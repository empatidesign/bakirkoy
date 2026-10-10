import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { PendingSurveySummary } from '@/types/survey.types'
import surveyService from '@/services/survey.service'
import { SurveyFormModal } from './SurveyFormModal'
import { useAuth } from '@/framework/auth/AuthContext'

type Props = {
  children: React.ReactNode
}

const MAX_FETCH_ATTEMPTS = 3
const RETRY_DELAY_MS = 1500

// Kullanıcı isteği (2026-08-12): "birden fazla program veya etkinlik varsa bunlar her biri en az
// 1 saat arası olsun veya her girişte sayfa geçişlerinde çok rahatsız etmeyecek şekilde
// zamanlama olması lazım" — pacing algoritması. Backend (ParticipantSurveyService.
// GetPendingSummaryAsync) aynı anda en fazla BİR zorunlu anketin bloklayıcı modal olarak
// sunulmasına izin verir (nextEligibleRequiredSurveyId, Participant.LastMandatorySurveyPromptAt
// üzerinden en az 60dk aralıkla). Bu gate, o tek anketi bulup gösterir; gösterildiği an backend'e
// "prompted" damgası atılır (markPrompted) böylece bir sonraki anket bekleme süresi başlar.
// Vatandaş bekleyen diğer zorunlu anketleri (varsa) her sayfa/tab geçişinde tekrar tekrar
// önüne çıkan modallarla rahatsız edilmeden, uygulamayı normal kullanmaya devam eder.
export function PendingSurveyGate({ children }: Props) {
  const { state } = useAuth()
  // Kullanıcı isteği (2026-09-01): saha anket sisteminde (/saha) anketör başka bir vatandaşla
  // görüşme yapıyordur; anketörün KENDİ bekleyen zorunlu anketi bu ekranı bloklamamalıdır.
  // Aksi hâlde saha görüşmesinin ortasında anketörün kendi anketi tam ekran açılır ve
  // görüşülen vatandaşın cevapları kaybolurdu.
  const isFieldMode = useLocation().pathname.startsWith('/saha')
  const userId = state.status === 'authenticated' ? state.user.id : null
  // SORUN (2026-09-23, kullanıcı bulgusu): admin panelden oluşturulan bir katılımcı ilk
  // girişte KVKK/bildirim onayını verdikten sonra "şifre değiştirmek zorunlu" bekleniyordu
  // ama /first-login ekranı hiç görünmüyordu. Kök neden: genel (audience=all) zorunlu bir
  // anket varsa bu gate CitizenRoutes'u (dolayısıyla ProtectedRoute'un mustChangePassword
  // yönlendirmesini) hiç render etmiyordu — kullanıcı şifresini değiştirecek ekrana asla
  // ulaşamadan sonsuza dek anket modalı (ya da boş ekran) arkasında kilitli kalıyordu.
  // Zorunlu şifre değişimi anketten önce gelir: bu durumda gate tamamen pas geçilir.
  const mustChangePassword = state.status === 'authenticated' && state.user.mustChangePassword

  const [summary, setSummary] = useState<PendingSurveySummary | null>(null)
  const [ready, setReady] = useState(false)
  const [blockedByError, setBlockedByError] = useState(false)
  const [dismissedOptionalIds, setDismissedOptionalIds] = useState<Set<string>>(new Set())
  const [promptedSurveyId, setPromptedSurveyId] = useState<string | null>(null)
  const attemptRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    attemptRef.current = 0
    // Hata bulgusu (2026-08-16): bağımlılık dizisi [] idi — veli çocuk hesabına
    // geçtiğinde (uygulamadan/sayfadan ayrılmadan) bu gate yeniden mount olmuyor,
    // bu yüzden zorunlu-anket özeti bir daha hiç yeniden çekilmiyordu; veli
    // hesabının anket durumu (ve varsa açık zorunlu anket modalı) çocuk hesabına
    // geçilmişken de ekranda kalmaya devam ediyordu. userId (aktif participant)
    // değişince özet sıfırdan çekilir; ayrıca önceki hesaba ait dismiss/prompt
    // durumu yeni hesaba taşınmasın diye sıfırlanır.
    setSummary(null)
    setReady(false)
    setBlockedByError(false)
    setDismissedOptionalIds(new Set())
    setPromptedSurveyId(null)

    const fetchSummary = () => {
      attemptRef.current += 1
      surveyService.pendingSummary()
        .then((res) => {
          if (cancelled) return
          setSummary(res)
          setReady(true)
          setBlockedByError(false)
        })
        .catch(() => {
          if (cancelled) return
          if (attemptRef.current < MAX_FETCH_ATTEMPTS) {
            setTimeout(fetchSummary, RETRY_DELAY_MS)
          } else {
            setSummary(null)
            setReady(true)
            setBlockedByError(true)
          }
        })
    }

    if (!userId || mustChangePassword) { setReady(true); return () => { cancelled = true } }
    fetchSummary()
    return () => { cancelled = true }
  }, [userId, mustChangePassword])

  const requiredSurveyId = summary?.nextEligibleRequiredSurveyId ?? null
  const requiredItem = requiredSurveyId ? summary?.items.find((i) => i.id === requiredSurveyId) ?? null : null

  const optionalItem = !requiredSurveyId
    ? summary?.items.find((i) => !i.isRequired && !dismissedOptionalIds.has(i.id)) ?? null
    : null

  const current = requiredItem ?? optionalItem
  const blockedByRequiredSurvey = !!requiredItem

  useEffect(() => {
    if (!requiredSurveyId || promptedSurveyId === requiredSurveyId) return
    setPromptedSurveyId(requiredSurveyId)
    surveyService.markPrompted().catch(() => {})
  }, [requiredSurveyId, promptedSurveyId])

  const refresh = () => {
    surveyService.pendingSummary()
      .then((res) => setSummary(res))
      .catch(() => {})
  }

  const handleClose = (submitted?: boolean) => {
    if (!current) return
    if (!submitted && current.isRequired) return
    if (!current.isRequired) {
      setDismissedOptionalIds((prev) => new Set(prev).add(current.id))
    }
    if (submitted) refresh()
  }

  if (isFieldMode || mustChangePassword) return <>{children}</>

  return (
    <>
      {ready && !blockedByRequiredSurvey ? children : null}
      {ready && blockedByRequiredSurvey && (
        <div aria-hidden="true" className="fixed inset-0 z-40 bg-background" />
      )}
      <SurveyFormModal
        surveyId={current?.id ?? null}
        isRequired={current?.isRequired ?? true}
        onClose={handleClose}
      />
      {blockedByError && import.meta.env.DEV && (
        <div className="fixed bottom-2 right-2 z-50 rounded bg-amber-500/90 px-2 py-1 text-[10px] text-white">
          survey/pending/summary alınamadı (gate açık bırakıldı)
        </div>
      )}
    </>
  )
}
