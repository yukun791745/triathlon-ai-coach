// netlify/functions/strava-refresh-token.js
// Stravaアクセストークンをリフレッシュする

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
        const { refresh_token } = JSON.parse(event.body);

        if (!refresh_token) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'リフレッシュトークンが必要です' })
            };
        }

        const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
        const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

        if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Strava認証情報が設定されていません' })
            };
        }

        console.log('Refreshing Strava token...');

        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: STRAVA_CLIENT_ID,
                client_secret: STRAVA_CLIENT_SECRET,
                refresh_token: refresh_token,
                grant_type: 'refresh_token'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Strava token refresh error:', response.status, errorText);
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ 
                    error: 'トークンリフレッシュに失敗しました',
                    details: errorText
                })
            };
        }

        const tokenData = await response.json();
        
        console.log('Token refreshed successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_at: tokenData.expires_at,
                expires_in: tokenData.expires_in
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
