import { useEffect, useRef, useState } from 'react'

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

export type UserLocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable'

interface UserLocationState {
  status: UserLocationStatus
  position: GeoPosition | null
}

type Listener = (s: UserLocationState) => void

let sharedState: UserLocationState = { status: 'idle', position: null }
const listeners = new Set<Listener>()
let watchId: number | null = null

function setState(next: Partial<UserLocationState>) {
  sharedState = { ...sharedState, ...next }
  listeners.forEach((l) => l(sharedState))
}

function startWatch() {
  if (watchId != null || !isGeolocationSupported()) return
  watchId = navigator.geolocation.watchPosition(
    (pos) => setState({
      status: 'ready',
      position: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy },
    }),
    () => {},
    { enableHighAccuracy: false, timeout: GEO_TIMEOUT_MS, maximumAge: 60_000 },
  )
}

async function requestUserLocation(): Promise<void> {
  if (sharedState.status === 'loading' || sharedState.status === 'ready') {
    if (sharedState.status === 'ready') startWatch()
    return
  }
  setState({ status: 'loading' })
  const res = await getCurrentPosition()
  if (res.ok) {
    setState({ status: 'ready', position: res.position })
    startWatch()
  } else {
    setState({ status: res.reason === 'denied' ? 'denied' : 'unavailable', position: null })
  }
}

async function requestUserLocationSilently(): Promise<void> {
  if (sharedState.status !== 'idle') {
    if (sharedState.status === 'ready') startWatch()
    return
  }
  try {
    if (!('permissions' in navigator)) return
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    if (status.state !== 'granted') return
  } catch {
    return
  }
  await requestUserLocation()
}

export interface UseUserLocationResult {
  status: UserLocationStatus
  position: GeoPosition | null
  request: () => void
  requestSilently: () => void
}

export function useUserLocation(): UseUserLocationResult {
  const [state, setLocalState] = useState<UserLocationState>(sharedState)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const listener: Listener = (s) => { if (mounted.current) setLocalState(s) }
    listeners.add(listener)
    setLocalState(sharedState)
    return () => { mounted.current = false; listeners.delete(listener) }
  }, [])

  return {
    status: state.status,
    position: state.position,
    request: () => { void requestUserLocation() },
    requestSilently: () => { void requestUserLocationSilently() },
  }
}

export async function currentCoordinates(): Promise<{ latitude?: number; longitude?: number }> {
  const result = await getCurrentPosition()
  return result.ok ? { latitude: result.position.latitude, longitude: result.position.longitude } : {}
}
