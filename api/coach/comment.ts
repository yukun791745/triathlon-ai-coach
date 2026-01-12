import type { VercelRequest, VercelResponse } from '@vercel/node'

const SESSION_EVALUATION: Record<string, any> = {
  swim_drill_focus: { purpose: 'フォーム改善・技術習得', focus: 'ストローク効率、フォームの一貫性', goodSigns: ['DPS維持/向上', '心拍Z1-Z2で技術に集中'], concerns: ['後半でDPS低下', '強度上がりすぎ'] },
  swim_endurance: { purpose: '有酸素能力向上', focus: 'ペース安定性、心拍ドリフト', goodSigns: ['Z2で安定', '心拍ドリフト10%以内'], concerns: ['心拍ドリフト大', '後半ペースダウン'] },
  swim_threshold: { purpose: '乳酸処理能力向上', focus: 'CSSペースの維持', goodSigns: ['CSSペース±3秒/100m', 'Z3-Z4維持'], concerns: ['ペースばらつき', '後半ペースダウン'] },
  bike_endurance: { purpose: '有酸素ベース構築', focus: 'Z2維持、心拍ドリフト', goodSigns: ['Z2維持', '心拍ドリフト10%以内'], concerns: ['登りでZ3-Z4', '心拍ドリフト大'] },
  bike_threshold: { purpose: 'FTP向上', focus: 'FTP±3%維持', goodSigns: ['FTP維持', 'Z4安定'], concerns: ['パワー維持できず', 'Z5突入'] },
  bike_brick: { purpose: 'バイク→ラン移行適応', focus: '後半パワー維持、ラン移行', goodSigns: ['後半パワー維持', 'ラン脚動いた'], concerns: ['バイクで追い込みすぎ'] },
  run_easy: { purpose: '有酸素ベース構築', focus: 'Z2維持、会話ペース', goodSigns: ['Z2維持', '会話ペース'], concerns: ['ペース上がりすぎ'] },
  run_long: { purpose: '持久力向上', focus: 'Z2維持、後半ペース維持', goodSigns: ['後半までZ2', 'ネガティブスプリット'], concerns: ['後半ペースダウン'] },
  run_tempo: { purpose: '乳酸閾値向上', focus: 'LTペース維持', goodSigns: ['閾値ペース維持', 'Z3-Z4安定'], concerns: ['ペース維持できず'] },
  run_interval: { purpose: 'VO2max向上', focus: '各本のタイム維持', goodSigns: ['設定ペースクリア', 'セット間維持'], concerns: ['後半タイム低下'] },
  race: { purpose: 'パフォーマンス発揮', focus: '目標タイム、ペーシング', goodSigns: ['目標達成', '計画通りのペーシング'], concerns: ['オーバーペース'] },
  other: { purpose: 'ユーザー定義', focus: '補足内容に基づく', goodSigns: [], concerns: [] }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { activity, trainingStatus, streamAnalysis, similarActivities, userQuestion, conversationHistory, sessionType, sessionSupplement, raceGoal } = req.body

    if (!activity) return res.status(400).json({ error: 'アクティビティデータが必要です' })

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OpenAI APIキーが設定されていません' })

    const observations = extractObservations(activity, streamAnalysis, sessionType)
    const systemPrompt = buildSystemPrompt(!!userQuestion, sessionType, !!(raceGoal?.raceName), !!(sessionSupplement?.trim()))
    const userMessage = buildUserMessage(activity, trainingStatus, streamAnalysis, similarActivities, userQuestion, sessionType, sessionSupplement, raceGoal, observations)

    const messages: any[] = [{ role: 'system', content: systemPrompt }]
    if (conversationHistory?.length > 0) conversationHistory.forEach((msg: any) => messages.push(msg))
    messages.push({ role: 'user', content: userMessage })

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 800, temperature: 0.6 })
    })

    if (!response.ok) {
      const errorData = await response.json()
      return res.status(response.status).json({ error: 'AI APIエラー', details: errorData.error?.message })
    }

    const data = await response.json()
    const comment = data.choices[0]?.message?.content || 'コメントを生成できませんでした'

    return res.status(200).json({ success: true, comment, usage: data.usage, sessionType })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

function buildSystemPrompt(isQuestion: boolean, sessionType: string, hasRaceGoal: boolean, hasSupplement: boolean): string {
  if (isQuestion) {
    return `あなたは「AIトライアスロンコーチ」です。運動生理学に精通し、選手の質問にデータを根拠に回答します。250-350字程度で回答してください。`
  }
  const evaluation = SESSION_EVALUATION[sessionType] || SESSION_EVALUATION.other
  let prompt = `あなたは「AIトライアスロンコーチ」です。

【今回のセッション】
- 目的: ${evaluation.purpose}
- 評価の焦点: ${evaluation.focus}
- 良いサイン: ${evaluation.goodSigns.join('、')}
- 注意すべき点: ${evaluation.concerns.join('、')}

【コメントの構成】
1. 称賛・ねぎらい（必須・冒頭）
2. 良かった点（必須）
3. 改善点・次への提案（必須）`

  if (hasSupplement) prompt += `\n4. 補足コメントへの言及（必須）`
  if (hasRaceGoal) prompt += `\n\n**レース目標との関連**（状況に応じて言及）`

  prompt += `\n\n【出力形式】自然な日本語、350-450字程度、絵文字なし`
  return prompt
}

function buildUserMessage(activity: any, trainingStatus: any, streamAnalysis: any, similarActivities: any, userQuestion: string, sessionType: string, sessionSupplement: string, raceGoal: any, observations: any[]): string {
  const sportName = getSportName(activity.sport_type || activity.type)
  const distance = activity.distance ? (activity.distance / 1000).toFixed(2) : 0
  const durationMin = Math.round((activity.moving_time || activity.elapsed_time || 0) / 60)
  const evaluation = SESSION_EVALUATION[sessionType] || SESSION_EVALUATION.other

  let message = `## セッション情報\n- 種目: ${sportName}\n- セッションタイプ: ${sessionType}\n- 目的: ${evaluation.purpose}\n\n`

  if (sessionSupplement?.trim()) {
    message += `## ★ ユーザーからの補足コメント\n「${sessionSupplement.trim()}」\n\n`
  }

  if (raceGoal?.raceName) {
    message += `## Aレース目標\n- レース名: ${raceGoal.raceName}\n`
    if (raceGoal.raceDate) message += `- レース日: ${raceGoal.raceDate}\n`
    if (raceGoal.goalTime) message += `- 目標タイム: ${raceGoal.goalTime}\n`
    message += '\n'
  }

  message += `## 基本データ\n- 日時: ${new Date(activity.start_date).toLocaleString('ja-JP')}\n- 距離: ${distance}km / 時間: ${durationMin}分\n`
  if (activity.average_heartrate) message += `- 心拍: 平均${Math.round(activity.average_heartrate)}bpm\n`
  if (activity.average_watts) message += `- パワー: ${Math.round(activity.average_watts)}W\n`
  message += '\n'

  if (observations.length > 0) {
    message += '## 観察された特徴\n'
    observations.forEach(obs => { message += `- ${obs.fact}${obs.interpretation ? ' → ' + obs.interpretation : ''}\n` })
    message += '\n'
  }

  if (userQuestion) {
    message += `---\n## 選手からの質問\n${userQuestion}`
  } else {
    message += `---\n上記のデータを踏まえて、このトレーニングについてコメントしてください。`
  }

  return message
}

function extractObservations(activity: any, streamAnalysis: any, sessionType: string): any[] {
  const observations: any[] = []
  if (streamAnalysis?.paceAnalysis) {
    const splitDiff = parseFloat(streamAnalysis.paceAnalysis.splitDiff)
    if (!isNaN(splitDiff) && splitDiff > 5) {
      observations.push({ type: 'pacing', fact: `後半ペースが${Math.abs(splitDiff).toFixed(1)}%向上`, interpretation: 'ネガティブスプリット成功' })
    } else if (!isNaN(splitDiff) && splitDiff < -10) {
      observations.push({ type: 'pacing', fact: `後半ペースが${Math.abs(splitDiff).toFixed(1)}%低下`, interpretation: 'オーバーペースまたは疲労' })
    }
  }
  if (streamAnalysis?.heartRateAnalysis) {
    const drift = parseFloat(streamAnalysis.heartRateAnalysis.drift)
    if (!isNaN(drift) && drift < 5 && activity.moving_time > 2400) {
      observations.push({ type: 'heart_rate', fact: `心拍ドリフト${drift.toFixed(1)}%`, interpretation: '優秀な有酸素効率' })
    } else if (!isNaN(drift) && drift > 12) {
      observations.push({ type: 'heart_rate', fact: `心拍ドリフト${drift.toFixed(1)}%`, interpretation: '脱水・暑熱・オーバーペースの影響' })
    }
  }
  return observations
}

function getSportName(sportType: string): string {
  const names: Record<string, string> = { 'Run': 'ランニング', 'TrailRun': 'トレイルラン', 'VirtualRun': 'トレッドミル', 'Ride': 'バイク', 'VirtualRide': 'インドアバイク', 'Swim': 'スイム' }
  return names[sportType] || sportType
}
