import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

interface RequireSuperAdminProps {
  children: React.ReactNode
}

export const RequireSuperAdmin = ({ children }: RequireSuperAdminProps) => {
  const { isSuperAdmin } = useAuth()
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
