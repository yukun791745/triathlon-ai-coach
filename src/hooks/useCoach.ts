import { useState, useCallback } from 'react'
import { post } from '../lib/api'

export function useCoach() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getComment = useCallback(async (params: {
    activity: any
    sessionType?: string
    sessionSupplement?: string
    raceGoal?: any
    userQuestion?: string
  }) => {
    setLoading(true)
    setError(null)
    try {
      const data = await post<{ comment: string }>('/coach/comment', params)
      return data.comment
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get comment'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, getComment }
}
