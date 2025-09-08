// netlify/functions/strava-activities.js
// 修正版：時間範囲分割とページネーション対応

exports.handler = async (event, context) => {
  // CORS ヘッダーの設定
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // プリフライトリクエストの処理
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  // POSTリクエストのみ許可
  if (event.httpMethod !== 'POST') {
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
      requestData = JSON.parse(event.body || '{}');
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
      page = 1, 
      per_page = 200, 
      isFullSync = false, 
      isIncremental = false 
    } = requestData;

    // 必須パラメータのチェック
    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required parameter: token' 
        })
      };
    }

    // パラメータをログ出力（デバッグ用）
    console.log('Strava Activities Function called with params:', {
      after: after,
      afterDate: after ? new Date(after * 1000).toISOString() : 'none',
      before: before,
      beforeDate: before ? new Date(before * 1000).toISOString() : 'none',
      page: page,
      per_page: per_page,
      isFullSync: isFullSync,
      isIncremental: isIncremental
    });

    // Strava API URL の構築
    let url = `https://www.strava.com/api/v3/athlete/activities?per_page=${per_page}&page=${page}`;
    
    // after パラメータ（この時刻以降のアクティビティ）
    if (after) {
      url += `&after=${after}`;
    }
    
    // before パラメータ（この時刻以前のアクティビティ）
    if (before) {
      url += `&before=${before}`;
    }

    console.log('Strava API URL:', url);

    // Strava API への実際の呼び出し
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Triathlon-Coach/1.0'
      }
    });

    // Strava APIからのレスポンス処理
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Strava API Error:', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        url: url
      });
      
      // Strava APIのエラーをそのまま返す
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: `Strava API Error: ${response.status} ${response.statusText}`,
          message: errorText,
          stravaStatus: response.status
        })
      };
    }

    // 成功時のレスポンス処理
    const activities = await response.json();
    
    // レスポンス情報をログ出力
    console.log(`Strava API Response - Page ${page}:`, {
      activitiesCount: activities.length,
      firstActivity: activities[0] ? {
        id: activities[0].id,
        name: activities[0].name,
        date: activities[0].start_date,
        type: activities[0].sport_type || activities[0].type
      } : null,
      lastActivity: activities[activities.length - 1] ? {
        id: activities[activities.length - 1].id,
        name: activities[activities.length - 1].name,
        date: activities[activities.length - 1].start_date,
        type: activities[activities.length - 1].sport_type || activities[activities.length - 1].type
      } : null
    });

    // 成功レスポンスを返す
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        activities: activities,
        meta: {
          page: page,
          per_page: per_page,
          count: activities.length,
          after: after,
          before: before,
          isFullSync: isFullSync,
          isIncremental: isIncremental
        },
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    // サーバーエラーの処理
    console.error('Function execution error:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// 補助関数：日付を人間が読める形式に変換
function formatDate(timestamp) {
  if (!timestamp) return 'none';
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

// 補助関数：Unix タイムスタンプの検証
function isValidTimestamp(timestamp) {
  if (!timestamp) return true; // null/undefined は有効（省略可能）
  const num = Number(timestamp);
  return !isNaN(num) && num > 0 && num < 9999999999; // 妥当な範囲
}
