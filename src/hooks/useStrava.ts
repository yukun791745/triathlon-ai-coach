import { useState, useCallback } from 'react'
import { post } from '../lib/api'

export function useStrava() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getToken = () => localStorage.getItem('strava_access_token')
  const isAuthenticated = () => !!getToken()

  const saveTokens = (accessToken: string, refreshToken: string, expiresAt: number) => {
    localStorage.setItem('strava_access_token', accessToken)
    localStorage.setItem('strava_refresh_token', refreshToken)
    localStorage.setItem('strava_expires_at', expiresAt.toString())
  }

  const fetchActivities = useCallback(async (params: { per_page?: number; before?: number; after?: number } = {}) => {
    setLoading(true)
    setError(null)
    try {
      const data = await post<{ activities: any[] }>('/strava/activities', {
        token: getToken(),
        ...params
      })
      return data.activities
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch activities'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchActivityDetail = useCallback(async (activityId: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await post<{ activity: any }>('/strava/activity-detail', {
        token: getToken(),
        activityId
      })
      return data.activity
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch activity'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = () => {
    localStorage.removeItem('strava_access_token')
    localStorage.removeItem('strava_refresh_token')
    localStorage.removeItem('strava_expires_at')
  }

  return {
    loading,
    error,
    isAuthenticated,
    getToken,
    saveTokens,
    fetchActivities,
    fetchActivityDetail,
    logout
  }
}
