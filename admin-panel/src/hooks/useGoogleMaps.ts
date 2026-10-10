import { useEffect, useState } from 'react'
import integrationSettingsService from '@/services/integrationSettings.service'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'disabled' | 'error'

declare global {
  interface Window {
    __nexoraGoogleMapsLoader?: Promise<void>
    gm_authFailure?: () => void
  }
}

let cachedApiKey: string | null | undefined
let authFailed = false
const authFailureListeners = new Set<() => void>()

function installAuthFailureHandler() {
  if (window.gm_authFailure) return
  window.gm_authFailure = () => {
    authFailed = true
    authFailureListeners.forEach((fn) => fn())
  }
}

function loadScript(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve()
  if (window.__nexoraGoogleMapsLoader) return window.__nexoraGoogleMapsLoader

  installAuthFailureHandler()
  window.__nexoraGoogleMapsLoader = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=tr&region=TR`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Maps script yüklenemedi'))
    document.head.appendChild(script)
  })
  return window.__nexoraGoogleMapsLoader
}

export function useGoogleMaps(): { status: LoadStatus; apiKey: string | null } {
  const [status, setStatus] = useState<LoadStatus>(authFailed ? 'error' : 'idle')
  const [apiKey, setApiKey] = useState<string | null>(cachedApiKey ?? null)

  useEffect(() => {
    let cancelled = false
    const onAuthFailure = () => { if (!cancelled) setStatus('error') }
    authFailureListeners.add(onAuthFailure)

    const run = async () => {
      if (authFailed) { setStatus('error'); return }
      setStatus('loading')
      try {
        let key = cachedApiKey
        if (key === undefined) {
          const config = await integrationSettingsService.getMapConfig()
          key = config.enabled ? config.apiKey : null
          cachedApiKey = key
        }
        if (cancelled) return
        if (!key) {
          setApiKey(null)
          setStatus('disabled')
          return
        }
        setApiKey(key)
        await loadScript(key)
        if (!cancelled) setStatus(authFailed ? 'error' : 'ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void run()
    return () => {
      cancelled = true
      authFailureListeners.delete(onAuthFailure)
    }
  }, [])

  return { status, apiKey }
}
