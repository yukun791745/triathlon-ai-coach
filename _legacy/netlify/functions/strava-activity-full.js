// netlify/functions/strava-activity-full.js
// Strava APIからアクティビティの全データを一括取得
// 詳細情報、ストリーム（時系列）、ラップ、ゾーンを一度に取得

exports.handler = async (event) => {
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
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { token, activityId, include } = JSON.parse(event.body);

        if (!token || !activityId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'トークンとアクティビティIDが必要です' })
            };
        }

        // 取得するデータの種類（デフォルトは全て）
        const includeOptions = include || {
            detail: true,
            streams: true,
            laps: true,
            zones: true
        };

        console.log('Fetching full data for activity:', activityId);
        console.log('Include options:', includeOptions);

        const result = {
            success: true,
            activityId: activityId,
            fetchedAt: new Date().toISOString()
        };

        // 並列でAPIリクエストを実行
        const promises = [];
        
        if (includeOptions.detail) {
            promises.push(
                fetchWithTimeout(
                    `https://www.strava.com/api/v3/activities/${activityId}`,
                    token
                ).then(data => ({ type: 'detail', data }))
                .catch(err => ({ type: 'detail', error: err.message }))
            );
        }
        
        if (includeOptions.streams) {
            const streamKeys = 'time,distance,latlng,altitude,velocity_smooth,heartrate,cadence,watts,temp,grade_smooth';
            promises.push(
                fetchWithTimeout(
                    `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=${streamKeys}&key_type=time`,
                    token
                ).then(data => ({ type: 'streams', data }))
                .catch(err => ({ type: 'streams', error: err.message }))
            );
        }
        
        if (includeOptions.laps) {
            promises.push(
                fetchWithTimeout(
                    `https://www.strava.com/api/v3/activities/${activityId}/laps`,
                    token
                ).then(data => ({ type: 'laps', data }))
                .catch(err => ({ type: 'laps', error: err.message }))
            );
        }
        
        if (includeOptions.zones) {
            promises.push(
                fetchWithTimeout(
                    `https://www.strava.com/api/v3/activities/${activityId}/zones`,
                    token
                ).then(data => ({ type: 'zones', data }))
                .catch(err => ({ type: 'zones', error: err.message }))
            );
        }

        // 全てのリクエストを待機
        const responses = await Promise.all(promises);

        // 結果を整形
        responses.forEach(response => {
            if (response.error) {
                result[response.type] = { error: response.error };
            } else {
                switch (response.type) {
                    case 'detail':
                        result.detail = formatActivityDetail(response.data);
                        break;
                    case 'streams':
                        result.streams = formatStreams(response.data);
                        break;
                    case 'laps':
                        result.laps = formatLaps(response.data);
                        break;
                    case 'zones':
                        result.zones = formatZones(response.data);
                        break;
                }
            }
        });

        // サマリー情報を追加
        result.summary = generateSummary(result);

        console.log('Full data retrieved successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message 
            })
        };
    }
};

// タイムアウト付きfetch
async function fetchWithTimeout(url, token, timeout = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            if (response.status === 404) {
                return null; // データなし
            }
            throw new Error(`API Error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// アクティビティ詳細を整形
function formatActivityDetail(data) {
    if (!data) return null;
    
    return {
        // 基本情報
        id: data.id,
        name: data.name,
        type: data.type,
        sport_type: data.sport_type,
        start_date: data.start_date,
        start_date_local: data.start_date_local,
        timezone: data.timezone,
        
        // 距離・時間
        distance: data.distance,
        distance_km: (data.distance / 1000).toFixed(2),
        moving_time: data.moving_time,
        elapsed_time: data.elapsed_time,
        moving_time_formatted: formatDuration(data.moving_time),
        elapsed_time_formatted: formatDuration(data.elapsed_time),
        
        // 速度・ペース
        average_speed: data.average_speed,
        max_speed: data.max_speed,
        average_speed_kmh: (data.average_speed * 3.6).toFixed(1),
        max_speed_kmh: (data.max_speed * 3.6).toFixed(1),
        pace_per_km: data.average_speed > 0 ? formatPace(1000 / data.average_speed / 60) : null,
        
        // 標高
        total_elevation_gain: data.total_elevation_gain,
        elev_high: data.elev_high,
        elev_low: data.elev_low,
        
        // 心拍
        has_heartrate: data.has_heartrate,
        average_heartrate: data.average_heartrate,
        max_heartrate: data.max_heartrate,
        
        // パワー（バイク）
        device_watts: data.device_watts,
        average_watts: data.average_watts,
        weighted_average_watts: data.weighted_average_watts,
        max_watts: data.max_watts,
        
        // ケイデンス
        average_cadence: data.average_cadence,
        
        // その他
        calories: data.calories,
        kilojoules: data.kilojoules,
        device_name: data.device_name,
        gear: data.gear ? { id: data.gear.id, name: data.gear.name } : null,
        
        // 位置情報
        start_latlng: data.start_latlng,
        end_latlng: data.end_latlng,
        
        // フラグ
        trainer: data.trainer,
        commute: data.commute,
        manual: data.manual,
        private: data.private,
        
        // 写真
        total_photo_count: data.total_photo_count,
        
        // 説明
        description: data.description
    };
}

// ストリームデータを整形
function formatStreams(data) {
    if (!data || !Array.isArray(data)) return { hasData: false };
    
    const streams = {};
    let dataPoints = 0;
    
    data.forEach(stream => {
        streams[stream.type] = stream.data;
        if (stream.data && stream.data.length > dataPoints) {
            dataPoints = stream.data.length;
        }
    });
    
    return {
        hasData: Object.keys(streams).length > 0,
        dataPoints: dataPoints,
        availableTypes: Object.keys(streams),
        data: streams,
        
        // グラフ用に時間ベースのデータを整形
        chartData: streams.time ? streams.time.map((time, i) => ({
            time: time,
            distance: streams.distance ? streams.distance[i] : null,
            heartrate: streams.heartrate ? streams.heartrate[i] : null,
            altitude: streams.altitude ? streams.altitude[i] : null,
            velocity: streams.velocity_smooth ? streams.velocity_smooth[i] : null,
            cadence: streams.cadence ? streams.cadence[i] : null,
            watts: streams.watts ? streams.watts[i] : null,
            grade: streams.grade_smooth ? streams.grade_smooth[i] : null,
            latlng: streams.latlng ? streams.latlng[i] : null
        })) : []
    };
}

// ラップデータを整形
function formatLaps(data) {
    if (!data || !Array.isArray(data)) return { hasData: false, laps: [] };
    
    const laps = data.map((lap, index) => {
        let pacePerKm = null;
        if (lap.distance > 0 && lap.moving_time > 0) {
            pacePerKm = (lap.moving_time / 60) / (lap.distance / 1000);
        }
        
        return {
            lap_index: index + 1,
            name: lap.name,
            distance: lap.distance,
            distance_km: (lap.distance / 1000).toFixed(2),
            moving_time: lap.moving_time,
            moving_time_formatted: formatDuration(lap.moving_time),
            pace_per_km: pacePerKm,
            pace_formatted: pacePerKm ? formatPace(pacePerKm) : null,
            average_heartrate: lap.average_heartrate,
            max_heartrate: lap.max_heartrate,
            total_elevation_gain: lap.total_elevation_gain,
            average_watts: lap.average_watts,
            average_cadence: lap.average_cadence
        };
    });
    
    return {
        hasData: laps.length > 0,
        count: laps.length,
        laps: laps
    };
}

// ゾーンデータを整形
function formatZones(data) {
    if (!data || !Array.isArray(data)) return { hasData: false };
    
    const result = { hasData: data.length > 0 };
    
    data.forEach(zoneData => {
        const buckets = zoneData.distribution_buckets || [];
        const totalTime = buckets.reduce((sum, b) => sum + b.time, 0);
        
        const zones = buckets.map((bucket, index) => ({
            zone: index + 1,
            min: bucket.min,
            max: bucket.max,
            time: bucket.time,
            time_formatted: formatDuration(bucket.time),
            percentage: totalTime > 0 ? ((bucket.time / totalTime) * 100).toFixed(1) : 0
        }));
        
        result[zoneData.type] = {
            sensor_based: zoneData.sensor_based,
            custom_zones: zoneData.custom_zones,
            zones: zones,
            totalTime: totalTime,
            totalTime_formatted: formatDuration(totalTime)
        };
    });
    
    return result;
}

// サマリー情報を生成
function generateSummary(result) {
    const summary = {
        hasDetail: !!result.detail,
        hasStreams: result.streams?.hasData || false,
        hasLaps: result.laps?.hasData || false,
        hasZones: result.zones?.hasData || false,
        hasGPS: result.streams?.data?.latlng?.length > 0 || false,
        hasHeartrate: result.streams?.data?.heartrate?.length > 0 || false,
        hasPower: result.streams?.data?.watts?.length > 0 || false
    };
    
    // データの品質スコア（0-100）
    let qualityScore = 0;
    if (summary.hasDetail) qualityScore += 20;
    if (summary.hasStreams) qualityScore += 20;
    if (summary.hasLaps) qualityScore += 15;
    if (summary.hasZones) qualityScore += 15;
    if (summary.hasGPS) qualityScore += 15;
    if (summary.hasHeartrate) qualityScore += 10;
    if (summary.hasPower) qualityScore += 5;
    
    summary.dataQualityScore = qualityScore;
    
    return summary;
}

// ユーティリティ関数
function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatPace(paceMinPerKm) {
    if (!paceMinPerKm || paceMinPerKm <= 0) return '-';
    const minutes = Math.floor(paceMinPerKm);
    const seconds = Math.round((paceMinPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}
