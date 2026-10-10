import type { CitizenMeResponse } from '@/types/auth.types'
import authService from '@/services/auth.service'

export function isAuthFailure(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status
  return status === 401
}

export function isTransientError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === undefined) return true // ağ hatası / timeout
  return status === 429 || status >= 500
}

/**
 * Ölçüm bulgusu (2026-09-03, VIA_L40 tablet): şebekesiz bölgede açılışta
 * me() 3 kez denenip her denemede 15sn timeout'a düştüğü için anketör ~46
 * saniye BOŞ EKRAN görüyordu. Ağ tamamen yokken tekrar denemek işe yaramaz;
 * profil önbelleği zaten hazır. Bu yüzden ağ hatasında (yanıt hiç gelmediyse)
 * ilk denemeden sonra durulur; 5xx/429 gibi sunucu hatalarında yeniden
 * deneme korunur, çünkü orada tekrar denemenin gerçekten faydası vardır.
 */
export function isOfflineError(err: unknown): boolean {
  return (err as { response?: unknown })?.response === undefined
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function meWithRetry(retries = 2, baseDelayMs = 300): Promise<CitizenMeResponse> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await authService.me()
    } catch (err) {
      lastErr = err
      if (isOfflineError(err)) throw err // ağ yok: beklemenin faydası yok
      if (!isTransientError(err) || attempt === retries) throw err
      await sleep(baseDelayMs * Math.pow(2, attempt))
    }
  }
  throw lastErr
}

/**
 * Kullanıcı isteği (2026-09-03): "internet bağlantısı kapalı olsa da çalışması
 * gerekiyordu." Saha anketörü şebekesiz bölgede uygulamayı yeniden açtığında
 * açılıştaki me() çağrısı ağ hatasıyla düşüyor ve token korunsa bile oturum
 * UNAUTHENTICATED'a geçip anketörü giriş ekranına atıyordu. Giriş sunucu
 * gerektirdiği için anketör çevrimdışıyken tamamen kilitleniyordu.
 *
 * Çözüm: son başarılı profil yanıtını sakla; yalnızca AĞ hatasında (401
 * DEĞİL, o gerçek yetki reddidir) önbellekten oturumu geri yükle.
 */
const PROFILE_CACHE_KEY = 'auth_profile_cache'

export function cacheProfile(me: CitizenMeResponse): void {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ at: Date.now(), me }))
  } catch { /* kota dolu olabilir, oturumu bozmasın */ }
}

export function readCachedProfile(): CitizenMeResponse | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at?: number; me?: CitizenMeResponse }
    if (!parsed?.me) return null
    // 30 gün: saha görevleri haftalarca sürebilir, ama süresiz de tutulmamalı.
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > 30 * 24 * 60 * 60 * 1000) return null
    return parsed.me
  } catch { return null }
}

export function clearCachedProfile(): void {
  try { localStorage.removeItem(PROFILE_CACHE_KEY) } catch { /* yoksay */ }
}

