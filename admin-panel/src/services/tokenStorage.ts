
const ACCESS_TOKEN_KEY = 'admin_access_token'
const REFRESH_TOKEN_KEY = 'admin_refresh_token'
const REMEMBER_KEY = 'admin_auth_remember'
const SAVED_EMAIL_KEY = 'admin_auth_saved_email'
const BYPASS_SESSION_KEY = 'admin_auth_bypass_session'

export const tokenStorage = {
  isRemembered(): boolean {
    return localStorage.getItem(REMEMBER_KEY) === '1'
  },

  setRemember(remember: boolean): void {
    if (remember) localStorage.setItem(REMEMBER_KEY, '1')
    else localStorage.removeItem(REMEMBER_KEY)
  },

  setTokens(accessToken: string, refreshToken: string): void {
    const primary = this.isRemembered() ? localStorage : sessionStorage
    const secondary = this.isRemembered() ? sessionStorage : localStorage

    primary.setItem(ACCESS_TOKEN_KEY, accessToken)
    primary.setItem(REFRESH_TOKEN_KEY, refreshToken)
    secondary.removeItem(ACCESS_TOKEN_KEY)
    secondary.removeItem(REFRESH_TOKEN_KEY)
    sessionStorage.removeItem(BYPASS_SESSION_KEY)
  },

  setBypassTokens(accessToken: string, refreshToken: string): void {
    sessionStorage.setItem(BYPASS_SESSION_KEY, '1')
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  },

  isBypassSession(): boolean {
    return sessionStorage.getItem(BYPASS_SESSION_KEY) === '1'
  },

  getAccessToken(): string | null {
    if (this.isBypassSession()) {
      return sessionStorage.getItem(ACCESS_TOKEN_KEY)
    }
    return sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? localStorage.getItem(ACCESS_TOKEN_KEY)
  },

  getRefreshToken(): string | null {
    if (this.isBypassSession()) {
      return sessionStorage.getItem(REFRESH_TOKEN_KEY)
    }
    return sessionStorage.getItem(REFRESH_TOKEN_KEY) ?? localStorage.getItem(REFRESH_TOKEN_KEY)
  },

  clearBypassTokens(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    sessionStorage.removeItem(BYPASS_SESSION_KEY)
  },

  clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    sessionStorage.removeItem(BYPASS_SESSION_KEY)
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
