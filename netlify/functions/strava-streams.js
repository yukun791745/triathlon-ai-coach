// netlify/functions/strava-streams.js
// Strava APIからアクティビティのストリームデータを取得

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

        // 取得するストリームの種類
        const streamTypes = [
            'time',
            'distance', 
            'heartrate',
            'cadence',
            'watts',
            'velocity_smooth',
            'altitude',
            'grade_smooth',
            'moving',
            'latlng'
        ];

        const url = `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=${streamTypes.join(',')}&key_by_type=true`;
        
        console.log('Fetching streams for activity:', activityId);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Strava API error:', response.status, errorText);
            
            if (response.status === 404) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        hasStreams: false,
                        message: 'このアクティビティにはストリームデータがありません'
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

        const streams = await response.json();
        
        // ストリームデータを整形
        const formattedStreams = {};
        for (const [key, value] of Object.entries(streams)) {
            formattedStreams[key] = value;
        }
        
        console.log('Streams retrieved:', Object.keys(formattedStreams));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                hasStreams: Object.keys(formattedStreams).length > 0,
                streams: formattedStreams
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
