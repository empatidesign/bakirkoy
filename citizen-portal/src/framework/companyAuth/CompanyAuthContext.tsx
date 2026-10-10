import { createContext, useCallback, useContext, useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import companyAuthService from '@/services/companyAuth.service'
import { tokenStorage } from '@/services/tokenStorage'
import type { CompanySessionConfig, CompanyTokenPair, CompanyUser } from '@/types/companyAuth.types'

const DEFAULT_SESSION_CONFIG: CompanySessionConfig = {
  webInactivityTimeoutMinutes: 15,
  mobileInactivityTimeoutMinutes: 0,
}

type CompanyAuthState =
  | { status: 'idle' }
  | { status: 'authenticated'; company: CompanyUser; sessionConfig: CompanySessionConfig }
  | { status: 'unauthenticated' }

type CompanyAuthAction =
  | { type: 'AUTHENTICATED'; company: CompanyUser; sessionConfig: CompanySessionConfig }
  | { type: 'UNAUTHENTICATED' }

const reducer = (state: CompanyAuthState, action: CompanyAuthAction): CompanyAuthState => {
  switch (action.type) {
    case 'AUTHENTICATED':
      return { status: 'authenticated', company: action.company, sessionConfig: action.sessionConfig }
    case 'UNAUTHENTICATED':
      return { status: 'unauthenticated' }
    default:
      return state
  }
}

interface CompanyAuthContextValue {
  state: CompanyAuthState
  login: (result: CompanyTokenPair) => void
  logout: () => Promise<void>
  refreshCompany: () => Promise<void>
}

const CompanyAuthContext = createContext<CompanyAuthContextValue | undefined>(undefined)

export const CompanyAuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' })

  useEffect(() => {
    const token = tokenStorage.getAccessToken()
    const refresh = tokenStorage.getRefreshToken()
    if (!token || !refresh || tokenStorage.getKind() !== 'company') {
      dispatch({ type: 'UNAUTHENTICATED' })
      return
    }
    let active = true
    const restore = async () => {
      try {
        const company = await companyAuthService.me()
        if (active) dispatch({ type: 'AUTHENTICATED', company, sessionConfig: DEFAULT_SESSION_CONFIG })
      } catch {
        tokenStorage.clearTokens()
        if (active) dispatch({ type: 'UNAUTHENTICATED' })
      }
    }
    void restore()
    return () => { active = false }
  }, [])

  const login = useCallback((result: CompanyTokenPair) => {
    tokenStorage.exitBypassMode()
    tokenStorage.setRemember(true)
    tokenStorage.clearImpersonationParent()
    tokenStorage.setTokens(result.accessToken, result.refreshToken)
    tokenStorage.setKind('company')
    dispatch({ type: 'AUTHENTICATED', company: result.company, sessionConfig: result.sessionConfig })
  }, [])

  const logout = useCallback(async () => {
    try { await companyAuthService.logout() } catch { void 0 }
    tokenStorage.clearTokens()
    dispatch({ type: 'UNAUTHENTICATED' })
  }, [])

  const refreshCompany = useCallback(async () => {
    const company = await companyAuthService.me()
    dispatch({ type: 'AUTHENTICATED', company, sessionConfig: DEFAULT_SESSION_CONFIG })
  }, [])

  return (
    <CompanyAuthContext.Provider value={{ state, login, logout, refreshCompany }}>
      {children}
    </CompanyAuthContext.Provider>
  )
}

export const useCompanyAuth = (): CompanyAuthContextValue => {
  const ctx = useContext(CompanyAuthContext)
  if (!ctx) throw new Error('useCompanyAuth must be used within CompanyAuthProvider')
  return ctx
}
