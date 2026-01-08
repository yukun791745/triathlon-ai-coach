// netlify/functions/strava-streams.js
// Strava APIから時系列データ（Streams）を取得
// 心拍、ペース、標高、GPS座標などの時系列データを取得

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
        const { token, activityId, keys } = JSON.parse(event.body);

        if (!token || !activityId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'トークンとアクティビティIDが必要です' })
            };
        }

        // 取得するストリームの種類
        // デフォルトは全ての主要なストリーム
        const streamKeys = keys || [
            'time',           // 経過時間（秒）
            'distance',       // 累積距離（メートル）
            'latlng',         // GPS座標 [緯度, 経度]
            'altitude',       // 標高（メートル）
            'velocity_smooth', // 速度（m/s）- ペース計算用
            'heartrate',      // 心拍数（bpm）
            'cadence',        // ケイデンス（rpm/spm）
            'watts',          // パワー（W）- バイクのみ
            'temp',           // 気温（℃）
            'grade_smooth',   // 勾配（%）
            'moving'          // 移動中かどうか
        ];

        const keysParam = streamKeys.join(',');
        const url = `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=${keysParam}&key_type=time`;

        console.log('Fetching streams for activity:', activityId);
        console.log('Stream keys:', keysParam);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Strava API error:', response.status, errorText);
            
            // 404の場合はストリームデータがない（インドアなど）
            if (response.status === 404) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        activityId: activityId,
                        streams: {},
                        hasStreams: false,
                        message: 'このアクティビティにはストリームデータがありません（インドアアクティビティの可能性）'
                    })
                };
            }
            
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

        const rawStreams = await response.json();
        
        // ストリームデータを使いやすい形式に変換
        // Strava APIは [{type: 'heartrate', data: [...], ...}, ...] の形式で返す
        const streams = {};
        let dataPoints = 0;
        
        if (Array.isArray(rawStreams)) {
            rawStreams.forEach(stream => {
                streams[stream.type] = {
                    data: stream.data,
                    series_type: stream.series_type,
                    original_size: stream.original_size,
                    resolution: stream.resolution
                };
                if (stream.data && stream.data.length > dataPoints) {
                    dataPoints = stream.data.length;
                }
            });
        }

        // 統計情報を計算
        const stats = calculateStreamStats(streams);

        console.log('Streams retrieved:', Object.keys(streams));
        console.log('Data points:', dataPoints);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                activityId: activityId,
                streams: streams,
                hasStreams: Object.keys(streams).length > 0,
                dataPoints: dataPoints,
                availableStreams: Object.keys(streams),
                stats: stats
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

// ストリームデータから統計情報を計算
function calculateStreamStats(streams) {
    const stats = {};
    
    // 心拍統計
    if (streams.heartrate && streams.heartrate.data) {
        const hr = streams.heartrate.data.filter(v => v > 0);
        if (hr.length > 0) {
            stats.heartrate = {
                min: Math.min(...hr),
                max: Math.max(...hr),
                avg: Math.round(hr.reduce((a, b) => a + b, 0) / hr.length)
            };
        }
    }
    
    // 標高統計
    if (streams.altitude && streams.altitude.data) {
        const alt = streams.altitude.data;
        if (alt.length > 0) {
            let elevGain = 0;
            let elevLoss = 0;
            for (let i = 1; i < alt.length; i++) {
                const diff = alt[i] - alt[i-1];
                if (diff > 0) elevGain += diff;
                else elevLoss += Math.abs(diff);
            }
            stats.altitude = {
                min: Math.round(Math.min(...alt)),
                max: Math.round(Math.max(...alt)),
                start: Math.round(alt[0]),
                end: Math.round(alt[alt.length - 1]),
                gain: Math.round(elevGain),
                loss: Math.round(elevLoss)
            };
        }
    }
    
    // 速度統計（ペース計算用）
    if (streams.velocity_smooth && streams.velocity_smooth.data) {
        const vel = streams.velocity_smooth.data.filter(v => v > 0);
        if (vel.length > 0) {
            const avgVel = vel.reduce((a, b) => a + b, 0) / vel.length;
            stats.velocity = {
                min_mps: Math.min(...vel),
                max_mps: Math.max(...vel),
                avg_mps: avgVel,
                // ペース（分/km）に変換
                avg_pace_per_km: avgVel > 0 ? (1000 / avgVel / 60) : 0,
                max_pace_per_km: Math.min(...vel) > 0 ? (1000 / Math.max(...vel) / 60) : 0
            };
        }
    }
    
    // パワー統計（バイク）
    if (streams.watts && streams.watts.data) {
        const watts = streams.watts.data.filter(v => v > 0);
        if (watts.length > 0) {
            stats.power = {
                min: Math.min(...watts),
                max: Math.max(...watts),
                avg: Math.round(watts.reduce((a, b) => a + b, 0) / watts.length)
            };
        }
    }
    
    // ケイデンス統計
    if (streams.cadence && streams.cadence.data) {
        const cad = streams.cadence.data.filter(v => v > 0);
        if (cad.length > 0) {
            stats.cadence = {
                min: Math.min(...cad),
                max: Math.max(...cad),
                avg: Math.round(cad.reduce((a, b) => a + b, 0) / cad.length)
            };
        }
    }
    
    // 勾配統計
    if (streams.grade_smooth && streams.grade_smooth.data) {
        const grade = streams.grade_smooth.data;
        if (grade.length > 0) {
            stats.grade = {
                min: Math.min(...grade).toFixed(1),
                max: Math.max(...grade).toFixed(1),
                avg: (grade.reduce((a, b) => a + b, 0) / grade.length).toFixed(1)
            };
        }
    }
    
    return stats;
}
