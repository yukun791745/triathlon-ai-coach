// 複数のアクティビティの詳細データを一括取得
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
        const { token, activityIds } = JSON.parse(event.body);

        if (!token || !activityIds || !Array.isArray(activityIds)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'トークンとアクティビティIDの配列が必要です' })
            };
        }

        // レート制限を考慮して並列数を制限
        const BATCH_SIZE = 10; // 一度に10件ずつ取得
        const DELAY_MS = 1000; // 各バッチ間に1秒待機

        const results = [];
        const errors = [];

        // バッチ処理
        for (let i = 0; i < activityIds.length; i += BATCH_SIZE) {
            const batch = activityIds.slice(i, i + BATCH_SIZE);
            
            const batchPromises = batch.map(async (activityId) => {
                try {
                    const response = await fetch(
                        `https://www.strava.com/api/v3/activities/${activityId}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`API error: ${response.status}`);
                    }

                    const activity = await response.json();
                    return {
                        success: true,
                        id: activityId,
                        data: activity
                    };
                } catch (error) {
                    console.error(`Error fetching activity ${activityId}:`, error);
                    return {
                        success: false,
                        id: activityId,
                        error: error.message
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            
            batchResults.forEach(result => {
                if (result.success) {
                    results.push(result.data);
                } else {
                    errors.push({ id: result.id, error: result.error });
                }
            });

            // 次のバッチの前に待機（レート制限対策）
            if (i + BATCH_SIZE < activityIds.length) {
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                activities: results,
                errors: errors.length > 0 ? errors : undefined,
                summary: {
                    total: activityIds.length,
                    success: results.length,
                    failed: errors.length
                }
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
