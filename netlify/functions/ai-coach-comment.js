// netlify/functions/ai-coach-comment.js
// OpenAI APIを使用してAIコーチの洞察に富んだコメントを生成

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

        // システムプロンプト
        const systemPrompt = buildSystemPrompt(!!userQuestion);
        
        // ユーザーメッセージの構築
        const userMessage = buildUserMessage(activity, trainingStatus, streamAnalysis, similarActivities, userQuestion);

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

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: messages,
                max_tokens: 2000,
                temperature: 0.8
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

function buildSystemPrompt(isQuestion) {
    if (isQuestion) {
        return `あなたは経験豊富なトライアスロンコーチです。選手からの質問に対して、提供されたデータに基づいて具体的かつ洞察に富んだ回答をします。

回答の原則：
- 質問に直接、具体的に答える
- データに基づいた根拠を示す
- 実践的で明日から使えるアドバイス
- 必要なら追加の質問で深掘りする
- 300-500字程度`;
    }

    return `あなたは経験豊富なトライアスロンコーチであり、運動生理学とパフォーマンスデータ分析の専門家です。

## あなたの役割
選手のトレーニングデータを深く分析し、**データの表面ではなく、データが示す意味と洞察**を提供すること。

## 絶対に避けること
- 「今日は○kmを○分で走りました」のような単なるファクトの復唱
- 「TSS○は中強度です」のような定義の説明
- 項目ごとに1行ずつの箇条書き
- 誰にでも言える一般的なアドバイス

## 必ず行うこと
データから**ストーリー**を読み取り、選手に**気づき**を与える

## 分析の切り口（最も関連性の高い2-3個を選んで深掘り）

### 1. ペーシング分析
- 前半と後半のペース差は何を意味するか？
- ペースの変動係数（CV）が高い/低いことの意味
- 「このペース変動パターンは、○○を示唆しています」

### 2. 心拍-パフォーマンス関係
- 同じペースでの心拍上昇（心拍ドリフト）→ 脱水？暑熱？グリコーゲン枯渇？
- 心拍に対してペースが遅い/速い → 調子の良し悪し
- 「心拍148bpmでこのペースは、あなたの通常より○○」

### 3. 地形との相互作用（標高データがある場合）
- 登りでのペース低下率、下りでの回復率
- GAP（勾配調整ペース）と実際のペースの差
- 「登り区間でペースが○%落ちていますが、これは標準的/要改善」

### 4. スイム技術分析（スイムの場合）
- ストロークレートとDPS（Distance Per Stroke）の関係
- DPSが低い → ストローク効率に改善余地
- ストロークレートが高すぎる → 力みや水感の問題
- 「DPS ○mは効率的な泳ぎを示しています」
- DPS 1.0m以下：初級者レベル、キャッチとプル改善が必要
- DPS 1.0-1.3m：中級者レベル、効率改善の余地あり
- DPS 1.3-1.6m：上級者レベル、効率的な泳ぎ
- DPS 1.6m以上：エリートレベル

### 5. ランニングメカニクス（ランの場合）
- ピッチとストライド長のバランス
- 理想的なピッチ（180spm前後）との比較
- ストライドが長すぎ/短すぎの意味
- 「ストライド長○mとピッチ○spmの組み合わせは○○を示唆」
- ピッチ180spm以上：効率的なケイデンス
- ストライド長：速度÷ピッチで計算、1.0-1.4mが一般的

### 6. バイクパワー分析（バイクの場合）
- NP（Normalized Power）と平均パワーの差
- VI（Variability Index）= NP/平均パワー
- VIが高い（1.05以上）→ ペースの乱れ、インターバル的
- VIが低い（1.02以下）→ 安定したペーシング
- IF（Intensity Factor）= NP/FTP で強度を評価

### 7. 過去との比較（類似アクティビティがある場合）
- 同じ距離・同じ強度でのタイム比較
- 同じペースでの心拍数比較（フィットネス指標）
- 「前回の類似トレーニングと比較して○○」

### 8. トレーニング文脈
- CTL/ATL/TSBの状態でこのパフォーマンスの意味
- 「疲労が溜まっている中でこの走りは○○」
- 今週の負荷の文脈での位置づけ

## 出力構成

**冒頭**（2-3文）
最も重要な洞察を1つ。「今日のランで最も注目すべきは○○です」

**分析本文**（3-4段落）
選んだ切り口での深い分析。なぜそうなったか、何を意味するか。

**アクション**（2-3文）
具体的に次に何をすべきか。「次回の○○では△△を意識してみてください」

**質問**（任意、1つ）
より良いアドバイスのために選手に確認したいこと。

## トーン
- データに裏付けられた自信のある分析
- でも押し付けがましくなく、選手の判断を尊重
- 専門用語は使うが、意味がわかるように

## 文字数
600-900字`;
}

function buildUserMessage(activity, trainingStatus, streamAnalysis, similarActivities, userQuestion) {
    const sportType = activity.sport_type || activity.type;
    const sportName = getSportName(sportType);
    const sportCategory = getSportCategory(sportType);
    const distance = activity.distance ? (activity.distance / 1000).toFixed(2) : 0;
    const durationMin = Math.round((activity.moving_time || activity.elapsed_time || 0) / 60);
    
    let message = `## アクティビティ基本情報
- 種目: ${sportName}
- 日時: ${new Date(activity.start_date).toLocaleString('ja-JP')}
- 距離: ${distance} km
- 時間: ${durationMin}分
- TSS: ${activity.tss || '不明'}
`;

    // ペース/速度
    if (activity.average_speed) {
        message += `- 平均: ${formatPace(activity.average_speed, sportType)}\n`;
    }

    // 心拍
    if (activity.average_heartrate) {
        message += `- 平均心拍: ${Math.round(activity.average_heartrate)} bpm`;
        if (activity.max_heartrate) {
            message += ` / 最大: ${Math.round(activity.max_heartrate)} bpm`;
        }
        message += '\n';
    }

    // バイク: パワーメトリクス
    if (sportCategory === 'bike') {
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
        if (activity.average_cadence) {
            message += `- 平均ケイデンス: ${Math.round(activity.average_cadence)} rpm\n`;
        }
    }

    // ラン: ピッチとストライド
    if (sportCategory === 'run') {
        if (activity.average_cadence) {
            const pitch = Math.round(activity.average_cadence * 2);
            message += `- 平均ピッチ: ${pitch} spm\n`;
            
            // ストライド長を計算
            if (activity.average_speed) {
                const speedMPerMin = activity.average_speed * 60;
                const stride = (speedMPerMin / pitch).toFixed(2);
                message += `- 平均ストライド長: ${stride} m\n`;
            }
        }
    }

    // スイム: ストロークメトリクス
    if (sportCategory === 'swim') {
        if (activity.average_cadence) {
            message += `- 平均ストロークレート: ${Math.round(activity.average_cadence)} spm\n`;
        }
        // DPSはラップデータから計算される場合がある
    }

    // 標高
    if (activity.total_elevation_gain && activity.total_elevation_gain > 20) {
        message += `- 獲得標高: ${Math.round(activity.total_elevation_gain)} m\n`;
    }

    // ストリーム分析データ（詳細な統計情報）
    if (streamAnalysis) {
        message += `\n## パフォーマンス分析データ\n`;
        
        if (streamAnalysis.paceAnalysis) {
            const pa = streamAnalysis.paceAnalysis;
            message += `### ペーシング\n`;
            message += `- 前半ペース: ${pa.firstHalfPace}\n`;
            message += `- 後半ペース: ${pa.secondHalfPace}\n`;
            message += `- スプリット: ${pa.splitType}（差: ${pa.splitDiff}）\n`;
            if (pa.variability) {
                message += `- ペース変動係数: ${pa.variability}%\n`;
            }
            if (pa.slowestSection && pa.fastestSection) {
                message += `- 最速区間: ${pa.fastestSection}\n`;
                message += `- 最遅区間: ${pa.slowestSection}\n`;
            }
        }
        
        if (streamAnalysis.heartRateAnalysis) {
            const hra = streamAnalysis.heartRateAnalysis;
            message += `### 心拍分析\n`;
            if (hra.drift !== undefined) {
                message += `- 心拍ドリフト: ${hra.drift > 0 ? '+' : ''}${hra.drift}%（前半→後半）\n`;
            }
            if (hra.zones) {
                message += `- Zone分布: Z1=${hra.zones.z1}%, Z2=${hra.zones.z2}%, Z3=${hra.zones.z3}%, Z4=${hra.zones.z4}%, Z5=${hra.zones.z5}%\n`;
            }
            if (hra.efficiency) {
                message += `- 心拍効率: ${hra.efficiency}（ペースあたりの心拍コスト）\n`;
            }
        }
        
        if (streamAnalysis.elevationAnalysis) {
            const ea = streamAnalysis.elevationAnalysis;
            message += `### 地形分析\n`;
            if (ea.climbingPaceLoss) {
                message += `- 登りでのペース低下: ${ea.climbingPaceLoss}%\n`;
            }
            if (ea.gradeAdjustedPace) {
                message += `- 勾配調整ペース (GAP): ${ea.gradeAdjustedPace}\n`;
            }
        }

        // スイム用のストローク分析
        if (streamAnalysis.swimAnalysis) {
            const sa = streamAnalysis.swimAnalysis;
            message += `### スイム技術分析\n`;
            if (sa.avgStrokeRate) {
                message += `- 平均ストロークレート: ${sa.avgStrokeRate} spm\n`;
            }
            if (sa.avgDPS) {
                message += `- 平均DPS (Distance Per Stroke): ${sa.avgDPS} m\n`;
            }
            if (sa.strokeCount) {
                message += `- 総ストローク数: ${sa.strokeCount}\n`;
            }
        }
    }

    // 過去の類似アクティビティとの比較
    if (similarActivities && similarActivities.length > 0) {
        message += `\n## 過去の類似トレーニングとの比較\n`;
        similarActivities.slice(0, 3).forEach((sim, i) => {
            const simDate = new Date(sim.start_date).toLocaleDateString('ja-JP');
            const simPace = formatPace(sim.average_speed, sportType);
            const simHr = sim.average_heartrate ? Math.round(sim.average_heartrate) : '-';
            message += `${i + 1}. ${simDate}: ${(sim.distance/1000).toFixed(1)}km, ${simPace}, HR ${simHr}bpm\n`;
        });
        
        // 比較分析
        const latest = similarActivities[0];
        if (latest && activity.average_speed && latest.average_speed) {
            const paceChange = ((activity.average_speed / latest.average_speed) - 1) * 100;
            message += `→ 直近の類似トレーニングと比較: ペース${paceChange > 0 ? '+' : ''}${paceChange.toFixed(1)}%\n`;
        }
    }

    // トレーニングステータス
    if (trainingStatus) {
        message += `\n## 現在のトレーニングステータス\n`;
        message += `- CTL (フィットネス): ${trainingStatus.ctl}\n`;
        message += `- ATL (疲労): ${trainingStatus.atl}\n`;
        message += `- TSB (フォーム): ${trainingStatus.tsb}\n`;
        
        if (trainingStatus.ctlTrend !== undefined) {
            const trend = trainingStatus.ctlTrend > 0 ? '上昇中' : trainingStatus.ctlTrend < 0 ? '低下中' : '横ばい';
            message += `- 7日間のCTL変化: ${trainingStatus.ctlTrend > 0 ? '+' : ''}${trainingStatus.ctlTrend}（${trend}）\n`;
        }
    }

    // Lapデータがある場合
    if (activity.laps && activity.laps.length > 1) {
        message += `\n## Lap詳細\n`;
        
        if (sportCategory === 'swim') {
            // スイムのラップ（RESTを除いた泳ぎラップのみ）
            const swimLaps = activity.laps.filter(lap => {
                const movingTime = lap.moving_time || 0;
                return movingTime >= 10 && lap.distance > 0;
            });
            
            swimLaps.slice(0, 10).forEach((lap, i) => {
                const lapPace = formatPace(lap.average_speed, sportType);
                const lapHr = lap.average_heartrate ? Math.round(lap.average_heartrate) : '-';
                const strokeRate = lap.average_cadence ? Math.round(lap.average_cadence) : '-';
                
                // ストローク数とDPSを計算
                let strokes = lap.total_strokes;
                if (!strokes && lap.average_cadence && lap.moving_time) {
                    strokes = Math.round(lap.average_cadence * lap.moving_time / 60);
                }
                const dps = strokes && lap.distance > 0 ? (lap.distance / strokes).toFixed(2) : '-';
                
                message += `Lap ${i + 1}: ${Math.round(lap.distance)}m, ${lapPace}, HR ${lapHr}bpm, Rate ${strokeRate}spm, DPS ${dps}m\n`;
            });
        } else if (sportCategory === 'run') {
            // ランのラップ
            activity.laps.slice(0, 10).forEach((lap, i) => {
                const lapPace = formatPace(lap.average_speed, sportType);
                const lapHr = lap.average_heartrate ? Math.round(lap.average_heartrate) : '-';
                
                // ピッチとストライド
                let pitchStr = '-';
                let strideStr = '-';
                if (lap.average_cadence) {
                    const pitch = Math.round(lap.average_cadence * 2);
                    pitchStr = pitch + 'spm';
                    if (lap.average_speed && lap.moving_time) {
                        const speedMPerMin = lap.average_speed * 60;
                        const stride = (speedMPerMin / pitch).toFixed(2);
                        strideStr = stride + 'm';
                    }
                }
                
                message += `Lap ${i + 1}: ${(lap.distance/1000).toFixed(2)}km, ${lapPace}, HR ${lapHr}bpm, Pitch ${pitchStr}, Stride ${strideStr}\n`;
            });
        } else {
            // バイク等
            activity.laps.slice(0, 10).forEach((lap, i) => {
                const lapPace = formatPace(lap.average_speed, sportType);
                const lapHr = lap.average_heartrate ? Math.round(lap.average_heartrate) : '-';
                const lapPower = lap.average_watts ? Math.round(lap.average_watts) + 'W' : '-';
                message += `Lap ${i + 1}: ${(lap.distance/1000).toFixed(2)}km, ${lapPace}, HR ${lapHr}bpm, Power ${lapPower}\n`;
            });
        }
    }

    // 質問がある場合
    if (userQuestion) {
        message += `\n---\n## 選手からの質問\n${userQuestion}\n\nこの質問に対して、上記データを踏まえて具体的に回答してください。`;
    } else {
        message += `\n---\n上記データを分析し、最も重要な洞察とアクションを提供してください。`;
    }

    return message;
}

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
    const swim = ['Swim'];
    const bike = ['Ride', 'VirtualRide', 'EBikeRide'];
    const run = ['Run', 'TrailRun', 'VirtualRun'];
    
    if (swim.includes(sportType)) return 'swim';
    if (bike.includes(sportType)) return 'bike';
    if (run.includes(sportType)) return 'run';
    return 'other';
}

function formatPace(avgSpeed, sportType) {
    if (!avgSpeed || avgSpeed <= 0) return '-';
    
    if (sportType === 'Swim') {
        const pace = 100 / avgSpeed;
        const min = Math.floor(pace / 60);
        const sec = Math.round(pace % 60);
        return `${min}:${String(sec).padStart(2, '0')}/100m`;
    } else if (sportType.includes('Ride')) {
        return `${(avgSpeed * 3.6).toFixed(1)} km/h`;
    } else {
        const pace = 1000 / avgSpeed;
        const min = Math.floor(pace / 60);
        const sec = Math.round(pace % 60);
        return `${min}:${String(sec).padStart(2, '0')}/km`;
    }
}
