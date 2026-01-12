// netlify/functions/ai-coach-comment.js
// 改善版v5: セッションタイプ選択による断定的コメント

// セッション評価基準（session-types.jsと同期）
const SESSION_EVALUATION = {
    // スイム
    swim_drill_focus: {
        purpose: 'フォーム改善・技術習得',
        focus: 'ストローク効率（DPS）、フォームの一貫性',
        goodSigns: ['DPSが維持/向上', '心拍Z1-Z2で技術に集中'],
        concerns: ['後半でDPS低下', '強度が上がりすぎ']
    },
    swim_drill_endurance: {
        purpose: 'テクニック確認＋有酸素ベース構築',
        focus: 'メインセットのペース安定性、心拍Z2維持',
        goodSigns: ['Z2維持', 'ペース安定', 'ドリルの動きをメインで実践'],
        concerns: ['オーバーペースでZ3以上', '後半ペースダウン']
    },
    swim_drill_speed: {
        purpose: 'テクニック確認＋スピード向上',
        focus: '高強度セットでのペース、セット間の維持',
        goodSigns: ['目標ペース達成', 'セット間でタイム維持', 'フォーム維持'],
        concerns: ['後半タイム低下', 'フォーム崩れ']
    },
    swim_endurance: {
        purpose: '有酸素能力向上・泳ぎ込み',
        focus: 'ペース安定性、心拍ドリフト、総距離',
        goodSigns: ['Z2で安定', '心拍ドリフト10%以内', 'ペース維持'],
        concerns: ['心拍ドリフト大', '後半ペースダウン']
    },
    swim_threshold: {
        purpose: '乳酸処理能力向上',
        focus: 'CSSペースの維持、心拍Z3-Z4',
        goodSigns: ['CSSペース±3秒/100m', 'セット間ペース維持', 'Z3-Z4維持'],
        concerns: ['ペースばらつき', '後半ペースダウン']
    },
    swim_interval: {
        purpose: 'スピード向上・無酸素能力強化',
        focus: '各本のタイム、レスト中の回復',
        goodSigns: ['設定タイムクリア', 'セット間タイム維持', 'レストで回復'],
        concerns: ['後半タイム低下', '回復不十分']
    },
    swim_ow: {
        purpose: 'レース実践・オープンウォーター適応',
        focus: 'ヘッドアップ頻度、直進性',
        goodSigns: ['ヘッドアップしてもペース維持', '直進できた'],
        concerns: ['大幅ペースダウン', '蛇行']
    },
    swim_recovery: {
        purpose: '疲労回復・血流促進',
        focus: '心拍Z1維持、主観的な楽さ',
        goodSigns: ['Z1維持', '楽に泳げた'],
        concerns: ['強度上がりすぎ']
    },
    swim_test: {
        purpose: '現状把握・CSS/閾値測定',
        focus: 'オールアウト、ペーシング',
        goodSigns: ['全力出し切り', '適切なペース配分'],
        concerns: ['前半突っ込みすぎ', '力出し切れず']
    },

    // バイク
    bike_endurance: {
        purpose: '有酸素ベース構築・脂肪燃焼効率向上',
        focus: 'Z2維持、心拍ドリフト、ケイデンス安定',
        goodSigns: ['Z2維持', '心拍ドリフト10%以内', 'ケイデンス安定'],
        concerns: ['登りでZ3-Z4', '心拍ドリフト大']
    },
    bike_tempo: {
        purpose: 'FTP向上・持久力強化',
        focus: 'FTP88-94%維持、心拍Z3-Z4',
        goodSigns: ['スイートスポット維持', 'Z3-Z4', 'パワー維持'],
        concerns: ['パワー低下', 'FTP超過']
    },
    bike_threshold: {
        purpose: 'FTP向上・閾値耐性強化',
        focus: 'FTP±3%維持、持続時間',
        goodSigns: ['FTP維持', 'Z4安定', 'ペダリング滑らか'],
        concerns: ['パワー維持できず', 'Z5突入']
    },
    bike_vo2max: {
        purpose: 'VO2max向上・高強度耐性',
        focus: '各セットのパワー維持、心拍Z5到達',
        goodSigns: ['FTP106-120%達成', 'セット間パワー維持', 'Z5到達'],
        concerns: ['パワー大幅低下', '強度不足']
    },
    bike_technique_interval: {
        purpose: 'ペダリング技術向上＋高強度トレーニング',
        focus: 'ケイデンスドリルの実行、インターバルのパワー',
        goodSigns: ['ドリル実行', 'インターバルでパワー出せた'],
        concerns: ['ドリルで疲労', 'ケイデンス不安定']
    },
    bike_zwift_workout: {
        purpose: 'Zwiftメニューの完遂・計画的トレーニング',
        focus: 'ワークアウト完遂率、各セグメントの達成度',
        goodSigns: ['完遂', '目標パワー達成'],
        concerns: ['中断', 'パワー乖離']
    },
    bike_hill: {
        purpose: '登坂力向上・パワーウェイトレシオ改善',
        focus: '登りでのパワー維持、W/kg',
        goodSigns: ['パワー維持', 'シッティング/ダンシング使い分け'],
        concerns: ['パワー低下', 'ケイデンス低下']
    },
    bike_brick: {
        purpose: 'バイク→ラン移行適応',
        focus: 'バイク後半のパワー維持、ラン移行',
        goodSigns: ['後半パワー維持', 'T2スムーズ', 'ラン脚動いた'],
        concerns: ['バイクで追い込みすぎ', 'ラン脚動かず']
    },
    bike_recovery: {
        purpose: '疲労回復・アクティブレスト',
        focus: 'Z1維持、低パワー',
        goodSigns: ['Z1維持', '高ケイデンス', '楽だった'],
        concerns: ['強度上がりすぎ']
    },
    bike_test: {
        purpose: 'FTP測定・現状把握',
        focus: 'オールアウト、ペーシング',
        goodSigns: ['全力出し切り', '適切なペース配分'],
        concerns: ['前半突っ込みすぎ', '追い込み不足']
    },

    // ラン
    run_easy: {
        purpose: '有酸素ベース構築・回復促進',
        focus: 'Z2維持、会話ペース、心拍安定',
        goodSigns: ['Z2維持', '会話ペース', '心拍ドリフト小'],
        concerns: ['ペース上がりすぎ', '心拍ドリフト大']
    },
    run_long: {
        purpose: '持久力向上・脂肪燃焼効率改善',
        focus: 'Z2維持、後半ペース維持、心拍ドリフト',
        goodSigns: ['後半までZ2', 'ネガティブ/イーブン', '心拍ドリフト10%以内'],
        concerns: ['後半ペースダウン', '心拍ドリフト大']
    },
    run_tempo: {
        purpose: '乳酸閾値向上・レースペース耐性',
        focus: 'LTペース維持、心拍Z3-Z4',
        goodSigns: ['閾値ペース維持', 'Z3-Z4安定', 'フォーム維持'],
        concerns: ['ペース維持できず', 'Z5突入']
    },
    run_interval: {
        purpose: 'VO2max向上・スピード強化',
        focus: '各本のタイム、セット間の維持率',
        goodSigns: ['設定ペースクリア', 'セット間維持', 'レストで回復'],
        concerns: ['後半タイム低下', '回復不十分']
    },
    run_fartlek: {
        purpose: 'スピード変化への適応・レース実践',
        focus: 'ペース変化の実行、強弱のメリハリ',
        goodSigns: ['意図したペース変化', '速い区間でしっかり上げた', '遅い区間で回復'],
        concerns: ['ペース変化が曖昧', '全体的に強度上がりすぎ']
    },
    run_hill: {
        purpose: '脚筋力強化・ランニングエコノミー向上',
        focus: '登りでのフォーム維持、心拍回復',
        goodSigns: ['フォーム維持', '腕振り・膝上げ意識', '下りで回復'],
        concerns: ['フォーム崩れ', '回復できず']
    },
    run_brick: {
        purpose: 'バイク後のラン適応',
        focus: '移行直後のペース、脚の動き',
        goodSigns: ['脚動いた', '目標ペースに乗れた'],
        concerns: ['脚動かず', 'バイクで追い込みすぎ']
    },
    run_recovery: {
        purpose: '疲労回復・血流促進',
        focus: 'Z1維持、主観的な楽さ',
        goodSigns: ['Z1維持', '遅すぎると感じた', '張り軽減'],
        concerns: ['強度上がりすぎ']
    },
    run_test: {
        purpose: '閾値測定・現状把握',
        focus: 'オールアウト、ペーシング',
        goodSigns: ['全力出し切り', 'ネガティブスプリット'],
        concerns: ['前半突っ込みすぎ', '追い込み不足']
    },

    // 共通
    race: {
        purpose: 'パフォーマンス発揮',
        focus: '目標タイム、ペーシング戦略、補給',
        goodSigns: ['目標達成', '計画通りのペーシング', '補給成功'],
        concerns: ['オーバーペース', '補給失敗', '想定外対応']
    },
    other: {
        purpose: 'ユーザー定義',
        focus: '補足内容に基づく',
        goodSigns: [],
        concerns: []
    }
};

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
            conversationHistory,
            sessionType,        // ユーザーが選択したセッションタイプ
            sessionSupplement,  // 補足コメント
            raceGoal            // Aレース目標（あれば）
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

        // データの信頼性を評価
        const dataReliability = assessDataReliability(activity, trainingStatus, streamAnalysis);
        
        // 観察できる事実を抽出
        const observations = extractObservations(activity, streamAnalysis, sessionType);
        
        // フラグを設定
        const hasRaceGoal = !!(raceGoal && raceGoal.raceName);
        const hasSupplement = !!(sessionSupplement && sessionSupplement.trim());
        
        // システムプロンプト
        const systemPrompt = buildSystemPrompt(!!userQuestion, sessionType, hasRaceGoal, hasSupplement);
        
        // ユーザーメッセージの構築
        const userMessage = buildUserMessage(
            activity, 
            trainingStatus, 
            streamAnalysis, 
            similarActivities, 
            userQuestion, 
            sessionType,
            sessionSupplement,
            raceGoal,
            observations, 
            dataReliability
        );

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
                temperature: 0.6
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
                sessionType: sessionType
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
// システムプロンプト（改善版：称賛から、補足への言及）
// ============================================
function buildSystemPrompt(isQuestion, sessionType, hasRaceGoal, hasSupplement) {
    if (isQuestion) {
        return `あなたは「AIトライアスロンコーチ」です。運動生理学に精通し、選手の質問にデータを根拠に回答します。

【回答の原則】
- 選手の目標達成を応援する姿勢で回答
- 推測には「〜と思われます」と表現
- 難しい概念は噛み砕いて説明
- 具体的で実践的なアドバイスを心がける

250-350字程度で回答してください。`;
    }

    const evaluation = SESSION_EVALUATION[sessionType] || SESSION_EVALUATION.other;

    let prompt = `あなたは「AIトライアスロンコーチ」です。運動生理学に精通し、スイム・バイク・ランのトレーニング、栄養、リカバリー、レース戦略、ケガと予防について専門的な知見を持っています。

【基本姿勢】
- 親しみやすく、プロフェッショナル
- ユーザーの目標達成を常に応援し励ます
- データに基づいた客観的な分析を行う
- 難解な運動生理学の知識も分かりやすく噛み砕いて伝える

【今回のセッション】
- 目的: ${evaluation.purpose}
- 評価の焦点: ${evaluation.focus}
- 良いサイン: ${evaluation.goodSigns.join('、')}
- 注意すべき点: ${evaluation.concerns.join('、')}

【コメントの構成（この順番で書く）】
1. **称賛・ねぎらい**（必須・冒頭）
   - 「お疲れ様でした！」「よく頑張りましたね！」などで始める
   - トレーニングを完遂したこと自体を称える
   - 距離や時間など、具体的な数字を挙げて労う

2. **良かった点**（必須）
   - データから読み取れるポジティブな観察を具体的に述べる
   - 「なぜ良いのか」を運動生理学的に簡潔に説明する

3. **改善点・次への提案**（必須）
   - 建設的なトーンで改善点を述べる
   - 「次回は〜を試してみてください」と具体的なアクションを提案
   - 否定的な表現は避け、前向きな言い方にする`;

    // 補足コメントがある場合の指示を追加
    if (hasSupplement) {
        prompt += `

4. **補足コメントへの言及**（必須）
   - ユーザーが入力した補足コメントの内容に必ず触れる
   - 「〜とのことですが」「〜を意識されたんですね」など、認識していることを明示する
   - 補足の内容を踏まえた上でコメントする`;
    }

    // Aレース目標がある場合の指示を追加
    if (hasRaceGoal) {
        prompt += `

**レース目標との関連**（状況に応じて言及）
Aレースの目標が設定されています。以下の条件に該当する場合、コメントの最後に1-2文で言及してください：

【言及すべき場合】
- セッションがレースに直結する練習の場合（レースペース走、ブリック、シミュレーション等）
- 残り日数が30日以内で、調整期に入っている場合
- 残り日数が60日以内で、ピーク期の重要なセッションの場合
- セッションの出来がレース目標達成に対して特に良い/悪い兆候を示している場合

【言及の仕方】
- 「○○に向けて順調ですね」「レースまであと○日、いい仕上がりです」など前向きに
- 具体的な目標タイムや距離に触れつつ、現状とのギャップや進捗を示唆
- 残り期間を踏まえた今後のトレーニングの方向性を簡潔に提案

【言及不要な場合】
- 基礎的なベーストレーニングや回復走
- レースまで90日以上ある場合の通常練習
- セッションとレース種目の関連が薄い場合`;
    }

    prompt += `

【避けること】
- 冒頭で「達成できた/できなかった」と断定的に評価すること
- 否定的な表現から始めること
- 箇条書きでの羅列（自然な文章で書く）
- 「冒頭：」「本文：」などのラベル
- すべてを褒めるだけの空虚なコメント

【出力形式】
- 自然な日本語の段落形式
- 350-450字程度
- 絵文字は使わない
- 温かみのある、コーチらしい語り口`;

    return prompt;
}

// ============================================
// ユーザーメッセージ構築
// ============================================
function buildUserMessage(activity, trainingStatus, streamAnalysis, similarActivities, userQuestion, sessionType, sessionSupplement, raceGoal, observations, dataReliability) {
    const sportType = activity.sport_type || activity.type;
    const sportName = getSportName(sportType);
    const sportCategory = getSportCategory(sportType);
    const distance = activity.distance ? (activity.distance / 1000).toFixed(2) : 0;
    const durationMin = Math.round((activity.moving_time || activity.elapsed_time || 0) / 60);
    
    const evaluation = SESSION_EVALUATION[sessionType] || SESSION_EVALUATION.other;
    
    let message = '';
    
    // セッション情報
    message += '## セッション情報\n';
    message += '- アクティビティ名: ' + (activity.name || '（名称なし）') + '\n';
    message += '- 種目: ' + sportName + '\n';
    message += '- 選択されたセッションタイプ: ' + sessionType + '\n';
    message += '- セッションの目的: ' + evaluation.purpose + '\n';
    message += '\n';
    
    // ★ 補足コメントがある場合、強調して伝える
    if (sessionSupplement && sessionSupplement.trim()) {
        message += '## ★ ユーザーからの補足コメント（重要：必ずコメント内で言及すること）\n';
        message += '「' + sessionSupplement.trim() + '」\n';
        message += '→ この補足内容を認識していることを、コメントの中で「〜とのことですが」「〜を意識されたんですね」などの形で明示的に触れてください。\n';
        message += '\n';
    }
    
    // ★ Aレース目標がある場合（詳細情報付き）
    if (raceGoal && raceGoal.raceName) {
        message += '## Aレース目標\n';
        message += '- レース名: ' + raceGoal.raceName + '\n';
        
        // 残り日数を計算
        let daysToRace = null;
        let trainingPhase = '';
        if (raceGoal.raceDate) {
            const raceDate = new Date(raceGoal.raceDate);
            const activityDate = new Date(activity.start_date);
            daysToRace = Math.ceil((raceDate - activityDate) / (1000 * 60 * 60 * 24));
            
            message += '- レース日: ' + raceGoal.raceDate + '\n';
            message += '- このトレーニング時点での残り日数: ' + daysToRace + '日\n';
            
            // トレーニングフェーズを判定
            if (daysToRace <= 0) {
                trainingPhase = 'レース当日または終了後';
            } else if (daysToRace <= 7) {
                trainingPhase = 'テーパー期（最終調整）- 疲労を抜きつつシャープさを維持';
            } else if (daysToRace <= 21) {
                trainingPhase = 'テーパー期（調整開始）- 量を落とし質を維持';
            } else if (daysToRace <= 42) {
                trainingPhase = 'ピーク期 - レース強度での仕上げ練習が重要';
            } else if (daysToRace <= 84) {
                trainingPhase = '構築期 - 強度を上げてレース特異的な練習';
            } else {
                trainingPhase = '基礎期 - ベースづくりと持久力向上';
            }
            message += '- トレーニングフェーズ: ' + trainingPhase + '\n';
        }
        
        if (raceGoal.goalTime) {
            message += '- 目標タイム: ' + raceGoal.goalTime + '\n';
        }
        if (raceGoal.raceDistance) {
            message += '- レース距離: ' + raceGoal.raceDistance + '\n';
        }
        
        // セッションタイプとの関連性を示唆
        const sessionRelevance = getSessionRaceRelevance(sessionType, raceGoal.raceDistance, daysToRace);
        if (sessionRelevance) {
            message += '- このセッションとレースの関連: ' + sessionRelevance + '\n';
        }
        
        message += '\n';
    }
    
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
        message += '- ピッチ: ' + Math.round(activity.average_cadence * 2) + 'spm\n';
    }
    if (sportCategory === 'bike' && activity.average_watts) {
        message += '- パワー: ' + Math.round(activity.average_watts) + 'W\n';
        if (activity.weighted_average_watts) {
            message += '- NP: ' + Math.round(activity.weighted_average_watts) + 'W\n';
        }
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
            message += '\n';
        });
        message += '\n';
    }
    
    // ペーシング詳細
    if (streamAnalysis && streamAnalysis.paceAnalysis) {
        const pa = streamAnalysis.paceAnalysis;
        message += '## ペーシング\n';
        message += '前半 ' + pa.firstHalfPace + ' → 後半 ' + pa.secondHalfPace + '\n';
        if (pa.variability) {
            message += 'ペース変動係数: ' + pa.variability + '%\n';
        }
        if (pa.splitDiff) {
            const diff = parseFloat(pa.splitDiff);
            if (diff > 0) {
                message += '→ ネガティブスプリット（後半' + diff.toFixed(1) + '%速い）\n';
            } else if (diff < -5) {
                message += '→ ポジティブスプリット（後半' + Math.abs(diff).toFixed(1) + '%遅い）\n';
            }
        }
        message += '\n';
    }
    
    // 心拍詳細
    if (streamAnalysis && streamAnalysis.heartRateAnalysis) {
        const hra = streamAnalysis.heartRateAnalysis;
        message += '## 心拍データ\n';
        if (hra.drift !== undefined) {
            message += '心拍ドリフト: ' + (hra.drift > 0 ? '+' : '') + hra.drift + '%\n';
        }
        if (hra.zones) {
            message += 'Zone分布: Z1=' + hra.zones.z1 + '% Z2=' + hra.zones.z2 + '% Z3=' + hra.zones.z3 + '% Z4=' + hra.zones.z4 + '% Z5=' + hra.zones.z5 + '%\n';
            
            // Zone分布の解釈を追加
            const z1z2 = (hra.zones.z1 || 0) + (hra.zones.z2 || 0);
            const z4z5 = (hra.zones.z4 || 0) + (hra.zones.z5 || 0);
            if (z1z2 > 80) {
                message += '→ 低強度（Z1-Z2）中心のセッション\n';
            } else if (z4z5 > 30) {
                message += '→ 高強度（Z4-Z5）の時間が多いセッション\n';
            }
        }
        message += '\n';
    }
    
    // 類似トレーニング比較
    if (similarActivities && similarActivities.length > 0) {
        const comparableActivities = similarActivities.slice(0, 2);
        if (comparableActivities.length > 0) {
            message += '## 過去の類似トレーニング\n';
            comparableActivities.forEach(function(sim, i) {
                const simDate = new Date(sim.start_date).toLocaleDateString('ja-JP');
                const simPace = formatPace(sim.average_speed, sportType);
                const simHr = sim.average_heartrate ? Math.round(sim.average_heartrate) + 'bpm' : '-';
                message += (i + 1) + '. ' + simDate + ': ' + (sim.distance/1000).toFixed(1) + 'km, ' + simPace + ', HR ' + simHr + '\n';
            });
            message += '\n';
        }
    }
    
    // 評価の参考情報
    message += '## 評価の参考情報\n';
    message += '- 良いサイン: ' + evaluation.goodSigns.join('、') + '\n';
    message += '- 注意すべき点: ' + evaluation.concerns.join('、') + '\n';
    message += '\n';
    
    // 指示
    if (userQuestion) {
        message += '---\n## 選手からの質問\n' + userQuestion + '\n\nこの質問に対して、上記データを参照しながら回答してください。';
    } else {
        message += '---\n';
        message += '上記のデータを踏まえて、このトレーニングについてコメントしてください。\n\n';
        message += '【コメントの構成】\n';
        message += '1. まず「お疲れ様でした！」「よく頑張りましたね！」などの称賛・ねぎらいから始める\n';
        message += '2. 次にデータから読み取れる良かった点を具体的に述べる\n';
        message += '3. 最後に改善点や次への提案を建設的に述べる\n\n';
        message += '※ 冒頭で「達成できた/できなかった」という断定的な評価は避けてください。良い点と改善点を述べれば、自然と理解できます。';
    }
    
    return message;
}

// ============================================
// セッションとレース目標の関連性を判定
// ============================================
function getSessionRaceRelevance(sessionType, raceDistance, daysToRace) {
    if (!sessionType || !daysToRace || daysToRace <= 0) return null;
    
    // レース距離の判定
    const isShortRace = raceDistance && (
        raceDistance.includes('スプリント') || 
        raceDistance.includes('Sprint') ||
        raceDistance.includes('オリンピック') ||
        raceDistance.includes('Olympic') ||
        raceDistance.includes('51.5')
    );
    const isLongRace = raceDistance && (
        raceDistance.includes('ミドル') ||
        raceDistance.includes('Middle') ||
        raceDistance.includes('70.3') ||
        raceDistance.includes('ハーフ') ||
        raceDistance.includes('Half') ||
        raceDistance.includes('ロング') ||
        raceDistance.includes('Long') ||
        raceDistance.includes('フル') ||
        raceDistance.includes('Full') ||
        raceDistance.includes('Ironman') ||
        raceDistance.includes('アイアンマン')
    );
    
    // セッションタイプ別の関連性
    const highRelevanceSessions = {
        // レースペース・閾値系（常に高関連）
        'swim_threshold': 'CSSはレースペースに直結する重要な練習',
        'bike_threshold': 'FTPゾーンはバイクパートの要',
        'bike_sweetspot': 'ロングレースのバイク強度に直結',
        'run_tempo': '閾値ペースはランパートの基盤',
        
        // ブリック（常に高関連）
        'bike_brick': 'トランジションとラン適応に直結',
        'run_brick': 'バイク後のラン感覚を身につける重要練習',
        
        // インターバル系（ピーク期に高関連）
        'swim_interval': daysToRace <= 60 ? 'スピード向上でレースペースに余裕を' : null,
        'bike_interval': daysToRace <= 60 ? 'VO2max向上でレース強度の余裕度アップ' : null,
        'run_interval': daysToRace <= 60 ? 'スピードの底上げでレースペースに余裕を' : null,
        
        // ロング系（ロングレース or 基礎期に関連）
        'swim_endurance': isLongRace ? 'ロングレースのスイムに必要な持久力' : null,
        'bike_endurance': isLongRace ? 'ロングレースに不可欠な有酸素ベース' : null,
        'run_long': isLongRace ? 'ロングレースのラン脚づくりに重要' : null,
        
        // テスト（常に高関連）
        'swim_test': '現状把握でレースペース設定の参考に',
        'bike_test': 'FTP更新でトレーニングゾーンを最適化',
        'run_test': '閾値更新で適切なペース設定が可能に'
    };
    
    const relevance = highRelevanceSessions[sessionType];
    
    // テーパー期の場合は追加コメント
    if (relevance && daysToRace <= 21) {
        return relevance + '（テーパー期：質を維持しながら量を落とす時期）';
    }
    
    return relevance;
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
        hasStreamData: !!(streamAnalysis && (streamAnalysis.paceAnalysis || streamAnalysis.heartRateAnalysis)),
        overallLevel: 'low'
    };
    
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
function extractObservations(activity, streamAnalysis, sessionType) {
    const observations = [];
    const sportCategory = getSportCategory(activity.sport_type || activity.type);
    
    // ペーシングの観察
    if (streamAnalysis && streamAnalysis.paceAnalysis) {
        const pa = streamAnalysis.paceAnalysis;
        const splitDiff = parseFloat(pa.splitDiff);
        
        if (!isNaN(splitDiff)) {
            if (splitDiff > 5) {
                observations.push({
                    type: 'pacing',
                    fact: '後半ペースが' + Math.abs(splitDiff).toFixed(1) + '%向上（ネガティブスプリット）',
                    interpretation: 'ペース配分成功'
                });
            } else if (splitDiff < -10) {
                observations.push({
                    type: 'pacing',
                    fact: '後半ペースが' + Math.abs(splitDiff).toFixed(1) + '%低下',
                    interpretation: '前半のオーバーペース、または後半の疲労'
                });
            }
        }
        
        const cv = parseFloat(pa.variability);
        if (!isNaN(cv) && cv > 20 && !sessionType.includes('interval')) {
            observations.push({
                type: 'pacing',
                fact: 'ペース変動係数が' + cv.toFixed(1) + '%と大きい',
                interpretation: 'ペースが安定していない'
            });
        }
    }
    
    // 心拍の観察
    if (streamAnalysis && streamAnalysis.heartRateAnalysis) {
        const hra = streamAnalysis.heartRateAnalysis;
        const drift = parseFloat(hra.drift);
        
        if (!isNaN(drift)) {
            if (drift < 5 && activity.moving_time > 2400) {
                observations.push({
                    type: 'heart_rate',
                    fact: '40分以上で心拍ドリフト' + drift.toFixed(1) + '%',
                    interpretation: '優秀な有酸素効率'
                });
            } else if (drift > 12) {
                observations.push({
                    type: 'heart_rate',
                    fact: '心拍ドリフト' + drift.toFixed(1) + '%',
                    interpretation: '脱水、暑熱、またはオーバーペースの影響'
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
                let strokes = lap.total_strokes;
                if (!strokes && lap.average_cadence && lap.moving_time) {
                    strokes = Math.round(lap.average_cadence * lap.moving_time / 60);
                }
                if (strokes && strokes > 0) {
                    const dps = lap.distance / strokes;
                    if (dps > 0.5 && dps < 3.0) {
                        totalDPS += dps;
                        validLaps++;
                    }
                }
            }
        });
        
        if (validLaps > 0) {
            const avgDPS = totalDPS / validLaps;
            let interpretation = null;
            if (avgDPS >= 1.4) {
                interpretation = '効率的なストローク';
            } else if (avgDPS < 1.0) {
                interpretation = 'ストローク効率に改善余地';
            }
            observations.push({
                type: 'swim_efficiency',
                fact: '平均DPS ' + avgDPS.toFixed(2) + 'm/ストローク',
                interpretation: interpretation
            });
        }
    }
    
    return observations;
}

// ============================================
// ユーティリティ関数
// ============================================
function getSportName(sportType) {
    const names = {
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
        const pace = 100 / avgSpeed;
        const min = Math.floor(pace / 60);
        const sec = Math.round(pace % 60);
        return min + ':' + String(sec).padStart(2, '0') + '/100m';
    } else if (sportType && sportType.indexOf('Ride') !== -1) {
        return (avgSpeed * 3.6).toFixed(1) + 'km/h';
    } else {
        const pace = 1000 / avgSpeed;
        const min = Math.floor(pace / 60);
        const sec = Math.round(pace % 60);
        return min + ':' + String(sec).padStart(2, '0') + '/km';
    }
}
