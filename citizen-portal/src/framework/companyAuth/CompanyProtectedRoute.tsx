import { Navigate, Outlet } from 'react-router-dom'
import { Loader2Icon } from 'lucide-react'
import { useCompanyAuth } from './CompanyAuthContext'
import { useCompanyInactivityLogout } from './useCompanyInactivityLogout'

export const CompanyProtectedRoute = () => {
  const { state } = useCompanyAuth()
  useCompanyInactivityLogout()

  if (state.status === 'idle') {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-surface-1">
        <Loader2Icon className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  if (state.status === 'unauthenticated') {
    return <Navigate to="/firma/login" replace />
  }

  return <Outlet />
}
