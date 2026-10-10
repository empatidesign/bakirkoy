import { createContext, useCallback, useContext, useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import authService from '@/services/auth.service'
import familyService from '@/services/family.service'
import loyaltyService from '@/services/loyalty.service'
import { tokenStorage } from '@/services/tokenStorage'
import { meWithRetry, isAuthFailure, cacheProfile, readCachedProfile, clearCachedProfile, isOfflineError } from './authResilience'
import type { CitizenSessionConfig, CitizenTokenPair, CitizenUser } from '@/types/auth.types'

type AuthState =
  | { status: 'idle' }
  | { status: 'authenticated'; user: CitizenUser; sessionConfig: CitizenSessionConfig; impersonatedFrom?: string }
  | { status: 'unauthenticated' }

type AuthAction =
  | { type: 'AUTHENTICATED'; user: CitizenUser; sessionConfig: CitizenSessionConfig; impersonatedFrom?: string }
  | { type: 'UNAUTHENTICATED' }

const reducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTHENTICATED':
      return { status: 'authenticated', user: action.user, sessionConfig: action.sessionConfig, impersonatedFrom: action.impersonatedFrom }
    case 'UNAUTHENTICATED':
      return { status: 'unauthenticated' }
    default:
      return state
  }
}

interface AuthContextValue {
  state: AuthState
  login: (result: CitizenTokenPair) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  switchToChild: (childId: string) => Promise<void>
  switchBack: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' })

  useEffect(() => {
    const token = tokenStorage.getAccessToken()
    const refresh = tokenStorage.getRefreshToken()
    if (!token || !refresh || tokenStorage.getKind() === 'company') {
      dispatch({ type: 'UNAUTHENTICATED' })
      return
    }
    let active = true
    const restore = async () => {
      try {
        const me = await meWithRetry()
        cacheProfile(me)
        const parent = tokenStorage.getImpersonationParent()
        if (active) dispatch({ type: 'AUTHENTICATED', user: me.user, sessionConfig: me.sessionConfig, impersonatedFrom: parent?.name })
      } catch (err) {
        if (isAuthFailure(err)) {
          tokenStorage.clearTokens()
          clearCachedProfile()
          if (active) dispatch({ type: 'UNAUTHENTICATED' })
          return
        }
        // Ağ yok: token geçerli olabilir, oturumu düşürmek yerine son bilinen
        // profille devam et. Aksi halde anketör sahada giriş ekranına kilitlenir.
        const cached = isOfflineError(err) ? readCachedProfile() : null
        if (cached) {
          const parent = tokenStorage.getImpersonationParent()
          if (active) dispatch({ type: 'AUTHENTICATED', user: cached.user, sessionConfig: cached.sessionConfig, impersonatedFrom: parent?.name })
          return
        }
        if (active) dispatch({ type: 'UNAUTHENTICATED' })
      }
    }
    void restore()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const onInvalidated = () => {
      tokenStorage.clearImpersonationParent()
      tokenStorage.clearFamilyRoster()
      dispatch({ type: 'UNAUTHENTICATED' })
    }
    window.addEventListener('session:invalidated', onInvalidated)
    return () => window.removeEventListener('session:invalidated', onInvalidated)
  }, [])

  // Kullanıcı bulgusu (2026-08-09): sadakat puanı ("Her gün uygulamaya giriş
  // yapıldığında kazanılır" — daily_login kuralı) sadece kullanıcı elle
  // Sadakat Puanım (/sadakat) sayfasına giderse kazanılıyordu; giriş yaptığında
  // otomatik tetiklenmiyordu, çünkü check-in çağrısı yalnızca LoyaltyPage.tsx
  // içindeki bir useEffect'te yapılıyordu. Kural açıkça "her gün giriş" dediği
  // için bu, kullanıcı arayüzünde puanının görünmemesi olarak yansıyordu — puan
  // aslında sadece o sayfaya gidince kazanılıyordu, otomatik değildi. Çözüm:
  // kullanıcı authenticated olur olmaz (login, sayfa yenileme sonrası oturum
  // geri yükleme, çocuğa geçiş dahil) bu effect check-in'i sessizce tetikler.
  // Backend (LoyaltyService.DailyCheckInAsync) günde bir kez gerçek puan verir
  // (isNew bayrağı ile korunuyor), bu yüzden burada tekrar tekrar çağırmak
  // (route değişiminde, farklı sekmelerde vs.) güvenlidir — sadece ilk çağrıda
  // puan kazanılır, sonrakiler no-op'tur. Participant kaydı olmayan hesaplar
  // (örn. firma/şirket girişleri bu context'i hiç kullanmaz) veya API hatası
  // sessizce yutulur — sadakat, kimlik doğrulamayı bloklamamalı.
  useEffect(() => {
    if (state.status !== 'authenticated') return
    let active = true
    loyaltyService.checkIn()
      .then((result) => {
        if (active && result.isNewCheckIn && result.pointsEarned > 0) {
          toast.success(`🎉 +${result.pointsEarned} puan kazandınız! ${result.streak.currentStreak} günlük seri!`)
        }
      })
      .catch(() => { /* sadakat check-in başarısız olursa sessizce yut */ })
    return () => { active = false }
    // Yalnızca authenticated durumuna geçişte (veya kullanıcı/tckn değiştiğinde,
    // örn. çocuğa geçiş) tetiklenmesi yeterli — her render'da değil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.status === 'authenticated' ? state.user.tckn : null])

  const login = useCallback(async (result: CitizenTokenPair) => {
    tokenStorage.clearImpersonationParent()
    tokenStorage.clearFamilyRoster()
    tokenStorage.setTokens(result.accessToken, result.refreshToken)
    tokenStorage.setKind('citizen')
    try {
      const me = await authService.me()
      cacheProfile(me)
      dispatch({ type: 'AUTHENTICATED', user: me.user, sessionConfig: me.sessionConfig })
    } catch {
      cacheProfile({ user: result.user, sessionConfig: result.sessionConfig })
      dispatch({ type: 'AUTHENTICATED', user: result.user, sessionConfig: result.sessionConfig })
    }
  }, [])

  const logout = useCallback(async () => {
    const refresh = tokenStorage.getRefreshToken()
    if (refresh) {
      try { await authService.logout(refresh) } catch { void 0 }
    }
    tokenStorage.clearTokens()
    clearCachedProfile()
    dispatch({ type: 'UNAUTHENTICATED' })
  }, [])

  const refreshUser = useCallback(async () => {
    const me = await authService.me()
    cacheProfile(me)
    const parent = tokenStorage.getImpersonationParent()
    dispatch({ type: 'AUTHENTICATED', user: me.user, sessionConfig: me.sessionConfig, impersonatedFrom: parent?.name })
  }, [])

  const switchToChild = useCallback(async (childId: string) => {
    if (state.status !== 'authenticated') return
    const impersonation = tokenStorage.getImpersonationParent()
    let parentAccess: string | null
    let parentRefresh: string | null
    let parentName: string
    if (impersonation) {
      parentAccess = impersonation.accessToken
      parentRefresh = impersonation.refreshToken
      parentName = impersonation.name
      tokenStorage.setTokens(impersonation.accessToken, impersonation.refreshToken)
    } else {
      parentAccess = tokenStorage.getAccessToken()
      parentRefresh = tokenStorage.getRefreshToken()
      parentName = state.user.fullName
    }
    const pair = await familyService.switchToChild(childId)
    if (parentAccess && parentRefresh) {
      tokenStorage.setImpersonationParent(parentAccess, parentRefresh, parentName)
    }
    tokenStorage.setTokens(pair.accessToken, pair.refreshToken)
    dispatch({ type: 'AUTHENTICATED', user: pair.user, sessionConfig: pair.sessionConfig, impersonatedFrom: parentName })
  }, [state])

  const switchBack = useCallback(async () => {
    const parent = tokenStorage.getImpersonationParent()
    if (!parent) return
    tokenStorage.setTokens(parent.accessToken, parent.refreshToken)
    tokenStorage.clearImpersonationParent()
    const me = await authService.me()
    dispatch({ type: 'AUTHENTICATED', user: me.user, sessionConfig: me.sessionConfig })
  }, [])

  return (
    <AuthContext.Provider value={{ state, login, logout, refreshUser, switchToChild, switchBack }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
