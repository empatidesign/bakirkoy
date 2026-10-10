import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type EffectiveTheme = 'light' | 'dark'
export type ColorTheme = 'default' | 'slate' | 'rose' | 'forest' | 'violet' | 'amber'
export type RadiusPreset = 'sharp' | 'default' | 'soft' | 'round'
export type ShadowPreset = 'flat' | 'default' | 'elevated'
export type DensityPreset = 'compact' | 'default' | 'comfortable'

export interface ThemeConfig {
  mode: ThemeMode
  color: ColorTheme
  radius: RadiusPreset
  shadow: ShadowPreset
  density: DensityPreset
}

interface ThemeContextValue extends ThemeConfig {
  effective: EffectiveTheme
  setMode: (mode: ThemeMode) => void
  setColor: (color: ColorTheme) => void
  setRadius: (radius: RadiusPreset) => void
  setShadow: (shadow: ShadowPreset) => void
  setDensity: (density: DensityPreset) => void
  setConfig: (config: Partial<ThemeConfig>) => void
}

const STORAGE_KEY = 'nexora_theme_v2'

const DEFAULT_CONFIG: ThemeConfig = {
  mode: 'system',
  color: 'default',
  radius: 'default',
  shadow: 'default',
  density: 'default',
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const readConfig = (): ThemeConfig => {
  if (typeof window === 'undefined') return DEFAULT_CONFIG
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const legacyMode = window.localStorage.getItem('nexora_theme')
      if (legacyMode === 'light' || legacyMode === 'dark' || legacyMode === 'system') {
        return { ...DEFAULT_CONFIG, mode: legacyMode }
      }
      return DEFAULT_CONFIG
    }
    const parsed = JSON.parse(raw) as Partial<ThemeConfig>
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return DEFAULT_CONFIG
  }
}

const saveConfig = (config: ThemeConfig) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    void 0
  }
}

const systemPrefersDark = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

type ColorClass = `theme-${ColorTheme}`
type RadiusClass = `radius-${RadiusPreset}`
type ShadowClass = `shadow-${ShadowPreset}`
type DensityClass = `density-${DensityPreset}`

const COLOR_CLASSES: ColorClass[] = ['theme-default', 'theme-slate', 'theme-rose', 'theme-forest', 'theme-violet', 'theme-amber']
const RADIUS_CLASSES: RadiusClass[] = ['radius-sharp', 'radius-default', 'radius-soft', 'radius-round']
const SHADOW_CLASSES: ShadowClass[] = ['shadow-flat', 'shadow-default', 'shadow-elevated']
const DENSITY_CLASSES: DensityClass[] = ['density-compact', 'density-default', 'density-comfortable']

const applyClasses = (config: ThemeConfig, effective: EffectiveTheme) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  root.classList.add('theme-transitioning')

  root.classList.toggle('dark', effective === 'dark')
  root.style.colorScheme = effective

  COLOR_CLASSES.forEach(c => root.classList.remove(c))
  if (config.color !== 'default') root.classList.add(`theme-${config.color}`)

  RADIUS_CLASSES.forEach(r => root.classList.remove(r))
  root.classList.add(`radius-${config.radius}`)

  SHADOW_CLASSES.forEach(s => root.classList.remove(s))
  root.classList.add(`shadow-${config.shadow}`)

  DENSITY_CLASSES.forEach(d => root.classList.remove(d))
  root.classList.add(`density-${config.density}`)

  setTimeout(() => {
    root.classList.remove('theme-transitioning')
  }, 250)
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfigState] = useState<ThemeConfig>(() => readConfig())
  // Kullanıcı isteği (2026-08-03): dark mode geçici olarak gizlendi, effective tema aşağıda
  // sabit 'light' — bu yüzden sistem tercihini izleyen prefersDark artık effective hesabında
  // kullanılmıyor. State/listener'ı SİLMEDİK (ileride dark mode geri açılırsa hazır olsun),
  // sadece TS'in "hiç okunmuyor" uyarısını sessize almak için void ile işaretliyoruz.
  const [prefersDark, setPrefersDark] = useState<boolean>(() => systemPrefersDark())
  void prefersDark

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const effective: EffectiveTheme = useMemo(
    // Kullanıcı isteği (2026-08-03): "dark modu kaldır (gizle), light mod kalsın" — dark tema
    // geçişinde modüllerin genelinde renk uyum sorunları çıktığı için özellik geçici olarak
    // devre dışı bırakıldı. Kod SİLİNMEDİ (ileride geri açılabilsin diye) — sadece effective
    // tema her zaman 'light' olarak sabitlendi. Kullanıcı Header'daki veya Ayarlar > Tema
    // sekmesindeki "Koyu"/"Sistem" seçeneğine tıklasa bile (o UI'lar da bilinçli olarak
    // gizlendi, bkz. Header.tsx ve ThemeSettingsTab.tsx) fiilen hiçbir şey değişmez.
    () => 'light',
    []
  )

  useEffect(() => {
    applyClasses(config, effective)
  }, [config, effective])

  const updateConfig = useCallback((patch: Partial<ThemeConfig>) => {
    setConfigState(prev => {
      const next = { ...prev, ...patch }
      saveConfig(next)
      return next
    })
  }, [])

  const value = useMemo<ThemeContextValue>(() => ({
    ...config,
    effective,
    setMode: (mode) => updateConfig({ mode }),
    setColor: (color) => updateConfig({ color }),
    setRadius: (radius) => updateConfig({ radius }),
    setShadow: (shadow) => updateConfig({ shadow }),
    setDensity: (density) => updateConfig({ density }),
    setConfig: updateConfig,
  }), [config, effective, updateConfig])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return {
      mode: 'system', color: 'default', radius: 'default', shadow: 'default', density: 'default',
      effective: 'light',
      setMode: () => void 0, setColor: () => void 0, setRadius: () => void 0,
      setShadow: () => void 0, setDensity: () => void 0, setConfig: () => void 0,
    }
  }
  return ctx
}
