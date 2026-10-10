import { describe, expect, it } from 'vitest'
import { quizResultTone, showsPassVerdict } from './quizResult'

/**
 * docs/hata.md #11 (KRİTİK) düzeltmesinin davranış kilidi.
 *
 * Şikayet: "Kullanıcı yarışmayı %100 başarıyla tamamlamasına rağmen sonuç ekranında
 * Geçemediniz". Kök neden, arayüzün kendi uydurduğu successRate >= 70 eşiğiydi.
 */
describe('yarışma sonucu (docs/hata.md #11)', () => {
  /** Hatalı eski karar: yüzdeye bakan sabit eşik. */
  const legacyTone = (successRate: number) =>
    successRate >= 70 ? 'success' : successRate >= 40 ? 'warning' : 'danger'

  it('geçme puanı yüksek olsa da sunucu geçti diyorsa başarılı gösterilir', () => {
    // Raporun tam senaryosu: kullanıcı geçti ama ham yüzde eşiğin altında kalabiliyor
    // (ör. pas hakkı kullanılmış, puanlama ağırlıklı). Eski mantık burada "başarısız" derdi.
    const result = { isPassed: true, successRate: 60, passingScore: 50 }

    expect(legacyTone(result.successRate)).toBe('warning') // eski: yanlış
    expect(quizResultTone(result)).toBe('success') // yeni: sunucunun kararı
  })

  it('yüzde 100 yapan kullanıcıya asla başarısız denmez', () => {
    const result = { isPassed: true, successRate: 100, passingScore: 70 }
    expect(quizResultTone(result)).toBe('success')
  })

  it('sunucu geçemedi diyorsa başarılı gösterilmez', () => {
    expect(quizResultTone({ isPassed: false, successRate: 65 })).toBe('warning')
    expect(quizResultTone({ isPassed: false, successRate: 20 })).toBe('danger')
  })

  it('geçme şartı tanımsızken geçti/geçemedi iddiası gösterilmez', () => {
    expect(showsPassVerdict({ passingScore: 0 })).toBe(false)
    expect(showsPassVerdict({ passingScore: 70 })).toBe(true)
    expect(showsPassVerdict(null)).toBe(false)
  })

  it('sonuç henüz yokken ekran hata tonuna düşmez', () => {
    expect(quizResultTone(null)).toBe('success')
  })
})
