// Strava APIから個別アクティビティの詳細データを取得
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
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

        // Strava APIからアクティビティ詳細を取得
        const response = await fetch(
            `https://www.strava.com/api/v3/activities/${activityId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

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

        const activity = await response.json();

        // 必要な情報を抽出
        const detailData = {
            id: activity.id,
            name: activity.name,
            type: activity.type,
            sport_type: activity.sport_type,
            start_date: activity.start_date,
            distance: activity.distance,
            moving_time: activity.moving_time,
            elapsed_time: activity.elapsed_time,
            total_elevation_gain: activity.total_elevation_gain,
            
            // 心拍データ
            average_heartrate: activity.average_heartrate,
            max_heartrate: activity.max_heartrate,
            has_heartrate: activity.has_heartrate,
            
            // パワーデータ（バイク）
            average_watts: activity.average_watts,
            weighted_average_watts: activity.weighted_average_watts,
            max_watts: activity.max_watts,
            
            // その他の詳細
            calories: activity.calories,
            device_name: activity.device_name,
            
            // 心拍Zone（Stravaが計算したもの）
            // 注: これはアスリートの設定に基づいて計算される
            // custom_zones: true の場合はカスタムZone、false の場合は年齢ベース
        };

        // Stravaの心拍Zoneデータがある場合は追加
        // 注: このデータは必ずしも全てのアクティビティに含まれるわけではない
        if (activity.stats_visibility && activity.stats_visibility.includes('heartrate')) {
            // 心拍Zoneの詳細データ
            // 実際のAPIレスポンスに応じて調整が必要
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                activity: detailData,
                raw: activity // デバッグ用に全データも返す
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};
