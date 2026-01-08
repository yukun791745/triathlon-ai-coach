// netlify/functions/strava-training-load.js
// CTL (Chronic Training Load)、ATL (Acute Training Load)、TSB (Training Stress Balance) 計算
// フィットネス、疲労、フォームの指標を計算

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
            // TSS履歴データ（日付とTSS値のペア）
            tssHistory,
            // または、計算済みの日別TSS配列
            dailyTss,
            // 計算パラメータ
            ctlDays = 42,  // CTL（フィットネス）の時定数：42日
            atlDays = 7,   // ATL（疲労）の時定数：7日
            // 現在のCTL/ATL値（継続計算用）
            initialCtl = 0,
            initialAtl = 0
        } = JSON.parse(event.body);

        if (!tssHistory && !dailyTss) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'tssHistory または dailyTss が必要です',
                    example: {
                        tssHistory: [
                            { date: '2024-01-01', tss: 75 },
                            { date: '2024-01-02', tss: 50 }
                        ]
                    }
                })
            };
        }

        console.log('Calculating training load metrics...');

        // 日別TSSを準備
        let processedDailyTss;
        
        if (dailyTss) {
            processedDailyTss = dailyTss;
        } else {
            // tssHistoryから日別TSSを集計
            processedDailyTss = aggregateTssByDay(tssHistory);
        }

        // CTL、ATL、TSBを計算
        const metrics = calculateTrainingMetrics(
            processedDailyTss, 
            ctlDays, 
            atlDays, 
            initialCtl, 
            initialAtl
        );

        // 週間サマリーを計算
        const weeklySummary = calculateWeeklySummary(processedDailyTss);

        // 月間サマリーを計算
        const monthlySummary = calculateMonthlySummary(processedDailyTss);

        // トレーニング分析
        const analysis = analyzeTraining(metrics, weeklySummary);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                calculatedAt: new Date().toISOString(),
                parameters: {
                    ctlDays,
                    atlDays
                },
                // 現在の値
                current: {
                    ctl: metrics.length > 0 ? metrics[metrics.length - 1].ctl : 0,
                    atl: metrics.length > 0 ? metrics[metrics.length - 1].atl : 0,
                    tsb: metrics.length > 0 ? metrics[metrics.length - 1].tsb : 0,
                    fitness: getFitnessLevel(metrics.length > 0 ? metrics[metrics.length - 1].ctl : 0),
                    fatigue: getFatigueLevel(metrics.length > 0 ? metrics[metrics.length - 1].atl : 0),
                    form: getFormStatus(metrics.length > 0 ? metrics[metrics.length - 1].tsb : 0)
                },
                // 日別推移
                daily: metrics,
                // 週間サマリー
                weekly: weeklySummary,
                // 月間サマリー
                monthly: monthlySummary,
                // 分析
                analysis: analysis
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};


// ============================================
// TSS履歴を日別に集計
// ============================================
function aggregateTssByDay(tssHistory) {
    const dailyMap = {};
    
    tssHistory.forEach(item => {
        const date = item.date.split('T')[0]; // YYYY-MM-DD形式に正規化
        if (!dailyMap[date]) {
            dailyMap[date] = 0;
        }
        dailyMap[date] += item.tss || 0;
    });
    
    // 日付順にソート
    const sortedDates = Object.keys(dailyMap).sort();
    
    // 欠損日を0で埋める
    const result = [];
    if (sortedDates.length > 0) {
        const startDate = new Date(sortedDates[0]);
        const endDate = new Date(sortedDates[sortedDates.length - 1]);
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            result.push({
                date: dateStr,
                tss: dailyMap[dateStr] || 0
            });
        }
    }
    
    return result;
}


// ============================================
// CTL、ATL、TSBを計算
// ============================================
function calculateTrainingMetrics(dailyTss, ctlDays, atlDays, initialCtl, initialAtl) {
    const results = [];
    
    // 指数移動平均の係数
    const ctlFactor = 1 - Math.exp(-1 / ctlDays);
    const atlFactor = 1 - Math.exp(-1 / atlDays);
    
    let ctl = initialCtl;
    let atl = initialAtl;
    
    dailyTss.forEach(day => {
        const tss = day.tss || 0;
        
        // 指数移動平均で更新
        // CTL = CTL_yesterday + (TSS - CTL_yesterday) / 42
        // ATL = ATL_yesterday + (TSS - ATL_yesterday) / 7
        ctl = ctl + (tss - ctl) * ctlFactor;
        atl = atl + (tss - atl) * atlFactor;
        
        // TSB = CTL - ATL
        const tsb = ctl - atl;
        
        results.push({
            date: day.date,
            tss: Math.round(tss),
            ctl: Math.round(ctl * 10) / 10,  // 小数点1桁
            atl: Math.round(atl * 10) / 10,
            tsb: Math.round(tsb * 10) / 10
        });
    });
    
    return results;
}


// ============================================
// 週間サマリー計算
// ============================================
function calculateWeeklySummary(dailyTss) {
    const weeklyMap = {};
    
    dailyTss.forEach(day => {
        const date = new Date(day.date);
        // ISO週番号を取得
        const weekStart = getWeekStart(date);
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weeklyMap[weekKey]) {
            weeklyMap[weekKey] = {
                weekStart: weekKey,
                totalTss: 0,
                days: 0,
                maxTss: 0,
                activities: []
            };
        }
        
        weeklyMap[weekKey].totalTss += day.tss || 0;
        weeklyMap[weekKey].days++;
        weeklyMap[weekKey].maxTss = Math.max(weeklyMap[weekKey].maxTss, day.tss || 0);
    });
    
    // 配列に変換してソート
    return Object.values(weeklyMap)
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
        .map(week => ({
            ...week,
            totalTss: Math.round(week.totalTss),
            avgTssPerDay: Math.round(week.totalTss / week.days)
        }));
}


// ============================================
// 月間サマリー計算
// ============================================
function calculateMonthlySummary(dailyTss) {
    const monthlyMap = {};
    
    dailyTss.forEach(day => {
        const monthKey = day.date.substring(0, 7); // YYYY-MM
        
        if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = {
                month: monthKey,
                totalTss: 0,
                days: 0,
                trainingDays: 0,
                maxTss: 0
            };
        }
        
        monthlyMap[monthKey].totalTss += day.tss || 0;
        monthlyMap[monthKey].days++;
        if (day.tss > 0) {
            monthlyMap[monthKey].trainingDays++;
        }
        monthlyMap[monthKey].maxTss = Math.max(monthlyMap[monthKey].maxTss, day.tss || 0);
    });
    
    return Object.values(monthlyMap)
        .sort((a, b) => a.month.localeCompare(b.month))
        .map(month => ({
            ...month,
            totalTss: Math.round(month.totalTss),
            avgTssPerDay: Math.round(month.totalTss / month.days),
            avgTssPerTrainingDay: month.trainingDays > 0 
                ? Math.round(month.totalTss / month.trainingDays) 
                : 0
        }));
}


// ============================================
// トレーニング分析
// ============================================
function analyzeTraining(metrics, weeklySummary) {
    const analysis = {};
    
    if (metrics.length === 0) {
        return { message: 'データが不足しています' };
    }
    
    const current = metrics[metrics.length - 1];
    
    // フィットネストレンド（過去4週間）
    const fourWeeksAgo = metrics.length > 28 ? metrics[metrics.length - 29] : metrics[0];
    analysis.fitnessTrend = {
        change: Math.round((current.ctl - fourWeeksAgo.ctl) * 10) / 10,
        direction: current.ctl > fourWeeksAgo.ctl ? '上昇' : current.ctl < fourWeeksAgo.ctl ? '下降' : '横ばい',
        percentage: fourWeeksAgo.ctl > 0 
            ? Math.round((current.ctl - fourWeeksAgo.ctl) / fourWeeksAgo.ctl * 100) 
            : 0
    };
    
    // 週間TSSトレンド
    if (weeklySummary.length >= 2) {
        const lastWeek = weeklySummary[weeklySummary.length - 1];
        const prevWeek = weeklySummary[weeklySummary.length - 2];
        
        analysis.weeklyTrend = {
            lastWeekTss: lastWeek.totalTss,
            prevWeekTss: prevWeek.totalTss,
            change: lastWeek.totalTss - prevWeek.totalTss,
            changePercent: prevWeek.totalTss > 0 
                ? Math.round((lastWeek.totalTss - prevWeek.totalTss) / prevWeek.totalTss * 100)
                : 0
        };
        
        // 推奨週間TSS（漸進的オーバーロード原則：5-10%増）
        analysis.recommendedWeeklyTss = {
            min: Math.round(prevWeek.totalTss * 1.0),  // 維持
            optimal: Math.round(prevWeek.totalTss * 1.05),  // 5%増
            max: Math.round(prevWeek.totalTss * 1.10)  // 10%増
        };
    }
    
    // レース準備状態の評価
    analysis.raceReadiness = evaluateRaceReadiness(current.ctl, current.atl, current.tsb);
    
    // トレーニングアドバイス
    analysis.advice = generateTrainingAdvice(current, weeklySummary);
    
    return analysis;
}


// ============================================
// レース準備状態の評価
// ============================================
function evaluateRaceReadiness(ctl, atl, tsb) {
    // 理想的なレースコンディション
    // - TSB: +5 ~ +25
    // - CTL: できるだけ高い
    // - ATL: CTLより適度に低い
    
    let readiness = {
        score: 0,
        status: '',
        details: []
    };
    
    // TSBベースの評価
    if (tsb >= 5 && tsb <= 25) {
        readiness.score += 40;
        readiness.details.push('フォーム良好（TSB +5～+25）');
    } else if (tsb >= -10 && tsb < 5) {
        readiness.score += 25;
        readiness.details.push('やや疲労あり');
    } else if (tsb >= 25 && tsb <= 40) {
        readiness.score += 30;
        readiness.details.push('十分な回復（ディトレーニングの可能性）');
    } else if (tsb < -10) {
        readiness.score += 10;
        readiness.details.push('疲労蓄積中（回復が必要）');
    } else {
        readiness.score += 15;
        readiness.details.push('休養過多（フィットネス低下の可能性）');
    }
    
    // CTLベースの評価
    if (ctl >= 70) {
        readiness.score += 30;
        readiness.details.push('高いフィットネスレベル');
    } else if (ctl >= 50) {
        readiness.score += 20;
        readiness.details.push('中程度のフィットネスレベル');
    } else if (ctl >= 30) {
        readiness.score += 10;
        readiness.details.push('フィットネス構築中');
    } else {
        readiness.score += 5;
        readiness.details.push('フィットネス向上が必要');
    }
    
    // フィットネス/疲労バランス
    const ratio = ctl > 0 ? atl / ctl : 1;
    if (ratio >= 0.8 && ratio <= 1.2) {
        readiness.score += 30;
        readiness.details.push('バランスの取れた負荷');
    } else if (ratio > 1.2) {
        readiness.score += 15;
        readiness.details.push('急激な負荷増加');
    } else {
        readiness.score += 20;
        readiness.details.push('テーパリング中');
    }
    
    // 総合評価
    if (readiness.score >= 80) {
        readiness.status = 'レース最適';
    } else if (readiness.score >= 60) {
        readiness.status = 'レース可能';
    } else if (readiness.score >= 40) {
        readiness.status = 'トレーニング継続推奨';
    } else {
        readiness.status = '回復が必要';
    }
    
    return readiness;
}


// ============================================
// トレーニングアドバイス生成
// ============================================
function generateTrainingAdvice(current, weeklySummary) {
    const advice = [];
    
    // TSBベースのアドバイス
    if (current.tsb < -30) {
        advice.push({
            type: 'warning',
            message: '疲労が蓄積しています。1-2日の完全休養を推奨します。'
        });
    } else if (current.tsb < -10) {
        advice.push({
            type: 'caution',
            message: 'やや疲労気味です。リカバリーセッションを取り入れましょう。'
        });
    } else if (current.tsb > 25) {
        advice.push({
            type: 'info',
            message: '十分に回復しています。トレーニング強度を上げる良いタイミングです。'
        });
    } else if (current.tsb >= 5 && current.tsb <= 25) {
        advice.push({
            type: 'success',
            message: 'フォームが良好です。レースや高強度セッションに最適な状態です。'
        });
    }
    
    // CTLベースのアドバイス
    if (current.ctl < 30) {
        advice.push({
            type: 'info',
            message: 'フィットネスの基盤を作りましょう。週3-4回の有酸素運動を継続してください。'
        });
    } else if (current.ctl >= 70) {
        advice.push({
            type: 'success',
            message: '高いフィットネスレベルを維持しています。この状態を維持しましょう。'
        });
    }
    
    // 週間負荷のアドバイス
    if (weeklySummary.length >= 2) {
        const lastWeek = weeklySummary[weeklySummary.length - 1];
        const prevWeek = weeklySummary[weeklySummary.length - 2];
        const changePercent = prevWeek.totalTss > 0 
            ? (lastWeek.totalTss - prevWeek.totalTss) / prevWeek.totalTss * 100 
            : 0;
        
        if (changePercent > 15) {
            advice.push({
                type: 'warning',
                message: `週間負荷が${Math.round(changePercent)}%増加しています。急激な増加は怪我のリスクがあります。`
            });
        } else if (changePercent < -20) {
            advice.push({
                type: 'info',
                message: `週間負荷が${Math.round(Math.abs(changePercent))}%減少しています。回復週であれば問題ありません。`
            });
        }
    }
    
    return advice;
}


// ============================================
// ユーティリティ関数
// ============================================
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function getFitnessLevel(ctl) {
    if (ctl >= 100) return { level: '非常に高い', description: 'エリートレベル' };
    if (ctl >= 70) return { level: '高い', description: '競技志向' };
    if (ctl >= 50) return { level: '中程度', description: 'アクティブ' };
    if (ctl >= 30) return { level: '低め', description: '構築中' };
    return { level: '低い', description: '基礎から開始' };
}

function getFatigueLevel(atl) {
    if (atl >= 100) return { level: '非常に高い', description: '回復が必要' };
    if (atl >= 70) return { level: '高い', description: '注意が必要' };
    if (atl >= 50) return { level: '中程度', description: '適度' };
    if (atl >= 30) return { level: '低め', description: '回復済み' };
    return { level: '低い', description: '十分に回復' };
}

function getFormStatus(tsb) {
    if (tsb >= 25) return { status: '非常に良い', description: 'レース最適、またはトレーニング不足' };
    if (tsb >= 5) return { status: '良い', description: 'パフォーマンス発揮に最適' };
    if (tsb >= -10) return { status: '普通', description: '通常のトレーニング状態' };
    if (tsb >= -30) return { status: '疲労', description: '回復を考慮' };
    return { status: '過労', description: '休養が必要' };
}
