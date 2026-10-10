import { useEffect, useState } from 'react'
import integrationSettingsService from '@/services/integrationSettings.service'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'disabled' | 'error'

declare global {
  interface Window {
    __nexoraGoogleMapsLoader?: Promise<void>
  }
}

let cachedApiKey: string | null | undefined

function loadScript(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve()
  if (window.__nexoraGoogleMapsLoader) return window.__nexoraGoogleMapsLoader

  window.__nexoraGoogleMapsLoader = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Maps script yüklenemedi'))
    document.head.appendChild(script)
  })
  return window.__nexoraGoogleMapsLoader
}

export function useGoogleMaps(): { status: LoadStatus; apiKey: string | null } {
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [apiKey, setApiKey] = useState<string | null>(cachedApiKey ?? null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
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
        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void run()
    return () => { cancelled = true }
  }, [])

  return { status, apiKey }
}
