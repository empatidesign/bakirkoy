import { describe, it, expect } from 'vitest'
import { resolveEmergencyMapView } from './emergencyMapView'

describe('resolveEmergencyMapView — acil toplanma harita durumu (R05)', () => {
  it('maps disabled → maps-disabled', () => {
    expect(resolveEmergencyMapView({ loading: false, dataError: false, gmapsStatus: 'disabled', areaCount: 3 })).toBe('maps-disabled')
  })

  it('maps error → maps-error', () => {
    expect(resolveEmergencyMapView({ loading: false, dataError: false, gmapsStatus: 'error', areaCount: 3 })).toBe('maps-error')
  })

  it('veri yüklenirken → loading', () => {
    expect(resolveEmergencyMapView({ loading: true, dataError: false, gmapsStatus: 'ready', areaCount: 0 })).toBe('loading')
  })

  it('API hatası boş sonuçtan AYRILIR → data-error', () => {
    expect(resolveEmergencyMapView({ loading: false, dataError: true, gmapsStatus: 'ready', areaCount: 0 })).toBe('data-error')
  })

  it('gerçek boş sonuç → empty', () => {
    expect(resolveEmergencyMapView({ loading: false, dataError: false, gmapsStatus: 'ready', areaCount: 0 })).toBe('empty')
  })

  it('veri var → ready', () => {
    expect(resolveEmergencyMapView({ loading: false, dataError: false, gmapsStatus: 'ready', areaCount: 5 })).toBe('ready')
  })
})
