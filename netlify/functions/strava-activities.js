// netlify/functions/strava-activities.js
exports.handler = async (event, context) => {
  // CORS ヘッダーの設定
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // プリフライトリクエストの処理
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { token, after, page = 1, per_page = 200, isFullSync = false, isIncremental = false } = JSON.parse(event.body);

    console.log('Function called with params:', {
      after: after,
      page: page,
      per_page: per_page,
      isFullSync: isFullSync,
      isIncremental: isIncremental,
      afterDate: after ? new Date(after * 1000).toISOString() : 'none'
    });

    // Strava API URL の構築（ページネーション対応）
    let url = `https://www.strava.com/api/v3/athlete/activities?per_page=${per_page}&page=${page}`;
    
    // after パラメータがある場合は追加
    if (after) {
      url += `&after=${after}`;
    }

    console.log('Strava API URL:', url);

    // Strava API 呼び出し
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Strava API Error:', response.status, errorText);
      
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
    
    console.log(`Page ${page} response: ${activities.length} activities`);
    
    if (activities.length > 0) {
      console.log('First activity:', activities[0].start_date, activities[0].name);
      console.log('Last activity:', activities[activities.length - 1].start_date, activities[activities.length - 1].name);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        activities: activities,
        page: page,
        per_page: per_page,
        count: activities.length
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
