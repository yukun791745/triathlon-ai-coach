// netlify/functions/ai-coach-comment.js
// 改善版v4: 共通コーチプロファイル統合、数値解釈基準追加、Few-shot品質向上

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
        const { 
            activity, 
            trainingStatus, 
            streamAnalysis,
            similarActivities,
            userQuestion,
            conversationHistory 
        } = JSON.parse(event.body);

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

        // トレーニング目的を推測
        const trainingType = inferTrainingType(activity, streamAnalysis);
        
        // データの信頼性を評価
        const dataReliability = assessDataReliability(activity, trainingStatus, streamAnalysis);
        
        // 実際に観察できる事実のみを抽出
        const observations = extractObservations(activity, streamAnalysis, trainingType);
        
        // システムプロンプト（改善版v4）
        const systemPrompt = buildSystemPrompt(!!userQuestion, trainingType, dataReliability);
        
        // ユーザーメッセージの構築
        const userMessage = buildUserMessage(activity, trainingStatus, streamAnalysis, similarActivities, userQuestion, trainingType, observations, dataReliability);

        const messages = [
            { role: 'system', content: systemPrompt }
        ];
        
        if (conversationHistory && conversationHistory.length > 0) {
            conversationHistory.forEach(function(msg) {
                messages.push(msg);
            });
        }
        
        messages.push({ role: 'user', content: userMessage });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + OPENAI_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: messages,
                max_tokens: 800,
                temperature: 0.65
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
                usage: data.usage,
                trainingType: trainingType
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

// ============================================
// ★ 改善版v4: システムプロンプト
// ============================================
function buildSystemPrompt(isQuestion, trainingType, dataReliability) {
    if (isQuestion) {
        // 質問への回答用（短縮版）
        return `あなたは「AIトライアスロンコーチ」です。運動生理学に精通し、選手の質問にデータを根拠に回答します。

【回答の原則】
- 選手の目標達成を応援する姿勢で回答
- 推測には「〜と思われます」「〜の可能性があります」と表現
- 難しい概念は噛み砕いて説明
- 具体的で実践的なアドバイスを心がける

250-350字程度で回答してください。`;
    }

    // 自動コメント用（完全版）
    var prompt = `あなたは「AIトライアスロンコーチ」です。運動生理学に精通し、スイム・バイク・ランのトレーニング、栄養、リカバリー、レース戦略、ケガと予防について専門的な知見を持っています。

【基本姿勢】
- 親しみやすく、プロフェッショナル
- ユーザーの目標達成を常に応援し励ます
- データに基づいた客観的な分析を行う
- 推測と事実を明確に区別する
- 難解な運動生理学の専門知識も分かりやすく噛み砕いて伝える
- 選手の自主性を尊重し、決めつけない

【数値の解釈基準】
■ 心拍ドリフト（同一ペースでの心拍上昇率）
- <5%: 優秀。安定した有酸素運動
- 5-10%: 正常範囲
- 10-15%: やや高め（暑さ、脱水、オーバーペースの可能性）
- >15%: 要注意

■ ペース変動係数（CV）
- <5%: 非常に安定
- 5-15%: 通常範囲
- >25%: インターバル系または大きな変動

■ 心拍ゾーン分布
- Z1-Z2が80%以上 → リカバリー/有酸素ベース向き
- Z3-Z4が50%以上 → テンポ/閾値トレーニング
- Z4-Z5が30%以上 → 高強度トレーニング

■ スイムDPS
- <1.0m: 改善の余地あり
- 1.0-1.4m: 一般的
- >1.4m: 効率的

`;

    // トレーニングタイプ別の評価観点を追加
    prompt += '【今回のトレーニングタイプ: ' + trainingType.label + '】\n';
    prompt += getTrainingTypeGuidance(trainingType.type) + '\n\n';

    prompt += `【コメント作成の原則】
1. まず、このトレーニングの「良かった点」を具体的に挙げて称える
2. データから読み取れる客観的な観察を述べる
3. 推測が含まれる場合は「〜かもしれません」「〜の可能性があります」と表現
4. 改善点や次への提案は、建設的かつ具体的に
5. トレーニングの意図が不明な場合は、選手に確認する質問を含める

【避けること】
- 箇条書きでの羅列（自然な文章で書く）
- CTL/ATL/TSBの数値を中心に据えた分析
- 異なる目的のトレーニング同士の単純比較
- 否定的な表現から始めること
- 「冒頭：」「本文：」などのラベル

【出力形式】
- 自然な日本語の段落形式
- 300-450字程度
- 絵文字は使わない`;

    return prompt;
}

// トレーニングタイプ別のガイダンス
function getTrainingTypeGuidance(type) {
    const guidance = {
        recovery: `■ リカバリー/イージーの評価観点
- Z1-Z2を維持できたか
- 心拍ドリフトは小さいか
- 主観的に楽だったか
- ペースが速すぎていないか`,

        long: `■ 有酸素ベース/ロングの評価観点
- Z2中心で走れたか
- 後半までペースを維持できたか
- 心拍ドリフトは10%以内か
- ネガティブスプリットができていれば称賛`,

        tempo: `■ テンポ/閾値の評価観点
- 設定強度（Z3-Z4）を維持できたか
- ペースの一貫性はあるか
- 目標とするペース/パワーに近いか`,

        interval: `■ インターバル/VO2maxの評価観点
- 各セットでZ4-Z5に到達できたか
- セット間で品質は維持できたか
- レスト中の心拍回復はどうか
- ペース変動が大きいのは正常`,

        high_intensity: `■ 高強度トレーニングの評価観点
- 目標強度に到達できたか
- 高強度区間の持続時間は適切か
- 回復のための低強度区間があるか`,

        race: `■ レース/タイムトライアルの評価観点
- 目標達成度
- ペーシング戦略の実行度
- 結果だけでなくプロセスも評価
- 次への学びと課題`,

        short: `■ 短めのトレーニングの評価観点
- 限られた時間で効果的な内容だったか
- 目的に合った強度だったか`,

        general: `■ 通常トレーニングの評価観点
- データから読み取れる特徴を観察
- トレーニングの意図を選手に確認することも有効`
    };
    
    return guidance[type] || guidance.general;
}

// ============================================
// トレーニング目的を推測
// ============================================
function inferTrainingType(activity, streamAnalysis) {
    const sportCategory = getSportCategory(activity.sport_type || activity.type);
    const name = (activity.name || '').toLowerCase();
    const durationMin = (activity.moving_time || 0) / 60;
    const distance = (activity.distance || 0) / 1000;
    
    // アクティビティ名からの推測（高確度）
    if (name.includes('インターバル') || name.includes('interval') || name.includes('vo2') || name.includes('スピード')) {
        return { type: 'interval', confidence: 'high', label: 'インターバル/スピード練習' };
    }
    if (name.includes('テンポ') || name.includes('tempo') || name.includes('閾値') || name.includes('threshold') || name.includes('lt')) {
        return { type: 'tempo', confidence: 'high', label: 'テンポ走/閾値走' };
    }
    if (name.includes('リカバリー') || name.includes('recovery') || name.includes('回復') || name.includes('イージー') || name.includes('easy') || name.includes('ジョグ') || name.includes('jog')) {
        return { type: 'recovery', confidence: 'high', label: 'リカバリー/イージー' };
    }
    if (name.includes('ロング') || name.includes('long') || name.includes('lsd') || name.includes('持久')) {
        return { type: 'long', confidence: 'high', label: 'ロング走/持久走' };
    }
    if (name.includes('レース') || name.includes('race') || name.includes('大会') || name.includes('本番')) {
        return { type: 'race', confidence: 'high', label: 'レース/大会' };
    }
    
    // ペース変動からの推測
    if (streamAnalysis && streamAnalysis.paceAnalysis) {
        const cv = parseFloat(streamAnalysis.paceAnalysis.variability);
        if (!isNaN(cv)) {
            if (cv > 25) {
                return { type: 'interval', confidence: 'medium', label: 'インターバル系（ペース変動大）', inferred: true };
            }
        }
    }
    
    // 心拍ゾーンからの推測
    if (streamAnalysis && streamAnalysis.heartRateAnalysis && streamAnalysis.heartRateAnalysis.zones) {
        const zones = streamAnalysis.heartRateAnalysis.zones;
        const z4z5 = (zones.z4 || 0) + (zones.z5 || 0);
        const z1z2 = (zones.z1 || 0) + (zones.z2 || 0);
        
        if (z1z2 > 85) {
            return { type: 'recovery', confidence: 'medium', label: 'リカバリー系（低強度中心）', inferred: true };
        }
        if (z4z5 > 50) {
            return { type: 'high_intensity', confidence: 'medium', label: '高強度トレーニング', inferred: true };
        }
    }
    
    // 距離/時間からの推測（ラン）
    if (sportCategory === 'run') {
        if (distance > 25 || durationMin > 120) {
            return { type: 'long', confidence: 'medium', label: 'ロング走（距離/時間から推測）', inferred: true };
        }
        if (distance < 8 && durationMin < 45) {
            return { type: 'short', confidence: 'low', label: '短めのラン', inferred: true };
        }
    }
    
    // バイク
    if (sportCategory === 'bike') {
        if (distance > 80 || durationMin > 180) {
            return { type: 'long', confidence: 'medium', label: 'ロングライド', inferred: true };
        }
    }
    
    // スイム
    if (sportCategory === 'swim') {
        if (distance > 3) {
            return { type: 'long', confidence: 'medium', label: '長距離スイム', inferred: true };
        }
    }
    
    return { type: 'general', confidence: 'low', label: '通常のトレーニング', inferred: true };
}

// ============================================
// データの信頼性を評価
// ============================================
function assessDataReliability(activity, trainingStatus, streamAnalysis) {
    const reliability = {
        hasHeartRate: !!activity.average_heartrate,
        hasPower: !!activity.average_watts,
        hasGPS: !!activity.start_latlng || activity.distance > 0,
        hasCadence: !!activity.average_cadence,
        hasTrainingStatus: !!(trainingStatus && trainingStatus.ctl),
        hasStreamData: !!(streamAnalysis && (streamAnalysis.paceAnalysis || streamAnalysis.heartRateAnalysis)),
        trainingStatusReliable: false,
        overallLevel: 'low'
    };
    
    // トレーニングステータスの信頼性判定
    if (trainingStatus && trainingStatus.ctl && trainingStatus.ctl >= 20) {
        reliability.trainingStatusReliable = true;
    }
    
    // 総合評価
    let score = 0;
    if (reliability.hasHeartRate) score += 2;
    if (reliability.hasPower) score += 2;
    if (reliability.hasGPS) score += 1;
    if (reliability.hasCadence) score += 1;
    if (reliability.hasStreamData) score += 2;
    
    if (score >= 6) {
        reliability.overallLevel = 'high';
    } else if (score >= 3) {
        reliability.overallLevel = 'medium';
    }
    
    return reliability;
}

// ============================================
// 観察できる事実を抽出
// ============================================
function extractObservations(activity, streamAnalysis, trainingType) {
    const observations = [];
    const sportCategory = getSportCategory(activity.sport_type || activity.type);
    
    // ペーシングの観察（インターバル以外）
    if (streamAnalysis && streamAnalysis.paceAnalysis && trainingType.type !== 'interval') {
        const pa = streamAnalysis.paceAnalysis;
        const splitDiff = parseFloat(pa.splitDiff);
        
        if (!isNaN(splitDiff)) {
            if (splitDiff > 5) {
                observations.push({
                    type: 'pacing',
                    fact: '後半のペースが' + Math.abs(splitDiff).toFixed(1) + '%上がっている（ネガティブスプリット）',
                    interpretation: 'ペース配分がうまくできている'
                });
            } else if (splitDiff < -10 && trainingType.type !== 'recovery') {
                observations.push({
                    type: 'pacing',
                    fact: '後半のペースが' + Math.abs(splitDiff).toFixed(1) + '%落ちている',
                    interpretation: null,
                    question: '意図的なビルドダウンでしたか？それとも後半きつくなりましたか？'
                });
            }
        }
    }
    
    // 心拍の観察
    if (streamAnalysis && streamAnalysis.heartRateAnalysis) {
        const hra = streamAnalysis.heartRateAnalysis;
        const drift = parseFloat(hra.drift);
        
        if (!isNaN(drift) && trainingType.type !== 'interval') {
            if (drift > 12) {
                observations.push({
                    type: 'heart_rate',
                    fact: '心拍ドリフトが' + drift.toFixed(1) + '%',
                    interpretation: '後半で心臓血管系への負荷が増加。暑さ、脱水、オーバーペースの可能性',
                    possibleFactors: ['気温', '脱水', 'ペース', '地形']
                });
            } else if (drift < 5 && activity.moving_time > 2400) {
                observations.push({
                    type: 'heart_rate',
                    fact: '40分以上で心拍ドリフトが' + drift.toFixed(1) + '%と小さい',
                    interpretation: '安定した有酸素運動ができている証拠'
                });
            }
        }
    }
    
    // スイムのストローク効率
    if (sportCategory === 'swim' && activity.laps && activity.laps.length > 0) {
        let totalDPS = 0;
        let validLaps = 0;
        
        activity.laps.forEach(function(lap) {
            if (lap.distance > 0 && lap.moving_time >= 10) {
                var strokes = lap.total_strokes;
                if (!strokes && lap.average_cadence && lap.moving_time) {
                    strokes = Math.round(lap.average_cadence * lap.moving_time / 60);
                }
                if (strokes && strokes > 0) {
                    var dps = lap.distance / strokes;
                    if (dps > 0.5 && dps < 3.0) {
                        totalDPS += dps;
                        validLaps++;
                    }
                }
            }
        });
        
        if (validLaps > 0) {
            var avgDPS = totalDPS / validLaps;
            var interpretation = null;
            if (avgDPS >= 1.4) {
                interpretation = 'ストローク効率が良い';
            } else if (avgDPS < 1.0) {
                interpretation = 'ストローク効率に改善の余地あり';
            }
            observations.push({
                type: 'swim_efficiency',
                fact: '平均DPS（1ストロークあたりの距離）は' + avgDPS.toFixed(2) + 'm',
                interpretation: interpretation
            });
        }
    }
    
    // ランのピッチ
    if (sportCategory === 'run' && activity.average_cadence) {
        var pitch = activity.average_cadence * 2;
        if (pitch > 0) {
            observations.push({
                type: 'run_cadence',
                fact: '平均ピッチは' + Math.round(pitch) + 'spm',
                interpretation: null
            });
        }
    }
    
    return observations;
}

// ============================================
// ユーザーメッセージ構築
// ============================================
function buildUserMessage(activity, trainingStatus, streamAnalysis, similarActivities, userQuestion, trainingType, observations, dataReliability) {
    var sportType = activity.sport_type || activity.type;
    var sportName = getSportName(sportType);
    var sportCategory = getSportCategory(sportType);
    var distance = activity.distance ? (activity.distance / 1000).toFixed(2) : 0;
    var durationMin = Math.round((activity.moving_time || activity.elapsed_time || 0) / 60);
    
    var message = '';
    
    // アクティビティ名を含める
    if (activity.name) {
        message += '## アクティビティ名: ' + activity.name + '\n\n';
    }
    
    // トレーニングタイプと信頼性情報
    message += '## トレーニング概要\n';
    message += '- 種目: ' + sportName + '\n';
    message += '- 推測されるタイプ: ' + trainingType.label + '（確度: ' + trainingType.confidence + '）\n';
    if (trainingType.inferred) {
        message += '  ※ データから推測。選手の意図と異なる可能性あり\n';
    }
    message += '\n';
    
    // 基本データ
    message += '## 基本データ\n';
    message += '- 日時: ' + new Date(activity.start_date).toLocaleString('ja-JP') + '\n';
    message += '- 距離: ' + distance + 'km / 時間: ' + durationMin + '分\n';
    
    if (activity.average_speed) {
        message += '- ペース: ' + formatPace(activity.average_speed, sportType) + '\n';
    }
    if (activity.average_heartrate) {
        message += '- 心拍: 平均' + Math.round(activity.average_heartrate) + 'bpm';
        if (activity.max_heartrate) {
            message += ' / 最大' + Math.round(activity.max_heartrate) + 'bpm';
        }
        message += '\n';
    }
    if (sportCategory === 'run' && activity.average_cadence) {
        var pitch = Math.round(activity.average_cadence * 2);
        message += '- ピッチ: ' + pitch + 'spm\n';
    }
    if (sportCategory === 'bike' && activity.average_watts) {
        message += '- パワー: ' + Math.round(activity.average_watts) + 'W\n';
    }
    if (activity.total_elevation_gain > 20) {
        message += '- 獲得標高: ' + Math.round(activity.total_elevation_gain) + 'm\n';
    }
    message += '\n';
    
    // 観察された事実
    if (observations.length > 0) {
        message += '## 観察された特徴\n';
        observations.forEach(function(obs) {
            message += '- ' + obs.fact;
            if (obs.interpretation) {
                message += ' → ' + obs.interpretation;
            }
            if (obs.question) {
                message += '\n  【確認したい点】' + obs.question;
            }
            message += '\n';
        });
        message += '\n';
    }
    
    // ペーシング詳細（インターバル以外）
    if (streamAnalysis && streamAnalysis.paceAnalysis && trainingType.type !== 'interval') {
        var pa = streamAnalysis.paceAnalysis;
        message += '## ペーシング\n';
        message += '前半 ' + pa.firstHalfPace + ' → 後半 ' + pa.secondHalfPace + '\n';
        if (pa.variability) {
            message += 'ペース変動係数: ' + pa.variability + '%\n';
        }
        message += '\n';
    }
    
    // 心拍詳細
    if (streamAnalysis && streamAnalysis.heartRateAnalysis) {
        var hra = streamAnalysis.heartRateAnalysis;
        message += '## 心拍データ\n';
        if (hra.drift) {
            message += '心拍ドリフト: ' + (hra.drift > 0 ? '+' : '') + hra.drift + '%\n';
        }
        if (hra.zones) {
            message += 'Zone分布: Z1=' + hra.zones.z1 + '% Z2=' + hra.zones.z2 + '% Z3=' + hra.zones.z3 + '% Z4=' + hra.zones.z4 + '% Z5=' + hra.zones.z5 + '%\n';
        }
        message += '\n';
    }
    
    // トレーニングステータス（参考程度に、信頼性が高い場合のみ詳細表示）
    if (trainingStatus && dataReliability.trainingStatusReliable) {
        message += '## コンディション指標（参考値）\n';
        message += 'CTL: ' + trainingStatus.ctl + ' / ATL: ' + trainingStatus.atl + ' / TSB: ' + trainingStatus.tsb + '\n';
        message += '※ これらの値は過去のデータ入力状況により精度が変わります\n\n';
    }
    
    // 類似トレーニング（同じタイプのみ比較）
    if (similarActivities && similarActivities.length > 0) {
        var comparableActivities = similarActivities.filter(function(sim) {
            var simType = inferTrainingTypeFromName(sim.name || '');
            return simType === trainingType.type || trainingType.type === 'general';
        });
        
        if (comparableActivities.length > 0) {
            message += '## 類似トレーニングとの比較\n';
            message += '（同じ種類のトレーニングと比較）\n';
            comparableActivities.slice(0, 2).forEach(function(sim, i) {
                var simDate = new Date(sim.start_date).toLocaleDateString('ja-JP');
                var simPace = formatPace(sim.average_speed, sportType);
                var simHr = sim.average_heartrate ? Math.round(sim.average_heartrate) + 'bpm' : '-';
                message += (i + 1) + '. ' + simDate + ': ' + (sim.distance/1000).toFixed(1) + 'km, ' + simPace + ', HR ' + simHr + '\n';
            });
            message += '\n';
        }
    }
    
    // 質問への回答または通常コメント
    if (userQuestion) {
        message += '---\n## 選手からの質問\n' + userQuestion + '\n\nこの質問に対して、上記データを参照しながら回答してください。';
    } else {
        message += '---\n';
        message += '上記のデータを踏まえて、このトレーニングについてコメントしてください。\n';
        message += '推測されるトレーニングタイプ（' + trainingType.label + '）を考慮し、そのタイプに適した観点で分析してください。\n';
        message += 'まず良かった点を称えてから、客観的な観察と建設的な提案を述べてください。\n';
        if (trainingType.inferred) {
            message += 'トレーニングの意図が不明確な場合は、選手に目的を確認する質問を含めてください。';
        }
    }
    
    return message;
}

// 名前からトレーニングタイプを簡易推測
function inferTrainingTypeFromName(name) {
    var n = (name || '').toLowerCase();
    if (n.includes('インターバル') || n.includes('interval') || n.includes('vo2') || n.includes('スピード')) return 'interval';
    if (n.includes('テンポ') || n.includes('tempo') || n.includes('閾値')) return 'tempo';
    if (n.includes('リカバリー') || n.includes('recovery') || n.includes('回復') || n.includes('イージー') || n.includes('easy') || n.includes('ジョグ')) return 'recovery';
    if (n.includes('ロング') || n.includes('long') || n.includes('lsd')) return 'long';
    if (n.includes('レース') || n.includes('race')) return 'race';
    return 'general';
}

// ============================================
// ユーティリティ関数
// ============================================
function getSportName(sportType) {
    var names = {
        'Run': 'ランニング',
        'TrailRun': 'トレイルラン',
        'VirtualRun': 'トレッドミル',
        'Ride': 'バイク',
        'VirtualRide': 'インドアバイク',
        'EBikeRide': 'E-Bike',
        'Swim': 'スイム',
        'WeightTraining': 'ウェイト',
        'Yoga': 'ヨガ',
        'Workout': 'ワークアウト'
    };
    return names[sportType] || sportType;
}

function getSportCategory(sportType) {
    if (sportType === 'Swim') return 'swim';
    if (sportType === 'Ride' || sportType === 'VirtualRide' || sportType === 'EBikeRide') return 'bike';
    if (sportType === 'Run' || sportType === 'TrailRun' || sportType === 'VirtualRun') return 'run';
    return 'other';
}

function formatPace(avgSpeed, sportType) {
    if (!avgSpeed || avgSpeed <= 0) return '-';
    
    if (sportType === 'Swim') {
        var pace = 100 / avgSpeed;
        var min = Math.floor(pace / 60);
        var sec = Math.round(pace % 60);
        return min + ':' + String(sec).padStart(2, '0') + '/100m';
    } else if (sportType && sportType.indexOf('Ride') !== -1) {
        return (avgSpeed * 3.6).toFixed(1) + 'km/h';
    } else {
        var pace = 1000 / avgSpeed;
        var min = Math.floor(pace / 60);
        var sec = Math.round(pace % 60);
        return min + ':' + String(sec).padStart(2, '0') + '/km';
    }
}
