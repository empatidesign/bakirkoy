export interface LatLng {
  latitude: number
  longitude: number
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
