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
    const { code } = JSON.parse(event.body);

    // 必須パラメータの確認
    if (!code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Authorization code is required' }),
      };
    }

    // 環境変数からStrava設定を取得
    const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
    const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
    
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Strava credentials not configured' }),
      };
    }

    // Strava APIにトークン交換リクエスト
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code'
      }),
    });

    // Strava APIのレスポンスを確認
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Strava token exchange error:', errorData);
      return {
        statusCode: tokenResponse.status,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to exchange authorization code',
          details: errorData
        }),
      };
    }

    // 成功時のレスポンス
    const tokenData = await tokenResponse.json();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        athlete: tokenData.athlete
      }),
    };

  } catch (error) {
    console.error('Strava auth function error:', error);
    
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
