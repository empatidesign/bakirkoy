import { describe, expect, it } from 'vitest'
import { deadlineFromNow, secondsUntil } from './countdown'

/**
 * docs/hata.md #9 (bilgi yarışması sayacı) ve #6.1 (kütüphane QR sayacı) düzeltmesinin
 * davranış kilidi.
 *
 * Şikayet: "gerçekte 30 saniye geçerken sayaç yalnızca ~5 saniye azalıyor" ve
 * "yaklaşık 5 saniyede 1 saniye azalıyor". Kök neden, sayaçların her tick'te sabit 1
 * düşmesiydi; gecikmiş/atlanmış tick'ler kalıcı olarak kayboluyordu.
 *
 * Aşağıdaki testler ESKİ modeli de simüle eder ve iki modelin farkını ölçer: eski model
 * gecikme altında gerçek zamandan sapar, yeni model sapmaz.
 */
describe('geri sayım (docs/hata.md #9, #6.1)', () => {
  /** Hatalı eski davranış: her tick'te sabit 1 azalt. */
  const legacyCountdown = (startSeconds: number, tickCount: number) =>
    Math.max(0, startSeconds - tickCount)

  it('kalan süre gerçek geçen zamana eşittir', () => {
    const t0 = 1_000_000
    const deadline = deadlineFromNow(60, t0)

    expect(secondsUntil(deadline, t0)).toBe(60)
    expect(secondsUntil(deadline, t0 + 1_000)).toBe(59)
    expect(secondsUntil(deadline, t0 + 30_000)).toBe(30)
    expect(secondsUntil(deadline, t0 + 59_000)).toBe(1)
  })

  it('gecikmiş tickler sayacı yavaşlatmaz (raporun asıl şikayeti)', () => {
    const t0 = 1_000_000
    const deadline = deadlineFromNow(60, t0)

    // Ağır render altında 1 sn'lik tick fiilen ~6 sn'de bir çalışıyor: 30 saniyede
    // yalnızca 5 tick. Eski model 5 saniye düşerdi, yeni model 30 saniye düşer.
    const ticksIn30s = 5
    expect(legacyCountdown(60, ticksIn30s)).toBe(55) // eski: 30 sn'de yalnızca 5 sn düştü
    expect(secondsUntil(deadline, t0 + 30_000)).toBe(30) // yeni: gerçek zamanla birebir
  })

  it('tickler tamamen atlansa bile (sekme arka planda) sayaç doğru kalır', () => {
    const t0 = 1_000_000
    const deadline = deadlineFromNow(60, t0)

    // Hiç tick çalışmadı, 45 saniye geçti.
    expect(legacyCountdown(60, 0)).toBe(60) // eski: hiç azalmamış
    expect(secondsUntil(deadline, t0 + 45_000)).toBe(15) // yeni: doğru
  })

  it('süre dolduğunda negatife düşmez', () => {
    const t0 = 1_000_000
    const deadline = deadlineFromNow(10, t0)

    expect(secondsUntil(deadline, t0 + 10_000)).toBe(0)
    expect(secondsUntil(deadline, t0 + 90_000)).toBe(0)
  })

  it('1 gerçek saniye = sayaçta 1 saniye (raporun beklenen sonucu)', () => {
    const t0 = 1_000_000
    const deadline = deadlineFromNow(120, t0)

    for (let elapsed = 0; elapsed <= 120; elapsed++) {
      expect(secondsUntil(deadline, t0 + elapsed * 1000)).toBe(120 - elapsed)
    }
  })
})
