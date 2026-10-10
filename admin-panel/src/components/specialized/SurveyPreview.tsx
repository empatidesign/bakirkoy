import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, SendIcon, CheckCircle2Icon, StarIcon, ClipboardListIcon } from 'lucide-react'
import { Badge, Button, Progress, Textarea } from '@/design-system'
import { cn } from '@/lib/utils'
import type { SurveyQuestionForm } from '@/types/survey.types'

const EMOJI_RATING = ['😭', '😞', '😐', '😊', '😍']
const SATISFACTION = [
  { emoji: '😡', label: 'Çok memnun değilim' },
  { emoji: '😞', label: 'Memnun değilim' },
  { emoji: '😐', label: 'Orta' },
  { emoji: '😊', label: 'Memnunum' },
  { emoji: '😍', label: 'Çok memnunum' },
]
const AGREEMENT = [
  { emoji: '✋', label: 'Kesinlikle katılmıyorum' },
  { emoji: '👎', label: 'Katılmıyorum' },
  { emoji: '🤷', label: 'Kararsızım' },
  { emoji: '👍', label: 'Katılıyorum' },
  { emoji: '💯', label: 'Kesinlikle katılıyorum' },
]

const optionBtn = (active: boolean) =>
  cn(
    'w-full rounded-field border px-3 py-2.5 text-left type-body transition-colors',
    active
      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary))]'
      : 'border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--foreground-default))] hover:border-[hsl(var(--primary)/0.4)]',
  )

const pillBtn = (active: boolean) =>
  cn(
    'flex flex-1 flex-col items-center gap-1 rounded-field border px-2 py-2 transition-colors',
    active
      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary-soft))]'
      : 'border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] hover:border-[hsl(var(--primary)/0.4)]',
  )

const isAnswered = (q: SurveyQuestionForm, val: unknown): boolean => {
  if (q.type === 'checkbox') return Array.isArray(val) && val.length > 0
  if (q.type === 'text') return typeof val === 'string' && val.trim().length > 0
  return val !== undefined && val !== null && val !== ''
}

interface SurveyPreviewProps {
  title: string
  category?: string
  estimatedDuration?: number
  questions: SurveyQuestionForm[]
}

export const SurveyPreview = ({ title, category, estimatedDuration, questions }: SurveyPreviewProps) => {
  const [index, setIndex] = useState(0)
  const [responses, setResponses] = useState<Record<number, unknown>>({})
  const [completed, setCompleted] = useState(false)

  const total = questions.length
  const q = questions[index]
  const value = responses[index]
  const setValue = (v: unknown) => setResponses((r) => ({ ...r, [index]: v }))
  const progress = total > 0 ? ((index + 1) / total) * 100 : 0
  const blocked = !!q?.required && !isAnswered(q, value)

  const next = () => {
    if (index < total - 1) setIndex((i) => i + 1)
    else setCompleted(true)
  }

  const renderQuestion = () => {
    if (!q) return null
    switch (q.type) {
      case 'rating': {
        const count = q.config.ratingCount ?? 5
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onClick={() => setValue(n)} className={pillBtn(typeof value === 'number' && value >= n)}>
                <StarIcon className={cn('h-6 w-6', typeof value === 'number' && value >= n ? 'fill-[hsl(var(--warning))] text-[hsl(var(--warning))]' : 'text-[hsl(var(--foreground-subtle))]')} />
              </button>
            ))}
          </div>
        )
      }
      case 'emoji_rating':
        return (
          <div className="flex items-stretch gap-1.5">
            {EMOJI_RATING.map((e, i) => (
              <button key={i} type="button" onClick={() => setValue(i + 1)} className={pillBtn(value === i + 1)}>
                <span className="text-2xl">{e}</span>
              </button>
            ))}
          </div>
        )
      case 'satisfaction':
        return (
          <div className="space-y-1.5">
            {SATISFACTION.map((s, i) => (
              <button key={i} type="button" onClick={() => setValue(i + 1)} className={cn(optionBtn(value === i + 1), 'flex items-center gap-2')}>
                <span className="text-xl">{s.emoji}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )
      case 'agreement':
        return (
          <div className="space-y-1.5">
            {AGREEMENT.map((s, i) => (
              <button key={i} type="button" onClick={() => setValue(i + 1)} className={cn(optionBtn(value === i + 1), 'flex items-center gap-2')}>
                <span className="text-xl">{s.emoji}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )
      case 'like_dislike':
        return (
          <div className="flex items-stretch gap-2">
            <button type="button" onClick={() => setValue('like')} className={pillBtn(value === 'like')}>
              <span className="text-2xl">👍</span>
              <span className="type-caption">Beğendim</span>
            </button>
            <button type="button" onClick={() => setValue('dislike')} className={pillBtn(value === 'dislike')}>
              <span className="text-2xl">👎</span>
              <span className="type-caption">Beğenmedim</span>
            </button>
          </div>
        )
      case 'yes_no':
        return (
          <div className="flex items-stretch gap-2">
            {['Evet', 'Hayır'].map((opt) => (
              <button key={opt} type="button" onClick={() => setValue(opt)} className={cn(pillBtn(value === opt), 'py-3')}>
                <span className="type-body-strong">{opt}</span>
              </button>
            ))}
          </div>
        )
      case 'multiple_choice': {
        const otherOpt = q.options.find((o) => o.trim().toLowerCase().startsWith('diğer'))
        const isOther = typeof value === 'string' && !!otherOpt && (value === otherOpt || value.startsWith(`${otherOpt}:`))
        return (
          <div className="space-y-1.5">
            {q.options.filter((o) => o.trim()).map((opt, i) => (
              <button key={i} type="button" onClick={() => setValue(opt)} className={optionBtn(typeof value === 'string' && (opt === otherOpt ? isOther : value === opt))}>
                {opt}
              </button>
            ))}
            {isOther && (
              <Textarea
                value={typeof value === 'string' ? value.split(':').slice(1).join(':').trim() : ''}
                onChange={(e) => setValue(`${otherOpt}: ${e.target.value}`)}
                rows={2}
                placeholder="Lütfen belirtiniz..."
              />
            )}
          </div>
        )
      }
      case 'checkbox': {
        const arr = Array.isArray(value) ? (value as string[]) : []
        const toggle = (opt: string) => setValue(arr.includes(opt) ? arr.filter((o) => o !== opt) : [...arr, opt])
        return (
          <div className="space-y-1.5">
            {q.options.filter((o) => o.trim()).map((opt, i) => (
              <button key={i} type="button" onClick={() => toggle(opt)} className={cn(optionBtn(arr.includes(opt)), 'flex items-center gap-2')}>
                <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border', arr.includes(opt) ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : 'border-[hsl(var(--border))]')}>
                  {arr.includes(opt) && <CheckCircle2Icon className="h-3 w-3" />}
                </span>
                <span>{opt}</span>
              </button>
            ))}
          </div>
        )
      }
      case 'scale': {
        const min = q.config.scaleMin ?? 1
        const max = q.config.scaleMax ?? 10
        const nums = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i)
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {nums.map((n) => (
                <button key={n} type="button" onClick={() => setValue(n)} className={cn('h-9 w-9 rounded-field border text-sm tabular-nums transition-colors', value === n ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--foreground-default))]')}>
                  {n}
                </button>
              ))}
            </div>
            {(q.config.minLabel || q.config.maxLabel) && (
              <div className="flex items-center justify-between type-caption">
                <span>{q.config.minLabel}</span>
                <span>{q.config.maxLabel}</span>
              </div>
            )}
          </div>
        )
      }
      case 'text':
        return (
          <Textarea value={typeof value === 'string' ? value : ''} onChange={(e) => setValue(e.target.value)} rows={4} placeholder="Yanıtınızı yazın..." />
        )
      default:
        return null
    }
  }

  return (
    <div className="flex justify-center py-2">
      <div className="flex h-[600px] w-[330px] flex-col overflow-hidden rounded-panel border border-[hsl(var(--border))] bg-[hsl(var(--surface-0))] shadow-pop">
        <div className="flex items-center justify-center bg-[hsl(var(--surface-2))] py-1.5 type-caption">9:41</div>

        {completed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <CheckCircle2Icon className="h-14 w-14 text-[hsl(var(--success))]" />
            <p className="type-section">Teşekkürler!</p>
            <p className="type-muted">Yanıtlarınız için teşekkür ederiz. Bu yalnızca bir önizlemedir; yanıt kaydedilmez.</p>
            <Button variant="outline" size="sm" onClick={() => { setCompleted(false); setIndex(0); setResponses({}) }}>
              Baştan Önizle
            </Button>
          </div>
        ) : total === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <ClipboardListIcon className="h-12 w-12 text-[hsl(var(--foreground-subtle))]" />
            <p className="type-muted">Bu ankette henüz soru yok.</p>
          </div>
        ) : (
          <>
            <div
              className="space-y-2 border-b border-[hsl(var(--border))] px-4 py-3 text-white"
              style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}
            >
              <div className="flex items-center justify-between">
                {category ? <Badge tone="neutral">{category}</Badge> : <span />}
                <span className="type-caption text-white/90">{index + 1} / {total}</span>
              </div>
              <p className="type-body-strong text-white">{title}</p>
              <Progress value={progress} tone="primary" className="bg-white/30" />
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div>
                <p className="type-section">
                  {q.question || '—'}
                  {q.required && <span className="ml-1 text-[hsl(var(--danger))]">*</span>}
                </p>
                {q.description && <p className="mt-0.5 type-caption">{q.description}</p>}
              </div>
              {renderQuestion()}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-[hsl(var(--border))] p-3">
              <Button variant="outline" size="sm" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} iconLeft={<ChevronLeftIcon className="h-4 w-4" />}>
                Önceki
              </Button>
              {estimatedDuration ? <span className="type-caption">~{estimatedDuration} dk</span> : <span />}
              {index < total - 1 ? (
                <Button variant="primary" size="sm" onClick={next} disabled={blocked} iconRight={<ChevronRightIcon className="h-4 w-4" />}>
                  Sonraki
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={next} disabled={blocked} iconRight={<SendIcon className="h-4 w-4" />}>
                  Gönder
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
