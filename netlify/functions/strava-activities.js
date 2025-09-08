// netlify/functions/strava-activities.js
// 修正版：エラーハンドリング強化とデバッグログ追加

exports.handler = async (event, context) => {
  console.log('=== Strava Activities Function Called ===');
  console.log('HTTP Method:', event.httpMethod);
  console.log('Headers:', event.headers);
  
  // CORS ヘッダーの設定
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // プリフライトリクエストの処理
  if (event.httpMethod === 'OPTIONS') {
    console.log('CORS preflight request');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  // POSTリクエストのみ許可
  if (event.httpMethod !== 'POST') {
    console.log('Invalid method:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' })
    };
  }

  try {
    // リクエストボディをパース
    let requestData;
    try {
      console.log('Raw body:', event.body);
      requestData = JSON.parse(event.body || '{}');
      console.log('Parsed request data:', requestData);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid JSON in request body',
          message: parseError.message 
        })
      };
    }

    const { 
      token, 
      after, 
      before, 
      per_page = 200, 
      isFullSync = false 
    } = requestData;

    // 必須パラメータのチェック
    if (!token) {
      console.error('Missing token parameter');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required parameter: token' 
        })
      };
    }

    // パラメータをログ出力（デバッグ用）
    console.log('=== Function Parameters ===');
    console.log('after:', after, after ? new Date(after * 1000).toISOString() : 'none');
    console.log('before:', before, before ? new Date(before * 1000).toISOString() : 'none');
    console.log('per_page:', per_page);
    console.log('isFullSync:', isFullSync);

    // Strava API URL の構築
    let url = `https://www.strava.com/api/v3/athlete/activities?per_page=${per_page}`;
    
    // after パラメータ（この時刻以降のアクティビティ）
    if (after) {
      url += `&after=${after}`;
    }
    
    // before パラメータ（この時刻以前のアクティビティ）
    if (before) {
      url += `&before=${before}`;
    }

    console.log('=== Strava API Call ===');
    console.log('URL:', url);

    // Strava API への実際の呼び出し
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Triathlon-Coach/1.0'
      }
    });

    console.log('Strava API Response Status:', response.status);
    console.log('Strava API Response Headers:', Object.fromEntries(response.headers.entries()));

    // Strava APIからのレスポンス処理
    if (!response.ok) {
      const errorText = await response.text();
      console.error('=== Strava API Error ===');
      console.error('Status:', response.status);
      console.error('Status Text:', response.statusText);
      console.error('Error Body:', errorText);
      
      // Strava APIのエラーをそのまま返す
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: `Strava API Error: ${response.status} ${response.statusText}`,
          message: errorText,
          stravaStatus: response.status,
          url: url
        })
      };
    }

    // 成功時のレスポンス処理
    const activities = await response.json();
    
    // レスポンス情報をログ出力
    console.log('=== Strava API Success ===');
    console.log('Activities Count:', activities.length);
    
    if (activities.length > 0) {
      console.log('First Activity:', {
        id: activities[0].id,
        name: activities[0].name,
        date: activities[0].start_date,
        type: activities[0].sport_type || activities[0].type
      });
      
      console.log('Last Activity:', {
        id: activities[activities.length - 1].id,
        name: activities[activities.length - 1].name,
        date: activities[activities.length - 1].start_date,
        type: activities[activities.length - 1].sport_type || activities[activities.length - 1].type
      });
    } else {
      console.log('No activities returned');
    }

    // 成功レスポンスを返す
    const responseBody = {
      success: true,
      activities: activities,
      meta: {
        count: activities.length,
        after: after,
        before: before,
        per_page: per_page,
        isFullSync: isFullSync,
        url: url
      },
      timestamp: new Date().toISOString()
    };

    console.log('=== Function Success ===');
    console.log('Returning', activities.length, 'activities');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseBody)
    };

  } catch (error) {
    // サーバーエラーの処理
    console.error('=== Function Error ===');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        name: error.name,
        timestamp: new Date().toISOString()
      })
    };
  }
};
