import { useAuth } from '@/framework/auth/AuthContext'
import { SCOPABLE_MODULE_KEYS } from '@/framework/auth/scopableModules'
import { CROSS_MODULE_PERMISSION_KEYS, MODULE_ROUTES } from '@/framework/auth/moduleRoutes'

export const useHasFacilityScopeRestriction = (): boolean => {
  const { state, can, isSuperAdmin, getFacilityScope } = useAuth()

  if (state.status !== 'authenticated') return false
  if (isSuperAdmin) return false
  if (CROSS_MODULE_PERMISSION_KEYS.some((key) => can(key))) return false

  const hasAssignedScope = SCOPABLE_MODULE_KEYS.some((moduleKey) => getFacilityScope(moduleKey) !== null)
  if (hasAssignedScope) return true

  return MODULE_ROUTES.some((m) => can(m.permissionKey))
}
