// netlify/functions/strava-activities.js
// シンプル版：基本機能のみ

exports.handler = async (event, context) => {
  console.log('=== Simple Strava Function ===');
  
  // CORS設定
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // プリフライト対応
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
    // リクエスト解析
    const { token, after, per_page = 200 } = JSON.parse(event.body || '{}');
    
    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Token required' })
      };
    }

    console.log('Request params:', { after, per_page });

    // Strava API URL構築
    let url = `https://www.strava.com/api/v3/athlete/activities?per_page=${per_page}`;
    if (after) {
      url += `&after=${after}`;
    }

    console.log('Strava API URL:', url);

    // Strava API呼び出し
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
