import { useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'
import { api } from '@/services/api'

const POLL_INTERVAL_MS = 5000

export const useSessionWatch = () => {
  const { state } = useAuth()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (state.status !== 'authenticated') return

    const check = async () => {
      try {
        await api.get('/auth/session-check')
      } catch {
      }
    }

    intervalRef.current = setInterval(check, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [state.status])
}
