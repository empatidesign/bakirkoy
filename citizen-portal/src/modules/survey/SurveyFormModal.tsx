import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2Icon,
  ChevronLeftIcon, ChevronRightIcon, ClipboardListIcon, ClockIcon,
  CalendarDaysIcon, MapPinIcon, BuildingIcon, DoorOpenIcon, BusIcon, UserCheckIcon, StarIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Button, SkeletonRows } from '@/design-system'
import { QuestionWidget, isOtherOption, injectAnimStyles } from './questionWidget'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import type { CitizenSurveyDetail, SourceContext } from '@/types/survey.types'
import surveyService from '@/services/survey.service'

type Props = {
  surveyId: string | null
  isRequired?: boolean
  sourceContext?: SourceContext | null
  onClose: (submitted?: boolean) => void
}


const AUTO_ADVANCE_TYPES = new Set(['yes_no', 'like_dislike', 'satisfaction', 'agreement', 'multiple_choice', 'emoji_rating'])

const SOURCE_CONFIG: Record<string, {
  label: string
  preposition: string
  headerIcon: typeof CalendarDaysIcon
  gradientFrom: string
  accentClass: string
  badgeClass: string
  cardClass: string
}> = {
  Event: {
    label: 'Etkinlik',
    preposition: 'etkinliğine',
    headerIcon: CalendarDaysIcon,
    gradientFrom: 'from-primary/12 via-primary/6',
    accentClass: 'text-primary',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    cardClass: 'bg-primary/6 border-primary/15',
  },
  Travel: {
    label: 'Gezi',
    preposition: 'gezisine',
    headerIcon: BusIcon,
    gradientFrom: 'from-success/12 via-success/6',
    accentClass: 'text-success',
    badgeClass: 'bg-success/10 text-success border-success/20',
    cardClass: 'bg-success/6 border-success/15',
  },
}

export const SurveyFormModal = ({ surveyId, isRequired, sourceContext, onClose }: Props) => {
  const [survey, setSurvey] = useState<CitizenSurveyDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [intro, setIntro] = useState(true)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    injectAnimStyles()
  }, [])

  useEffect(() => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current)
      autoAdvanceTimer.current = null
    }
    if (!surveyId) {
      setSurvey(null)
      setAnswers({})
      setDone(false)
      setIntro(true)
      setStep(0)
      return
    }
    let active = true
    setLoading(true)
    setDone(false)
    setIntro(true)
    setStep(0)
    setDir(1)
    surveyService.detail(surveyId)
      .then((d) => { if (active) setSurvey(d) })
      .catch(() => { if (active) setSurvey(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => {
      active = false
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current)
        autoAdvanceTimer.current = null
      }
    }
  }, [surveyId])

  const effectiveRequired = isRequired ?? survey?.isRequired ?? true
  const effectiveContext = sourceContext !== undefined ? sourceContext : (survey?.sourceContext ?? null)

  const questions = survey ? [...survey.questions].sort((a, b) => a.order - b.order) : []
  const readonlyBlocked = !!survey && survey.alreadyResponded && !survey.allowMultipleResponses
  const total = questions.length
  const current = questions[step]
  const isLast = step === total - 1
  const isFirst = step === 0
  const progress = total > 0 ? ((step + 1) / total) * 100 : 0

  const goTo = (nextStep: number, direction: number) => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
    setDir(direction)
    setStep(nextStep)
  }

  const goNext = () => {
    if (!isLast) goTo(step + 1, 1)
    else handleSubmit()
  }

  const goBack = () => {
    if (!isFirst) goTo(step - 1, -1)
  }

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    const q = questions.find((q) => q.id === questionId)
    // "Diğer... (Belirtiniz)" seçildiğinde otomatik ilerleme yapılmaz — kullanıcının serbest
    // metin kutusuna yazması için beklenir (bkz. isOtherOption kullanımı QuestionWidget'ta).
    const isOtherPick = q?.type === 'multiple_choice' && q.options.some((o) => isOtherOption(o))
      && (value === q.options.find((o) => isOtherOption(o)) || value.startsWith(`${q.options.find((o) => isOtherOption(o))}:`))
    if (q && AUTO_ADVANCE_TYPES.has(q.type) && !isLast && !isOtherPick) {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
      autoAdvanceTimer.current = setTimeout(() => {
        setDir(1)
        setStep((s) => Math.min(s + 1, total - 1))
      }, 380)
    }
  }

  const handleSubmit = () => {
    if (!survey || !surveyId) return
    const missing = questions.filter((q) => q.required && !answers[q.id]?.trim())
    if (missing.length > 0) {
      const firstIdx = questions.findIndex((q) => q.required && !answers[q.id]?.trim())
      if (firstIdx !== -1) goTo(firstIdx, firstIdx > step ? 1 : -1)
      toast.error(`${missing.length} zorunlu soru yanıtlanmadı.`)
      return
    }
    const answerList = questions
      .filter((q) => answers[q.id]?.trim())
      .map((q) => ({ questionId: q.id, answer: answers[q.id].trim() }))
    setSubmitting(true)
    surveyService.submit(surveyId, answerList)
      .then(() => setDone(true))
      .catch((err: unknown) => {
        // Kullanıcı isteği (2026-09-20): günlük opsiyonel anket limiti/bekleme süresi dolduğunda
        // backend'in gerçek nedeni açıklayan mesajını göster (ör. "günlük en fazla 2 anket…"),
        // genel bir hata metniyle karıştırma. Bu anketler zaten opsiyonel olduğu için modal
        // kapatılır — kullanıcı zorla bekletilmez, uygun zamanda tekrar denenebilir.
        const typed = err as { response?: { data?: { message?: string; errorCode?: string } } }
        const errorCode = typed?.response?.data?.errorCode
        const message = typed?.response?.data?.message
        if (errorCode === 'SURVEY_DAILY_LIMIT_REACHED' || errorCode === 'SURVEY_COOLDOWN_ACTIVE') {
          toast.info(message ?? 'Şu anda bu anketi yanıtlayamazsınız, daha sonra tekrar deneyin.')
          onClose(false)
          return
        }
        toast.error(message ?? 'Anket gönderilemedi, tekrar deneyin.')
      })
      .finally(() => setSubmitting(false))
  }

  const isOpen = !!surveyId

  const introFooter = !done ? (
    <div className={cn(
      'flex items-center gap-2 border-t border-border px-5 py-3',
      effectiveRequired ? 'justify-center' : 'justify-between',
    )}>
      {!effectiveRequired && (
        <Button variant="ghost" size="sm" onClick={() => onClose(false)}>
          Daha Sonra
        </Button>
      )}
      <Button variant="primary" onClick={() => setIntro(false)} disabled={loading || !survey}>
        Başla
        <ChevronRightIcon className="h-4 w-4 ml-1" />
      </Button>
    </div>
  ) : undefined

  const questionFooter = !done ? (
    <div className={cn(
      'flex items-center gap-2 border-t border-border px-5 py-3',
      !effectiveRequired ? 'justify-between' : 'justify-end',
    )}>
      {!effectiveRequired && (
        <Button variant="ghost" size="sm" onClick={() => onClose(false)} disabled={submitting}>
          Daha Sonra
        </Button>
      )}
      <div className={cn('flex items-center gap-2', effectiveRequired && isFirst && isLast ? 'mx-auto' : '')}>
        {!isFirst && (
          <Button variant="outline" size="sm" onClick={goBack} disabled={submitting}>
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            Geri
          </Button>
        )}
        {!isLast ? (
          <Button variant="primary" size="sm" onClick={goNext} disabled={loading || !survey}>
            İleri
            <ChevronRightIcon className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={submitting} disabled={loading || !survey}
            className={cn(effectiveRequired && isFirst ? 'px-8' : '')}
          >
            Gönder
          </Button>
        )}
      </div>
    </div>
  ) : undefined

  return (
    <Modal
      open={isOpen}
      onClose={() => onClose(done)}
      title={undefined}
      width={560}
      footer={readonlyBlocked ? undefined : intro && !done && !loading && survey ? introFooter : !intro && !done ? questionFooter : undefined}
    >
      {done ? (
        <div className="relative flex flex-col items-center gap-5 overflow-hidden px-6 py-14 text-center">
          <div className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(circle at 50% 25%, rgba(16,185,129,0.14) 0%, transparent 60%)' }}
          />
          <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-emerald-500/10" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-teal-500/10" />
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full shadow-xl"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 12px 32px rgba(16,185,129,0.4)' }}>
              <CheckCircle2Icon className="h-12 w-12 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md">
              <StarIcon className="h-4 w-4 text-amber-400" fill="currentColor" />
            </div>
          </div>
          <div className="relative space-y-2">
            <p className="text-2xl font-black text-foreground-default">Teşekkürler! 🎉</p>
            <p className="text-sm text-foreground-muted leading-relaxed">
              Yanıtlarınız başarıyla alındı.<br />Görüşleriniz hizmetlerimizi şekillendiriyor.
            </p>
          </div>
          <Button variant="primary" onClick={() => onClose(true)} className="relative mt-2 px-8">
            Kapat
          </Button>
        </div>
      ) : loading || !survey ? (
        <div className="p-8">
          <SkeletonRows rows={5} />
        </div>
      ) : readonlyBlocked ? (
        <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2Icon className="h-8 w-8 text-emerald-500" />
          </div>
          <div className="space-y-1.5">
            <p className="text-lg font-bold text-foreground-default">Bu anketi zaten yanıtladınız</p>
            <p className="text-sm text-foreground-muted leading-relaxed">
              Bu ankete yalnızca bir kez yanıt verebilirsiniz. Katılımınız için teşekkür ederiz.
            </p>
          </div>
          <Button variant="primary" onClick={() => onClose(false)} className="mt-2 px-8">Kapat</Button>
        </div>
      ) : intro ? (
        <div className="flex flex-col">
          {(() => {
            const src = effectiveContext ? SOURCE_CONFIG[effectiveContext.type] : null
            const accentClass = src?.accentClass ?? 'text-primary'
            const HeaderIcon = src?.headerIcon ?? ClipboardListIcon
            const heroGradient = effectiveContext?.type === 'Travel'
              ? 'linear-gradient(150deg, #10b981 0%, #059669 55%, #047857 100%)'
              : effectiveContext?.type === 'Event'
                ? 'linear-gradient(150deg, #6366f1 0%, #4f46e5 55%, #4338ca 100%)'
                : 'linear-gradient(150deg, #14b8a6 0%, #0f766e 55%, #134e4a 100%)'
            return (
              <>
                <div className="relative overflow-hidden rounded-t-xl px-6 pt-9 pb-7" style={{ background: heroGradient }}>
                  <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10" />
                  <div className="pointer-events-none absolute -bottom-14 -left-8 h-36 w-36 rounded-full bg-white/8" />
                  <div className="pointer-events-none absolute top-6 right-20 h-16 w-16 rounded-full bg-white/10" />
                  <div className="relative flex flex-col items-center gap-3.5">
                    <div className="flex items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ring-1 ring-white/25 shadow-lg shadow-black/10"
                      style={{ height: '4.5rem', width: '4.5rem' }}>
                      <HeaderIcon className="h-9 w-9 text-white" />
                    </div>
                    <div className="space-y-2 text-center">
                      <p className="text-xl font-bold leading-tight text-white">{survey.title}</p>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {src && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                            {src.label} Anketi
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-4 space-y-4">
                  {effectiveContext && src && (
                    <div className={cn('rounded-xl border px-4 py-3.5 space-y-2.5', src.cardClass)}>
                      <p className={cn('text-xs font-semibold uppercase tracking-wide', src.accentClass)}>
                        Bu anket için
                      </p>
                      <p className={cn('text-[15px] font-bold leading-tight', src.accentClass)}>
                        {effectiveContext.name}
                      </p>
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex items-center gap-2 text-[12.5px] text-foreground-muted">
                          <CalendarDaysIcon className={cn('h-3.5 w-3.5 flex-shrink-0', src.accentClass)} />
                          <span>
                            {formatDate(effectiveContext.sourceStartDate)}
                            {effectiveContext.sourceStartDate !== effectiveContext.sourceEndDate && (
                              <> — {formatDate(effectiveContext.sourceEndDate)}</>
                            )}
                          </span>
                        </div>
                        {effectiveContext.facilityName && (
                          <div className="flex items-center gap-2 text-[12.5px] text-foreground-muted">
                            <BuildingIcon className={cn('h-3.5 w-3.5 flex-shrink-0', src.accentClass)} />
                            <span>{effectiveContext.facilityName}</span>
                          </div>
                        )}
                        {effectiveContext.hallName && (
                          <div className="flex items-center gap-2 text-[12.5px] text-foreground-muted">
                            <DoorOpenIcon className={cn('h-3.5 w-3.5 flex-shrink-0', src.accentClass)} />
                            <span>{effectiveContext.hallName}</span>
                          </div>
                        )}
                        {effectiveContext.destination && (
                          <div className="flex items-center gap-2 text-[12.5px] text-foreground-muted">
                            <MapPinIcon className={cn('h-3.5 w-3.5 flex-shrink-0', src.accentClass)} />
                            <span>{effectiveContext.destination}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-[12.5px] text-foreground-muted">
                          <UserCheckIcon className={cn('h-3.5 w-3.5 flex-shrink-0', src.accentClass)} />
                          <span>Yalnızca {src.label.toLowerCase()} katılımcılarına açıktır</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {survey.description && (
                    <p className="text-[13.5px] leading-relaxed text-foreground-muted text-center">
                      {survey.description}
                    </p>
                  )}

                  <div className="flex items-center justify-center gap-3">
                    <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3.5 py-1.5">
                      <ClipboardListIcon className={cn('h-3.5 w-3.5', accentClass)} />
                      <span className="text-xs font-medium text-foreground-default">{total} soru</span>
                    </div>
                    {survey.estimatedDuration != null && survey.estimatedDuration > 0 && (
                      <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3.5 py-1.5">
                        <ClockIcon className={cn('h-3.5 w-3.5', accentClass)} />
                        <span className="text-xs font-medium text-foreground-default">~{survey.estimatedDuration} dk</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="px-6 pt-10 pb-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums text-white"
                style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}>
                {step + 1} / {total}
              </span>
              <div className="flex gap-1 items-center">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={cn('h-1.5 rounded-full transition-all duration-300', i < step ? 'w-3' : i === step ? 'w-7' : 'bg-border w-3')}
                    style={i <= step ? { background: i === step ? '#0d9488' : 'rgba(13,148,136,0.4)' } : undefined}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-teal-600 tabular-nums">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #14b8a6, #0d9488)',
                  boxShadow: '0 0 8px rgba(20,184,166,0.5)',
                }}
              />
            </div>
          </div>

          <div className="overflow-hidden px-6 pb-7">
            <div
              key={`${step}-${dir}`}
              style={{ animation: `${dir >= 0 ? 'sq-from-right' : 'sq-from-left'} 0.22s ease-out both` }}
              className="space-y-7"
            >
              <div className="space-y-2 text-center pt-2">
                <p className="text-[18px] font-semibold leading-snug text-foreground-default">
                  {current.question}
                  {current.required && <span className="ml-1 text-danger text-sm">*</span>}
                </p>
                {current.description && (
                  <p className="text-sm text-foreground-muted">{current.description}</p>
                )}
              </div>

              <div className="w-full">
                <QuestionWidget
                  question={current}
                  answer={answers[current.id] ?? ''}
                  onChange={(val) => handleAnswer(current.id, val)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
