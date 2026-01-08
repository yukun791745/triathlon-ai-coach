// netlify/functions/ai-coach-comment.js
// OpenAI APIを使用してAIコーチのコメントを生成

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
        const { activity, metrics, trainingStatus, userQuestion } = JSON.parse(event.body);

        if (!activity) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'アクティビティデータが必要です' })
            };
        }

        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        
        if (!OPENAI_API_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'OpenAI APIキーが設定されていません' })
            };
        }

        // システムプロンプト
        const systemPrompt = `あなたは経験豊富なトライアスロンコーチです。運動生理学の専門知識を持ちながらも、親しみやすく励ましの言葉をかけるスタイルで選手をサポートします。

コメントの特徴：
- 運動生理学的な観点から専門的な分析を行う
- しかし難しい言葉を使いすぎず、選手が理解しやすい表現を心がける
- 励ましと具体的なアドバイスをバランスよく含める
- 絵文字は控えめに使用（1-2個程度）
- 日本語で300-500字程度で回答

分析に含める内容（該当する場合）：
1. 当該アクティビティの全体評価
2. 過去トレンドとの比較（データがある場合）
3. フィットネス改善効果の解説
4. 現在のCTL/ATL/TSBから見たステータス分析
5. ハードセッションの場合は回復に向けたアドバイス
6. 明日以降の運動強度や休息の提案`;

        // ユーザーメッセージの構築
        let userMessage = buildUserMessage(activity, metrics, trainingStatus, userQuestion);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API error:', errorData);
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ 
                    error: 'AI APIエラー',
                    details: errorData.error?.message || 'Unknown error'
                })
            };
        }

        const data = await response.json();
        const comment = data.choices[0]?.message?.content || 'コメントを生成できませんでした';

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                comment: comment,
                usage: data.usage
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

function buildUserMessage(activity, metrics, trainingStatus, userQuestion) {
    const sportType = activity.sport_type || activity.type;
    const distance = activity.distance ? (activity.distance / 1000).toFixed(2) : 0;
    const duration = formatDuration(activity.moving_time || activity.elapsed_time);
    
    let message = `## 今回のアクティビティ
- 種目: ${getSportName(sportType)}
- 名前: ${activity.name || '無題'}
- 日時: ${new Date(activity.start_date).toLocaleString('ja-JP')}
- 距離: ${distance} km
- 時間: ${duration}
- TSS: ${activity.tss || '不明'}
`;

    // メトリクス情報
    if (activity.average_heartrate) {
        message += `- 平均心拍: ${Math.round(activity.average_heartrate)} bpm\n`;
    }
    if (activity.max_heartrate) {
        message += `- 最大心拍: ${Math.round(activity.max_heartrate)} bpm\n`;
    }
    if (activity.average_speed) {
        message += `- 平均ペース/速度: ${formatPace(activity.average_speed, sportType)}\n`;
    }
    if (activity.average_watts) {
        message += `- 平均パワー: ${Math.round(activity.average_watts)} W\n`;
    }
    if (activity.weighted_average_watts) {
        message += `- NP: ${Math.round(activity.weighted_average_watts)} W\n`;
    }
    if (activity.average_cadence) {
        if (sportType === 'Run' || sportType === 'TrailRun') {
            message += `- ピッチ: ${Math.round(activity.average_cadence * 2)} spm\n`;
        } else {
            message += `- ケイデンス: ${Math.round(activity.average_cadence)} rpm\n`;
        }
    }
    if (activity.total_elevation_gain) {
        message += `- 獲得標高: ${Math.round(activity.total_elevation_gain)} m\n`;
    }

    // トレーニングステータス
    if (trainingStatus) {
        message += `\n## 現在のトレーニングステータス
- Fitness (CTL): ${trainingStatus.ctl || '--'}
- Fatigue (ATL): ${trainingStatus.atl || '--'}
- Form (TSB): ${trainingStatus.tsb || '--'}
`;
        if (trainingStatus.ctlTrend !== undefined) {
            message += `- CTL変化（7日間）: ${trainingStatus.ctlTrend > 0 ? '+' : ''}${trainingStatus.ctlTrend}\n`;
        }
    }

    // 追加の質問がある場合
    if (userQuestion) {
        message += `\n## 選手からの質問
${userQuestion}

上記の質問に対して、アクティビティデータを踏まえて回答してください。`;
    } else {
        message += `\n上記のアクティビティについて、コーチとしてのコメントをお願いします。`;
    }

    return message;
}

function getSportName(sportType) {
    const names = {
        'Run': 'ランニング',
        'TrailRun': 'トレイルラン',
        'VirtualRun': 'バーチャルラン',
        'Ride': 'サイクリング',
        'VirtualRide': 'バーチャルライド',
        'EBikeRide': 'E-Bike',
        'Swim': 'スイム',
        'WeightTraining': 'ウェイトトレーニング',
        'Yoga': 'ヨガ',
        'Workout': 'ワークアウト'
    };
    return names[sportType] || sportType;
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}時間${minutes}分`;
    }
    return `${minutes}分${secs}秒`;
}

function formatPace(avgSpeed, sportType) {
    if (!avgSpeed || avgSpeed <= 0) return '-';
    
    if (sportType === 'Swim') {
        const pace = 100 / avgSpeed;
        const min = Math.floor(pace / 60);
        const sec = Math.round(pace % 60);
        return `${min}:${String(sec).padStart(2, '0')}/100m`;
    } else if (sportType === 'Ride' || sportType === 'VirtualRide' || sportType === 'EBikeRide') {
        return `${(avgSpeed * 3.6).toFixed(1)} km/h`;
    } else {
        const pace = 1000 / avgSpeed;
        const min = Math.floor(pace / 60);
        const sec = Math.round(pace % 60);
        return `${min}:${String(sec).padStart(2, '0')}/km`;
    }
}
