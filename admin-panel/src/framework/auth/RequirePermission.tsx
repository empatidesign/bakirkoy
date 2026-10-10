import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

interface RequirePermissionProps {
  permission: string | string[]
  children: React.ReactNode
}

// 2026-10-05 kullanıcı isteği (/library + /library-mesai birleşimi): bir route artık
// birden fazla yetkiden herhangi birine sahip kullanıcılara açık olabilmeli — ör. sadece
// "library-mesai.view" verilmiş (ama "library.view" verilmemiş) özel bir rol de /library'ye
// girebilmeli.
export const RequirePermission = ({ permission, children }: RequirePermissionProps) => {
  const { can } = useAuth()
  const permissions = Array.isArray(permission) ? permission : [permission]
  if (!permissions.some((p) => can(p))) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
