import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react'
import authService from '@/services/auth.service'
import { api } from '@/services/api'
import { tokenStorage } from '@/services/tokenStorage'
import { meWithRetry, isAuthFailure } from './authResilience'
import type { MeDto, AuthState, SessionConfig } from '@/types/auth.types'

const DEFAULT_SESSION_CONFIG: SessionConfig = { inactivityTimeoutMinutes: 60 }

type AuthAction =
  | { type: 'LOGIN'; user: MeDto; accessToken: string; refreshToken: string; sessionConfig: SessionConfig }
  | { type: 'LOGOUT' }
  | { type: 'SET_UNAUTHENTICATED' }
  | { type: 'UPDATE_USER'; user: MeDto }

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN':
      return {
        status: 'authenticated',
        user: action.user,
        accessToken: action.accessToken,
        refreshToken: action.refreshToken,
        sessionConfig: action.sessionConfig,
      }
    case 'UPDATE_USER':
      if (state.status !== 'authenticated') return state
      return { ...state, user: action.user }
    case 'LOGOUT':
    case 'SET_UNAUTHENTICATED':
      return { status: 'unauthenticated' }
    default:
      return state
  }
}

interface AuthContextValue {
  state: AuthState
  login: (user: MeDto, accessToken: string, refreshToken: string, sessionConfig: SessionConfig) => void
  logout: () => Promise<void>
  updateUser: (user: MeDto) => void
  can: (permissionKey: string) => boolean
  isSuperAdmin: boolean
  isSurveyOnlyUser: boolean
  getFacilityScope: (moduleKey: string) => string[] | null
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(authReducer, { status: 'idle' })

  useEffect(() => {
    const restore = async () => {
      const accessToken = tokenStorage.getAccessToken()
      const refreshToken = tokenStorage.getRefreshToken()

      if (!accessToken || !refreshToken) {
        dispatch({ type: 'SET_UNAUTHENTICATED' })
        return
      }

      try {
        const { me, sessionConfig } = await meWithRetry()
        dispatch({
          type: 'LOGIN',
          user: me,
          accessToken,
          refreshToken,
          sessionConfig: sessionConfig ?? DEFAULT_SESSION_CONFIG,
        })
      } catch (err) {
        if (isAuthFailure(err)) tokenStorage.clearTokens()
        dispatch({ type: 'SET_UNAUTHENTICATED' })
      }
    }

    void restore()
  }, [])

  const login = (user: MeDto, accessToken: string, refreshToken: string, sessionConfig: SessionConfig) => {
    tokenStorage.setTokens(accessToken, refreshToken)
    dispatch({ type: 'LOGIN', user, accessToken, refreshToken, sessionConfig })
  }

  const logout = async () => {
    const refreshToken = tokenStorage.getRefreshToken()
    // Kullanıcı isteği (2026-09-25): kütüphane görevlisi çıkış yaparken mesaisi açıksa sorulur.
    // Personel kaydı olmayan kullanıcıda uç 409 döner ve hiçbir şey sorulmaz.
    try {
      const now = new Date()
      const res = await api.get<{ data: { shifts: { status: string; libraryId: string; libraryName: string }[] } }>(
        '/mesai/mine/summary', { params: { year: now.getFullYear(), month: now.getMonth() + 1 } })
      const open = res.data.data.shifts.find((s) => s.status === 'active')
      if (open && window.confirm(`${open.libraryName} kütüphanesinde mesainiz açık.\n\nÇıkmadan önce mesainizi bitirmek ister misiniz?\n\nTamam: mesaiyi bitir ve çık · İptal: yalnızca çık (mesai 23:00'te otomatik kapanır)`)) {
        await api.post(`/libraries/${open.libraryId}/shifts/me/end`)
      }
    } catch { /* personel değil ya da ağ hatası — çıkışı engelleme */ }
    if (refreshToken) {
      try { await authService.logout(refreshToken) } catch {}
    }
    tokenStorage.clearTokens()
    dispatch({ type: 'LOGOUT' })
  }

  const updateUser = useCallback((user: MeDto) => {
    dispatch({ type: 'UPDATE_USER', user })
  }, [])

  const can = (permissionKey: string): boolean => {
    if (state.status !== 'authenticated') return false
    const { permissions, isSuperAdmin } = state.user
    if (permissions === undefined) return false
    return isSuperAdmin === true || permissions.includes(permissionKey)
  }

  const getFacilityScope = (moduleKey: string): string[] | null => {
    if (state.status !== 'authenticated') return null
    if (state.user.isSuperAdmin === true) return null
    const scope = state.user.scopes?.find((s) => s.moduleKey === moduleKey)
    return scope ? scope.refIds : null
  }

  const isSuperAdmin = state.status === 'authenticated' && state.user.isSuperAdmin === true

  // Kullanıcı isteği (2026-09-01): "Anket Kullanıcısı" yetkisi işaretli bir yöneticinin
  // admin panelde yalnızca Anketler modülünü görmesi için — Sidebar/App.tsx bu bayrağa
  // bakarak diğer menü/route'ları gizler.
  const isSurveyOnlyUser = state.status === 'authenticated' && state.user.isSurveyUser === true && !isSuperAdmin

  return (
    <AuthContext.Provider value={{ state, login, logout, updateUser, can, isSuperAdmin, isSurveyOnlyUser, getFacilityScope }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
