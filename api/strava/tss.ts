import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { activity, ftp, lthr, css, maxHr } = req.body

    if (!activity) {
      return res.status(400).json({ error: 'Activity data required' })
    }

    const sportType = activity.sport_type || activity.type
    const movingTime = activity.moving_time || 0
    const durationHours = movingTime / 3600

    let tss = 0
    let intensityFactor = 0
    let normalizedValue = 0

    // バイク: パワーベースTSS
    if (sportType?.includes('Ride') && activity.weighted_average_watts && ftp) {
      normalizedValue = activity.weighted_average_watts
      intensityFactor = normalizedValue / ftp
      tss = (movingTime * normalizedValue * intensityFactor) / (ftp * 3600) * 100
    }
    // ラン: rTSS (心拍ベース)
    else if ((sportType === 'Run' || sportType === 'TrailRun') && activity.average_heartrate && lthr) {
      const hrRatio = activity.average_heartrate / lthr
      intensityFactor = hrRatio
      tss = durationHours * Math.pow(hrRatio, 2) * 100
    }
    // スイム: sTSS
    else if (sportType === 'Swim' && activity.average_speed && css) {
      const avgPace = 100 / activity.average_speed
      const cssSeconds = parseFloat(css) * 60
      intensityFactor = cssSeconds / avgPace
      tss = durationHours * Math.pow(intensityFactor, 3) * 100
    }
    // 心拍ベースTSS (フォールバック)
    else if (activity.average_heartrate && maxHr) {
      const hrRatio = activity.average_heartrate / maxHr
      tss = durationHours * Math.pow(hrRatio, 2) * 100
    }

    return res.status(200).json({
      success: true,
      tss: Math.round(tss),
      intensityFactor: Math.round(intensityFactor * 100) / 100,
      normalizedValue: Math.round(normalizedValue),
      method: sportType?.includes('Ride') ? 'power' : sportType === 'Swim' ? 'pace' : 'heart_rate'
    })

  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}
