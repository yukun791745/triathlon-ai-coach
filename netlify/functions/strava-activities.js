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
    const { token, userId, activityId } = JSON.parse(event.body);

    // 必須パラメータの確認
    if (!token || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Token and userId are required' }),
      };
    }

    // 特定のアクティビティの詳細データを取得する場合
    if (activityId) {
      return await getActivityDetail(token, activityId, headers);
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
      normalized_power: activity.normalized_power,
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

// アクティビティの詳細データを取得する関数
async function getActivityDetail(token, activityId, headers) {
  try {
    // アクティビティの基本情報を取得
    const activityResponse = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!activityResponse.ok) {
      throw new Error('Failed to fetch activity details');
    }

    const activity = await activityResponse.json();

    // Streams（時系列データ）を取得
    const streamsResponse = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/streams/heartrate,watts,time,distance,velocity_smooth,cadence`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    let streams = null;
    if (streamsResponse.ok) {
      streams = await streamsResponse.json();
    }

    // ゾーン分析を実行
    const zoneAnalysis = calculateZoneAnalysis(streams, activity);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        activity: activity,
        streams: streams,
        zoneAnalysis: zoneAnalysis,
        detailedMetrics: calculateDetailedMetrics(activity, streams)
      }),
    };

  } catch (error) {
    console.error('Activity detail fetch error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch activity details',
        message: error.message 
      }),
    };
  }
}

// ゾーン分析を計算する関数
function calculateZoneAnalysis(streams, activity) {
  if (!streams) return null;

  const result = {
    heartRateZones: null,
    powerZones: null
  };

  // 心拍ゾーン分析
  const hrStream = streams.find(s => s.type === 'heartrate');
  if (hrStream && hrStream.data) {
    result.heartRateZones = calculateHeartRateZones(hrStream.data, activity.moving_time);
  }

  // パワーゾーン分析（バイクの場合）
  const powerStream = streams.find(s => s.type === 'watts');
  if (powerStream && powerStream.data && (activity.sport_type === 'Ride' || activity.type === 'Ride')) {
    result.powerZones = calculatePowerZones(powerStream.data, activity.moving_time);
  }

  return result;
}

// 心拍ゾーン計算（一般的な年齢ベース計算）
function calculateHeartRateZones(heartRateData, totalTime) {
  // 仮の最大心拍数計算（実際にはユーザー設定が必要）
  const maxHR = 190; // 仮の値、実際にはユーザーのプロフィールから取得

  const zones = [
    { name: 'Zone 5', min: Math.round(maxHR * 0.9), max: maxHR, time: 0 },
    { name: 'Zone 4', min: Math.round(maxHR * 0.8), max: Math.round(maxHR * 0.89), time: 0 },
    { name: 'Zone 3', min: Math.round(maxHR * 0.7), max: Math.round(maxHR * 0.79), time: 0 },
    { name: 'Zone 2', min: Math.round(maxHR * 0.6), max: Math.round(maxHR * 0.69), time: 0 },
    { name: 'Zone 1', min: 0, max: Math.round(maxHR * 0.59), time: 0 }
  ];

  // 各データポイントをゾーンに分類
  heartRateData.forEach(hr => {
    if (hr && hr > 0) {
      for (let zone of zones) {
        if (hr >= zone.min && hr <= zone.max) {
          zone.time++;
          break;
        }
      }
    }
  });

  // 時間を秒からパーセンテージに変換
  zones.forEach(zone => {
    zone.percentage = totalTime > 0 ? ((zone.time / heartRateData.length) * 100).toFixed(1) : 0;
    zone.timeFormatted = formatZoneTime(zone.time, heartRateData.length, totalTime);
  });

  return zones;
}

// パワーゾーン計算
function calculatePowerZones(powerData, totalTime) {
  // 仮のFTP値（実際にはユーザー設定が必要）
  const ftp = 250; // 仮の値

  const zones = [
    { name: 'Zone 5', min: Math.round(ftp * 1.06), max: 9999, time: 0 },
    { name: 'Zone 4', min: Math.round(ftp * 0.91), max: Math.round(ftp * 1.05), time: 0 },
    { name: 'Zone 3', min: Math.round(ftp * 0.76), max: Math.round(ftp * 0.90), time: 0 },
    { name: 'Zone 2', min: Math.round(ftp * 0.56), max: Math.round(ftp * 0.75), time: 0 },
    { name: 'Zone 1', min: 0, max: Math.round(ftp * 0.55), time: 0 }
  ];

  // 各データポイントをゾーンに分類
  powerData.forEach(power => {
    if (power && power > 0) {
      for (let zone of zones) {
        if (power >= zone.min && power <= zone.max) {
          zone.time++;
          break;
        }
      }
    }
  });

  // パーセンテージ計算
  zones.forEach(zone => {
    zone.percentage = totalTime > 0 ? ((zone.time / powerData.length) * 100).toFixed(1) : 0;
    zone.timeFormatted = formatZoneTime(zone.time, powerData.length, totalTime);
  });

  return zones;
}

// ゾーン時間をフォーマット
function formatZoneTime(dataPoints, totalDataPoints, totalTimeSeconds) {
  const timeInSeconds = Math.round((dataPoints / totalDataPoints) * totalTimeSeconds);
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = timeInSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

// 詳細指標計算
function calculateDetailedMetrics(activity, streams) {
  const metrics = {
    sportType: activity.sport_type || activity.type,
    distance: activity.distance,
    movingTime: activity.moving_time,
    elapsedTime: activity.elapsed_time
  };

  // 種目別の計算
  if (activity.sport_type === 'Swim') {
    // スイム指標
    metrics.pace = calculateSwimPace(activity.distance, activity.moving_time);
    metrics.avgHeartRate = activity.average_heartrate;
  } else if (activity.sport_type === 'Ride') {
    // バイク指標
    metrics.avgSpeed = activity.average_speed ? (activity.average_speed * 3.6).toFixed(1) : null;
    metrics.avgCadence = activity.average_cadence;
    metrics.avgPower = activity.average_watts;
    metrics.normalizedPower = activity.normalized_power || activity.weighted_average_watts;
    metrics.avgHeartRate = activity.average_heartrate;
  } else if (activity.sport_type === 'Run') {
    // ラン指標
    metrics.pace = calculateRunPace(activity.distance, activity.moving_time);
    metrics.avgCadence = activity.average_cadence;
    metrics.avgHeartRate = activity.average_heartrate;
    // ストライドは計算で求める（ペース + ケイデンスから）
    if (activity.average_cadence && activity.average_speed) {
      metrics.avgStride = calculateStride(activity.average_speed, activity.average_cadence);
    }
  }

  return metrics;
}

// スイムペース計算（分:秒/100m）
function calculateSwimPace(distance, timeSeconds) {
  if (!distance || !timeSeconds) return null;
  const paceSeconds = (timeSeconds / distance) * 100;
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ランペース計算（分:秒/km）
function calculateRunPace(distance, timeSeconds) {
  if (!distance || !timeSeconds) return null;
  const paceSeconds = timeSeconds / (distance / 1000);
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ストライド計算
function calculateStride(speedMs, cadence) {
  if (!speedMs || !cadence) return null;
  // ストライド = 速度(m/min) / (ケイデンス * 2)
  const speedMPerMin = speedMs * 60;
  const stride = speedMPerMin / (cadence * 2);
  return (stride * 100).toFixed(1); // cm単位
}
