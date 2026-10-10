import type { CitizenQuizSubmitResult } from '@/types/quiz.types'

/**
 * Yarışma sonucunun kullanıcıya nasıl sunulacağı.
 *
 * Hata raporu (docs/hata.md #11, KRİTİK): "%100 başarıyla tamamlamasına rağmen sonuç
 * ekranında Geçemediniz". Kök neden, başarı kararının arayüzde uydurma bir eşikle
 * (successRate >= 70) verilmesiydi. Gerçek geçme şartı yarışma bazında ve PUAN üzerinden
 * tanımlıdır (quiz.PassingScore); sunucu bunu zaten hesaplayıp isPassed olarak döndürür.
 *
 * Karar burada tek yerde toplandı ve doğrudan sunucunun sonucuna bağlandı.
 */
export type QuizResultTone = 'success' | 'warning' | 'danger'

export const quizResultTone = (result: Pick<CitizenQuizSubmitResult, 'isPassed' | 'successRate'> | null): QuizResultTone => {
  if (!result) return 'success'
  if (result.isPassed) return 'success'
  return result.successRate >= 40 ? 'warning' : 'danger'
}

/**
 * Geçme şartı tanımlı değilse (passingScore = 0) "geçtiniz/geçemediniz" iddiası hiç
 * gösterilmez; aksi halde her katılımcıya yanlış bir yargı bildirilirdi.
 */
export const showsPassVerdict = (result: Pick<CitizenQuizSubmitResult, 'passingScore'> | null): boolean =>
  !!result && result.passingScore > 0
