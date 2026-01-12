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
    const { token, activityIds } = req.body

    if (!token || !activityIds || !Array.isArray(activityIds)) {
      return res.status(400).json({ error: 'トークンとアクティビティIDの配列が必要です' })
    }

    const BATCH_SIZE = 10
    const DELAY_MS = 1000

    const results: any[] = []
    const errors: any[] = []

    for (let i = 0; i < activityIds.length; i += BATCH_SIZE) {
      const batch = activityIds.slice(i, i + BATCH_SIZE)

      const batchPromises = batch.map(async (activityId: string) => {
        try {
          const response = await fetch(
            `https://www.strava.com/api/v3/activities/${activityId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          )

          if (!response.ok) {
            throw new Error(`API error: ${response.status}`)
          }

          const activity = await response.json()
          return {
            success: true,
            id: activityId,
            data: activity
          }
        } catch (error) {
          console.error(`Error fetching activity ${activityId}:`, error)
          return {
            success: false,
            id: activityId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)

      batchResults.forEach(result => {
        if (result.success) {
          results.push(result.data)
        } else {
          errors.push({ id: result.id, error: result.error })
        }
      })

      if (i + BATCH_SIZE < activityIds.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS))
      }
    }

    return res.status(200).json({
      activities: results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: activityIds.length,
        success: results.length,
        failed: errors.length
      }
    })

  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
