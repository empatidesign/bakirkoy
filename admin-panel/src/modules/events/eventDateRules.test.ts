import { describe, it, expect } from 'vitest'
import { deriveSingleDay, applicationEndMax, withEventEndFallback } from './eventDateRules'

describe('deriveSingleDay — bitiş opsiyonel, boş=tek gün', () => {
  it('bitiş boşsa tek günlük kabul edilir', () => {
    expect(deriveSingleDay('2026-10-20', '')).toBe(true)
  })

  it('bitiş başlangıçla aynı günse tek günlük', () => {
    expect(deriveSingleDay('2026-10-20', '2026-10-20T00:00:00')).toBe(true)
  })

  it('bitiş farklı günse çok günlük', () => {
    expect(deriveSingleDay('2026-10-20', '2026-10-30')).toBe(false)
  })
})

describe('applicationEndMax — başvuru bitişi ≤ etkinlik bitişi ama takvim asla tümüyle pasif olmaz', () => {
  it('etkinlik tarihi yoksa üst sınır yok', () => {
    expect(applicationEndMax('', '2026-10-01')).toBeUndefined()
  })

  it('normal durumda üst sınır etkinliğin son günüdür', () => {
    expect(applicationEndMax('2026-10-20', '2026-10-01')).toBe('2026-10-20')
  })

  it('etkinliğin son günü, başvuru başlangıcından ÖNCEyse üst sınır düşer (min>max pasiflik önlenir)', () => {
    expect(applicationEndMax('2026-10-10', '2026-10-15')).toBeUndefined()
  })
})

describe('withEventEndFallback — boş bitiş kayıtta başlangıca eşitlenir', () => {
  it('bitiş boşsa başlangıca set edilir', () => {
    expect(withEventEndFallback({ startDate: '2026-10-20', endDate: '' }))
      .toEqual({ startDate: '2026-10-20', endDate: '2026-10-20' })
  })

  it('bitiş doluysa değişmez', () => {
    const d = { startDate: '2026-10-20', endDate: '2026-10-30' }
    expect(withEventEndFallback(d)).toBe(d)
  })
})
