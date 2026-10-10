import { useEffect, useState } from 'react'
import {
  CalendarIcon, ClockIcon, UsersIcon, ListChecksIcon,
  SmartphoneIcon, PencilIcon, CheckCircle2Icon, ShieldCheckIcon,
  ChevronDownIcon, ChevronUpIcon,
} from 'lucide-react'
import { Modal, Badge, Button } from '@/design-system'
import quizService from '@/services/quiz.service'
import type { Quiz, QuizQuestion } from '@/types/quiz.types'
import { QUIZ_STATUS_LABELS, QUIZ_STATUS_TONE, QUIZ_DIFFICULTY_LABELS, QUIZ_DIFFICULTY_TONE } from '@/types/quiz.types'
import { formatDate } from '@/lib/utils'
import { FULL_RESIDENCY_MODE_OPTIONS } from '@/lib/residency'

interface Props {
  quiz: Quiz | null
  open: boolean
  onClose: () => void
  onOpenMobilePreview?: (quiz: Quiz) => void
  onOpenQuestions?: (quiz: Quiz) => void
  onOpenParticipants?: (quiz: Quiz) => void
  onEdit?: (quiz: Quiz) => void
  canEdit?: boolean
}

export const QuizDetailModal = ({
  quiz,
  open,
  onClose,
  onOpenMobilePreview,
  onOpenQuestions,
  onOpenParticipants,
  onEdit,
  canEdit = true,
}: Props) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !quiz) {
      setQuestions([])
      setExpandedQuestion(null)
      return
    }

    setLoadingQuestions(true)
    quizService
      .getQuestions(quiz.id)
      .then((data) => setQuestions(data || []))
      .catch(() => setQuestions([]))
      .finally(() => setLoadingQuestions(false))
  }, [open, quiz?.id])

  if (!quiz) return null

  const residencyLabel =
    FULL_RESIDENCY_MODE_OPTIONS.find((o) => o.value === quiz.residencyMode)?.label ?? 'Kısıtlama Yok'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={quiz.title}
      subtitle="Yarışma Detayları & Sorular"
      width={920}
      className="max-w-[96vw]"
    >
      <div className="space-y-6 py-1">
        {/* Top Quick Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-1 p-3.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={QUIZ_STATUS_TONE[quiz.status]}>
              {QUIZ_STATUS_LABELS[quiz.status]}
            </Badge>
            <Badge tone={quiz.isActive ? 'success' : 'neutral'}>
              {quiz.isActive ? 'Aktif' : 'Pasif'}
            </Badge>
            {quiz.categoryName && (
              <Badge color={quiz.categoryColor}>
                {quiz.categoryName}
              </Badge>
            )}
            {quiz.ageGroupName && (
              <Badge tone="info">{quiz.ageGroupName}</Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenMobilePreview && (
              <Button
                variant="primary"
                size="sm"
                iconLeft={<SmartphoneIcon className="h-4 w-4" />}
                onClick={() => {
                  onClose()
                  onOpenMobilePreview(quiz)
                }}
              >
                Mobil Görünüm
              </Button>
            )}
            {onOpenQuestions && (
              <Button
                variant="outline"
                size="sm"
                iconLeft={<ListChecksIcon className="h-4 w-4" />}
                onClick={() => {
                  onClose()
                  onOpenQuestions(quiz)
                }}
              >
                Soruları Yönet
              </Button>
            )}
            {onOpenParticipants && (
              <Button
                variant="outline"
                size="sm"
                iconLeft={<UsersIcon className="h-4 w-4" />}
                onClick={() => {
                  onClose()
                  onOpenParticipants(quiz)
                }}
              >
                Katılımcılar ({quiz.participantCount})
              </Button>
            )}
            {canEdit && onEdit && (
              <Button
                variant="outline"
                size="sm"
                iconLeft={<PencilIcon className="h-4 w-4" />}
                onClick={() => {
                  onClose()
                  onEdit(quiz)
                }}
              >
                Düzenle
              </Button>
            )}
          </div>
        </div>

        {/* Description */}
        {quiz.description && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
              Açıklama
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-foreground-default whitespace-pre-line">
              {quiz.description}
            </p>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-2 text-foreground-muted">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Tarih Aralığı</span>
            </div>
            <p className="mt-1.5 text-xs font-semibold text-foreground-strong">
              {formatDate(quiz.startDate)} – {formatDate(quiz.endDate)}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-2 text-foreground-muted">
              <ClockIcon className="h-4 w-4 text-warning" />
              <span className="text-xs font-medium">Süre Limitleri</span>
            </div>
            <p className="mt-1.5 text-xs font-semibold text-foreground-strong">
              Soru: <span className="text-primary">{quiz.perQuestionTimeLimit} sn</span> • Toplam: <span className="text-primary">{quiz.durationMinutes} dk</span>
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-2 text-foreground-muted">
              <ListChecksIcon className="h-4 w-4 text-info" />
              <span className="text-xs font-medium">Soru & Katılım</span>
            </div>
            <p className="mt-1.5 text-xs font-semibold text-foreground-strong">
              {questions.length || quiz.questionCount} Soru • {quiz.participantCount} Katılımcı
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-2 text-foreground-muted">
              <ShieldCheckIcon className="h-4 w-4 text-success" />
              <span className="text-xs font-medium">İkamet Kriteri</span>
            </div>
            <p className="mt-1.5 text-xs font-semibold text-foreground-strong truncate" title={residencyLabel}>
              {residencyLabel}
            </p>
          </div>
        </div>

        {/* Question List Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground-strong">
                Yarışma Soruları ({questions.length})
              </h3>
            </div>
            {onOpenQuestions && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenQuestions(quiz)
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Tüm Soruları Yönet →
              </button>
            )}
          </div>

          {loadingQuestions ? (
            <div className="space-y-2 py-4">
              <div className="h-12 w-full animate-pulse rounded-lg bg-surface-2" />
              <div className="h-12 w-full animate-pulse rounded-lg bg-surface-2" />
              <div className="h-12 w-full animate-pulse rounded-lg bg-surface-2" />
            </div>
          ) : questions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-xs text-foreground-muted">Bu yarışmaya henüz soru eklenmemiş.</p>
              {onOpenQuestions && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    onClose()
                    onOpenQuestions(quiz)
                  }}
                >
                  Soru Ekle
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const isExpanded = expandedQuestion === q.id || expandedQuestion === null
                const letters = ['A', 'B', 'C', 'D', 'E', 'F']

                return (
                  <div
                    key={q.id || idx}
                    className="overflow-hidden rounded-xl border border-border bg-card transition-all"
                  >
                    <div
                      className="flex cursor-pointer items-center justify-between gap-3 p-3 hover:bg-surface-1"
                      onClick={() => setExpandedQuestion(expandedQuestion === q.id ? '' : q.id)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                          {idx + 1}
                        </span>
                        <p className="text-xs font-semibold text-foreground-strong truncate">
                          {q.question}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {q.difficulty && (
                          <Badge tone={QUIZ_DIFFICULTY_TONE[q.difficulty]}>
                            {QUIZ_DIFFICULTY_LABELS[q.difficulty]}
                          </Badge>
                        )}
                        <Badge tone="neutral">+{q.points || 10} Puan</Badge>
                        {isExpanded ? (
                          <ChevronUpIcon className="h-4 w-4 text-foreground-muted" />
                        ) : (
                          <ChevronDownIcon className="h-4 w-4 text-foreground-muted" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border bg-surface-1/50 p-3 pt-2.5">
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {q.options.map((opt, optIdx) => {
                            const isCorrect = optIdx === q.correctAnswer
                            return (
                              <div
                                key={optIdx}
                                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors ${
                                  isCorrect
                                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                                    : 'border-border bg-surface-1 text-foreground-default'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold ${
                                      isCorrect
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-surface-3 text-foreground-muted'
                                    }`}
                                  >
                                    {letters[optIdx] ?? optIdx + 1}
                                  </span>
                                  <span className="truncate">{opt}</span>
                                </div>
                                {isCorrect && (
                                  <span className="ml-2 flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
                                    <CheckCircle2Icon className="h-3 w-3" /> Doğru Cevap
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
