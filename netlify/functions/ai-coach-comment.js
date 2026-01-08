// netlify/functions/ai-coach-comment.js
// テスト用の最小コード - まずこれで動作確認

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // OPTIONSリクエスト（CORS preflight）
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // POSTリクエスト
    if (event.httpMethod === 'POST') {
        try {
            // リクエストボディをパース
            const body = JSON.parse(event.body);
            
            // 環境変数の確認
            const hasApiKey = !!process.env.OPENAI_API_KEY;
            
            // テスト用の固定レスポンス
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    comment: "🎉 テスト成功！\n\nNetlify Functionは正常に動作しています。\n\n環境変数OPENAI_API_KEY: " + (hasApiKey ? "設定済み ✓" : "未設定 ✗") + "\n\n受信したアクティビティ: " + (body.activity ? body.activity.name || "名前なし" : "データなし"),
                    debug: {
                        hasApiKey: hasApiKey,
                        hasActivity: !!body.activity,
                        activityType: body.activity ? body.activity.sport_type : null
                    }
                })
            };
        } catch (error) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'パースエラー',
                    message: error.message
                })
            };
        }
    }

    // その他のメソッド
    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};
