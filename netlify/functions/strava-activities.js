exports.handler = async (event, context) => {
  // CORS設定
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // OPTIONSリクエスト（プリフライト）への対応
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // POSTメソッドのみ許可
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // リクエストボディを解析
    const { token, userId } = JSON.parse(event.body);

    // 必須パラメータの確認
    if (!token || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Token and userId are required' }),
      };
    }

    // 過去30日間のアクティビティを取得（UNIX timestamp）
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    
    // Strava APIからアクティビティ一覧を取得
    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${thirtyDaysAgo}&per_page=50`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    // Strava APIのレスポンスを確認
    if (!activitiesResponse.ok) {
      const errorData = await activitiesResponse.json();
      console.error('Strava activities API error:', errorData);
      return {
        statusCode: activitiesResponse.status,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to fetch activities from Strava',
          details: errorData
        }),
      };
    }

    const activities = await activitiesResponse.json();
    
    // 各アクティビティを処理して必要なデータのみ抽出
    const processedActivities = activities.map(activity => ({
      id: activity.id,
      name: activity.name,
      sport_type: activity.sport_type,
      type: activity.type,
      start_date: activity.start_date,
      distance: activity.distance,
      moving_time: activity.moving_time,
      elapsed_time: activity.elapsed_time,
      total_elevation_gain: activity.total_elevation_gain,
      average_speed: activity.average_speed,
      max_speed: activity.max_speed,
      average_heartrate: activity.average_heartrate,
      max_heartrate: activity.max_heartrate,
      average_watts: activity.average_watts,
      max_watts: activity.max_watts,
      weighted_average_watts: activity.weighted_average_watts,
      kilojoules: activity.kilojoules,
      average_cadence: activity.average_cadence,
      suffer_score: activity.suffer_score,
      description: activity.description,
      trainer: activity.trainer,
      commute: activity.commute,
      manual: activity.manual,
      private: activity.private,
      flagged: activity.flagged,
      workout_type: activity.workout_type,
      upload_id_str: activity.upload_id_str,
      external_id: activity.external_id,
      // Firebase保存用のメタデータ
      userId: userId,
      syncedAt: new Date().toISOString()
    }));

    // 成功時のレスポンス
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        activities: processedActivities,
        count: processedActivities.length,
        message: `Successfully fetched ${processedActivities.length} activities`
      }),
    };

  } catch (error) {
    console.error('Strava activities function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
    };
  }
};
