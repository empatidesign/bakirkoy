export interface LatLng {
  latitude: number
  longitude: number
}

const EARTH_RADIUS_M = 6_371_000

export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`
  const km = meters / 1000
  return `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`
}

export function formatDistanceKm(km: number): string {
  return formatDistance(km * 1000)
}

export function directionsUrl(target: LatLng, placeId?: string | null): string {
  const destination = `${target.latitude},${target.longitude}`
  if (placeId) {
    const params = new URLSearchParams({
      api: '1',
      destination,
      destination_place_id: placeId,
    })
    return `https://www.google.com/maps/dir/?${params.toString()}`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`
}

export function distanceLabel(user: LatLng | null | undefined, target: LatLng | null | undefined): string | null {
  if (!user || !target || typeof target.latitude !== 'number' || typeof target.longitude !== 'number') return null
  return formatDistance(distanceMeters(user, target))
}
