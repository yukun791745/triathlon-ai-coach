import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStrava } from '../hooks/useStrava'
import Layout from '../components/common/Layout'
import Card from '../components/common/Card'

export default function HomePage() {
  const { fetchActivities, isAuthenticated, loading, logout } = useStrava()
  const [activities, setActivities] = useState<any[]>([])

  useEffect(() => {
    if (isAuthenticated()) {
      loadData()
    }
  }, [])

  const loadData = async () => {
    try {
      const data = await fetchActivities({ per_page: 20 })
      setActivities(data)
    } catch (error) {
      console.error('Failed to load:', error)
    }
  }

  if (!isAuthenticated()) {
    return <StravaLoginPrompt />
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">最近のアクティビティ</h1>
        <button 
          onClick={() => { logout(); window.location.reload() }} 
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ログアウト
        </button>
      </div>
      
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-slate-500">読み込み中...</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {activities.map((activity: any) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </Layout>
  )
}

function ActivityCard({ activity }: { activity: any }) {
  const sportIcon = getSportIcon(activity.sport_type)
  const sportColor = getSportColor(activity.sport_type)
  
  return (
    <Link to={`/activity/${activity.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <div className="p-4 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${sportColor}`}>
            {sportIcon}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800">{activity.name}</h3>
            <p className="text-sm text-slate-500">
              {formatDate(activity.start_date)} • {(activity.distance / 1000).toFixed(1)}km • {formatDuration(activity.moving_time)}
            </p>
          </div>
          <div className="text-right">
            {activity.average_heartrate && (
              <p className="text-sm text-slate-600">❤️ {Math.round(activity.average_heartrate)} bpm</p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}

function StravaLoginPrompt() {
  const clientId = '171117'
  const redirectUri = `${window.location.origin}/auth/callback`
  const scope = 'read,activity:read_all'
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🏊🚴🏃</div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Triathlon AI Coach</h1>
        <p className="text-slate-500 mb-6">AIがあなたのトレーニングを分析し、パーソナライズされたアドバイスを提供します</p>
        <a 
          href={authUrl} 
          className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-full font-semibold hover:bg-orange-600 transition-colors shadow-lg"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
          </svg>
          Stravaでログイン
        </a>
      </div>
    </div>
  )
}

function getSportIcon(sportType: string): string {
  const icons: Record<string, string> = {
    'Run': '🏃', 'TrailRun': '🏔️', 'VirtualRun': '🏃',
    'Ride': '🚴', 'VirtualRide': '🚴', 'Swim': '🏊', 'Walk': '🚶'
  }
  return icons[sportType] || '🏋️'
}

function getSportColor(sportType: string): string {
  if (sportType === 'Swim') return 'bg-blue-100'
  if (sportType?.includes('Ride')) return 'bg-green-100'
  if (sportType === 'Run' || sportType === 'TrailRun') return 'bg-orange-100'
  return 'bg-slate-100'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}時間${m}分`
  return `${m}分`
}
