// netlify/functions/strava-zones.js
// Strava APIから心拍ゾーンデータを取得
// 各ゾーンで過ごした時間と分布を取得

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

        const url = `https://www.strava.com/api/v3/activities/${activityId}/zones`;

        console.log('Fetching zones for activity:', activityId);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Strava API error:', response.status, errorText);
            
            // ゾーンデータがない場合（心拍計なしなど）
            if (response.status === 404) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        activityId: activityId,
                        zones: [],
                        hasZones: false,
                        message: 'このアクティビティにはゾーンデータがありません'
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

        const rawZones = await response.json();
        
        // ゾーンデータを整形
        const formattedZones = rawZones.map(zoneData => {
            const zoneType = zoneData.type; // 'heartrate' または 'power'
            const distributionBuckets = zoneData.distribution_buckets || [];
            
            // 各ゾーンのデータを整形
            const zones = distributionBuckets.map((bucket, index) => {
                const timeInZone = bucket.time; // 秒
                
                return {
                    zone: index + 1,
                    min: bucket.min,
                    max: bucket.max,
                    time: timeInZone,
                    time_formatted: formatDuration(timeInZone),
                    range: bucket.max === -1 
                        ? `${bucket.min}+` 
                        : `${bucket.min}-${bucket.max}`
                };
            });
            
            // 総時間
            const totalTime = zones.reduce((sum, z) => sum + z.time, 0);
            
            // パーセンテージを計算
            zones.forEach(zone => {
                zone.percentage = totalTime > 0 
                    ? ((zone.time / totalTime) * 100).toFixed(1) 
                    : 0;
            });
            
            // 分析データ
            const analysis = analyzeZones(zones, zoneType);
            
            return {
                type: zoneType,
                sensor_based: zoneData.sensor_based,
                custom_zones: zoneData.custom_zones,
                zones: zones,
                totalTime: totalTime,
                totalTime_formatted: formatDuration(totalTime),
                analysis: analysis
            };
        });

        // 心拍ゾーンとパワーゾーンを分離
        const heartrateZones = formattedZones.find(z => z.type === 'heartrate');
        const powerZones = formattedZones.find(z => z.type === 'power');

        console.log('Zones retrieved:', formattedZones.map(z => z.type));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                activityId: activityId,
                heartrateZones: heartrateZones || null,
                powerZones: powerZones || null,
                hasZones: formattedZones.length > 0,
                allZones: formattedZones
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

// ゾーン分析
function analyzeZones(zones, zoneType) {
    const analysis = {};
    
    // 最も長く過ごしたゾーン
    const maxTimeZone = zones.reduce((max, zone) => 
        zone.time > max.time ? zone : max
    , zones[0]);
    
    analysis.dominantZone = {
        zone: maxTimeZone.zone,
        time: maxTimeZone.time_formatted,
        percentage: maxTimeZone.percentage
    };
    
    // ゾーン別の説明（心拍の場合）
    if (zoneType === 'heartrate') {
        const zoneDescriptions = {
            1: { name: 'リカバリー', description: '非常に軽い運動、回復促進' },
            2: { name: '有酸素ベース', description: '脂肪燃焼、持久力向上' },
            3: { name: 'テンポ', description: '有酸素能力向上、レースペース' },
            4: { name: '閾値', description: '乳酸閾値向上、高強度' },
            5: { name: '最大', description: '最大心拍、スプリント・インターバル' }
        };
        
        zones.forEach(zone => {
            const desc = zoneDescriptions[zone.zone];
            if (desc) {
                zone.name = desc.name;
                zone.description = desc.description;
            }
        });
        
        // 強度分類
        const lowIntensityTime = zones.filter(z => z.zone <= 2)
            .reduce((sum, z) => sum + z.time, 0);
        const moderateIntensityTime = zones.filter(z => z.zone === 3)
            .reduce((sum, z) => sum + z.time, 0);
        const highIntensityTime = zones.filter(z => z.zone >= 4)
            .reduce((sum, z) => sum + z.time, 0);
        const totalTime = zones.reduce((sum, z) => sum + z.time, 0);
        
        if (totalTime > 0) {
            analysis.intensityDistribution = {
                low: {
                    time: formatDuration(lowIntensityTime),
                    percentage: ((lowIntensityTime / totalTime) * 100).toFixed(1)
                },
                moderate: {
                    time: formatDuration(moderateIntensityTime),
                    percentage: ((moderateIntensityTime / totalTime) * 100).toFixed(1)
                },
                high: {
                    time: formatDuration(highIntensityTime),
                    percentage: ((highIntensityTime / totalTime) * 100).toFixed(1)
                }
            };
            
            // トレーニング効果の推定
            const highIntensityRatio = highIntensityTime / totalTime;
            if (highIntensityRatio > 0.3) {
                analysis.trainingType = 'インターバル/高強度トレーニング';
            } else if (highIntensityRatio > 0.1) {
                analysis.trainingType = 'テンポ/閾値トレーニング';
            } else {
                analysis.trainingType = 'イージー/リカバリーラン';
            }
        }
    }
    
    // パワーゾーンの場合
    if (zoneType === 'power') {
        const zoneDescriptions = {
            1: { name: 'アクティブリカバリー', description: '回復走' },
            2: { name: '耐久力', description: 'ロングライド' },
            3: { name: 'テンポ', description: '中強度持続' },
            4: { name: '乳酸閾値', description: 'FTP付近' },
            5: { name: 'VO2max', description: '高強度インターバル' },
            6: { name: '無酸素', description: 'ショートインターバル' },
            7: { name: '神経筋', description: 'スプリント' }
        };
        
        zones.forEach(zone => {
            const desc = zoneDescriptions[zone.zone];
            if (desc) {
                zone.name = desc.name;
                zone.description = desc.description;
            }
        });
    }
    
    return analysis;
}
