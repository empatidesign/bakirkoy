export type EmergencyMapViewState = 'loading' | 'maps-disabled' | 'maps-error' | 'data-error' | 'empty' | 'ready'

export type GoogleMapsStatus = 'idle' | 'loading' | 'ready' | 'disabled' | 'error'

export const resolveEmergencyMapView = (args: {
  loading: boolean
  dataError: boolean
  gmapsStatus: GoogleMapsStatus
  areaCount: number
}): EmergencyMapViewState => {
  if (args.gmapsStatus === 'disabled') return 'maps-disabled'
  if (args.gmapsStatus === 'error') return 'maps-error'
  if (args.loading || args.gmapsStatus === 'idle' || args.gmapsStatus === 'loading') return 'loading'
  if (args.dataError) return 'data-error'
  if (args.areaCount === 0) return 'empty'
  return 'ready'
}
