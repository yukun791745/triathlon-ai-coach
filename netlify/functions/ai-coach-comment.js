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
        const systemPrompt = `あなたは経験豊富なトライアスロンコーチです。運動生理学、スポーツ科学の専門知識を持ちながらも、親しみやすく励ましの言葉をかけるスタイルで選手をサポートします。

## コメントのスタイル
- 選手に直接語りかけるような親しみやすい口調（「〜ですね」「〜しましょう」）
- 専門用語は使いつつも、必要に応じて簡単な説明を添える
- 具体的な数値に基づいた客観的な分析
- ポジティブな点を先に伝え、改善点は建設的に提案
- 絵文字は見出し的に1-2個使用可

## 必ず含める分析項目（該当するものすべて）

### 1. セッション総評（必須）
- このトレーニングの目的と達成度
- 強度レベルの評価（Zone分布から）
- 良かった点を具体的に

### 2. 生理学的効果の解説（必須）
- このセッションで得られる適応効果
- 心肺機能、筋持久力、乳酸閾値などへの影響
- TSSと負荷の観点からの分析

### 3. パフォーマンス分析（データがある場合）
- ペース/パワーの安定性
- 心拍数とペースの関係（心拍ドリフトの有無）
- ケイデンス/ピッチの効率性
- ネガティブ/ポジティブスプリットの傾向

### 4. 現在のコンディション評価（CTL/ATL/TSBがある場合）
- Fitness（CTL）レベルの評価
- 疲労度（ATL）の状況
- Form（TSB）から見たパフォーマンス準備状態
- 今のトレーニングフェーズの推測

### 5. リカバリーと次のステップ（必須）
- このセッション後の推奨回復時間
- 明日以降2-3日の推奨トレーニング強度
- 栄養・睡眠に関するワンポイントアドバイス

### 6. 長期的な視点（可能であれば）
- 継続した場合の期待される適応
- 次に取り組むべきトレーニング課題

## 文字数
400-600字程度（質問への回答時は300-400字）

## 注意点
- データに基づかない推測は避ける
- 無理な追い込みを推奨しない
- 怪我のリスクがある場合は警告する`;

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
                max_tokens: 1500,
                temperature: 0.75
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
    const durationMinutes = (activity.moving_time || activity.elapsed_time || 0) / 60;
    
    let message = `## 📊 アクティビティ概要
- **種目**: ${getSportName(sportType)}
- **名前**: ${activity.name || '無題'}
- **日時**: ${new Date(activity.start_date).toLocaleString('ja-JP')}
- **距離**: ${distance} km
- **時間**: ${duration}（${durationMinutes.toFixed(0)}分）
- **TSS**: ${activity.tss || '不明'}
`;

    // 心拍データ
    if (activity.average_heartrate || activity.max_heartrate) {
        message += `\n## 💓 心拍データ\n`;
        if (activity.average_heartrate) {
            message += `- 平均心拍: ${Math.round(activity.average_heartrate)} bpm\n`;
        }
        if (activity.max_heartrate) {
            message += `- 最大心拍: ${Math.round(activity.max_heartrate)} bpm\n`;
        }
        // 心拍予備量の使用率を推定（最大心拍190, 安静時60と仮定）
        if (activity.average_heartrate) {
            const hrReservePercent = ((activity.average_heartrate - 60) / (190 - 60) * 100).toFixed(0);
            message += `- 推定心拍予備量使用率: 約${hrReservePercent}%\n`;
        }
    }

    // ペース/速度データ
    if (activity.average_speed) {
        message += `\n## ⏱️ ペース/速度\n`;
        message += `- 平均: ${formatPace(activity.average_speed, sportType)}\n`;
        if (activity.max_speed) {
            message += `- 最高: ${formatPace(activity.max_speed, sportType)}\n`;
        }
    }

    // パワーデータ（バイク）
    if (activity.average_watts || activity.weighted_average_watts) {
        message += `\n## ⚡ パワーデータ\n`;
        if (activity.average_watts) {
            message += `- 平均パワー: ${Math.round(activity.average_watts)} W\n`;
        }
        if (activity.weighted_average_watts) {
            message += `- NP (Normalized Power): ${Math.round(activity.weighted_average_watts)} W\n`;
        }
        if (activity.average_watts && activity.weighted_average_watts) {
            const vi = (activity.weighted_average_watts / activity.average_watts).toFixed(2);
            message += `- VI (Variability Index): ${vi}\n`;
        }
        if (activity.max_watts) {
            message += `- 最大パワー: ${Math.round(activity.max_watts)} W\n`;
        }
    }

    // ケイデンス/ピッチ
    if (activity.average_cadence) {
        message += `\n## 🔄 ケイデンス/ピッチ\n`;
        if (sportType === 'Run' || sportType === 'TrailRun' || sportType === 'VirtualRun') {
            message += `- 平均ピッチ: ${Math.round(activity.average_cadence * 2)} spm\n`;
        } else {
            message += `- 平均ケイデンス: ${Math.round(activity.average_cadence)} rpm\n`;
        }
    }

    // 標高データ
    if (activity.total_elevation_gain && activity.total_elevation_gain > 10) {
        message += `\n## ⛰️ 標高\n`;
        message += `- 獲得標高: ${Math.round(activity.total_elevation_gain)} m\n`;
        if (activity.elev_high) {
            message += `- 最高標高: ${Math.round(activity.elev_high)} m\n`;
        }
        if (activity.elev_low) {
            message += `- 最低標高: ${Math.round(activity.elev_low)} m\n`;
        }
    }

    // カロリー
    if (activity.kilojoules) {
        const calories = Math.round(activity.kilojoules * 0.239); // kJをkcalに変換
        message += `\n## 🔥 エネルギー\n`;
        message += `- 消費カロリー: 約${calories} kcal\n`;
    }

    // トレーニングステータス（CTL/ATL/TSB）
    if (trainingStatus && (trainingStatus.ctl || trainingStatus.atl || trainingStatus.tsb !== undefined)) {
        message += `\n## 📈 現在のトレーニングステータス\n`;
        message += `- **Fitness (CTL)**: ${trainingStatus.ctl || '--'}\n`;
        message += `- **Fatigue (ATL)**: ${trainingStatus.atl || '--'}\n`;
        message += `- **Form (TSB)**: ${trainingStatus.tsb || '--'}\n`;
        
        if (trainingStatus.ctlTrend !== undefined) {
            const trendText = trainingStatus.ctlTrend > 0 ? `+${trainingStatus.ctlTrend}（上昇中）` : 
                              trainingStatus.ctlTrend < 0 ? `${trainingStatus.ctlTrend}（低下中）` : '変化なし';
            message += `- CTL変化（7日間）: ${trendText}\n`;
        }
        
        // TSBの状態を説明
        if (trainingStatus.tsb !== undefined) {
            let tsbStatus = '';
            if (trainingStatus.tsb >= 25) tsbStatus = '非常にフレッシュ（レース向け）';
            else if (trainingStatus.tsb >= 5) tsbStatus = 'フレッシュ（好調）';
            else if (trainingStatus.tsb >= -10) tsbStatus = '通常の状態';
            else if (trainingStatus.tsb >= -30) tsbStatus = '疲労蓄積中';
            else tsbStatus = '過度の疲労（要休養）';
            message += `- 状態: ${tsbStatus}\n`;
        }
    }

    // TSSからセッション強度を判定
    if (activity.tss) {
        message += `\n## 💪 セッション強度評価\n`;
        let intensityLevel = '';
        if (activity.tss < 50) intensityLevel = '低強度（リカバリー/イージー）';
        else if (activity.tss < 100) intensityLevel = '中強度（有酸素ベース）';
        else if (activity.tss < 150) intensityLevel = '中〜高強度（テンポ/閾値）';
        else if (activity.tss < 250) intensityLevel = '高強度（ハードセッション）';
        else intensityLevel = '非常に高強度（レース/キーワークアウト）';
        message += `- TSS ${activity.tss} → ${intensityLevel}\n`;
        
        // 推定回復時間
        let recoveryHours = activity.tss < 50 ? 12 : activity.tss < 100 ? 24 : activity.tss < 150 ? 36 : activity.tss < 250 ? 48 : 72;
        message += `- 推定回復時間: 約${recoveryHours}時間\n`;
    }

    // Lapデータがある場合
    if (activity.laps && activity.laps.length > 1) {
        message += `\n## 📋 Lap情報\n`;
        message += `- Lap数: ${activity.laps.length}\n`;
        
        // 最初と最後のLapを比較（ネガティブ/ポジティブスプリット）
        const firstLap = activity.laps[0];
        const lastLap = activity.laps[activity.laps.length - 1];
        if (firstLap.average_speed && lastLap.average_speed) {
            const firstPace = 1000 / firstLap.average_speed / 60;
            const lastPace = 1000 / lastLap.average_speed / 60;
            const diff = lastPace - firstPace;
            if (Math.abs(diff) > 0.1) {
                const splitType = diff < 0 ? 'ネガティブスプリット（後半ペースアップ）' : 'ポジティブスプリット（後半ペースダウン）';
                message += `- スプリット傾向: ${splitType}\n`;
            }
        }
    }

    // 追加の質問がある場合
    if (userQuestion) {
        message += `\n---\n## ❓ 選手からの質問\n${userQuestion}\n\n上記の質問に対して、このアクティビティのデータを踏まえて具体的に回答してください。`;
    } else {
        message += `\n---\n上記のデータを分析し、トライアスロンコーチとして多角的なコメントをお願いします。`;
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
