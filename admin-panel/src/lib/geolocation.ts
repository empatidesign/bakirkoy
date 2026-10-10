
import type { LocationConsentStatus } from '@/types/library.types'

export interface GeoPosition {
  latitude: number
  longitude: number
  accuracy: number
}

export type GeoResult =
  | { ok: true; position: GeoPosition }
  | { ok: false; reason: 'unsupported' | 'denied' | 'timeout' | 'unavailable' }

const GEO_TIMEOUT_MS = 10_000

export const isGeolocationSupported = (): boolean =>
  typeof navigator !== 'undefined' && 'geolocation' in navigator

export const queryLocationPermission = async (): Promise<LocationConsentStatus> => {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown'
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') return status.state
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export const getCurrentPosition = (): Promise<GeoResult> =>
  new Promise((resolve) => {
    if (!isGeolocationSupported()) {
      resolve({ ok: false, reason: 'unsupported' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        ok: true,
        position: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy },
      }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) resolve({ ok: false, reason: 'denied' })
        else if (err.code === err.TIMEOUT) resolve({ ok: false, reason: 'timeout' })
        else resolve({ ok: false, reason: 'unavailable' })
      },
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: 0 },
    )
  })
