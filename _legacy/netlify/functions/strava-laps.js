// netlify/functions/strava-laps.js
// Strava APIからラップデータを取得
// 各ラップの距離、時間、ペース、心拍などの詳細情報

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
        const { token, activityId } = JSON.parse(event.body);

        if (!token || !activityId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'トークンとアクティビティIDが必要です' })
            };
        }

        const url = `https://www.strava.com/api/v3/activities/${activityId}/laps`;

        console.log('Fetching laps for activity:', activityId);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Strava API error:', response.status, errorText);
            
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ 
                    error: 'Strava APIエラー',
                    status: response.status,
                    details: errorText
                })
            };
        }

        const rawLaps = await response.json();
        
        // ラップデータを整形
        const laps = rawLaps.map((lap, index) => {
            // ペース計算（分/km）
            let pacePerKm = null;
            if (lap.distance > 0 && lap.moving_time > 0) {
                pacePerKm = (lap.moving_time / 60) / (lap.distance / 1000);
            }
            
            // 速度計算（km/h）
            let speedKmh = null;
            if (lap.distance > 0 && lap.moving_time > 0) {
                speedKmh = (lap.distance / 1000) / (lap.moving_time / 3600);
            }
            
            return {
                lap_index: index + 1,
                id: lap.id,
                name: lap.name,
                
                // 距離・時間
                distance: lap.distance,                    // メートル
                distance_km: (lap.distance / 1000).toFixed(2),
                moving_time: lap.moving_time,              // 秒
                elapsed_time: lap.elapsed_time,            // 秒
                moving_time_formatted: formatDuration(lap.moving_time),
                elapsed_time_formatted: formatDuration(lap.elapsed_time),
                
                // ペース・速度
                pace_per_km: pacePerKm,                    // 分/km
                pace_formatted: pacePerKm ? formatPace(pacePerKm) : null,
                average_speed: lap.average_speed,          // m/s
                max_speed: lap.max_speed,                  // m/s
                speed_kmh: speedKmh ? speedKmh.toFixed(1) : null,
                
                // 心拍
                average_heartrate: lap.average_heartrate,
                max_heartrate: lap.max_heartrate,
                
                // 標高
                total_elevation_gain: lap.total_elevation_gain,
                elev_high: lap.elev_high,
                elev_low: lap.elev_low,
                
                // パワー（バイク）
                average_watts: lap.average_watts,
                
                // ケイデンス
                average_cadence: lap.average_cadence,
                
                // 開始位置
                start_index: lap.start_index,
                end_index: lap.end_index,
                
                // 時刻
                start_date: lap.start_date,
                start_date_local: lap.start_date_local
            };
        });

        // ラップ間の比較データを計算
        const lapAnalysis = analyzeLaps(laps);

        console.log('Laps retrieved:', laps.length);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                activityId: activityId,
                laps: laps,
                lapCount: laps.length,
                analysis: lapAnalysis
            })
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

// 秒を時:分:秒形式に変換
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

// ペースをmm:ss/km形式に変換
function formatPace(paceMinPerKm) {
    if (!paceMinPerKm || paceMinPerKm <= 0) return '-';
    const minutes = Math.floor(paceMinPerKm);
    const seconds = Math.round((paceMinPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}

// ラップ分析
function analyzeLaps(laps) {
    if (laps.length === 0) return null;
    
    // ペースがあるラップのみ抽出
    const lapsWithPace = laps.filter(l => l.pace_per_km && l.pace_per_km > 0);
    
    const analysis = {
        totalLaps: laps.length,
        totalDistance: laps.reduce((sum, l) => sum + (l.distance || 0), 0),
        totalTime: laps.reduce((sum, l) => sum + (l.moving_time || 0), 0)
    };
    
    if (lapsWithPace.length > 0) {
        const paces = lapsWithPace.map(l => l.pace_per_km);
        const fastestPace = Math.min(...paces);
        const slowestPace = Math.max(...paces);
        const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;
        
        analysis.pace = {
            fastest: formatPace(fastestPace),
            slowest: formatPace(slowestPace),
            average: formatPace(avgPace),
            fastestLapIndex: lapsWithPace.find(l => l.pace_per_km === fastestPace)?.lap_index,
            slowestLapIndex: lapsWithPace.find(l => l.pace_per_km === slowestPace)?.lap_index,
            variance: ((slowestPace - fastestPace) / avgPace * 100).toFixed(1) + '%'
        };
    }
    
    // 心拍分析
    const lapsWithHR = laps.filter(l => l.average_heartrate);
    if (lapsWithHR.length > 0) {
        const hrs = lapsWithHR.map(l => l.average_heartrate);
        analysis.heartrate = {
            min: Math.min(...hrs),
            max: Math.max(...hrs),
            average: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length)
        };
    }
    
    // 標高分析
    const totalElevGain = laps.reduce((sum, l) => sum + (l.total_elevation_gain || 0), 0);
    if (totalElevGain > 0) {
        analysis.elevation = {
            totalGain: Math.round(totalElevGain)
        };
    }
    
    // ネガティブスプリット判定（後半が前半より速いか）
    if (lapsWithPace.length >= 2) {
        const midPoint = Math.floor(lapsWithPace.length / 2);
        const firstHalfPaces = lapsWithPace.slice(0, midPoint).map(l => l.pace_per_km);
        const secondHalfPaces = lapsWithPace.slice(midPoint).map(l => l.pace_per_km);
        
        const firstHalfAvg = firstHalfPaces.reduce((a, b) => a + b, 0) / firstHalfPaces.length;
        const secondHalfAvg = secondHalfPaces.reduce((a, b) => a + b, 0) / secondHalfPaces.length;
        
        analysis.splitAnalysis = {
            firstHalfAvgPace: formatPace(firstHalfAvg),
            secondHalfAvgPace: formatPace(secondHalfAvg),
            isNegativeSplit: secondHalfAvg < firstHalfAvg,
            difference: formatPace(Math.abs(secondHalfAvg - firstHalfAvg))
        };
    }
    
    return analysis;
}
