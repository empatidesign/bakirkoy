import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import {
  CheckCircleIcon,
  TrophyIcon,
  ZapIcon,
  ClockIcon,
  StarIcon,
  UsersIcon,
  TargetIcon,
  ChevronRightIcon,
  AwardIcon,
  SkipForwardIcon,
  XCircleIcon,
  CheckIcon,
  XIcon,
  Loader2Icon,
} from 'lucide-react'
import { Modal, Button, SkeletonRows, Banner } from '@/design-system'
import type { CitizenQuizDetail, QuizAnswer, CitizenQuizSubmitResult } from '@/types/quiz.types'
import quizService from '@/services/quiz.service'
import { secondsUntil, deadlineFromNow } from '@/lib/countdown'
import { quizResultTone, showsPassVerdict } from './quizResult'

type Props = {
  quizId: string | null
  onClose: () => void
  onGoLeaderboard: (quizId: string) => void
}

type Phase = 'loading' | 'error' | 'intro' | 'playing' | 'result'

const OPTION_LABELS = ['A', 'B', 'C', 'D']
const DEFAULT_ACCENT = '#6366F1'
const RING_RADIUS = 42
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const formatTimeLeft = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Kullanıcı isteği (2026-08-30): "yarışma başlattıktan sonra gelen ekranlar çok fazla
// renkli, genel tasarım kurallarımıza uyarak bu ekranları iyileştir" — önceki sürüm
// mor-siyah-pembe-sarı-mavi glow'lu, tam ekran koyu bir "eğlence parkı" temasıydı ve
// portalın geri kalanındaki (EventDetailModal, TravelDetailModal, FacilityDetailModal vb.)
// açık zeminli, tek bir kategori-rengi vurgulu sade dile hiç uymuyordu. Artık standart
// Modal bileşeni + açık zemin kullanılıyor; renk sadece kategoriden (categoryColor) veya
// anlamlı bir durumdan (başarı/uyarı/hata) geliyor, davranış (soru süresi, pas hakkı,
// otomatik sonraki soru, sonuç ekranı) hiç değişmedi.
export const QuizPlayModal = ({ quizId, onClose, onGoLeaderboard }: Props) => {
  const [detail, setDetail] = useState<CitizenQuizDetail | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<CitizenQuizSubmitResult | null>(null)
  const [animating, setAnimating] = useState(false)
  const [loadKey, setLoadKey] = useState(0)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null)
  const [verdict, setVerdict] = useState<boolean | null>(null)
  const [verdictLoading, setVerdictLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startedAtRef = useRef(0)
  const questionStartRef = useRef(0)
  // Hata raporu (docs/hata.md #9): sayaç gerçek zamana göre değil, "her tick'te bir azalt"
  // mantığıyla ilerliyordu. Her azalma yeni bir setTimeout kuruyor, o timeout da render/animasyon
  // yüküyle gecikiyordu; gecikmeler biriktiği için 30 saniyede ancak ~5 saniye düşüyordu.
  // Artık bitiş ANI (timestamp) saklanıyor ve kalan süre her tick'te "bitiş - şimdi" olarak
  // YENİDEN HESAPLANIYOR; tick gecikse bile gösterilen süre gerçek saatle senkron kalır.
  const quizDeadlineRef = useRef<number | null>(null)
  const questionDeadlineRef = useRef<number | null>(null)
  const answersRef = useRef<QuizAnswer[]>([])
  const submittingRef = useRef(false)

  const accent = detail?.categoryColor || DEFAULT_ACCENT

  useEffect(() => {
    if (!quizId) {
      setDetail(null)
      setPhase('loading')
      setCurrentIndex(0)
      setAnswers([])
      setSelected(null)
      setResult(null)
      setTimeLeft(null)
      setQuestionTimeLeft(null)
      return
    }
    let active = true
    setPhase('loading')
    quizService.detail(quizId)
      .then((d) => {
        if (!active) return
        setDetail(d)
        setPhase('intro')
      })
      .catch(() => {
        if (active) setPhase('error')
      })
    return () => { active = false }
  }, [quizId, loadKey])

  const submitAnswers = (finalAnswers: QuizAnswer[]) => {
    if (!detail || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    const totalTimeSpent = startedAtRef.current > 0
      ? Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000))
      : 0
    quizService.submit(detail.id, { answers: finalAnswers, totalTimeSpent })
      .then((r) => {
        setResult(r)
        setPhase('result')
        setTimeLeft(null)
      })
      .catch((err: unknown) => {
        const resp = (err as { response?: { status?: number; data?: { errorCode?: string; message?: string } } })?.response
        if (resp?.data?.errorCode === 'QUIZ_TIME_EXCEEDED') {
          toast.error('Yarışma süresi doldu, cevaplarınız kabul edilemedi.')
        } else if (resp?.status === 409) {
          toast.error(resp.data?.message ?? 'Zaten bu yarışmaya katıldınız.')
        } else {
          toast.error('Cevaplar gönderilemedi. Lütfen tekrar deneyin.')
        }
      })
      .finally(() => {
        submittingRef.current = false
        setSubmitting(false)
      })
  }

  useEffect(() => {
    if (phase !== 'playing' || timeLeft === null) return
    if (timeLeft <= 0) {
      submitAnswers(answersRef.current)
      return
    }
    const t = setInterval(() => {
      const deadline = quizDeadlineRef.current
      if (deadline === null) return
      setTimeLeft(secondsUntil(deadline))
    }, 250)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submitAnswers useCallback'e sarılı değil; eklenirse her render'da sayaç yeniden başlar
  }, [phase, timeLeft === null, timeLeft === 0])

  const handleStart = () => {
    if (!detail) return
    if (detail.alreadyParticipated) {
      onGoLeaderboard(detail.id)
      onClose()
      return
    }
    if (detail.status !== 'ongoing') return
    setCurrentIndex(0)
    setAnswers([])
    answersRef.current = []
    setSelected(null)
    setVerdict(null)
    setVerdictLoading(false)
    startedAtRef.current = Date.now()
    questionStartRef.current = Date.now()
    const totalSeconds = detail.durationMinutes > 0 ? detail.durationMinutes * 60 : null
    quizDeadlineRef.current = totalSeconds === null ? null : deadlineFromNow(totalSeconds)
    setTimeLeft(totalSeconds)
    const firstLimit = detail.questions[0]?.timeLimit > 0 ? detail.questions[0].timeLimit : null
    questionDeadlineRef.current = firstLimit === null ? null : deadlineFromNow(firstLimit)
    setQuestionTimeLeft(firstLimit)
    setPhase('playing')
  }

  // Kullanıcı isteği (2026-09-02): şık seçilir seçilmez doğru/yanlış (yeşil tik /
  // kırmızı çarpı) gösterilsin. Doğru cevap güvenlik gereği tarayıcıya HİÇ
  // gönderilmiyor (CitizenQuizQuestionDto'da yok), bu yüzden verdict sunucudan
  // /check-answer ucuyla alınır — uç yalnız bool döner, cevap anahtarı sızmaz.
  const handleSelectAnswer = (option: string) => {
    if (animating || selected !== null || verdictLoading) return
    setSelected(option)
    if (!detail) return
    setVerdictLoading(true)
    quizService.checkAnswer(detail.id, currentIndex, option)
      .then((ok) => setVerdict(ok))
      .catch(() => setVerdict(null))
      .finally(() => setVerdictLoading(false))
  }

  // selectedOverride: elle "sonraki"/"pas" tıklanınca seçili şık veya pas geç
  // metni; null ise soru süresi doldu ve kullanıcı hiçbir şık seçmemiş demektir
  // (cevaplanmadı olarak backend'e gönderilir, sunucu bunu yanlış sayar).
  const commitAnswer = (selectedOverride: string | null, isPassed: boolean) => {
    if (!detail || animating || submitting) return
    setAnimating(true)
    const timeSpent = questionStartRef.current > 0
      ? Math.max(0, Math.round((Date.now() - questionStartRef.current) / 1000))
      : 0
    const newAnswers = [
      ...answers,
      { questionIndex: currentIndex, selectedAnswer: selectedOverride ?? '', timeSpent, isPassed },
    ]
    setAnswers(newAnswers)
    answersRef.current = newAnswers

    setTimeout(() => {
      setSelected(null)
      setVerdict(null)
      setVerdictLoading(false)
      setAnimating(false)
      if (currentIndex + 1 < detail.questions.length) {
        const nextIndex = currentIndex + 1
        setCurrentIndex(nextIndex)
        questionStartRef.current = Date.now()
        const nextLimit = detail.questions[nextIndex]?.timeLimit
        const seconds = nextLimit > 0 ? nextLimit : null
        questionDeadlineRef.current = seconds === null ? null : deadlineFromNow(seconds)
        setQuestionTimeLeft(seconds)
      } else {
        submitAnswers(newAnswers)
      }
    }, 150)
  }

  const handleNext = () => {
    if (selected === null) return
    commitAnswer(selected, false)
  }

  // Kullanıcı bulgusu (2026-08-09): admin panelde soru başına süre limiti
  // (perQuestionTimeLimit / question.timeLimit) yapılandırılıyor ama gerçek
  // yarışma alma ekranında hiç kullanılmıyordu — sadece toplam yarışma süresi
  // (durationMinutes) sayılıyordu, tek tek sorular için süre dolduğunda hiçbir
  // şey olmuyordu, kullanıcı istediği kadar o soruda kalabiliyordu. Bu efekt,
  // her soru için ayrı bir geri sayım başlatır; süre dolduğunda seçili cevap
  // var mı yok mu bakılmaksızın (cevaplanmadı sayılarak) otomatik sonraki
  // soruya geçilir — tıpkı kullanıcı elle "sonraki" tıklamış gibi.
  useEffect(() => {
    if (phase !== 'playing' || questionTimeLeft === null) return
    if (questionTimeLeft <= 0) {
      commitAnswer(null, false)
      return
    }
    // Soru sayacı da bitiş anına göre hesaplanır (bkz. docs/hata.md #9).
    const t = setInterval(() => {
      const deadline = questionDeadlineRef.current
      if (deadline === null) return
      setQuestionTimeLeft(secondsUntil(deadline))
    }, 250)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex, questionTimeLeft === null, questionTimeLeft === 0])

  const passedCountUsed = answers.filter((a) => a.isPassed).length
  const passRightsLeft = detail ? Math.max(0, detail.passRights - passedCountUsed) : 0

  const handlePass = () => {
    if (passRightsLeft <= 0) return
    commitAnswer(null, true)
  }

  const question = detail?.questions[currentIndex]
  const progress = detail ? ((currentIndex) / detail.questions.length) * 100 : 0

  // Büyük halka soru başına süreyi gösterir; soruda ayrı bir limit tanımlı
  // değilse toplam yarışma süresine düşer.
  const usesQuestionTimer = questionTimeLeft !== null && (question?.timeLimit ?? 0) > 0
  const ringSeconds = usesQuestionTimer ? questionTimeLeft : timeLeft
  const ringTotal = usesQuestionTimer
    ? (question?.timeLimit ?? 1)
    : (detail && detail.durationMinutes > 0 ? detail.durationMinutes * 60 : 1)
  const ringRatio = ringSeconds === null ? 0 : Math.max(0, Math.min(1, ringSeconds / ringTotal))

  // Hata raporu (docs/hata.md #11, KRİTİK): karar tek yerde ve sunucunun isPassed değerine
  // bağlı (bkz. quizResult.ts) — arayüz artık kendi geçme eşiğini uydurmuyor.
  const resultTone = quizResultTone(result)

  return (
    <Modal
      open={!!quizId}
      onClose={onClose}
      width={480}
      bodyClassName="p-0"
      hideClose={phase === 'playing'}
      header={phase !== 'loading' && phase !== 'error' ? (
        <div className="flex items-center gap-3 pr-8">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ background: `${accent}18`, color: accent }}
          >
            <TrophyIcon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground-strong">{detail?.title ?? 'Yarışma'}</h3>
            {detail?.categoryName && <p className="type-caption truncate">{detail.categoryName}</p>}
          </div>
        </div>
      ) : undefined}
    >
      <div ref={containerRef}>
        {phase === 'loading' && (
          <div className="p-6">
            <SkeletonRows rows={5} />
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-5 p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft">
              <ClockIcon className="h-7 w-7 text-danger" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground-strong">Yarışma yüklenemedi</p>
              <p className="type-muted">Bağlantınızı kontrol edip tekrar deneyin.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={onClose}>Kapat</Button>
              <Button variant="primary" onClick={() => { setPhase('loading'); setLoadKey((k) => k + 1) }}>
                Tekrar Dene
              </Button>
            </div>
          </div>
        )}

        {phase === 'intro' && detail && (
          <div>
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
              {[
                { icon: TargetIcon, label: 'Soru', value: `${detail.questions.length}` },
                { icon: ClockIcon, label: 'Süre', value: `${detail.durationMinutes} dk` },
                { icon: ZapIcon, label: 'Puan', value: `${detail.questions.reduce((s, q) => s + q.points, 0)}` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex flex-col items-center gap-1 py-4">
                  <Icon className="h-4 w-4" style={{ color: accent }} />
                  <span className="text-lg font-bold text-foreground-strong">{value}</span>
                  <span className="type-caption">{label}</span>
                </div>
              ))}
            </div>

            <div className="space-y-4 p-6">
              {detail.description && (
                <p className="text-center text-sm leading-relaxed text-foreground-muted">{detail.description}</p>
              )}

              {detail.alreadyParticipated && (
                <Banner tone="warning" icon={AwardIcon}>
                  Bu yarışmaya zaten katıldınız.
                </Banner>
              )}

              {detail.status !== 'ongoing' && !detail.alreadyParticipated && (
                <Banner tone="danger" icon={ClockIcon}>
                  Yarışma şu anda aktif değil.
                </Banner>
              )}

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleStart}
                disabled={detail.status !== 'ongoing' && !detail.alreadyParticipated}
                style={!detail.alreadyParticipated ? { background: accent } : undefined}
                iconLeft={detail.alreadyParticipated ? <TrophyIcon className="h-5 w-5" /> : <ZapIcon className="h-5 w-5" />}
              >
                {detail.alreadyParticipated ? 'Sıralamaya Git' : 'Yarışmayı Başlat'}
              </Button>
            </div>
          </div>
        )}

        {phase === 'playing' && question && (
          <div>
            <div className="space-y-3 px-6 pb-4 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="type-caption">SORU</span>
                  <span className="text-sm font-bold text-foreground-strong">{currentIndex + 1}</span>
                  <span className="type-caption">/ {detail?.questions.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  {timeLeft !== null && (
                    <div
                      className="flex items-center gap-1.5 rounded-pill px-2.5 py-1"
                      style={timeLeft <= 60 ? { background: '#FEF2F2' } : { background: 'hsl(var(--surface-1))' }}
                    >
                      <ClockIcon className={`h-3.5 w-3.5 ${timeLeft <= 60 ? 'text-danger' : 'text-foreground-muted'}`} />
                      <span className={`text-xs font-bold tabular-nums ${timeLeft <= 60 ? 'text-danger' : 'text-foreground-default'}`}>
                        {formatTimeLeft(timeLeft)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 rounded-pill px-2.5 py-1" style={{ background: '#FFFBEB' }}>
                    <StarIcon className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                    <span className="text-xs font-bold text-amber-700">{question.points} puan</span>
                  </div>
                </div>
              </div>

              <div className="h-1.5 overflow-hidden rounded-pill bg-surface-2">
                <div
                  className="h-full rounded-pill transition-all duration-500"
                  style={{ width: `${progress}%`, background: accent }}
                />
              </div>

            </div>

            <div className="flex justify-center pb-1">
              <div className="relative h-[104px] w-[104px]">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r={RING_RADIUS} fill="none" strokeWidth="8" stroke="hsl(var(--surface-2))" />
                  <circle
                    cx="50" cy="50" r={RING_RADIUS} fill="none" strokeWidth="8" strokeLinecap="round"
                    stroke={ringSeconds !== null && ringSeconds <= 5 ? '#EF4444' : accent}
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={RING_CIRCUMFERENCE * (1 - ringRatio)}
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black tabular-nums text-foreground-strong">
                    {ringSeconds ?? '—'}
                  </span>
                  <span className="type-caption">Saniye</span>
                </div>
              </div>
            </div>

            <div className="mx-6 mb-5 rounded-panel p-4" style={{ background: `${accent}10`, border: `1px solid ${accent}30` }}>
              <p className="text-base font-semibold leading-relaxed text-foreground-strong">{question.question}</p>
            </div>

            <div className="space-y-2.5 px-6 pb-6">
              {question.options.map((opt, idx) => {
                const isSelected = selected === opt
                const showCorrect = isSelected && verdict === true
                const showWrong = isSelected && verdict === false
                const optionStyle = showCorrect
                  ? { background: '#16A34A', borderColor: '#16A34A' }
                  : showWrong
                    ? { background: '#DC2626', borderColor: '#DC2626' }
                    : isSelected
                      ? { background: `${accent}12`, borderColor: accent }
                      : { background: 'hsl(var(--surface-0))', borderColor: 'hsl(var(--border))' }
                const feedbackShown = showCorrect || showWrong
                return (
                  <button
                    key={opt}
                    type="button"
                    data-testid={`quiz-option-${idx}`}
                    onClick={() => handleSelectAnswer(opt)}
                    disabled={selected !== null}
                    /* Hata raporu (docs/hata.md #10): şıklara normal dokunuşta tepki gecikiyordu.
                       touch-manipulation, tarayıcının çift-dokunma-yakınlaştırma için beklettiği
                       ~300 ms'lik gecikmeyi kaldırır; seçim dokunma anında işlenir. */
                    className="flex w-full touch-manipulation select-none items-center gap-3 rounded-pill border px-4 py-3 text-left transition-all active:scale-[0.99] disabled:active:scale-100"
                    style={optionStyle}
                  >
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      style={feedbackShown
                        ? { background: '#fff', color: showCorrect ? '#16A34A' : '#DC2626' }
                        : isSelected
                          ? { background: accent, color: '#fff' }
                          : { background: 'hsl(var(--surface-2))', color: 'hsl(var(--foreground-muted))' }}
                    >
                      {showCorrect ? <CheckIcon className="h-4 w-4" strokeWidth={3} />
                        : showWrong ? <XIcon className="h-4 w-4" strokeWidth={3} />
                        : OPTION_LABELS[idx]}
                    </div>
                    <span
                      className="text-sm font-medium"
                      style={feedbackShown ? { color: '#fff' } : undefined}
                    >
                      {opt}
                    </span>
                    {isSelected && verdictLoading && (
                      <Loader2Icon className="ml-auto h-4 w-4 flex-shrink-0 animate-spin" style={{ color: accent }} />
                    )}
                  </button>
                )
              })}

              <Button
                variant="primary"
                size="lg"
                className="mt-1 w-full"
                onClick={handleNext}
                disabled={selected === null || submitting}
                isLoading={submitting}
                style={selected !== null ? { background: accent } : undefined}
                iconRight={!submitting ? <ChevronRightIcon className="h-4 w-4" /> : undefined}
              >
                {currentIndex + 1 < (detail?.questions.length ?? 0) ? 'Sonraki Soru' : 'Tamamla'}
              </Button>

              {passRightsLeft > 0 && (
                <button
                  type="button"
                  onClick={handlePass}
                  disabled={animating || submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-panel border border-dashed border-border py-2.5 text-sm font-medium text-foreground-muted transition-all hover:text-foreground-strong disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <SkipForwardIcon className="h-4 w-4" />
                  Pas Geç ({passRightsLeft} hak kaldı)
                </button>
              )}
            </div>
          </div>
        )}

        {phase === 'result' && result && (
          <div>
            {/* Kullanıcı isteği (2026-08-30): "yarışmalardaki tablolarda standart yapay
                zeka tablo başlarındaki renkten kaçın" — önceki sürüm tam genişlikte
                yeşil/turuncu/kırmızı bir gradyan banner kullanıyordu (tipik AI-panosu
                görünümü). Artık FacilityDetailModal/EventCheckInModal'daki başarı
                ekranlarıyla aynı dil: açık zemin + tek bir soft-tone ikon dairesi. */}
            <div className="flex flex-col items-center px-8 pb-6 pt-9 text-center">
              <div className={`mb-3 flex h-16 w-16 items-center justify-center rounded-full ${
                resultTone === 'success' ? 'bg-success-soft' : resultTone === 'danger' ? 'bg-danger-soft' : 'bg-warning-soft'
              }`}>
                {resultTone === 'success' ? (
                  <TrophyIcon className="h-8 w-8 text-success" />
                ) : resultTone === 'danger' ? (
                  <XCircleIcon className="h-8 w-8 text-danger" />
                ) : (
                  <CheckCircleIcon className="h-8 w-8 text-warning" />
                )}
              </div>
              <p className="mb-1 type-caption">Toplam Puan</p>
              <p className="mb-1 text-5xl font-black text-foreground-strong">{result.score}</p>
              <p className="type-caption">%{result.successRate.toFixed(0)} başarı oranı</p>
              {/* Hata raporu (docs/hata.md #11): sonuç "geçti/geçemedi" olarak açıkça yazılır ve
                  bu karar sunucudan gelir; geçme şartı yoksa (passingScore = 0) hiç iddia edilmez. */}
              {showsPassVerdict(result) && (
                <p className={`mt-2 text-sm font-bold ${result.isPassed ? 'text-success' : 'text-danger'}`}>
                  {result.isPassed ? 'Başarılı — Geçtiniz' : 'Geçemediniz'}
                  <span className="ml-1 font-normal text-foreground-muted">
                    (geçme puanı: {result.passingScore})
                  </span>
                </p>
              )}
            </div>

            <div className={`grid divide-x divide-border border-y border-border ${result.passedCount > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {[
                { value: result.correctAnswers, label: 'Doğru', className: 'text-success' },
                { value: result.wrongAnswers, label: 'Yanlış', className: 'text-danger' },
                ...(result.passedCount > 0
                  ? [{ value: result.passedCount, label: 'Pas', className: 'text-foreground-muted' }]
                  : []),
                { value: `#${result.rank}`, label: 'Sıralama', className: 'text-foreground-strong' },
              ].map(({ value, label, className }) => (
                <div key={label} className="flex flex-col items-center gap-1 py-4">
                  <span className={`text-xl font-black ${className}`}>{value}</span>
                  <span className="type-caption">{label}</span>
                </div>
              ))}
            </div>

            <div className="space-y-4 p-6">
              <div className="flex items-center justify-center gap-2 type-caption">
                <UsersIcon className="h-3.5 w-3.5" />
                <span>{result.totalParticipants.toLocaleString('tr-TR')} katılımcı arasında</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={onClose}>Kapat</Button>
                <Button
                  variant="primary"
                  style={{ background: accent }}
                  onClick={() => { onGoLeaderboard(detail!.id); onClose() }}
                  iconLeft={<TrophyIcon className="h-4 w-4" />}
                >
                  Sıralama
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
