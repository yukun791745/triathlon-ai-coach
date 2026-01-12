import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== Enhanced Strava Function ===')

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST method required' })
  }

  try {
    const { token, before, after, per_page = 200 } = req.body || {}

    if (!token) {
      return res.status(400).json({ error: 'Token required' })
    }

    console.log('Request params:', { before, after, per_page })

    let url = `https://www.strava.com/api/v3/athlete/activities?per_page=${per_page}`

    if (before) {
      url += `&before=${before}`
      console.log('Using BEFORE parameter:', before)
    }

    if (after) {
      url += `&after=${after}`
      console.log('Using AFTER parameter:', after)
    }

    console.log('Strava API URL:', url)

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    console.log('Strava response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Strava API error:', errorText)

      return res.status(response.status).json({
        error: `Strava API Error: ${response.status}`,
        message: errorText
      })
    }

    const activities = await response.json()
    console.log('Activities received:', activities.length)

    if (activities.length > 0) {
      const firstDate = activities[0].start_date
      const lastDate = activities[activities.length - 1].start_date
      console.log('Date range:', firstDate, 'to', lastDate)
    }

    return res.status(200).json({
      success: true,
      activities: activities,
      count: activities.length
    })

  } catch (error) {
    console.error('Function error:', error)

    return res.status(500).json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
