// netlify/functions/strava-activities.js
exports.handler = async (event, context) => {
  console.log('=== Enhanced Strava Function ===');
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'POST method required' })
    };
  }

  try {
    // beforeとafter両方に対応
    const { token, before, after, per_page = 200 } = JSON.parse(event.body || '{}');
    
    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Token required' })
      };
    }
    
    console.log('Request params:', { before, after, per_page });
    
    // URL構築 - beforeとafter両方に対応
    let url = `https://www.strava.com/api/v3/athlete/activities?per_page=${per_page}`;
    
    if (before) {
      url += `&before=${before}`;
      console.log('Using BEFORE parameter:', before);
    }
    
    if (after) {
      url += `&after=${after}`;
      console.log('Using AFTER parameter:', after);
    }
    
    console.log('Strava API URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Strava response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Strava API error:', errorText);
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: `Strava API Error: ${response.status}`,
          message: errorText
        })
      };
    }
    
    const activities = await response.json();
    console.log('Activities received:', activities.length);
    
    // デバッグ情報追加
    if (activities.length > 0) {
      const firstDate = activities[0].start_date;
      const lastDate = activities[activities.length - 1].start_date;
      console.log('Date range:', firstDate, 'to', lastDate);
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        activities: activities,
        count: activities.length
      })
    };
    
  } catch (error) {
    console.error('Function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Server error',
        message: error.message
      })
    };
  }
};
