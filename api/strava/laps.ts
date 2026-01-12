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

    const url = `https://www.strava.com/api/v3/activities/${activityId}/laps`

    console.log('Fetching laps for activity:', activityId)

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Strava API error:', response.status, errorText)

      return res.status(response.status).json({
        error: 'Strava APIエラー',
        status: response.status,
        details: errorText
      })
    }

    const rawLaps = await response.json()

    const laps = rawLaps.map((lap: any, index: number) => {
      let pacePerKm = null
      if (lap.distance > 0 && lap.moving_time > 0) {
        pacePerKm = (lap.moving_time / 60) / (lap.distance / 1000)
      }

      let speedKmh = null
      if (lap.distance > 0 && lap.moving_time > 0) {
        speedKmh = (lap.distance / 1000) / (lap.moving_time / 3600)
      }

      return {
        lap_index: index + 1,
        id: lap.id,
        name: lap.name,
        distance: lap.distance,
        distance_km: (lap.distance / 1000).toFixed(2),
        moving_time: lap.moving_time,
        elapsed_time: lap.elapsed_time,
        moving_time_formatted: formatDuration(lap.moving_time),
        elapsed_time_formatted: formatDuration(lap.elapsed_time),
        pace_per_km: pacePerKm,
        pace_formatted: pacePerKm ? formatPace(pacePerKm) : null,
        average_speed: lap.average_speed,
        max_speed: lap.max_speed,
        speed_kmh: speedKmh ? speedKmh.toFixed(1) : null,
        average_heartrate: lap.average_heartrate,
        max_heartrate: lap.max_heartrate,
        total_elevation_gain: lap.total_elevation_gain,
        elev_high: lap.elev_high,
        elev_low: lap.elev_low,
        average_watts: lap.average_watts,
        average_cadence: lap.average_cadence,
        start_index: lap.start_index,
        end_index: lap.end_index,
        start_date: lap.start_date,
        start_date_local: lap.start_date_local
      }
    })

    const lapAnalysis = analyzeLaps(laps)

    console.log('Laps retrieved:', laps.length)

    return res.status(200).json({
      success: true,
      activityId: activityId,
      laps: laps,
      lapCount: laps.length,
      analysis: lapAnalysis
    })

  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatPace(paceMinPerKm: number): string {
  if (!paceMinPerKm || paceMinPerKm <= 0) return '-'
  const minutes = Math.floor(paceMinPerKm)
  const seconds = Math.round((paceMinPerKm - minutes) * 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`
}

function analyzeLaps(laps: any[]) {
  if (laps.length === 0) return null

  const lapsWithPace = laps.filter(l => l.pace_per_km && l.pace_per_km > 0)

  const analysis: any = {
    totalLaps: laps.length,
    totalDistance: laps.reduce((sum, l) => sum + (l.distance || 0), 0),
    totalTime: laps.reduce((sum, l) => sum + (l.moving_time || 0), 0)
  }

  if (lapsWithPace.length > 0) {
    const paces = lapsWithPace.map(l => l.pace_per_km)
    const fastestPace = Math.min(...paces)
    const slowestPace = Math.max(...paces)
    const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length

    analysis.pace = {
      fastest: formatPace(fastestPace),
      slowest: formatPace(slowestPace),
      average: formatPace(avgPace),
      fastestLapIndex: lapsWithPace.find(l => l.pace_per_km === fastestPace)?.lap_index,
      slowestLapIndex: lapsWithPace.find(l => l.pace_per_km === slowestPace)?.lap_index,
      variance: ((slowestPace - fastestPace) / avgPace * 100).toFixed(1) + '%'
    }
  }

  const lapsWithHR = laps.filter(l => l.average_heartrate)
  if (lapsWithHR.length > 0) {
    const hrs = lapsWithHR.map(l => l.average_heartrate)
    analysis.heartrate = {
      min: Math.min(...hrs),
      max: Math.max(...hrs),
      average: Math.round(hrs.reduce((a, b)
cat > api/strava/laps.ts << 'EOF'
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

    const url = `https://www.strava.com/api/v3/activities/${activityId}/laps`

    console.log('Fetching laps for activity:', activityId)

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Strava API error:', response.status, errorText)

      return res.status(response.status).json({
        error: 'Strava APIエラー',
        status: response.status,
        details: errorText
      })
    }

    const rawLaps = await response.json()

    const laps = rawLaps.map((lap: any, index: number) => {
      let pacePerKm = null
      if (lap.distance > 0 && lap.moving_time > 0) {
        pacePerKm = (lap.moving_time / 60) / (lap.distance / 1000)
      }

      let speedKmh = null
      if (lap.distance > 0 && lap.moving_time > 0) {
        speedKmh = (lap.distance / 1000) / (lap.moving_time / 3600)
      }

      return {
        lap_index: index + 1,
        id: lap.id,
        name: lap.name,
        distance: lap.distance,
        distance_km: (lap.distance / 1000).toFixed(2),
        moving_time: lap.moving_time,
        elapsed_time: lap.elapsed_time,
        moving_time_formatted: formatDuration(lap.moving_time),
        elapsed_time_formatted: formatDuration(lap.elapsed_time),
        pace_per_km: pacePerKm,
        pace_formatted: pacePerKm ? formatPace(pacePerKm) : null,
        average_speed: lap.average_speed,
        max_speed: lap.max_speed,
        speed_kmh: speedKmh ? speedKmh.toFixed(1) : null,
        average_heartrate: lap.average_heartrate,
        max_heartrate: lap.max_heartrate,
        total_elevation_gain: lap.total_elevation_gain,
        elev_high: lap.elev_high,
        elev_low: lap.elev_low,
        average_watts: lap.average_watts,
        average_cadence: lap.average_cadence,
        start_index: lap.start_index,
        end_index: lap.end_index,
        start_date: lap.start_date,
        start_date_local: lap.start_date_local
      }
    })

    const lapAnalysis = analyzeLaps(laps)

    console.log('Laps retrieved:', laps.length)

    return res.status(200).json({
      success: true,
      activityId: activityId,
      laps: laps,
      lapCount: laps.length,
      analysis: lapAnalysis
    })

  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatPace(paceMinPerKm: number): string {
  if (!paceMinPerKm || paceMinPerKm <= 0) return '-'
  const minutes = Math.floor(paceMinPerKm)
  const seconds = Math.round((paceMinPerKm - minutes) * 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`
}

function analyzeLaps(laps: any[]) {
  if (laps.length === 0) return null

  const lapsWithPace = laps.filter(l => l.pace_per_km && l.pace_per_km > 0)

  const analysis: any = {
    totalLaps: laps.length,
    totalDistance: laps.reduce((sum, l) => sum + (l.distance || 0), 0),
    totalTime: laps.reduce((sum, l) => sum + (l.moving_time || 0), 0)
  }

  if (lapsWithPace.length > 0) {
    const paces = lapsWithPace.map(l => l.pace_per_km)
    const fastestPace = Math.min(...paces)
    const slowestPace = Math.max(...paces)
    const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length

    analysis.pace = {
      fastest: formatPace(fastestPace),
      slowest: formatPace(slowestPace),
      average: formatPace(avgPace),
      fastestLapIndex: lapsWithPace.find(l => l.pace_per_km === fastestPace)?.lap_index,
      slowestLapIndex: lapsWithPace.find(l => l.pace_per_km === slowestPace)?.lap_index,
      variance: ((slowestPace - fastestPace) / avgPace * 100).toFixed(1) + '%'
    }
  }

  const lapsWithHR = laps.filter(l => l.average_heartrate)
  if (lapsWithHR.length > 0) {
    const hrs = lapsWithHR.map(l => l.average_heartrate)
    analysis.heartrate = {
      min: Math.min(...hrs),
      max: Math.max(...hrs),
      average: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length)
    }
  }

  const totalElevGain = laps.reduce((sum, l) => sum + (l.total_elevation_gain || 0), 0)
  if (totalElevGain > 0) {
    analysis.elevation = {
      totalGain: Math.round(totalElevGain)
    }
  }

  if (lapsWithPace.length >= 2) {
    const midPoint = Math.floor(lapsWithPace.length / 2)
    const firstHalfPaces = lapsWithPace.slice(0, midPoint).map(l => l.pace_per_km)
    const secondHalfPaces = lapsWithPace.slice(midPoint).map(l => l.pace_per_km)

    const firstHalfAvg = firstHalfPaces.reduce((a, b) => a + b, 0) / firstHalfPaces.length
    const secondHalfAvg = secondHalfPaces.reduce((a, b) => a + b, 0) / secondHalfPaces.length

    analysis.splitAnalysis = {
      firstHalfAvgPace: formatPace(firstHalfAvg),
      secondHalfAvgPace: formatPace(secondHalfAvg),
      isNegativeSplit: secondHalfAvg < firstHalfAvg,
      difference: formatPace(Math.abs(secondHalfAvg - firstHalfAvg))
    }
  }

  return analysis
}
