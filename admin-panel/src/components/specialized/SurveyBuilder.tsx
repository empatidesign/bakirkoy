import { useRef, useState } from 'react'
import {
  GripVerticalIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  StarIcon,
  SmileIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  HeartIcon,
  HandIcon,
  CircleDotIcon,
  CheckSquareIcon,
  ToggleLeftIcon,
  RulerIcon,
  TypeIcon,
  ListChecksIcon,
  CheckIcon,
  XIcon,
  FrownIcon,
  MehIcon,
  LaughIcon,
  AlignLeftIcon,
} from 'lucide-react'
import {
  Badge,
  Button,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  Input,
  NumberInput,
  Select,
  Textarea,
  ToggleRow,
} from '@/design-system'
import { cn } from '@/lib/utils'
import {
  SURVEY_QUESTION_TYPE_HINTS,
  SURVEY_QUESTION_TYPE_LABELS,
  SURVEY_QUESTION_TYPE_OPTIONS,
  SURVEY_QUESTION_TYPES_WITH_OPTIONS,
} from '@/types/survey.types'
import type {
  SurveyQuestionConfig,
  SurveyQuestionForm,
  SurveyQuestionType,
} from '@/types/survey.types'

const TYPE_ICON: Record<SurveyQuestionType, typeof StarIcon> = {
  rating: StarIcon,
  emoji_rating: SmileIcon,
  like_dislike: ThumbsUpIcon,
  satisfaction: HeartIcon,
  agreement: HandIcon,
  multiple_choice: CircleDotIcon,
  checkbox: CheckSquareIcon,
  yes_no: ToggleLeftIcon,
  scale: RulerIcon,
  text: TypeIcon,
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

const AnswerPreview = ({ question, compact = false }: { question: SurveyQuestionForm; compact?: boolean }) => {
  const itemClass = 'inline-flex items-center gap-1.5 rounded-field border border-border bg-white px-2 py-1 text-[11px] text-foreground-default'
  const iconClass = 'h-3.5 w-3.5 text-primary'

  if (question.type === 'rating') {
    return <div className="flex gap-1" aria-label={`${question.config.ratingCount ?? 5} yıldız`}>
      {Array.from({ length: question.config.ratingCount ?? 5 }, (_, i) => <StarIcon key={i} className="h-4 w-4 fill-warning/20 text-warning" />)}
    </div>
  }
  if (question.type === 'emoji_rating') {
    const icons = [FrownIcon, MehIcon, SmileIcon, LaughIcon]
    return <div className="flex gap-1.5">{icons.map((Icon, i) => <span key={i} className={itemClass}><Icon className={iconClass} /></span>)}</div>
  }
  if (question.type === 'like_dislike') {
    return <div className="flex gap-1.5">
      <span className={itemClass}><ThumbsUpIcon className={iconClass} /> Beğendim</span>
      <span className={itemClass}><ThumbsDownIcon className={iconClass} /> Beğenmedim</span>
    </div>
  }
  if (question.type === 'yes_no') {
    return <div className="flex gap-1.5">
      <span className={itemClass}><CheckIcon className={iconClass} /> Evet</span>
      <span className={itemClass}><XIcon className={iconClass} /> Hayır</span>
    </div>
  }
  if (question.type === 'satisfaction') {
    return <div className="flex flex-wrap gap-1.5">
      <span className={itemClass}><FrownIcon className={iconClass} /> Memnun değilim</span>
      <span className={itemClass}><MehIcon className={iconClass} /> Kararsızım</span>
      <span className={itemClass}><SmileIcon className={iconClass} /> Memnunum</span>
    </div>
  }
  if (question.type === 'agreement') {
    return <div className="flex flex-wrap gap-1.5">
      {['Katılmıyorum', 'Kararsızım', 'Katılıyorum'].map((label) => <span key={label} className={itemClass}><CircleDotIcon className={iconClass} /> {label}</span>)}
    </div>
  }
  if (question.type === 'scale') {
    const min = question.config.scaleMin ?? 1
    const max = question.config.scaleMax ?? 10
    const values = compact && max - min > 4 ? [min, min + 1, min + 2, '…', max] : Array.from({ length: max - min + 1 }, (_, i) => min + i)
    return <div className="flex flex-wrap gap-1">{values.map((value, i) => <span key={`${value}-${i}`} className="flex h-7 min-w-7 items-center justify-center rounded-field border border-border bg-white px-1 text-[11px]">{value}</span>)}</div>
  }
  if (question.type === 'text') {
    return <span className={`${itemClass} min-w-48 justify-start text-foreground-muted`}><AlignLeftIcon className={iconClass} /> Serbest yanıt alanı</span>
  }

  const options = question.options.filter((option) => option.trim())
  return <div className="flex flex-wrap gap-1.5">
    {options.map((option) => (
      <span key={option} className={itemClass}>
        {question.type === 'checkbox' ? <CheckSquareIcon className={iconClass} /> : <CircleDotIcon className={iconClass} />}
        {option}
      </span>
    ))}
  </div>
}

export const defaultSurveyQuestionConfig = (type: SurveyQuestionType): SurveyQuestionConfig => {
  if (type === 'scale') return { scaleMin: 1, scaleMax: 10, minLabel: '', maxLabel: '' }
  if (type === 'rating') return { ratingCount: 5 }
  return {}
}

export const emptySurveyQuestionForm = (type: SurveyQuestionType = 'rating'): SurveyQuestionForm => ({
  type,
  question: '',
  description: '',
  required: true,
  options: SURVEY_QUESTION_TYPES_WITH_OPTIONS.includes(type) ? ['', ''] : [],
  config: defaultSurveyQuestionConfig(type),
})

export const isSurveyQuestionValid = (q: SurveyQuestionForm): boolean => {
  if (!q.question.trim()) return false
  if (SURVEY_QUESTION_TYPES_WITH_OPTIONS.includes(q.type)) {
    return q.options.filter((o) => o.trim()).length >= 2
  }
  if (q.type === 'scale') {
    const min = q.config.scaleMin ?? 1
    const max = q.config.scaleMax ?? 10
    return max > min
  }
  return true
}

const previewLine = (q: SurveyQuestionForm): string => {
  if (q.type === 'scale') return `Ölçek ${q.config.scaleMin ?? 1}–${q.config.scaleMax ?? 10}`
  if (q.type === 'rating') return `${q.config.ratingCount ?? 5} yıldız`
  if (SURVEY_QUESTION_TYPES_WITH_OPTIONS.includes(q.type)) return ''
  return SURVEY_QUESTION_TYPE_HINTS[q.type]
}

interface SurveyBuilderProps {
  value: SurveyQuestionForm[]
  onChange: (next: SurveyQuestionForm[]) => void
  disabled?: boolean
}

export const SurveyBuilder = ({ value, onChange, disabled }: SurveyBuilderProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<SurveyQuestionForm>(emptySurveyQuestionForm())
  const dragIndex = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const openAdd = () => {
    setEditingIndex(null)
    setDraft(emptySurveyQuestionForm())
    setDrawerOpen(true)
  }

  const openEdit = (index: number) => {
    setEditingIndex(index)
    setDraft({ ...value[index], options: [...value[index].options], config: { ...value[index].config } })
    setDrawerOpen(true)
  }

  const removeQuestion = (index: number) => onChange(value.filter((_, i) => i !== index))

  const saveDraft = () => {
    if (!isSurveyQuestionValid(draft)) return
    if (editingIndex === null) onChange([...value, draft])
    else onChange(value.map((q, i) => (i === editingIndex ? draft : q)))
    setDrawerOpen(false)
  }

  const reorder = (from: number, to: number) => {
    if (from === to) return
    const next = [...value]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  const patchDraft = (p: Partial<SurveyQuestionForm>) => setDraft((d) => ({ ...d, ...p }))

  const changeType = (type: SurveyQuestionType) =>
    setDraft((d) => ({
      ...d,
      type,
      options: SURVEY_QUESTION_TYPES_WITH_OPTIONS.includes(type)
        ? d.options.length >= 2
          ? d.options
          : ['', '']
        : [],
      config: defaultSurveyQuestionConfig(type),
    }))

  const setOption = (index: number, val: string) =>
    setDraft((d) => ({ ...d, options: d.options.map((o, i) => (i === index ? val : o)) }))
  const addOption = () => setDraft((d) => ({ ...d, options: [...d.options, ''] }))
  const removeOption = (index: number) =>
    setDraft((d) => ({ ...d, options: d.options.filter((_, i) => i !== index) }))
  const patchConfig = (p: Partial<SurveyQuestionConfig>) =>
    setDraft((d) => ({ ...d, config: { ...d.config, ...p } }))

  const hasOptions = SURVEY_QUESTION_TYPES_WITH_OPTIONS.includes(draft.type)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="type-section">Sorular ({value.length})</p>
        <Button variant="primary" size="sm" onClick={openAdd} disabled={disabled} iconLeft={<PlusIcon className="h-4 w-4" />}>
          Soru Ekle
        </Button>
      </div>

      {value.length === 0 ? (
        <EmptyState
          icon={ListChecksIcon}
          title="Henüz soru eklenmedi"
          description="Ankete soru eklemek için “Soru Ekle” düğmesine basın. Soruları sürükleyerek sıralayabilirsiniz."
          action={
            <Button variant="primary" size="sm" onClick={openAdd} disabled={disabled} iconLeft={<PlusIcon className="h-4 w-4" />}>
              Soru Ekle
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {value.map((q, index) => {
            const Icon = TYPE_ICON[q.type]
            const preview = previewLine(q)
            return (
              <div
                key={index}
                draggable={!disabled}
                onDragStart={() => { dragIndex.current = index }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(index) }}
                onDragLeave={() => setDragOver((o) => (o === index ? null : o))}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIndex.current !== null) reorder(dragIndex.current, index)
                  dragIndex.current = null
                  setDragOver(null)
                }}
                onDragEnd={() => { dragIndex.current = null; setDragOver(null) }}
                className={cn(
                  'rounded-card border bg-[hsl(var(--surface-1))] p-3 transition-colors',
                  dragOver === index ? 'border-[hsl(var(--primary))]' : 'border-[hsl(var(--border))]',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className={cn('mt-0.5 shrink-0 text-[hsl(var(--foreground-subtle))]', disabled ? '' : 'cursor-grab')}>
                      <GripVerticalIcon className="h-4 w-4" />
                    </span>
                    <Badge tone="primary">{index + 1}</Badge>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 type-body-strong">
                          <Icon className="h-4 w-4 text-[hsl(var(--primary))]" />
                          {q.question || '—'}
                        </span>
                        {q.required && <span className="text-[hsl(var(--danger))]">*</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{SURVEY_QUESTION_TYPE_LABELS[q.type]}</Badge>
                        {preview && <span className="type-caption">{preview}</span>}
                      </div>
                      <div className="mt-2">
                        <AnswerPreview question={q} compact />
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton tone="primary" title="Düzenle" disabled={disabled} onClick={() => openEdit(index)}>
                      <PencilIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton tone="danger" title="Sil" disabled={disabled} onClick={() => removeQuestion(index)}>
                      <Trash2Icon className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingIndex === null ? 'Soru Ekle' : 'Soru Düzenle'}
        icon={ListChecksIcon}
        width={560}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>İptal</Button>
            <Button variant="primary" onClick={saveDraft} disabled={!isSurveyQuestionValid(draft)}>
              {editingIndex === null ? 'Ekle' : 'Güncelle'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Soru Tipi" hint={SURVEY_QUESTION_TYPE_HINTS[draft.type]}>
            <Select className="bg-white" value={draft.type} onChange={(e) => changeType(e.target.value as SurveyQuestionType)}>
              {SURVEY_QUESTION_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>

          <div className="rounded-card border border-border bg-surface-1 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Cevap görünümü</p>
            <AnswerPreview question={draft} />
          </div>

          <Field label="Soru Metni" required>
            <Textarea
              value={draft.question}
              onChange={(e) => patchDraft({ question: e.target.value })}
              rows={2}
              className="bg-white"
              placeholder="Sorunuzu yazın..."
            />
          </Field>

          <Field label="Açıklama" hint="İsteğe bağlı — soruyu açıklayan kısa metin">
            <Input
              value={draft.description}
              onChange={(e) => patchDraft({ description: e.target.value })}
              className="bg-white"
              placeholder="Açıklama (opsiyonel)"
            />
          </Field>

          {hasOptions && (
            <Field label="Seçenekler" required hint="En az iki seçenek girin">
              <div className="space-y-2">
                {draft.options.map((opt, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="flex h-[var(--control-h)] w-9 shrink-0 items-center justify-center rounded-field border border-[hsl(var(--border))] bg-white text-sm font-medium text-[hsl(var(--foreground-muted))]">
                      {OPTION_LABELS[index] ?? index + 1}
                    </span>
                    <Input
                      value={opt}
                      onChange={(e) => setOption(index, e.target.value)}
                      className="bg-white"
                      placeholder={`${index + 1}. seçenek`}
                    />
                    <IconButton
                      tone="danger"
                      title="Seçeneği sil"
                      disabled={draft.options.length <= 2}
                      onClick={() => removeOption(index)}
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </IconButton>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addOption} iconLeft={<PlusIcon className="h-4 w-4" />}>
                  Seçenek Ekle
                </Button>
              </div>
            </Field>
          )}

          {draft.type === 'scale' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="En Düşük Değer" required>
                <NumberInput className="bg-white" value={draft.config.scaleMin ?? 1} onChange={(n) => patchConfig({ scaleMin: n })} min={0} max={(draft.config.scaleMax ?? 10) - 1} />
              </Field>
              <Field label="En Yüksek Değer" required>
                <NumberInput className="bg-white" value={draft.config.scaleMax ?? 10} onChange={(n) => patchConfig({ scaleMax: n })} min={(draft.config.scaleMin ?? 1) + 1} max={10} />
              </Field>
              <Field label="Alt Uç Etiketi" hint="Örn. Hiç memnun değilim">
                <Input className="bg-white" value={draft.config.minLabel ?? ''} onChange={(e) => patchConfig({ minLabel: e.target.value })} placeholder="Opsiyonel" />
              </Field>
              <Field label="Üst Uç Etiketi" hint="Örn. Çok memnunum">
                <Input className="bg-white" value={draft.config.maxLabel ?? ''} onChange={(e) => patchConfig({ maxLabel: e.target.value })} placeholder="Opsiyonel" />
              </Field>
            </div>
          )}

          {draft.type === 'rating' && (
            <Field label="Yıldız Sayısı" hint="3 ile 10 arası">
              <NumberInput className="bg-white" value={draft.config.ratingCount ?? 5} onChange={(n) => patchConfig({ ratingCount: n })} min={3} max={10} suffix="yıldız" />
            </Field>
          )}

          <ToggleRow
            label="Zorunlu Soru"
            description="Katılımcı bu soruyu yanıtlamadan ilerleyemez"
            checked={draft.required}
            onChange={(v) => patchDraft({ required: v })}
          />
        </div>
      </Drawer>
    </div>
  )
}
