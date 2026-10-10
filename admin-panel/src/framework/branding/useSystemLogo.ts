import { useEffect, useState } from 'react'
import systemBrandingService from '@/services/systemBranding.service'

const DEFAULT_LOGO = `${import.meta.env.BASE_URL}logo.png`
const CACHE_KEY = 'nexora_system_logo_url'
const API_BASE = import.meta.env.VITE_API_URL ?? ''

const resolveLogoUrl = (url: string | null): string => {
  if (!url) return DEFAULT_LOGO
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${API_BASE}${url}`
}

/**
 * Sistem logosunu (Ayarlar > Logo / Kurumsal Kimlik bölümünden yüklenen) döner.
 * Admin yüklemediyse veya API'ye erişilemiyorsa varsayılan `public/logo.png`'ye düşer.
 * Sayfa yenilendiğinde flaşı önlemek için son bilinen URL localStorage'da tutulur.
 */
export const useSystemLogo = (): string => {
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    try { return localStorage.getItem(CACHE_KEY) || DEFAULT_LOGO } catch { return DEFAULT_LOGO }
  })

  useEffect(() => {
    systemBrandingService.getPublic()
      .then((data) => {
        const url = resolveLogoUrl(data.logoUrl)
        setLogoUrl(url)
        try { localStorage.setItem(CACHE_KEY, url) } catch { /* önemsiz */ }
      })
      .catch(() => { /* varsayılan logo zaten gösteriliyor */ })
  }, [])

  return logoUrl
}

const HORIZONTAL_CACHE_KEY = 'nexora_system_horizontal_logo_url'

/**
 * Yatay (geniş) sistem logosunu döner (Ayarlar > Logo / Kurumsal Kimlik).
 * Admin yatay logo yüklemediyse `null` döner; çağıran taraf bu durumda
 * kare logoya (useSystemLogo) düşmelidir.
 */
export const useSystemHorizontalLogo = (): string | null => {
  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    try { return localStorage.getItem(HORIZONTAL_CACHE_KEY) || null } catch { return null }
  })

  useEffect(() => {
    systemBrandingService.getPublic()
      .then((data) => {
        const url = data.horizontalLogoUrl ? resolveLogoUrl(data.horizontalLogoUrl) : null
        setLogoUrl(url)
        try {
          if (url) localStorage.setItem(HORIZONTAL_CACHE_KEY, url)
          else localStorage.removeItem(HORIZONTAL_CACHE_KEY)
        } catch { /* önemsiz */ }
      })
      .catch(() => { /* mevcut önbellek zaten gösteriliyor */ })
  }, [])

  return logoUrl
}

