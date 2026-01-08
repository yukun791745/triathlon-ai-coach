// netlify/functions/ai-coach-comment.js
// 改善版: 事前分析による注目ポイント抽出 + 焦点を絞ったプロンプト
// gpt-4o-mini使用（安定性重視）

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

        // ★ 改善の核心: データから「注目ポイント」を事前抽出
        const insights = extractKeyInsights(activity, streamAnalysis, similarActivities, trainingStatus);
        
        // システムプロンプト（改善版 - 抽出された洞察に基づいて動的に調整）
        const systemPrompt = buildSystemPrompt(!!userQuestion, insights);
        
        // ユーザーメッセージの構築（改善版 - 注目ポイントを最初に提示）
        const userMessage = buildUserMessage(activity, trainingStatus, streamAnalysis, similarActivities, userQuestion, insights);

        // メッセージ配列の構築
        const messages = [
            { role: 'system', content: systemPrompt }
        ];
        
        // 会話履歴があれば追加
        if (conversationHistory && conversationHistory.length > 0) {
            conversationHistory.forEach(msg => {
                messages.push(msg);
            });
        }
        
        messages.push({ role: 'user', content: userMessage });

        // gpt-4o-mini を使用（安定性重視）
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: messages,
                max_tokens: 1500,
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

// ============================================
// ★ 改善の核心: 事前にデータから「注目ポイント」を抽出
// ============================================
function extractKeyInsights(activity, streamAnalysis, similarActivities, trainingStatus) {
    const insights = {
        highlights: [],
        concerns: [],
        comparisons: [],
        context: [],
        primaryFocus: null
    };
    
    const sportCategory = getSportCategory(activity.sport_type || activity.type);
    const tss = activity.tss || 0;
    
    // ===== 1. ペーシング分析 =====
    if (streamAnalysis && streamAnalysis.paceAnalysis) {
        const pa = streamAnalysis.paceAnalysis;
        const splitDiff = parseFloat(pa.splitDiff);
        
        if (!isNaN(splitDiff)) {
            if (splitDiff > 5) {
                insights.highlights.push({
                    type: 'negative_split',
                    message: '後半' + Math.abs(splitDiff).toFixed(1) + '%ペースアップ（ネガティブスプリット）',
                    detail: 'レース本番で活きる理想的なペース配分',
                    importance: 'high'
                });
            } else if (splitDiff < -8) {
                insights.concerns.push({
                    type: 'positive_split',
                    message: '後半' + Math.abs(splitDiff).toFixed(1) + '%ペースダウン',
                    possibleCauses: ['序盤のオーバーペース', 'エネルギー切れ', '暑熱'],
                    suggestion: '次回は最初の1-2kmを意識的に抑えてスタート',
                    importance: 'medium'
                });
            }
        }
        
        // ペース変動係数
        const cv = parseFloat(pa.variability);
        if (!isNaN(cv)) {
            if (cv < 5) {
                insights.highlights.push({
                    type: 'pace_stability',
                    message: 'ペース変動' + cv + '%と非常に安定',
                    detail: '一定ペースを刻む能力が高い',
                    importance: 'medium'
                });
            } else if (cv > 15) {
                insights.concerns.push({
                    type: 'pace_variability',
                    message: 'ペース変動' + cv + '%とばらつき大',
                    suggestion: 'ラップアラートを活用してペース管理を',
                    importance: 'low'
                });
            }
        }
    }
    
    // ===== 2. 心拍ドリフト分析 =====
    if (streamAnalysis && streamAnalysis.heartRateAnalysis) {
        const hra = streamAnalysis.heartRateAnalysis;
        const drift = parseFloat(hra.drift);
        
        if (!isNaN(drift)) {
            if (drift > 10) {
                insights.concerns.push({
                    type: 'cardiac_drift',
                    message: '心拍ドリフト' + drift.toFixed(1) + '%（やや高め）',
                    possibleCauses: ['脱水', '暑熱', '有酸素ベース不足'],
                    suggestion: '水分補給のタイミングを見直す',
                    importance: drift > 15 ? 'high' : 'medium'
                });
            } else if (drift < 3 && activity.moving_time > 2400) {
                insights.highlights.push({
                    type: 'cardiac_efficiency',
                    message: '40分以上で心拍ドリフトわずか' + drift.toFixed(1) + '%',
                    detail: '優れた有酸素ベースの証拠',
                    importance: 'high'
                });
            }
        }
        
        // ゾーン分布
        if (hra.zones) {
            const z4z5 = (hra.zones.z4 || 0) + (hra.zones.z5 || 0);
            const z1z2 = (hra.zones.z1 || 0) + (hra.zones.z2 || 0);
            
            if (z4z5 > 40) {
                insights.context.push({
                    type: 'high_intensity',
                    message: '高強度ゾーン（Z4-5）が' + z4z5 + '%',
                    implication: 'ハードセッション。回復が必要。'
                });
            } else if (z1z2 > 80) {
                insights.context.push({
                    type: 'recovery_run',
                    message: '低強度ゾーン（Z1-2）が' + z1z2 + '%',
                    implication: '回復走として適切な強度。'
                });
            }
        }
    }
    
    // ===== 3. 種目別分析 =====
    
    // スイム: DPS
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
            
            if (avgDPS >= 1.5) {
                insights.highlights.push({
                    type: 'swim_efficiency',
                    message: 'DPS ' + avgDPS.toFixed(2) + 'm（効率的なストローク）',
                    detail: '上級者レベルの推進力',
                    importance: 'high'
                });
            } else if (avgDPS < 1.1) {
                insights.concerns.push({
                    type: 'swim_efficiency',
                    message: 'DPS ' + avgDPS.toFixed(2) + 'm（改善余地あり）',
                    suggestion: 'キャッチアップドリルでストローク効率を改善',
                    importance: 'medium'
                });
            }
        }
    }
    
    // ラン: ピッチ
    if (sportCategory === 'run' && activity.average_cadence) {
        const pitch = activity.average_cadence * 2;
        
        if (pitch >= 180) {
            insights.highlights.push({
                type: 'run_cadence',
                message: 'ピッチ' + Math.round(pitch) + 'spm（理想的な回転数）',
                detail: '効率的なランニングフォーム',
                importance: 'medium'
            });
        } else if (pitch < 165 && activity.average_speed > 2.5) {
            insights.concerns.push({
                type: 'run_cadence',
                message: 'ピッチ' + Math.round(pitch) + 'spm（やや低め）',
                suggestion: 'メトロノームで170-180spmを意識',
                importance: 'low'
            });
        }
    }
    
    // バイク: VI
    if (sportCategory === 'bike' && activity.average_watts && activity.weighted_average_watts) {
        const vi = activity.weighted_average_watts / activity.average_watts;
        
        if (vi <= 1.03) {
            insights.highlights.push({
                type: 'bike_pacing',
                message: 'VI ' + vi.toFixed(2) + '（非常に安定したペーシング）',
                detail: 'TTやトライアスロンに理想的',
                importance: 'high'
            });
        } else if (vi > 1.10) {
            insights.context.push({
                type: 'bike_variability',
                message: 'VI ' + vi.toFixed(2) + '（変動の大きいライド）',
                implication: 'インターバル/丘陵コースの可能性'
            });
        }
    }
    
    // ===== 4. 過去との比較 =====
    if (similarActivities && similarActivities.length > 0) {
        const recent = similarActivities[0];
        
        if (activity.average_speed && recent.average_speed) {
            const paceChange = ((activity.average_speed / recent.average_speed) - 1) * 100;
            
            if (paceChange > 3) {
                insights.comparisons.push({
                    type: 'pace_improvement',
                    message: '前回の類似セッションより' + paceChange.toFixed(1) + '%速い',
                    importance: 'high'
                });
            } else if (paceChange < -5) {
                insights.comparisons.push({
                    type: 'pace_slower',
                    message: '前回より' + Math.abs(paceChange).toFixed(1) + '%遅い',
                    possibleReasons: ['疲労', '気象条件', '意図的なイージー走'],
                    importance: 'medium'
                });
            }
        }
        
        // 心拍効率の比較
        if (activity.average_heartrate && recent.average_heartrate && 
            activity.average_speed && recent.average_speed) {
            const paceRatio = activity.average_speed / recent.average_speed;
            if (paceRatio > 0.95 && paceRatio < 1.05) {
                const hrDiff = activity.average_heartrate - recent.average_heartrate;
                
                if (hrDiff < -5) {
                    insights.highlights.push({
                        type: 'fitness_gain',
                        message: '同ペースで心拍' + Math.abs(Math.round(hrDiff)) + 'bpm低下',
                        detail: 'フィットネス向上の証拠！',
                        importance: 'high'
                    });
                } else if (hrDiff > 8) {
                    insights.concerns.push({
                        type: 'fitness_signal',
                        message: '同ペースで心拍' + Math.round(hrDiff) + 'bpm上昇',
                        possibleCauses: ['疲労蓄積', '睡眠不足', '体調'],
                        suggestion: '体調をチェックし、必要なら回復を優先',
                        importance: 'medium'
                    });
                }
            }
        }
    }
    
    // ===== 5. トレーニング文脈 =====
    if (trainingStatus) {
        const tsb = trainingStatus.tsb;
        
        if (tsb < -25 && tss > 80) {
            insights.concerns.push({
                type: 'overreach_risk',
                message: 'TSB ' + tsb + 'の疲労状態でTSS ' + tss + 'のセッション',
                suggestion: '明日は完全休養を強く推奨',
                importance: 'high'
            });
        } else if (tsb > 10 && tss > 100) {
            insights.highlights.push({
                type: 'quality_timing',
                message: 'フレッシュな状態（TSB +' + tsb + '）での高負荷セッション',
                detail: '理想的なタイミングでの質の高いトレーニング',
                importance: 'high'
            });
        }
        
        if (trainingStatus.ctlTrend > 3) {
            insights.context.push({
                type: 'fitness_building',
                message: 'CTL週間+' + trainingStatus.ctlTrend + 'でフィットネス構築中',
                implication: 'トレーニングが順調に積み上がっている'
            });
        }
    }
    
    // ===== 6. 最も重要な洞察を特定 =====
    const allInsights = []
        .concat(insights.highlights.map(function(h) { return Object.assign({}, h, { category: 'highlight' }); }))
        .concat(insights.concerns.map(function(c) { return Object.assign({}, c, { category: 'concern' }); }))
        .concat(insights.comparisons.map(function(c) { return Object.assign({}, c, { category: 'comparison' }); }));
    
    const highImportance = allInsights.filter(function(i) { return i.importance === 'high'; });
    if (highImportance.length > 0) {
        insights.primaryFocus = highImportance[0];
    } else if (allInsights.length > 0) {
        insights.primaryFocus = allInsights[0];
    }
    
    return insights;
}

// ============================================
// 改善版システムプロンプト
// ============================================
function buildSystemPrompt(isQuestion, insights) {
    if (isQuestion) {
        return 'あなたは経験20年のトライアスロンコーチ。選手の質問に、データを根拠に具体的に回答する。\n\nルール：\n- 質問に直接答える（前置き不要）\n- データの数値を引用して根拠を示す\n- 「〜してみてください」等の実践的アドバイスで締める\n- 300-400字';
    }

    const hasHighlights = insights.highlights.length > 0;
    const hasConcerns = insights.concerns.length > 0;
    const hasComparisons = insights.comparisons.length > 0;
    
    let focusInstruction = '';
    if (hasHighlights && !hasConcerns) {
        focusInstruction = '今回のセッションには称えるべき点があります。具体的に何が良かったのか、なぜそれが重要なのかを伝えてください。';
    } else if (hasConcerns && !hasHighlights) {
        focusInstruction = '改善点が見られます。批判ではなく「次はこうしてみよう」という建設的な形で伝えてください。';
    } else if (hasHighlights && hasConcerns) {
        focusInstruction = '良い点と改善点の両方があります。まず良い点を認めてから、改善点を建設的に提案してください。';
    } else if (hasComparisons) {
        focusInstruction = '過去との比較に注目してください。';
    }

    return 'あなたは経験20年のトライアスロンコーチ。選手のトレーニングデータを見て、**数字の復唱ではなく、データが示す意味**を伝える。\n\n## 絶対NG\n- 「今日は○km走りました」のような事実の復唱\n- 「TSS○は中強度です」のような定義説明\n- 箇条書きの羅列\n- 誰にでも言える一般論\n\n## 必須\n- 最も重要な1つの洞察から始める\n- データの数値を根拠として引用\n- 「なぜそうなったか」「何を意味するか」を解説\n- 次のトレーニングへの具体的アクション1つ\n\n' + focusInstruction + '\n\n## 出力形式\n**冒頭1文**：最も注目すべき点を端的に。\n\n**本文（2-3段落）**：注目ポイントの詳細解説（データ引用しながら）\n\n**次のアクション（1-2文）**：具体的提案\n\n## トーン\n- 親しみやすく、でも専門性を感じさせる\n- 褒める時は具体的に、指摘する時は建設的に\n\n## 文字数\n400-600字（日本語）';
}

// ============================================
// 改善版ユーザーメッセージ構築
// ============================================
function buildUserMessage(activity, trainingStatus, streamAnalysis, similarActivities, userQuestion, insights) {
    const sportType = activity.sport_type || activity.type;
    const sportName = getSportName(sportType);
    const sportCategory = getSportCategory(sportType);
    const distance = activity.distance ? (activity.distance / 1000).toFixed(2) : 0;
    const durationMin = Math.round((activity.moving_time || activity.elapsed_time || 0) / 60);
    
    // 注目ポイントを最初に提示
    let message = '## このセッションの注目ポイント（事前分析済み）\n\n';
    
    if (insights.primaryFocus) {
        message += '### 最重要ポイント\n';
        message += '**' + insights.primaryFocus.message + '**\n';
        if (insights.primaryFocus.detail) {
            message += '→ ' + insights.primaryFocus.detail + '\n';
        }
        message += '\n';
    }
    
    if (insights.highlights.length > 0) {
        message += '### 良い点\n';
        insights.highlights.forEach(function(h) {
            message += '- ' + h.message;
            if (h.detail) message += '（' + h.detail + '）';
            message += '\n';
        });
        message += '\n';
    }
    
    if (insights.concerns.length > 0) {
        message += '### 改善の余地\n';
        insights.concerns.forEach(function(c) {
            message += '- ' + c.message;
            if (c.suggestion) message += ' → ' + c.suggestion;
            message += '\n';
        });
        message += '\n';
    }
    
    if (insights.comparisons.length > 0) {
        message += '### 過去との比較\n';
        insights.comparisons.forEach(function(c) {
            message += '- ' + c.message + '\n';
        });
        message += '\n';
    }
    
    if (insights.context.length > 0) {
        message += '### 文脈\n';
        insights.context.forEach(function(c) {
            message += '- ' + c.message;
            if (c.implication) message += ' → ' + c.implication;
            message += '\n';
        });
        message += '\n';
    }
    
    // セッション基本データ
    message += '---\n## セッションデータ\n';
    message += '- 種目: ' + sportName + ' / 日時: ' + new Date(activity.start_date).toLocaleString('ja-JP') + '\n';
    message += '- 距離: ' + distance + 'km / 時間: ' + durationMin + '分';
    if (activity.tss) message += ' / TSS: ' + activity.tss;
    message += '\n';
    
    if (activity.average_speed) {
        message += '- ペース: ' + formatPace(activity.average_speed, sportType);
    }
    if (activity.average_heartrate) {
        message += ' / 心拍: 平均' + Math.round(activity.average_heartrate) + 'bpm';
        if (activity.max_heartrate) message += '・最大' + Math.round(activity.max_heartrate) + 'bpm';
    }
    message += '\n';

    // 種目別メトリクス
    if (sportCategory === 'bike' && activity.average_watts) {
        message += '- パワー: ' + Math.round(activity.average_watts) + 'W';
        if (activity.weighted_average_watts) {
            message += ' / NP: ' + Math.round(activity.weighted_average_watts) + 'W';
            const vi = (activity.weighted_average_watts / activity.average_watts).toFixed(2);
            message += ' / VI: ' + vi;
        }
        message += '\n';
    }
    
    if (sportCategory === 'run' && activity.average_cadence) {
        const pitch = Math.round(activity.average_cadence * 2);
        message += '- ピッチ: ' + pitch + 'spm';
        if (activity.average_speed) {
            const stride = (activity.average_speed * 60 / pitch).toFixed(2);
            message += ' / ストライド: ' + stride + 'm';
        }
        message += '\n';
    }

    if (activity.total_elevation_gain > 20) {
        message += '- 獲得標高: ' + Math.round(activity.total_elevation_gain) + 'm\n';
    }
    
    // ペーシング詳細
    if (streamAnalysis && streamAnalysis.paceAnalysis) {
        const pa = streamAnalysis.paceAnalysis;
        message += '\n### ペーシング\n';
        message += '前半 ' + pa.firstHalfPace + ' → 後半 ' + pa.secondHalfPace + '（' + pa.splitType + '、差' + pa.splitDiff + '）\n';
        if (pa.variability) message += '変動係数: ' + pa.variability + '%\n';
    }
    
    // 心拍詳細
    if (streamAnalysis && streamAnalysis.heartRateAnalysis) {
        const hra = streamAnalysis.heartRateAnalysis;
        message += '\n### 心拍\n';
        if (hra.drift) message += 'ドリフト: ' + (hra.drift > 0 ? '+' : '') + hra.drift + '%\n';
        if (hra.zones) {
            message += 'Zone分布: Z1=' + hra.zones.z1 + '% Z2=' + hra.zones.z2 + '% Z3=' + hra.zones.z3 + '% Z4=' + hra.zones.z4 + '% Z5=' + hra.zones.z5 + '%\n';
        }
    }
    
    // トレーニングステータス
    if (trainingStatus) {
        message += '\n### コンディション\n';
        message += 'CTL: ' + trainingStatus.ctl + ' / ATL: ' + trainingStatus.atl + ' / TSB: ' + trainingStatus.tsb;
        if (trainingStatus.ctlTrend) {
            message += ' / 週間CTL変化: ' + (trainingStatus.ctlTrend > 0 ? '+' : '') + trainingStatus.ctlTrend;
        }
        message += '\n';
    }
    
    // 類似セッション比較
    if (similarActivities && similarActivities.length > 0) {
        message += '\n### 類似トレーニング比較\n';
        similarActivities.slice(0, 2).forEach(function(sim, i) {
            const simDate = new Date(sim.start_date).toLocaleDateString('ja-JP');
            const simPace = formatPace(sim.average_speed, sportType);
            const simHr = sim.average_heartrate ? Math.round(sim.average_heartrate) + 'bpm' : '-';
            message += (i + 1) + '. ' + simDate + ': ' + (sim.distance/1000).toFixed(1) + 'km, ' + simPace + ', HR ' + simHr + '\n';
        });
    }

    // スイム用Lapサマリー
    if (sportCategory === 'swim' && activity.laps && activity.laps.length > 1) {
        const swimLaps = activity.laps.filter(function(lap) { 
            return lap.moving_time >= 10 && lap.distance > 0; 
        });
        if (swimLaps.length > 0) {
            message += '\n### Lap詳細（上位5本）\n';
            swimLaps.slice(0, 5).forEach(function(lap, i) {
                const lapPace = formatPace(lap.average_speed, sportType);
                let strokes = lap.total_strokes;
                if (!strokes && lap.average_cadence && lap.moving_time) {
                    strokes = Math.round(lap.average_cadence * lap.moving_time / 60);
                }
                const dps = strokes && lap.distance > 0 ? (lap.distance / strokes).toFixed(2) : '-';
                message += 'Lap' + (i+1) + ': ' + Math.round(lap.distance) + 'm ' + lapPace + ', DPS ' + dps + 'm\n';
            });
        }
    }
    
    // 質問または指示
    if (userQuestion) {
        message += '\n---\n## 選手からの質問\n' + userQuestion + '\n\nこの質問に、上記データを根拠に具体的に回答してください。';
    } else {
        message += '\n---\n**指示**: 「注目ポイント」を中心に、このセッションの意味と次のアクションを伝えてください。事前分析の内容をそのまま使うのではなく、あなたの言葉で選手に語りかけてください。';
    }

    return message;
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
