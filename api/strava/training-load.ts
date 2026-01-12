import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      tssHistory,
      dailyTss,
      ctlDays = 42,
      atlDays = 7,
      initialCtl = 0,
      initialAtl = 0
    } = req.body

    if (!tssHistory && !dailyTss) {
      return res.status(400).json({
        error: 'tssHistory または dailyTss が必要です'
      })
    }

    let processedDailyTss = dailyTss || aggregateTssByDay(tssHistory)
    const metrics = calculateTrainingMetrics(processedDailyTss, ctlDays, atlDays, initialCtl, initialAtl)
    const weeklySummary = calculateWeeklySummary(processedDailyTss)
    const monthlySummary = calculateMonthlySummary(processedDailyTss)
    const analysis = analyzeTraining(metrics, weeklySummary)

    return res.status(200).json({
      success: true,
      calculatedAt: new Date().toISOString(),
      parameters: { ctlDays, atlDays },
      current: {
        ctl: metrics.length > 0 ? metrics[metrics.length - 1].ctl : 0,
        atl: metrics.length > 0 ? metrics[metrics.length - 1].atl : 0,
        tsb: metrics.length > 0 ? metrics[metrics.length - 1].tsb : 0,
        fitness: getFitnessLevel(metrics.length > 0 ? metrics[metrics.length - 1].ctl : 0),
        fatigue: getFatigueLevel(metrics.length > 0 ? metrics[metrics.length - 1].atl : 0),
        form: getFormStatus(metrics.length > 0 ? metrics[metrics.length - 1].tsb : 0)
      },
      daily: metrics,
      weekly: weeklySummary,
      monthly: monthlySummary,
      analysis
    })

  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

function aggregateTssByDay(tssHistory: any[]) {
  const dailyMap: Record<string, number> = {}
  tssHistory.forEach(item => {
    const date = item.date.split('T')[0]
    dailyMap[date] = (dailyMap[date] || 0) + (item.tss || 0)
  })
  const sortedDates = Object.keys(dailyMap).sort()
  const result: any[] = []
  if (sortedDates.length > 0) {
    const startDate = new Date(sortedDates[0])
    const endDate = new Date(sortedDates[sortedDates.length - 1])
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      result.push({ date: dateStr, tss: dailyMap[dateStr] || 0 })
    }
  }
  return result
}

function calculateTrainingMetrics(dailyTss: any[], ctlDays: number, atlDays: number, initialCtl: number, initialAtl: number) {
  const ctlFactor = 1 - Math.exp(-1 / ctlDays)
  const atlFactor = 1 - Math.exp(-1 / atlDays)
  let ctl = initialCtl, atl = initialAtl
  return dailyTss.map(day => {
    const tss = day.tss || 0
    ctl = ctl + (tss - ctl) * ctlFactor
    atl = atl + (tss - atl) * atlFactor
    return {
      date: day.date,
      tss: Math.round(tss),
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round((ctl - atl) * 10) / 10
    }
  })
}

function calculateWeeklySummary(dailyTss: any[]) {
  const weeklyMap: Record<string, any> = {}
  dailyTss.forEach(day => {
    const date = new Date(day.date)
    const weekStart = getWeekStart(date).toISOString().split('T')[0]
    if (!weeklyMap[weekStart]) {
      weeklyMap[weekStart] = { weekStart, totalTss: 0, days: 0, maxTss: 0 }
    }
    weeklyMap[weekStart].totalTss += day.tss || 0
    weeklyMap[weekStart].days++
    weeklyMap[weekStart].maxTss = Math.max(weeklyMap[weekStart].maxTss, day.tss || 0)
  })
  return Object.values(weeklyMap).sort((a: any, b: any) => a.weekStart.localeCompare(b.weekStart)).map((week: any) => ({
    ...week,
    totalTss: Math.round(week.totalTss),
    avgTssPerDay: Math.round(week.totalTss / week.days)
  }))
}

function calculateMonthlySummary(dailyTss: any[]) {
  const monthlyMap: Record<string, any> = {}
  dailyTss.forEach(day => {
    const monthKey = day.date.substring(0, 7)
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = { month: monthKey, totalTss: 0, days: 0, trainingDays: 0, maxTss: 0 }
    }
    monthlyMap[monthKey].totalTss += day.tss || 0
    monthlyMap[monthKey].days++
    if (day.tss > 0) monthlyMap[monthKey].trainingDays++
    monthlyMap[monthKey].maxTss = Math.max(monthlyMap[monthKey].maxTss, day.tss || 0)
  })
  return Object.values(monthlyMap).sort((a: any, b: any) => a.month.localeCompare(b.month)).map((month: any) => ({
    ...month,
    totalTss: Math.round(month.totalTss),
    avgTssPerDay: Math.round(month.totalTss / month.days),
    avgTssPerTrainingDay: month.trainingDays > 0 ? Math.round(month.totalTss / month.trainingDays) : 0
  }))
}

function analyzeTraining(metrics: any[], weeklySummary: any[]) {
  if (metrics.length === 0) return { message: 'データが不足しています' }
  const current = metrics[metrics.length - 1]
  const fourWeeksAgo = metrics.length > 28 ? metrics[metrics.length - 29] : metrics[0]
  const analysis: any = {
    fitnessTrend: {
      change: Math.round((current.ctl - fourWeeksAgo.ctl) * 10) / 10,
      direction: current.ctl > fourWeeksAgo.ctl ? '上昇' : current.ctl < fourWeeksAgo.ctl ? '下降' : '横ばい'
    }
  }
  if (weeklySummary.length >= 2) {
    const lastWeek = weeklySummary[weeklySummary.length - 1]
    const prevWeek = weeklySummary[weeklySummary.length - 2]
    analysis.weeklyTrend = {
      lastWeekTss: lastWeek.totalTss,
      prevWeekTss: prevWeek.totalTss,
      change: lastWeek.totalTss - prevWeek.totalTss
    }
  }
  analysis.raceReadiness = evaluateRaceReadiness(current.ctl, current.atl, current.tsb)
  analysis.advice = generateTrainingAdvice(current, weeklySummary)
  return analysis
}

function evaluateRaceReadiness(ctl: number, atl: number, tsb: number) {
  let score = 0
  const details: string[] = []
  if (tsb >= 5 && tsb <= 25) { score += 40; details.push('フォーム良好') }
  else if (tsb >= -10 && tsb < 5) { score += 25; details.push('やや疲労あり') }
  else if (tsb < -10) { score += 10; details.push('疲労蓄積中') }
  else { score += 20; details.push('十分な回復') }
  if (ctl >= 70) { score += 30; details.push('高いフィットネス') }
  else if (ctl >= 50) { score += 20; details.push('中程度のフィットネス') }
  else { score += 10; details.push('フィットネス構築中') }
  let status = score >= 80 ? 'レース最適' : score >= 60 ? 'レース可能' : score >= 40 ? 'トレーニング継続推奨' : '回復が必要'
  return { score, status, details }
}

function generateTrainingAdvice(current: any, weeklySummary: any[]) {
  const advice: any[] = []
  if (current.tsb < -30) advice.push({ type: 'warning', message: '疲労が蓄積しています。休養を推奨します。' })
  else if (current.tsb < -10) advice.push({ type: 'caution', message: 'やや疲労気味です。' })
  else if (current.tsb > 25) advice.push({ type: 'info', message: '十分に回復しています。' })
  else if (current.tsb >= 5) advice.push({ type: 'success', message: 'フォームが良好です。' })
  return advice
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

function getFitnessLevel(ctl: number) {
  if (ctl >= 100) return { level: '非常に高い', description: 'エリートレベル' }
  if (ctl >= 70) return { level: '高い', description: '競技志向' }
  if (ctl >= 50) return { level: '中程度', description: 'アクティブ' }
  if (ctl >= 30) return { level: '低め', description: '構築中' }
  return { level: '低い', description: '基礎から開始' }
}

function getFatigueLevel(atl: number) {
  if (atl >= 100) return { level: '非常に高い', description: '回復が必要' }
  if (atl >= 70) return { level: '高い', description: '注意が必要' }
  if (atl >= 50) return { level: '中程度', description: '適度' }
  return { level: '低め', description: '回復済み' }
}

function getFormStatus(tsb: number) {
  if (tsb >= 25) return { status: '非常に良い', description: 'レース最適' }
  if (tsb >= 5) return { status: '良い', description: 'パフォーマンス発揮に最適' }
  if (tsb >= -10) return { status: '普通', description: '通常のトレーニング状態' }
  if (tsb >= -30) return { status: '疲労', description: '回復を考慮' }
  return { status: '過労', description: '休養が必要' }
}
