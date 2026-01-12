import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStrava } from '../hooks/useStrava'

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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">ログアウト</button>
      </div>
      
      {loading ? (
        <div className="text-center py-8">読み込み中...</div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity: any) => (
            <Link to={`/activity/${activity.id}`} key={activity.id}>
              <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{activity.name}</h3>
                    <p className="text-sm text-gray-600">
                      {getSportIcon(activity.sport_type)} {activity.sport_type} • {(activity.distance / 1000).toFixed(1)}km
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(activity.start_date).toLocaleDateString('ja-JP')}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function getSportIcon(sportType: string): string {
  const icons: Record<string, string> = {
    'Run': '🏃',
    'TrailRun': '🏔️',
    'VirtualRun': '🏃',
    'Ride': '🚴',
    'VirtualRide': '🚴',
    'Swim': '🏊',
    'Walk': '🚶'
  }
  return icons[sportType] || '🏋️'
}

function StravaLoginPrompt() {
  const clientId = '171117'
  const redirectUri = `${window.location.origin}/auth/callback`
  const scope = 'read,activity:read_all'
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Triathlon AI Coach</h1>
        <a href={authUrl} className="px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold inline-block hover:bg-orange-600">
          Stravaでログイン
        </a>
      </div>
    </div>
  )
}
