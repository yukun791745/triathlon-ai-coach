import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStrava } from '../hooks/useStrava'

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { fetchActivityDetail, loading } = useStrava()
  const [activity, setActivity] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      loadActivity()
    }
  }, [id])

  const loadActivity = async () => {
    try {
      const data = await fetchActivityDetail(id!)
      setActivity(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Link to="/" className="text-blue-500 mb-4 inline-block">← 戻る</Link>
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  if (!activity) {
    return null
  }

  const sportName = getSportName(activity.sport_type || activity.type)
  const distance = (activity.distance / 1000).toFixed(2)
  const duration = formatDuration(activity.moving_time)
  const pace = formatPace(activity.average_speed, activity.sport_type)

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Link to="/" className="text-blue-500 mb-4 inline-block">← 戻る</Link>
      
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <h1 className="text-2xl font-bold mb-2">{activity.name}</h1>
        <p className="text-gray-500 mb-4">
          {new Date(activity.start_date).toLocaleDateString('ja-JP', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
          })}
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="種目" value={sportName} />
          <StatCard label="距離" value={`${distance} km`} />
          <StatCard label="時間" value={duration} />
          <StatCard label="ペース" value={pace} />
          
          {activity.average_heartrate && (
            <StatCard label="平均心拍" value={`${Math.round(activity.average_heartrate)} bpm`} />
          )}
          {activity.max_heartrate && (
            <StatCard label="最大心拍" value={`${Math.round(activity.max_heartrate)} bpm`} />
          )}
          {activity.average_watts && (
            <StatCard label="平均パワー" value={`${Math.round(activity.average_watts)} W`} />
          )}
          {activity.total_elevation_gain > 0 && (
            <StatCard label="獲得標高" value={`${Math.round(activity.total_elevation_gain)} m`} />
          )}
          {activity.average_cadence && (
            <StatCard 
              label={activity.sport_type === 'Run' ? 'ピッチ' : 'ケイデンス'} 
              value={`${Math.round(activity.average_cadence * (activity.sport_type === 'Run' ? 2 : 1))} ${activity.sport_type === 'Run' ? 'spm' : 'rpm'}`} 
            />
          )}
          {activity.calories && (
            <StatCard label="カロリー" value={`${activity.calories} kcal`} />
          )}
        </div>
      </div>

      {activity.description && (
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="font-bold mb-2">メモ</h2>
          <p className="text-gray-700">{activity.description}</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

function getSportName(sportType: string): string {
  const names: Record<string, string> = {
    'Run': 'ランニング',
    'TrailRun': 'トレイルラン',
    'VirtualRun': 'トレッドミル',
    'Ride': 'バイク',
    'VirtualRide': 'インドアバイク',
    'Swim': 'スイム',
    'Walk': 'ウォーキング'
  }
  return names[sportType] || sportType
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatPace(avgSpeed: number, sportType: string): string {
  if (!avgSpeed || avgSpeed <= 0) return '-'
  
  if (sportType === 'Swim') {
    const pace = 100 / avgSpeed
    const min = Math.floor(pace / 60)
    const sec = Math.round(pace % 60)
    return `${min}:${String(sec).padStart(2, '0')}/100m`
  } else if (sportType?.includes('Ride')) {
    return `${(avgSpeed * 3.6).toFixed(1)} km/h`
  } else {
    const pace = 1000 / avgSpeed
    const min = Math.floor(pace / 60)
    const sec = Math.round(pace % 60)
    return `${min}:${String(sec).padStart(2, '0')}/km`
  }
}
