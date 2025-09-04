// netlify/functions/strava-activities.js
exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        const { token } = JSON.parse(event.body);
        
        if (!token) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Access token is required' }),
            };
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const after = Math.floor(thirtyDaysAgo.getTime() / 1000);

        const activitiesResponse = await fetch(
            `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=200`, 
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                },
            }
        );

        if (!activitiesResponse.ok) {
            const error = await activitiesResponse.text();
            return {
                statusCode: activitiesResponse.status,
                headers,
                body: JSON.stringify({ 
                    error: 'Failed to fetch activities from Strava',
                    details: error,
                    status: activitiesResponse.status
                }),
            };
        }

        const activities = await activitiesResponse.json();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                activities: activities,
                count: activities.length,
            }),
        };

    } catch (error) {
        console.error('Activities fetch error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error', 
                details: error.message 
            }),
        };
    }
};
