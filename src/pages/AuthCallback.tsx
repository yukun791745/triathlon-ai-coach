import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { post } from '../lib/api'
import { useStrava } from '../hooks/useStrava'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { saveTokens } = useStrava()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      exchangeCode(code)
    } else {
      setError('認証コードがありません')
    }
  }, [searchParams])

  const exchangeCode = async (code: string) => {
    try {
      const data = await post<{
        access_token: string
        refresh_token: string
        expires_at: number
      }>('/strava/auth', { code })
      
      saveTokens(data.access_token, data.refresh_token, data.expires_at)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '認証に失敗しました')
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <a href="/" className="text-blue-500">ホームに戻る</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>認証中...</p>
    </div>
  )
}
