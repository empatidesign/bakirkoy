import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2Icon } from 'lucide-react'
import { useAuth } from './AuthContext'
import { useInactivityLogout } from './useInactivityLogout'
import { tokenStorage } from '@/services/tokenStorage'

export const ProtectedRoute = () => {
  const { state } = useAuth()
  const location = useLocation()
  const isAdminBypass = tokenStorage.isBypassSession()
  useInactivityLogout()

  if (state.status === 'idle') {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-surface-1">
        <Loader2Icon className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  if (state.status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  if (state.user.mustChangePassword && !state.impersonatedFrom && !isAdminBypass && location.pathname !== '/first-login') {
    return <Navigate to="/first-login" replace />
  }

  if ((!state.user.mustChangePassword || state.impersonatedFrom || isAdminBypass) && location.pathname === '/first-login') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
