import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { isNativePlatform } from '@/lib/platform'

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click']

export const useInactivityLogout = () => {
  const { state, logout } = useAuth()
  const navigate = useNavigate()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const minutes =
    state.status === 'authenticated'
      ? isNativePlatform()
        ? state.sessionConfig.mobileInactivityTimeoutMinutes
        : state.sessionConfig.webInactivityTimeoutMinutes
      : 0

  useEffect(() => {
    if (minutes <= 0) return
    const ms = minutes * 60 * 1000

    const onTimeout = async () => {
      await logout()
      navigate('/login', { replace: true })
    }

    let lastReset = 0
    const reset = () => {
      const now = Date.now()
      if (now - lastReset < 1000) return
      lastReset = now
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => { void onTimeout() }, ms)
    }

    reset()
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [minutes, logout, navigate])
}
