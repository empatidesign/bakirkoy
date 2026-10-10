/**
 * Geri sayım yardımcıları.
 *
 * Hata raporu (docs/hata.md #9 ve #6.1): sayaçlar "her tick'te 1 azalt" mantığıyla
 * yazılmıştı. Bu yaklaşım tick gecikmelerini BİRİKTİRİR: render/animasyon yükü altında
 * bir saniyelik tick 1.2-1.5 saniyede çalışır, her gecikme kalıcı olarak kaybedilir ve
 * gerçekte 30 saniye geçerken sayaç ancak ~5 saniye düşer.
 *
 * Doğru model: bitiş ANINI sakla, kalan süreyi her seferinde "bitiş - şimdi" olarak
 * YENİDEN HESAPLA. Tick gecikse, atlansa, sekme arka plana alınsa bile gösterilen değer
 * gerçek saatle senkron kalır.
 */

/** Verilen bitiş anına göre kalan tam saniye (asla negatif olmaz). */
export const secondsUntil = (deadlineMs: number, nowMs: number = Date.now()): number =>
  Math.max(0, Math.round((deadlineMs - nowMs) / 1000))

/** Şimdiden itibaren verilen saniye sonrası için bitiş anı. */
export const deadlineFromNow = (seconds: number, nowMs: number = Date.now()): number =>
  nowMs + seconds * 1000
