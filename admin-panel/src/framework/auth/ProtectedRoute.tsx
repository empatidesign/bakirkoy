import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useInactivityLogout } from './useInactivityLogout'
import { useSessionWatch } from './useSessionWatch'
import { SessionInvalidatedBanner } from './SessionInvalidatedBanner'
import { AdminBypassBanner } from './AdminBypassBanner'
import { tokenStorage } from '@/services/tokenStorage'

export const ProtectedRoute = () => {
  const { state } = useAuth()
  const location = useLocation()
  const isBypass = tokenStorage.isBypassSession()
  useInactivityLogout()
  useSessionWatch()

  if (state.status === 'idle') {
    return (
      <div className="flex h-screen items-center justify-center bg-[hsl(var(--surface-0))]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    )
  }

  if (state.status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  if (state.user.mustChangePassword && !isBypass && location.pathname !== '/first-login') {
    return <Navigate to="/first-login" replace />
  }

  if ((!state.user.mustChangePassword || isBypass) && location.pathname === '/first-login') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <>
      <SessionInvalidatedBanner />
      <AdminBypassBanner />
      <Outlet />
    </>
  )
}
