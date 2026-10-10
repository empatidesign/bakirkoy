import { describe, it, expect } from 'vitest'
import { combineApplicationResults } from './combineApplicationResults'

const ok = <T>(items: T[]): PromiseSettledResult<{ items: T[] }> => ({ status: 'fulfilled', value: { items } })
const fail = <T>(): PromiseSettledResult<{ items: T[] }> => ({ status: 'rejected', reason: new Error('boom') })

describe('combineApplicationResults', () => {
  it('hepsi başarılıysa loadError=false ve listeler eşlenir', () => {
    const r = combineApplicationResults(
      ok([{} as never]),
      ok([]),
      ok([{} as never, {} as never]),
      ok([]),
    )
    expect(r.loadError).toBe(false)
    expect(r.eventApps).toHaveLength(1)
    expect(r.facilityApps).toHaveLength(2)
  })

  it('bir kaynak reddedilirse loadError=true ve o kaynak boş kalır (sessizce yok sayılmaz)', () => {
    const r = combineApplicationResults(
      fail(),
      ok([{} as never]),
      ok([]),
      ok([]),
    )
    expect(r.loadError).toBe(true)
    expect(r.eventApps).toEqual([])
    expect(r.travelApps).toHaveLength(1)
  })
})
