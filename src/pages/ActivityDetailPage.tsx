import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStrava } from '../hooks/useStrava'
import { useCoach } from '../hooks/useCoach'
import Layout from '../components/common/Layout'
import Card, { CardHeader, CardBody } from '../components/common/Card'

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { fetchActivityDetail, loading } = useStrava()
  const { getComment, loading: coachLoading } = useCoach()
  const [activity, setActivity] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [coachComment, setCoachComment] = useState<string | null>(null)

  useEffect(() => {
    if (id) loadActivity()
  }, [id])

  const loadActivity = async () => {
    try {
      const data = await fetchActivityDetail(id!)
      setActivity(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    }
  }

  const requestCoachComment = async () => {
    if (!activity) return
    try {
      const comment = await getComment({
        activity,
        sessionType: getDefaultSessionType(activity.sport_type)
      })
      setCoachComment(comment)
    } catch (err) {
      console.error('Coach comment error:', err)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-slate-500">読み込み中...</p>
        </div>
      </Layout>
    )
  }

  if (error || !activity) {
    return (
      <Layout>
        <Link to="/" className="text-blue-500 mb-4 inline-block">← 戻る</Link>
        <p className="text-red-500">{error || 'アクティビティが見つかりません'}</p>
      </Layout>
    )
  }

  const sportIcon = getSportIcon(activity.sport_type)
  const sportColor = getSportColor(activity.sport_type)

  return (
    <Layout>
      <Link to="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 mb-4">
        <span>←</span> 戻る
      </Link>
      
      {/* ヘッダーカード */}
      <Card className="mb-4">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl ${sportColor}`}>
              {sportIcon}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-800">{activity.name}</h1>
              <p className="text-slate-500">
                {new Date(activity.start_date).toLocaleDateString('ja-JP', {
                  year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
                })}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 統計カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="距離" value={`${(activity.distance / 1000).toFixed(2)} km`} icon="📏" />
        <StatCard label="時間" value={formatDuration(activity.moving_time)} icon="⏱️" />
        <StatCard label="ペース" value={formatPace(activity.average_speed, activity.sport_type)} icon="⚡" />
        {activity.total_elevation_gain > 0 && (
          <StatCard label="獲得標高" value={`${Math.round(activity.total_elevation_gain)} m`} icon="⛰️" />
        )}
        {activity.average_heartrate && (
          <StatCard label="平均心拍" value={`${Math.round(activity.average_heartrate)} bpm`} icon="❤️" />
        )}
        {activity.max_heartrate && (
          <StatCard label="最大心拍" value={`${Math.round(activity.max_heartrate)} bpm`} icon="💓" />
        )}
        {activity.average_watts && (
          <StatCard label="平均パワー" value={`${Math.round(activity.average_watts)} W`} icon="💪" />
        )}
        {activity.calories && (
          <StatCard label="カロリー" value={`${activity.calories} kcal`} icon="🔥" />
        )}
      </div>

      {/* AIコーチ */}
      <Card className="mb-4">
        <CardHeader>
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <span className="text-xl">🤖</span> AIコーチ
          </h2>
        </CardHeader>
        <CardBody>
          {coachComment ? (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{coachComment}</p>
            </div>
          ) : (
            <button
              onClick={requestCoachComment}
              disabled={coachLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 disabled:from-slate-300 disabled:to-slate-300 transition-all flex items-center justify-center gap-2"
            >
              {coachLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  コメント生成中...
                </>
              ) : (
                <>✨ AIコーチのコメントを取得</>
              )}
            </button>
          )}
        </CardBody>
      </Card>

      {/* メモ */}
      {activity.description && (
        <Card>
          <CardHeader>
            <h2 className="font-bold text-slate-800">📝 メモ</h2>
          </CardHeader>
          <CardBody>
            <p className="text-slate-700">{activity.description}</p>
          </CardBody>
        </Card>
      )}
    </Layout>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <Card>
      <div className="p-4 text-center">
        <span className="text-2xl">{icon}</span>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
        <p className="text-lg font-bold text-slate-800">{value}</p>
      </div>
    </Card>
  )
}

function getDefaultSessionType(sportType: string): string {
  if (sportType === 'Swim') return 'swim_endurance'
  if (sportType?.includes('Ride')) return 'bike_endurance'
  if (sportType === 'Run' || sportType === 'TrailRun') return 'run_easy'
  return 'other'
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

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
