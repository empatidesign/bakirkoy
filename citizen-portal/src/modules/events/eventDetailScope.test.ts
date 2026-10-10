import { describe, it, expect } from 'vitest'
import { resolveEventDetailScope } from './eventDetailScope'
import type { CitizenEventDetail, CitizenEventSession } from '@/types/event.types'

const session = (over: Partial<CitizenEventSession>): CitizenEventSession => ({
  id: 's', date: '2026-10-05', startTime: '10:00', endTime: '12:00',
  capacity: 420, registeredCount: 0, reserveCapacity: 0, waitlistCount: 0,
  ...over,
} as CitizenEventSession)

const detail = (over: Partial<CitizenEventDetail>): CitizenEventDetail => ({
  hasSessions: true, startDate: '2026-10-05', endDate: '2026-10-06',
  capacity: 840, registeredCount: 1, reserveCapacity: 0, waitlistCount: 0,
  alreadyApplied: true, sessions: [], applicants: [],
  ...over,
} as CitizenEventDetail)

const s1 = session({ id: 's1', date: '2026-10-05', capacity: 420, registeredCount: 1 })
const s2 = session({ id: 's2', date: '2026-10-06', capacity: 420, registeredCount: 0 })

describe('resolveEventDetailScope — çoklu-seans mobil detay (WEB-001/002/003)', () => {
  it('WEB-001: seçili seansın tarihini döner (etkinlik startDate değil)', () => {
    const d = detail({ sessions: [s1, s2], startDate: '2026-10-05' })
    expect(resolveEventDetailScope(d, 's2', null).date).toBe('2026-10-06')
  })

  it('WEB-003: seçili seansın kapasitesini döner (toplam 840 değil)', () => {
    const d = detail({ sessions: [s1, s2], capacity: 840 })
    expect(resolveEventDetailScope(d, 's2', null).capacity).toBe(420)
    expect(resolveEventDetailScope(d, 's1', null).registered).toBe(1)
  })

  it('WEB-002: rezervasyon seans-bazlı — sadece başvurulan seansta applied', () => {
    const d = detail({ sessions: [s1, s2], alreadyApplied: true, applicants: [{ appliedSessionIds: ['s1'] }] as never })
    expect(resolveEventDetailScope(d, 's1', null).applied).toBe(true)
    expect(resolveEventDetailScope(d, 's2', null).applied).toBe(false)
  })

  it('seans yoksa (hasSessions=false) etkinlik-genel değerler kullanılır', () => {
    const d = detail({ hasSessions: false, capacity: 100, alreadyApplied: true, sessions: [] })
    const scope = resolveEventDetailScope(d, null, null)
    expect(scope.capacity).toBe(100)
    expect(scope.applied).toBe(true)
  })

  it('R03: seçili sessionId verilince ilk-yaklaşan seans (fallback) EZİLMEZ', () => {
    const d = detail({ sessions: [s1, s2], applicants: [{ appliedSessionIds: ['s2'] }] as never })
    const scope = resolveEventDetailScope(d, 's2', s1)
    expect(scope.date).toBe('2026-10-06')
    expect(scope.applied).toBe(true)
    expect(resolveEventDetailScope(d, 's1', s1).applied).toBe(false)
  })
})
