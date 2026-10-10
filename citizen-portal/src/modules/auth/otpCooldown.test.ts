import { describe, it, expect } from 'vitest'
import { loadOrInitDeadline, saveDeadline } from './otpCooldown'
import { secondsUntil } from '@/lib/countdown'

const makeStore = () => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v) },
    removeItem: (k: string) => { m.delete(k) },
  }
}

describe('otpCooldown — kalıcı mutlak deadline (R07)', () => {
  it('ilk mount 180sn deadline yazar; 120sn sonra remount 60sn kalanı korur', () => {
    const store = makeStore()
    const t0 = 1_000_000_000_000
    const first = loadOrInitDeadline('tok', 180, t0, store)
    expect(secondsUntil(first, t0)).toBe(180)

    const remount = loadOrInitDeadline('tok', 180, t0 + 120_000, store)
    expect(remount).toBe(first)
    expect(secondsUntil(remount, t0 + 120_000)).toBe(60)
  })

  it('süresi geçmiş deadline KORUNUR, kalan 0 (yeniden başlatılmaz)', () => {
    const store = makeStore()
    const t0 = 1_000_000_000_000
    const first = loadOrInitDeadline('tok', 180, t0, store)
    const after = loadOrInitDeadline('tok', 180, t0 + 200_000, store)
    expect(after).toBe(first)
    expect(secondsUntil(after, t0 + 200_000)).toBe(0)
    const again = loadOrInitDeadline('tok', 180, t0 + 260_000, store)
    expect(secondsUntil(again, t0 + 260_000)).toBe(0)
  })

  it('saveDeadline (resend) yeni deadline yazar ve sonraki load onu okur', () => {
    const store = makeStore()
    const t0 = 1_000_000_000_000
    loadOrInitDeadline('tok', 180, t0, store)
    const saved = saveDeadline('tok', 90, t0 + 10_000, store)
    const reloaded = loadOrInitDeadline('tok', 180, t0 + 10_000, store)
    expect(reloaded).toBe(saved)
    expect(secondsUntil(reloaded, t0 + 10_000)).toBe(90)
  })

  it('farklı token farklı deadline tutar', () => {
    const store = makeStore()
    const t0 = 1_000_000_000_000
    const a = loadOrInitDeadline('A', 180, t0, store)
    const b = loadOrInitDeadline('B', 60, t0, store)
    expect(a).not.toBe(b)
  })
})
