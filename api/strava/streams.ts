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

    const streamTypes = [
      'time',
      'distance',
      'heartrate',
      'cadence',
      'watts',
      'velocity_smooth',
      'altitude',
      'grade_smooth',
      'moving',
      'latlng'
    ]

    const url = `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=${streamTypes.join(',')}&key_by_type=true`

    console.log('Fetching streams for activity:', activityId)

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Strava API error:', response.status, errorText)

      if (response.status === 404) {
        return res.status(200).json({
          hasStreams: false,
          message: 'このアクティビティにはストリームデータがありません'
        })
      }

      return res.status(response.status).json({
        error: 'Strava APIエラー',
        status: response.status,
        details: errorText
      })
    }

    const streams = await response.json()

    const formattedStreams: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(streams)) {
      formattedStreams[key] = value
    }

    console.log('Streams retrieved:', Object.keys(formattedStreams))

    return res.status(200).json({
      hasStreams: Object.keys(formattedStreams).length > 0,
      streams: formattedStreams
    })

  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
