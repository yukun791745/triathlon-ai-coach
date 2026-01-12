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
    const { token, activityId } = req.body

    if (!token || !activityId) {
      return res.status(400).json({ error: 'トークンとアクティビティIDが必要です' })
    }

    const response = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Strava API error:', response.status, errorText)
      return res.status(response.status).json({
        error: 'Strava APIエラー',
        status: response.status,
        details: errorText
      })
    }

    const activity = await response.json()

    const detailData = {
      id: activity.id,
      name: activity.name,
      type: activity.type,
      sport_type: activity.sport_type,
      start_date: activity.start_date,
      distance: activity.distance,
      moving_time: activity.moving_time,
      elapsed_time: activity.elapsed_time,
      total_elevation_gain: activity.total_elevation_gain,
      average_heartrate: activity.average_heartrate,
      max_heartrate: activity.max_heartrate,
      has_heartrate: activity.has_heartrate,
      average_watts: activity.average_watts,
      weighted_average_watts: activity.weighted_average_watts,
      max_watts: activity.max_watts,
      calories: activity.calories,
      device_name: activity.device_name,
    }

    return res.status(200).json({
      activity: detailData,
      raw: activity
    })

  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
