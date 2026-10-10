
const ACCESS_TOKEN_KEY = 'portal_access_token'
const REFRESH_TOKEN_KEY = 'portal_refresh_token'
const REMEMBER_KEY = 'portal_auth_remember'
const SAVED_EMAIL_KEY = 'portal_auth_saved_email'
const PARENT_ACCESS_KEY = 'portal_parent_access_token'
const PARENT_REFRESH_KEY = 'portal_parent_refresh_token'
const PARENT_NAME_KEY = 'portal_parent_name'
const FAMILY_ROSTER_KEY = 'portal_family_roster'
const KIND_KEY = 'portal_auth_kind'
const BYPASS_SESSION_KEY = 'portal_auth_bypass_session'
const STAFF_COMPANY_KEY = 'portal_auth_staff_company'

const LEGACY_KEY_MAP: Record<string, string> = {
  access_token: ACCESS_TOKEN_KEY,
  refresh_token: REFRESH_TOKEN_KEY,
  auth_remember: REMEMBER_KEY,
  auth_saved_email: SAVED_EMAIL_KEY,
  parent_access_token: PARENT_ACCESS_KEY,
  parent_refresh_token: PARENT_REFRESH_KEY,
  parent_name: PARENT_NAME_KEY,
  family_roster: FAMILY_ROSTER_KEY,
  auth_kind: KIND_KEY,
  auth_bypass_session: BYPASS_SESSION_KEY,
  auth_staff_company: STAFF_COMPANY_KEY,
}

const isNativeWebView = (): boolean => {
  if (typeof window === 'undefined') return false
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean; platform?: string } }).Capacitor
  if (cap?.isNativePlatform?.() === true) return true
  if (cap?.platform && cap.platform !== 'web') return true
  return /^(capacitor|ionic|file):/.test(window.location.protocol)
}

const migrateLegacyKeysForNative = (): void => {
  if (!isNativeWebView()) return
  try {
    for (const store of [localStorage, sessionStorage]) {
      for (const [oldKey, newKey] of Object.entries(LEGACY_KEY_MAP)) {
        const value = store.getItem(oldKey)
        if (value === null) continue
        if (store.getItem(newKey) === null) store.setItem(newKey, value)
        store.removeItem(oldKey)
      }
    }
  } catch {
    void 0
  }
}

migrateLegacyKeysForNative()

export type SessionKind = 'citizen' | 'company' | 'company_staff'

export const tokenStorage = {
  /**
   * Kullanıcı isteği (2026-09-03): "internet bağlantısı kapalı olsa da çalışması
   * gerekiyordu." Saha anketörü şebekesiz bölgede çalışıyor; oturum
   * sessionStorage'da tutulursa uygulama kapanınca silinir ve anketör
   * çevrimdışıyken TEKRAR GİRİŞ YAPAMAZ (giriş sunucu ister).
   *
   * Bu yüzden yerel uygulamada (Capacitor/WebView) oturum her zaman kalıcı
   * saklanır. Tarayıcıda davranış değişmez: ortak bilgisayarda oturumun
   * sekme kapanınca düşmesi güvenlik açısından doğrudur.
   */
  isNativeApp(): boolean {
    if (typeof window === 'undefined') return false
    // Protokole güvenilmez: androidScheme 'http' yapıldığında (yerel ağdaki
    // http API'ye Mixed Content engeline takılmadan erişmek için) sayfa
    // http://localhost olarak açılır ve capacitor:// kontrolü tutmaz.
    // Capacitor köprüsünün varlığı tek güvenilir ölçüttür.
    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean; platform?: string } }).Capacitor
    if (cap?.isNativePlatform?.() === true) return true
    if (cap?.platform && cap.platform !== 'web') return true
    return /^(capacitor|ionic|file):/.test(window.location.protocol)
  },

  isRemembered(): boolean {
    return this.isNativeApp() || localStorage.getItem(REMEMBER_KEY) === '1'
  },

  setRemember(remember: boolean): void {
    if (remember) localStorage.setItem(REMEMBER_KEY, '1')
    else localStorage.removeItem(REMEMBER_KEY)
  },

  isBypassSession(): boolean {
    return sessionStorage.getItem(BYPASS_SESSION_KEY) === '1'
  },

  setTokens(accessToken: string, refreshToken: string): void {
    if (this.isBypassSession()) {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
      sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
      return
    }

    const primary = this.isRemembered() ? localStorage : sessionStorage
    const secondary = this.isRemembered() ? sessionStorage : localStorage

    primary.setItem(ACCESS_TOKEN_KEY, accessToken)
    primary.setItem(REFRESH_TOKEN_KEY, refreshToken)
    secondary.removeItem(ACCESS_TOKEN_KEY)
    secondary.removeItem(REFRESH_TOKEN_KEY)
  },

  setBypassTokens(accessToken: string, refreshToken: string): void {
    sessionStorage.setItem(BYPASS_SESSION_KEY, '1')
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  },

  clearBypassSession(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    sessionStorage.removeItem(KIND_KEY)
    sessionStorage.removeItem(BYPASS_SESSION_KEY)
    this.clearImpersonationParent()
    this.clearFamilyRoster()
  },

  exitBypassMode(): void {
    sessionStorage.removeItem(BYPASS_SESSION_KEY)
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    sessionStorage.removeItem(KIND_KEY)
  },

  getAccessToken(): string | null {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? localStorage.getItem(ACCESS_TOKEN_KEY)
  },

  getRefreshToken(): string | null {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY) ?? localStorage.getItem(REFRESH_TOKEN_KEY)
  },

  setKind(kind: SessionKind): void {
    if (this.isBypassSession()) {
      sessionStorage.setItem(KIND_KEY, kind)
      return
    }

    const primary = this.isRemembered() ? localStorage : sessionStorage
    const secondary = this.isRemembered() ? sessionStorage : localStorage
    primary.setItem(KIND_KEY, kind)
    secondary.removeItem(KIND_KEY)
  },

  setBypassKind(kind: SessionKind): void {
    sessionStorage.setItem(KIND_KEY, kind)
  },

  getKind(): SessionKind | null {
    return (sessionStorage.getItem(KIND_KEY) ?? localStorage.getItem(KIND_KEY)) as SessionKind | null
  },

  clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(KIND_KEY)
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    sessionStorage.removeItem(KIND_KEY)
    sessionStorage.removeItem(BYPASS_SESSION_KEY)
    this.clearImpersonationParent()
    this.clearFamilyRoster()
    this.clearStaffCompany()
  },

  setStaffCompany(company: import('@/types/companyAuth.types').CompanyUser): void {
    // 2026-07-30 denetiminde tespit edildi: bu değer "remember me" tercihine
    // bakılmaksızın her zaman kalıcı localStorage'a yazılıyordu (ana access/refresh
    // token'ların isRemembered() durumuna göre localStorage/sessionStorage arasında
    // seçim yapmasıyla tutarsız). Artık aynı desen uygulanıyor: "beni hatırla"
    // işaretli değilse bu bilgi de oturum kapanınca (sessionStorage) silinir.
    const store = this.isRemembered() || this.isBypassSession() ? localStorage : sessionStorage
    const other = store === localStorage ? sessionStorage : localStorage
    store.setItem(STAFF_COMPANY_KEY, JSON.stringify(company))
    other.removeItem(STAFF_COMPANY_KEY)
  },

  getStaffCompany(): import('@/types/companyAuth.types').CompanyUser | null {
    const raw = sessionStorage.getItem(STAFF_COMPANY_KEY) ?? localStorage.getItem(STAFF_COMPANY_KEY)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  },

  clearStaffCompany(): void {
    localStorage.removeItem(STAFF_COMPANY_KEY)
    sessionStorage.removeItem(STAFF_COMPANY_KEY)
  },

  setFamilyRoster(json: string): void {
    const store = this.isRemembered() || this.isBypassSession() ? localStorage : sessionStorage
    const other = store === localStorage ? sessionStorage : localStorage
    store.setItem(FAMILY_ROSTER_KEY, json)
    other.removeItem(FAMILY_ROSTER_KEY)
  },

  getFamilyRoster(): string | null {
    return sessionStorage.getItem(FAMILY_ROSTER_KEY) ?? localStorage.getItem(FAMILY_ROSTER_KEY)
  },

  clearFamilyRoster(): void {
    localStorage.removeItem(FAMILY_ROSTER_KEY)
    sessionStorage.removeItem(FAMILY_ROSTER_KEY)
  },

  setImpersonationParent(accessToken: string, refreshToken: string, name: string): void {
    // 2026-07-30 denetiminde tespit edildi: ebeveyn-çocuk hesap geçişindeki
    // "ebeveyn" token'ı da (switchToChild sırasında saklanan orijinal oturum),
    // "beni hatırla" işaretli olmasa bile her zaman kalıcı localStorage'a
    // yazılıyordu. Ana token'larla aynı desene taşındı.
    const store = this.isRemembered() || this.isBypassSession() ? localStorage : sessionStorage
    const other = store === localStorage ? sessionStorage : localStorage
    store.setItem(PARENT_ACCESS_KEY, accessToken)
    store.setItem(PARENT_REFRESH_KEY, refreshToken)
    store.setItem(PARENT_NAME_KEY, name)
    other.removeItem(PARENT_ACCESS_KEY)
    other.removeItem(PARENT_REFRESH_KEY)
    other.removeItem(PARENT_NAME_KEY)
  },

  getImpersonationParent(): { accessToken: string; refreshToken: string; name: string } | null {
    const accessToken = sessionStorage.getItem(PARENT_ACCESS_KEY) ?? localStorage.getItem(PARENT_ACCESS_KEY)
    const refreshToken = sessionStorage.getItem(PARENT_REFRESH_KEY) ?? localStorage.getItem(PARENT_REFRESH_KEY)
    if (!accessToken || !refreshToken) return null
    return {
      accessToken,
      refreshToken,
      name: sessionStorage.getItem(PARENT_NAME_KEY) ?? localStorage.getItem(PARENT_NAME_KEY) ?? '',
    }
  },

  clearImpersonationParent(): void {
    localStorage.removeItem(PARENT_ACCESS_KEY)
    localStorage.removeItem(PARENT_REFRESH_KEY)
    localStorage.removeItem(PARENT_NAME_KEY)
    sessionStorage.removeItem(PARENT_ACCESS_KEY)
    sessionStorage.removeItem(PARENT_REFRESH_KEY)
    sessionStorage.removeItem(PARENT_NAME_KEY)
  },

  getSavedEmail(): string {
    return localStorage.getItem(SAVED_EMAIL_KEY) ?? ''
  },

  setSavedEmail(email: string): void {
    localStorage.setItem(SAVED_EMAIL_KEY, email)
  },

  clearSavedEmail(): void {
    localStorage.removeItem(SAVED_EMAIL_KEY)
  },
}
