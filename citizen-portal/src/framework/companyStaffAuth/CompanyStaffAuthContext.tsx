import { createContext, useCallback, useContext, useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import companyStaffAuthService from '@/services/companyStaffAuth.service'
import { tokenStorage } from '@/services/tokenStorage'
import type { CompanyStaffTokenPair } from '@/types/companyStaffAuth.types'
import type { CompanyStaff } from '@/types/companyStaff.types'
import type { CompanyUser } from '@/types/companyAuth.types'

type CompanyStaffAuthState =
  | { status: 'idle' }
  | { status: 'authenticated'; staff: CompanyStaff; company: CompanyUser }
  | { status: 'unauthenticated' }

type CompanyStaffAuthAction =
  | { type: 'AUTHENTICATED'; staff: CompanyStaff; company: CompanyUser }
  | { type: 'UNAUTHENTICATED' }

const reducer = (state: CompanyStaffAuthState, action: CompanyStaffAuthAction): CompanyStaffAuthState => {
  switch (action.type) {
    case 'AUTHENTICATED':
      return { status: 'authenticated', staff: action.staff, company: action.company }
    case 'UNAUTHENTICATED':
      return { status: 'unauthenticated' }
    default:
      return state
  }
}

interface CompanyStaffAuthContextValue {
  state: CompanyStaffAuthState
  login: (result: CompanyStaffTokenPair) => void
  logout: () => Promise<void>
  refreshStaff: () => Promise<void>
}

const CompanyStaffAuthContext = createContext<CompanyStaffAuthContextValue | undefined>(undefined)

export const CompanyStaffAuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' })

  useEffect(() => {
    const token = tokenStorage.getAccessToken()
    const refresh = tokenStorage.getRefreshToken()
    if (!token || !refresh || tokenStorage.getKind() !== 'company_staff') {
      dispatch({ type: 'UNAUTHENTICATED' })
      return
    }
    let active = true
    const restore = async () => {
      try {
        const staff = await companyStaffAuthService.me()
        const cachedCompany = tokenStorage.getStaffCompany()
        if (active && cachedCompany) dispatch({ type: 'AUTHENTICATED', staff, company: cachedCompany })
        else if (active) dispatch({ type: 'UNAUTHENTICATED' })
      } catch {
        tokenStorage.clearTokens()
        if (active) dispatch({ type: 'UNAUTHENTICATED' })
      }
    }
    void restore()
    return () => { active = false }
  }, [])

  const login = useCallback((result: CompanyStaffTokenPair) => {
    tokenStorage.exitBypassMode()
    tokenStorage.setRemember(true)
    tokenStorage.clearImpersonationParent()
    tokenStorage.setTokens(result.accessToken, result.refreshToken)
    tokenStorage.setKind('company_staff')
    tokenStorage.setStaffCompany(result.company)
    dispatch({ type: 'AUTHENTICATED', staff: result.staff, company: result.company })
  }, [])

  const logout = useCallback(async () => {
    try { await companyStaffAuthService.logout() } catch { void 0 }
    tokenStorage.clearTokens()
    tokenStorage.clearStaffCompany()
    dispatch({ type: 'UNAUTHENTICATED' })
  }, [])

  const refreshStaff = useCallback(async () => {
    if (state.status !== 'authenticated') return
    const staff = await companyStaffAuthService.me()
    dispatch({ type: 'AUTHENTICATED', staff, company: state.company })
  }, [state])

  return (
    <CompanyStaffAuthContext.Provider value={{ state, login, logout, refreshStaff }}>
      {children}
    </CompanyStaffAuthContext.Provider>
  )
}

export const useCompanyStaffAuth = (): CompanyStaffAuthContextValue => {
  const ctx = useContext(CompanyStaffAuthContext)
  if (!ctx) throw new Error('useCompanyStaffAuth must be used within CompanyStaffAuthProvider')
  return ctx
}
