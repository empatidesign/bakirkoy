import { tokenStorage, type SessionKind } from './tokenStorage'
import { isNativePlatform } from '../lib/platform'

const HANDOFF_KEY = 'nexora_mobile_session'

interface MobileSessionPayload {
  accessToken: string
  refreshToken: string
  kind?: SessionKind
  source?: string
}

declare global {
  interface Window {
    __NEXORA_MOBILE_SESSION__?: MobileSessionPayload
  }
}

const readPayload = (): MobileSessionPayload | null => {
  const fromGlobal = window.__NEXORA_MOBILE_SESSION__
  if (fromGlobal?.accessToken && fromGlobal?.refreshToken) return fromGlobal

  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MobileSessionPayload
    return parsed?.accessToken && parsed?.refreshToken ? parsed : null
  } catch {
    return null
  }
}

export const adoptMobileSession = (): boolean => {
  // DÜZELTME (2026-08-26, ÜÇÜNCÜ TUR mobil güvenlik denetimi): önceden bu fonksiyon web
  // tarayıcısında da koşulsuz çalışıyordu (şu an hiçbir üreticisi olmayan ölü kod, ama ileride
  // biri bir handoff mekanizması eklerse web'de de tetiklenebilirdi). Artık yalnızca gerçek
  // native (Capacitor) platformda çalışıyor — savunma derinliği, mevcut davranışı değiştirmez
  // çünkü zaten hiçbir üretici yok.
  if (!isNativePlatform()) return false

  const payload = readPayload()
  if (!payload) return false

  tokenStorage.setBypassTokens(payload.accessToken, payload.refreshToken)
  tokenStorage.setKind(payload.kind ?? 'citizen')

  try {
    sessionStorage.removeItem(HANDOFF_KEY)
  } catch {
    void 0
  }
  delete window.__NEXORA_MOBILE_SESSION__

  return true
}
