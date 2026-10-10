import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

const ACTIVITY_EVENTS = [
  'mousedown', 'mousemove', 'keydown',
  'touchstart', 'scroll', 'click',
] as const

export const useInactivityLogout = () => {
  const { state, logout } = useAuth()
  const navigate = useNavigate()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const timeoutMinutes =
    state.status === 'authenticated'
      ? state.sessionConfig?.inactivityTimeoutMinutes ?? 0
      : 0

  const handleTimeout = useCallback(async () => {
    await logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  useEffect(() => {
    if (timeoutMinutes <= 0) return

    const timeoutMs = timeoutMinutes * 60 * 1000

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => { void handleTimeout() }, timeoutMs)
    }

    reset()

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, reset, { passive: true })
    )

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, reset)
      )
    }
  }, [timeoutMinutes, handleTimeout])
}
