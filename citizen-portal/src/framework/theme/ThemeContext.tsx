import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type EffectiveTheme = 'light' | 'dark'

interface ThemeContextValue {
  mode: ThemeMode
  effective: EffectiveTheme
  setMode: (mode: ThemeMode) => void
}

const STORAGE_KEY = 'nexora_theme'
const DEFAULT_MODE: ThemeMode = 'system'

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'system'

const readStoredMode = (): ThemeMode => {
  if (typeof window === 'undefined') return DEFAULT_MODE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return isThemeMode(raw) ? raw : DEFAULT_MODE
  } catch {
    return DEFAULT_MODE
  }
}

const systemPrefersDark = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

const applyEffectiveTheme = (effective: EffectiveTheme) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', effective === 'dark')
  root.style.colorScheme = effective
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode())
  // Kullanıcı isteği (2026-08-05): "vatandaş portalındaki dark temayı kaldır" — admin panelde
  // daha önce yapılan aynı düzeltme deseni (bkz. admin-panel commit 11d8478): kod SİLİNMEDİ,
  // sadece effective tema aşağıda sabit 'light' döndürülüyor. Bu yüzden sistem tercihini
  // izleyen prefersDark artık effective hesabında kullanılmıyor; state/listener'ı ileride dark
  // mode geri açılırsa hazır olsun diye koruyoruz, sadece "hiç okunmuyor" uyarısını sessize
  // almak için void ile işaretliyoruz.
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
    // Kullanıcı isteği (2026-08-05): dark mode kaldırıldı, her zaman light dönüyor.
    () => 'light',
    []
  )

  useEffect(() => {
    applyEffectiveTheme(effective)
  }, [effective])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      void 0
    }
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, effective, setMode }),
    [mode, effective, setMode]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return { mode: DEFAULT_MODE, effective: 'light', setMode: () => void 0 }
  }
  return ctx
}
