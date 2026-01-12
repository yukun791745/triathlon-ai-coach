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
    const { token, activityId, thresholds = {} } = req.body

    if (!token || !activityId) {
      return res.status(400).json({ error: 'トークンとアクティビティIDが必要です' })
    }

    const userThresholds = {
      ftp: thresholds.ftp || 200,
      rFtpPacePerKm: thresholds.rFtpPacePerKm || 300,
      sFtpPacePer100m: thresholds.sFtpPacePer100m || 100,
      maxHr: thresholds.maxHr || 190,
      thresholdHr: thresholds.thresholdHr || 170
    }

    console.log('Calculating TSS for activity:', activityId)

    const detailResponse = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    if (!detailResponse.ok) {
      throw new Error(`Activity fetch failed: ${detailResponse.status}`)
    }

    const activity = await detailResponse.json()
    const activityType = activity.sport_type || activity.type

    const streamKeys = 'time,distance,velocity_smooth,watts,heartrate,altitude,grade_smooth'
    const streamResponse = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=${streamKeys}&key_type=time`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    let streams: Record<string, number[]> = {}
    if (streamResponse.ok) {
      const rawStreams = await streamResponse.json()
      if (Array.isArray(rawStreams)) {
        rawStreams.forEach((stream: any) => {
          streams[stream.type] = stream.data
        })
      }
    }

    let tssResult
    if (['Ride', 'VirtualRide', 'EBikeRide', 'Handcycle', 'Velomobile'].includes(activityType)) {
      tssResult = calculateBikeTSS(activity, streams, userThresholds)
    } else if (['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike'].includes(activityType)) {
      tssResult = calculateRunTSS(activity, streams, userThresholds)
    } else if (['Swim'].includes(activityType)) {
      tssResult = calculateSwimTSS(activity, streams, userThresholds)
    } else {
      tssResult = calculateHrTSS(activity, streams, userThresholds)
    }

    return res.status(200).json({
      success: true,
      activityId,
      activityType,
      activityName: activity.name,
      date: activity.start_date_local,
      duration: {
        moving_time: activity.moving_time,
        elapsed_time: activity.elapsed_time,
        formatted: formatDuration(activity.moving_time)
      },
      distance: {
        meters: activity.distance,
        km: (activity.distance / 1000).toFixed(2)
      },
      tss: tssResult,
      thresholdsUsed: userThresholds
    })

  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

function calculateBikeTSS(activity: any, streams: any, thresholds: any) {
  const result: any = { type: 'TSS', sport: 'Bike', method: null, tss: null, details: {} }
  const movingTime = activity.moving_time
  const durationHours = movingTime / 3600
  const ftp = thresholds.ftp

  if (streams.watts && streams.watts.length > 0) {
    result.method = 'power_stream'
    const np = calculateNormalizedPower(streams.watts, streams.time)
    const avgPower = streams.watts.reduce((a: number, b: number) => a + b, 0) / streams.watts.length
    const intensityFactor = np / ftp
    const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100)
    result.tss = tss
    result.details = { normalizedPower: Math.round(np), averagePower: Math.round(avgPower), intensityFactor: intensityFactor.toFixed(2), ftp }
  } else if (activity.weighted_average_watts || activity.average_watts) {
    result.method = 'activity_power'
    const np = activity.weighted_average_watts || activity.average_watts
    const intensityFactor = np / ftp
    const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100)
    result.tss = tss
    result.details = { normalizedPower: Math.round(np), intensityFactor: intensityFactor.toFixed(2), ftp }
  } else if (streams.heartrate || activity.average_heartrate) {
    result.method = 'heartrate_fallback'
    const hrResult = calculateHrTSS(activity, streams, thresholds)
    result.tss = hrResult.tss
    result.details = hrResult.details
  } else {
    result.method = 'duration_estimate'
    result.tss = Math.round(durationHours * 50)
  }
  return result
}

function calculateRunTSS(activity: any, streams: any, thresholds: any) {
  const result: any = { type: 'rTSS', sport: 'Run', method: null, tss: null, details: {} }
  const movingTime = activity.moving_time
  const durationHours = movingTime / 3600
  const rFtpPacePerKm = thresholds.rFtpPacePerKm

  if (streams.velocity_smooth && streams.velocity_smooth.length > 0) {
    result.method = 'pace_stream'
    const ngpVelocity = calculateNormalizedValue(streams.velocity_smooth, streams.time, 30)
    const ngpPacePerKm = ngpVelocity > 0 ? 1000 / ngpVelocity : 0
    const intensityFactor = ngpPacePerKm > 0 ? rFtpPacePerKm / ngpPacePerKm : 0
    const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100)
    result.tss = tss
    result.details = { ngpPace: formatPace(ngpPacePerKm), intensityFactor: intensityFactor.toFixed(2) }
  } else if (activity.average_speed && activity.average_speed > 0) {
    result.method = 'activity_pace'
    const avgPacePerKm = 1000 / activity.average_speed
    const intensityFactor = rFtpPacePerKm / avgPacePerKm
    const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100)
    result.tss = tss
    result.details = { avgPace: formatPace(avgPacePerKm), intensityFactor: intensityFactor.toFixed(2) }
  } else if (streams.heartrate || activity.average_heartrate) {
    result.method = 'heartrate_fallback'
    const hrResult = calculateHrTSS(activity, streams, thresholds)
    result.tss = hrResult.tss
    result.details = hrResult.details
  } else {
    result.method = 'duration_estimate'
    result.tss = Math.round(durationHours * 60)
  }
  return result
}

function calculateSwimTSS(activity: any, streams: any, thresholds: any) {
  const result: any = { type: 'sTSS', sport: 'Swim', method: null, tss: null, details: {} }
  const movingTime = activity.moving_time
  const durationHours = movingTime / 3600
  const distance = activity.distance
  const sFtpPacePer100m = thresholds.sFtpPacePer100m

  if (streams.velocity_smooth && streams.velocity_smooth.length > 0) {
    result.method = 'pace_stream'
    const npVelocity = calculateNormalizedValue(streams.velocity_smooth, streams.time, 30)
    const npPacePer100m = npVelocity > 0 ? 100 / npVelocity : 0
    const intensityFactor = npPacePer100m > 0 ? sFtpPacePer100m / npPacePer100m : 0
    const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100)
    result.tss = tss
    result.details = { npPace: formatSwimPace(npPacePer100m), intensityFactor: intensityFactor.toFixed(2) }
  } else if (distance > 0 && movingTime > 0) {
    result.method = 'activity_pace'
    const avgPacePer100m = 100 / (distance / movingTime)
    const intensityFactor = sFtpPacePer100m / avgPacePer100m
    const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100)
    result.tss = tss
    result.details = { avgPace: formatSwimPace(avgPacePer100m), intensityFactor: intensityFactor.toFixed(2) }
  } else if (streams.heartrate || activity.average_heartrate) {
    result.method = 'heartrate_fallback'
    const hrResult = calculateHrTSS(activity, streams, thresholds)
    result.tss = hrResult.tss
    result.details = hrResult.details
  } else {
    result.method = 'duration_estimate'
    result.tss = Math.round(durationHours * 50)
  }
  return result
}

function calculateHrTSS(activity: any, streams: any, thresholds: any) {
  const result: any = { type: 'hrTSS', sport: 'Generic', method: null, tss: null, details: {} }
  const movingTime = activity.moving_time
  const durationHours = movingTime / 3600
  const thresholdHr = thresholds.thresholdHr

  if (streams.heartrate && streams.heartrate.length > 0) {
    result.method = 'hr_stream'
    const validHr = streams.heartrate.filter((hr: number) => hr > 0)
    const avgHr = validHr.reduce((a: number, b: number) => a + b, 0) / validHr.length
    const intensityFactor = avgHr / thresholdHr
    const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100 * 0.9)
    result.tss = tss
    result.details = { avgHeartrate: Math.round(avgHr), intensityFactor: intensityFactor.toFixed(2) }
  } else if (activity.average_heartrate) {
    result.method = 'activity_hr'
    const intensityFactor = activity.average_heartrate / thresholdHr
    const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100 * 0.9)
    result.tss = tss
    result.details = { avgHeartrate: activity.average_heartrate, intensityFactor: intensityFactor.toFixed(2) }
  } else {
    result.method = 'duration_estimate'
    result.tss = Math.round(durationHours * 50)
  }
  return result
}

function calculateNormalizedPower(powerData: number[], timeData: number[]) {
  return calculateNormalizedValue(powerData, timeData, 30)
}

function calculateNormalizedValue(data: number[], timeData: number[], windowSeconds = 30) {
  if (!data || data.length === 0) return 0
  const validData = data.filter(v => v > 0)
  if (validData.length === 0) return 0
  const times = timeData || data.map((_, i) => i)
  const windowedData: number[] = []
  let windowSum = 0, windowCount = 0, windowStartIdx = 0
  for (let i = 0; i < data.length; i++) {
    windowSum += data[i]
    windowCount++
    while (windowStartIdx < i && (times[i] - times[windowStartIdx]) > windowSeconds) {
      windowSum -= data[windowStartIdx]
      windowCount--
      windowStartIdx++
    }
    if (windowCount > 0) windowedData.push(windowSum / windowCount)
  }
  if (windowedData.length === 0) return 0
  const fourthPowers = windowedData.map(v => Math.pow(v, 4))
  const avgFourthPower = fourthPowers.reduce((a, b) => a + b, 0) / fourthPowers.length
  return Math.pow(avgFourthPower, 0.25)
}

function formatDuration(seconds: number) {
  if (!seconds) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatPace(secondsPerKm: number) {
  if (!secondsPerKm || secondsPerKm <= 0) return '-'
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`
[200~cat _legacy/netlify/functions/strava-training-load.js~}

function formatSwimPace(secondsPer100m: number) {
  if (!secondsPer100m || secondsPer100m <= 0) return '-'
  const minutes = Math.floor(secondsPer100m / 60)
  const seconds = Math.round(secondsPer100m % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}/100m`
}
