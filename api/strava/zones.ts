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

    const url = `https://www.strava.com/api/v3/activities/${activityId}/zones`

    console.log('Fetching zones for activity:', activityId)

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(200).json({
          success: true,
          activityId,
          zones: [],
          hasZones: false,
          message: 'このアクティビティにはゾーンデータがありません'
        })
      }
      const errorText = await response.text()
      return res.status(response.status).json({
        error: 'Strava APIエラー',
        status: response.status,
        details: errorText
      })
    }

    const rawZones = await response.json()

    const formattedZones = rawZones.map((zoneData: any) => {
      const zoneType = zoneData.type
      const distributionBuckets = zoneData.distribution_buckets || []

      const zones = distributionBuckets.map((bucket: any, index: number) => ({
        zone: index + 1,
        min: bucket.min,
        max: bucket.max,
        time: bucket.time,
        time_formatted: formatDuration(bucket.time),
        range: bucket.max === -1 ? `${bucket.min}+` : `${bucket.min}-${bucket.max}`
      }))

      const totalTime = zones.reduce((sum: number, z: any) => sum + z.time, 0)

      zones.forEach((zone: any) => {
        zone.percentage = totalTime > 0 ? ((zone.time / totalTime) * 100).toFixed(1) : 0
      })

      const analysis = analyzeZones(zones, zoneType)

      return {
        type: zoneType,
        sensor_based: zoneData.sensor_based,
        custom_zones: zoneData.custom_zones,
        zones,
        totalTime,
        totalTime_formatted: formatDuration(totalTime),
        analysis
      }
    })

    const heartrateZones = formattedZones.find((z: any) => z.type === 'heartrate')
    const powerZones = formattedZones.find((z: any) => z.type === 'power')

    return res.status(200).json({
      success: true,
      activityId,
      heartrateZones: heartrateZones || null,
      powerZones: powerZones || null,
      hasZones: formattedZones.length > 0,
      allZones: formattedZones
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
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function analyzeZones(zones: any[], zoneType: string) {
  const analysis: any = {}

  const maxTimeZone = zones.reduce((max: any, zone: any) =>
    zone.time > max.time ? zone : max, zones[0])

  analysis.dominantZone = {
    zone: maxTimeZone.zone,
    time: maxTimeZone.time_formatted,
    percentage: maxTimeZone.percentage
  }

  if (zoneType === 'heartrate') {
    const zoneDescriptions: Record<number, { name: string; description: string }> = {
      1: { name: 'リカバリー', description: '非常に軽い運動、回復促進' },
      2: { name: '有酸素ベース', description: '脂肪燃焼、持久力向上' },
      3: { name: 'テンポ', description: '有酸素能力向上、レースペース' },
      4: { name: '閾値', description: '乳酸閾値向上、高強度' },
      5: { name: '最大', description: '最大心拍、スプリント・インターバル' }
    }

    zones.forEach(zone => {
      const desc = zoneDescriptions[zone.zone]
      if (desc) {
        zone.name = desc.name
        zone.description = desc.description
      }
    })

    const lowIntensityTime = zones.filter(z => z.zone <= 2).reduce((sum, z) => sum + z.time, 0)
    const moderateIntensityTime = zones.filter(z => z.zone === 3).reduce((sum, z) => sum + z.time, 0)
    const highIntensityTime = zones.filter(z => z.zone >= 4).reduce((sum, z) => sum + z.time, 0)
    const totalTime = zones.reduce((sum, z) => sum + z.time, 0)

    if (totalTime > 0) {
      analysis.intensityDistribution = {
        low: { time: formatDuration(lowIntensityTime), percentage: ((lowIntensityTime / totalTime) * 100).toFixed(1) },
        moderate: { time: formatDuration(moderateIntensityTime), percentage: ((moderateIntensityTime / totalTime) * 100).toFixed(1) },
        high: { time: formatDuration(highIntensityTime), percentage: ((highIntensityTime / totalTime) * 100).toFixed(1) }
      }

      const highIntensityRatio = highIntensityTime / totalTime
      if (highIntensityRatio > 0.3) analysis.trainingType = 'インターバル/高強度トレーニング'
      else if (highIntensityRatio > 0.1) analysis.trainingType = 'テンポ/閾値トレーニング'
      else analysis.trainingType = 'イージー/リカバリーラン'
    }
  }

  if (zoneType === 'power') {
    const zoneDescriptions: Record<number, { name: string; description: string }> = {
      1: { name: 'アクティブリカバリー', description: '回復走' },
      2: { name: '耐久力', description: 'ロングライド' },
      3: { name: 'テンポ', description: '中強度持続' },
      4: { name: '乳酸閾値', description: 'FTP付近' },
      5: { name: 'VO2max', description: '高強度インターバル' },
      6: { name: '無酸素', description: 'ショートインターバル' },
      7: { name: '神経筋', description: 'スプリント' }
    }

    zones.forEach(zone => {
      const desc = zoneDescriptions[zone.zone]
      if (desc) {
        zone.name = desc.name
        zone.description = desc.description
      }
    })
  }

  return analysis
}
