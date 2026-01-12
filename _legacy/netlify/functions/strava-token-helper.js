// ========================================
// Stravaトークン管理ヘルパー
// activity-details.html の <script> タグ内に追加
// ========================================

// トークンの有効期限をチェックし、必要ならリフレッシュ
async function ensureValidToken() {
    const tokenData = JSON.parse(localStorage.getItem('strava_token') || '{}');
    
    if (!tokenData.access_token) {
        console.error('No access token found');
        return null;
    }
    
    // 有効期限をチェック（5分の余裕を持たせる）
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = tokenData.expires_at || 0;
    
    if (now < expiresAt - 300) {
        // まだ有効
        console.log('Token is still valid');
        return tokenData.access_token;
    }
    
    // 期限切れまたは間もなく切れる - リフレッシュが必要
    console.log('Token expired or expiring soon, refreshing...');
    
    if (!tokenData.refresh_token) {
        console.error('No refresh token found');
        // 再ログインが必要
        alert('セッションの有効期限が切れました。再度ログインしてください。');
        window.location.href = '/';  // ログインページへリダイレクト
        return null;
    }
    
    try {
        const response = await fetch('/.netlify/functions/strava-refresh-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                refresh_token: tokenData.refresh_token
            })
        });
        
        if (!response.ok) {
            throw new Error('Token refresh failed');
        }
        
        const newTokenData = await response.json();
        
        // 新しいトークンを保存
        const updatedTokenData = {
            ...tokenData,
            access_token: newTokenData.access_token,
            refresh_token: newTokenData.refresh_token,
            expires_at: newTokenData.expires_at
        };
        localStorage.setItem('strava_token', JSON.stringify(updatedTokenData));
        
        console.log('Token refreshed successfully');
        return newTokenData.access_token;
        
    } catch (error) {
        console.error('Token refresh error:', error);
        alert('セッションの更新に失敗しました。再度ログインしてください。');
        window.location.href = '/';
        return null;
    }
}

// Strava APIを呼び出すラッパー関数（自動リフレッシュ付き）
async function callStravaAPI(endpoint, body) {
    // まずトークンが有効か確認
    const token = await ensureValidToken();
    if (!token) {
        throw new Error('認証が必要です');
    }
    
    // APIを呼び出し
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, token: token })
    });
    
    // 401エラーの場合、トークンをリフレッシュして再試行
    if (response.status === 401) {
        console.log('Got 401, attempting token refresh...');
        
        // 強制的にリフレッシュ
        const tokenData = JSON.parse(localStorage.getItem('strava_token') || '{}');
        if (tokenData.refresh_token) {
            try {
                const refreshResponse = await fetch('/.netlify/functions/strava-refresh-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: tokenData.refresh_token })
                });
                
                if (refreshResponse.ok) {
                    const newTokenData = await refreshResponse.json();
                    
                    // 新しいトークンを保存
                    localStorage.setItem('strava_token', JSON.stringify({
                        ...tokenData,
                        access_token: newTokenData.access_token,
                        refresh_token: newTokenData.refresh_token,
                        expires_at: newTokenData.expires_at
                    }));
                    
                    // 新しいトークンで再試行
                    return fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...body, token: newTokenData.access_token })
                    });
                }
            } catch (error) {
                console.error('Retry after refresh failed:', error);
            }
        }
        
        // リフレッシュも失敗した場合
        alert('セッションの有効期限が切れました。再度ログインしてください。');
        window.location.href = '/';
        throw new Error('Authentication failed');
    }
    
    return response;
}

// ========================================
// 使用例：既存のコードを置き換える
// ========================================

// 変更前:
// const response = await fetch('/.netlify/functions/strava-streams', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ token: accessToken, activityId: activityId })
// });

// 変更後:
// const response = await callStravaAPI('/.netlify/functions/strava-streams', {
//     activityId: activityId
// });

// ========================================
// または、既存の関数を修正する場合の例
// ========================================

// fetchStreamsData関数の例
async function fetchStreamsDataWithAutoRefresh(activityId) {
    try {
        const response = await callStravaAPI('/.netlify/functions/strava-streams', {
            activityId: activityId
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching streams:', error);
        return null;
    }
}

// fetchLapsData関数の例
async function fetchLapsDataWithAutoRefresh(activityId) {
    try {
        const response = await callStravaAPI('/.netlify/functions/strava-laps', {
            activityId: activityId
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching laps:', error);
        return null;
    }
}
