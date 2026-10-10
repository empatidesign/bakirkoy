import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { HelpCircleIcon, PlusIcon, PencilIcon, Trash2Icon, CheckCircle2Icon, CheckIcon, UsersIcon } from 'lucide-react'
import { Modal, Drawer, Button, Badge, IconButton, EmptyState, ConfirmModal, SkeletonRows, AdminFormShell, Progress } from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import { cn } from '@/lib/utils'
import quizService from '@/services/quiz.service'
import quizCategoryService from '@/services/quizCategory.service'
import quizAgeGroupService from '@/services/quizAgeGroup.service'
import { QUIZ_DIFFICULTY_LABELS, QUIZ_DIFFICULTY_TONE } from '@/types/quiz.types'
import type { Quiz, QuizQuestionForm as QuizQuestionFormData, QuizQuestionStat } from '@/types/quiz.types'
import type { SelectOption } from '@/types/common'
import { QuizQuestionForm } from './QuizQuestionForm'
import { emptyQuestionForm, questionToForm } from './quizConstants'

interface Props {
  quiz: Quiz
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const isQuestionValid = (q: QuizQuestionFormData) =>
  !!q.question.trim() && !!q.categoryId && q.options.length >= 2 && q.options.every((o) => o.trim()) && q.correctAnswer < q.options.length

export const QuizQuestionsModal = ({ quiz, open, onClose, onSaved }: Props) => {
  const { can } = useAuth()
  const canEditQuestions = can('quiz.edit')
  const [questions, setQuestions] = useState<QuizQuestionFormData[]>([])
  const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>([])
  const [ageGroupOptions, setAgeGroupOptions] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState<Record<number, QuizQuestionStat>>({})
  const [totalParticipants, setTotalParticipants] = useState(0)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<QuizQuestionFormData>(emptyQuestionForm())

  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    quizService
      .getQuestions(quiz.id)
      .then((list) => setQuestions(list.map(questionToForm)))
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false))
    quizCategoryService.getOptions().then((o) => setCategoryOptions(o ?? [])).catch(() => setCategoryOptions([]))
    quizAgeGroupService.getOptions().then((o) => setAgeGroupOptions(o ?? [])).catch(() => setAgeGroupOptions([]))
    quizService
      .getQuestionStats(quiz.id)
      .then((s) => {
        setTotalParticipants(s.totalParticipants)
        setStats(Object.fromEntries(s.questions.map((q) => [q.order, q])))
      })
      .catch(() => { setStats({}); setTotalParticipants(0) })
  }, [open, quiz.id])

  const categoryLabel = (id: string) => categoryOptions.find((o) => o.value === id)?.label ?? '—'

  const openAdd = () => {
    setEditingIndex(null)
    setDraft(emptyQuestionForm(quiz.categoryId))
    setDrawerOpen(true)
  }

  const openEdit = (index: number) => {
    setEditingIndex(index)
    setDraft({ ...questions[index], options: [...questions[index].options] })
    setDrawerOpen(true)
  }

  const saveDraft = () => {
    if (!isQuestionValid(draft)) {
      toast.warning('Lütfen soru metnini, kategoriyi ve tüm seçenekleri doldurun.')
      return
    }
    setQuestions((prev) => {
      if (editingIndex === null) return [...prev, draft]
      const next = [...prev]
      next[editingIndex] = draft
      return next
    })
    setDrawerOpen(false)
  }

  const confirmDelete = () => {
    if (deleteIndex === null) return
    setQuestions((prev) => prev.filter((_, i) => i !== deleteIndex))
    setDeleteIndex(null)
  }

  const saveAll = async () => {
    if (saving) return
    if (questions.length === 0) {
      toast.warning('En az bir soru eklemelisiniz.')
      return
    }
    setSaving(true)
    try {
      await quizService.saveQuestions(quiz.id, questions)
      toast.success('Sorular kaydedildi.')
      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Sorular kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Soru Yönetimi"
        subtitle={quiz.title}
        width={880}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="type-muted">{questions.length} soru</span>
            <Button
              variant="primary"
              onClick={saveAll}
              isLoading={saving}
              disabled={!canEditQuestions}
              title={canEditQuestions ? undefined : 'Soru düzenleme yetkiniz yok'}
              iconLeft={<CheckCircle2Icon className="h-4 w-4" />}
            >
              Kaydet
            </Button>
          </div>
        }
      >
        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="type-section">Sorular</p>
            <div className="flex items-center gap-3">
              {totalParticipants > 0 && (
                <span className="flex items-center gap-1 type-caption">
                  <UsersIcon className="h-3.5 w-3.5" /> {totalParticipants} katılımcı
                </span>
              )}
              <Button variant="primary" size="sm" onClick={openAdd} iconLeft={<PlusIcon className="h-4 w-4" />}>
                Soru Ekle
              </Button>
            </div>
          </div>

          {loading ? (
            <SkeletonRows rows={4} />
          ) : questions.length === 0 ? (
            <EmptyState
              icon={HelpCircleIcon}
              title="Henüz soru eklenmedi"
              description="Bu yarışmaya soru eklemek için “Soru Ekle” düğmesine basın."
              action={<Button variant="primary" size="sm" onClick={openAdd} iconLeft={<PlusIcon className="h-4 w-4" />}>Soru Ekle</Button>}
            />
          ) : (
            <div className="space-y-3">
              {questions.map((q, index) => {
                const stat = stats[index]
                const totalAnswered = stat?.totalAnswered ?? 0
                return (
                  <div key={index} className="rounded-card border border-border bg-surface-0 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <Badge tone="primary">{index + 1}</Badge>
                        <div className="min-w-0 flex-1">
                          <p className="type-body-strong">{q.question || '—'}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge tone="neutral">{categoryLabel(q.categoryId)}</Badge>
                            <Badge tone={QUIZ_DIFFICULTY_TONE[q.difficulty]}>{QUIZ_DIFFICULTY_LABELS[q.difficulty]}</Badge>
                            <span className="type-caption tabular-nums">{q.points} puan · {q.timeLimit} sn</span>
                            {stat && stat.totalAnswered > 0 && (
                              <>
                                <Badge tone="success">{stat.correctCount} doğru</Badge>
                                <Badge tone="danger">{stat.wrongCount} yanlış</Badge>
                                {stat.skippedCount > 0 && <Badge tone="neutral">{stat.skippedCount} boş</Badge>}
                              </>
                            )}
                          </div>

                          <div className="mt-4 space-y-2">
                            {q.options.map((opt, optIndex) => {
                              const isCorrect = optIndex === q.correctAnswer
                              const optStat = stat?.optionBreakdown[optIndex]
                              const count = optStat?.count ?? 0
                              const pct = totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0
                              return (
                                <div
                                  key={optIndex}
                                  className={cn(
                                    'rounded-field border px-3 py-2',
                                    isCorrect
                                      ? 'border-[hsl(var(--success))] bg-[hsl(var(--success-soft))]'
                                      : 'border-border bg-surface-1',
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={cn('flex min-w-0 items-center gap-1.5 type-caption', isCorrect && 'font-semibold text-[hsl(var(--success))]')}>
                                      {isCorrect && <CheckIcon className="h-3.5 w-3.5 shrink-0" />}
                                      <span className="truncate">{opt || '—'}</span>
                                    </span>
                                    {totalAnswered > 0 && (
                                      <span className="shrink-0 type-caption tabular-nums">{count} · %{pct}</span>
                                    )}
                                  </div>
                                  {totalAnswered > 0 && (
                                    <Progress value={pct} tone={isCorrect ? 'success' : 'primary'} className="mt-1.5 h-1" />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <IconButton tone="primary" title="Düzenle" onClick={() => openEdit(index)}>
                          <PencilIcon className="h-4 w-4" />
                        </IconButton>
                        <IconButton tone="danger" title="Sil" onClick={() => setDeleteIndex(index)}>
                          <Trash2Icon className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingIndex === null ? 'Soru Ekle' : 'Soru Düzenle'}
        icon={HelpCircleIcon}
        width={560}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>İptal</Button>
            <Button variant="primary" onClick={saveDraft} disabled={!isQuestionValid(draft)}>
              {editingIndex === null ? 'Ekle' : 'Güncelle'}
            </Button>
          </div>
        }
      >
        <AdminFormShell
          icon={HelpCircleIcon}
          title={editingIndex === null ? 'Soru Ekle' : 'Soru Düzenle'}
          subtitle="Soru metni, seçenekler, kategori, zorluk ve süre bilgilerini yönetin"
          badge="Soru"
          tone="violet"
        >
          <QuizQuestionForm form={draft} setForm={setDraft} categoryOptions={categoryOptions} ageGroupOptions={ageGroupOptions} />
        </AdminFormShell>
      </Drawer>

      <ConfirmModal
        open={deleteIndex !== null}
        onClose={() => setDeleteIndex(null)}
        onConfirm={confirmDelete}
        title="Soruyu Sil"
        description="Bu soruyu listeden çıkarmak istediğinizden emin misiniz? Değişiklik “Kaydet” ile kalıcı olur."
        confirmLabel="Sil"
        tone="danger"
      />
    </>
  )
}
