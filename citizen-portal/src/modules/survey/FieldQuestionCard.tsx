import { useMemo } from 'react'
import { StarIcon, MessageSquareIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CitizenSurveyQuestion } from '@/types/survey.types'
import { optionVisual } from './optionIcons'
import { isOtherOption, parseCheckboxAnswer } from './questionWidget'
import { MicButton } from './MicButton'

// Kullanıcı isteği (2026-09-01, docs/ankettema/02.png): saha anket ekranında sorular tek
// sayfada, her biri kendi renkli kartında ve seçenekler ikonlu 3'lü ızgarada gösterilir.
// Tek soruyu tam ekran gösteren mevcut QuestionWidget korunur (vatandaş modalı onu kullanır);
// bu bileşen yalnızca tablet saha formunun "tek sayfa" düzeni içindir.

const TEXT_MAX = 500

/** Karta ve soru numarasına renk paleti — 02.png'deki mavi/yeşil/turuncu/mor sıralaması. */
const PALETTES = [
  { card: 'border-blue-100 bg-blue-50/40', chip: 'bg-blue-600', ring: 'ring-blue-500', sel: 'border-blue-500 bg-blue-50' },
  { card: 'border-emerald-100 bg-emerald-50/40', chip: 'bg-emerald-600', ring: 'ring-emerald-500', sel: 'border-emerald-500 bg-emerald-50' },
  { card: 'border-amber-100 bg-amber-50/40', chip: 'bg-amber-500', ring: 'ring-amber-500', sel: 'border-amber-500 bg-amber-50' },
  { card: 'border-violet-100 bg-violet-50/40', chip: 'bg-violet-600', ring: 'ring-violet-500', sel: 'border-violet-500 bg-violet-50' },
] as const

export type QuestionPalette = (typeof PALETTES)[number]
export const paletteFor = (index: number): QuestionPalette => PALETTES[index % PALETTES.length]

interface OptionCardProps {
  label: string
  selected: boolean
  multi: boolean
  palette: QuestionPalette
  onClick: () => void
}

/** 02.png'deki seçenek kartı: solda radyo/checkbox, yanında ikon, sonra etiket. */
const OptionCard = ({ label, selected, multi, palette, onClick }: OptionCardProps) => {
  const { Icon, tone } = optionVisual(label)
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-2xl border-2 bg-white px-3.5 py-3 text-left transition-all duration-150 active:scale-[0.98]',
        selected ? cn(palette.sel, 'shadow-sm ring-1', palette.ring) : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      {multi ? (
        <span
          className={cn(
            'order-last flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors',
            selected ? cn(palette.chip, 'border-transparent text-white') : 'border-slate-300 bg-white',
          )}
        >
          {selected && (
            <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
              <path d="M4 10.5l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      ) : (
        <span
          className={cn(
            'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            selected ? cn(palette.ring.replace('ring-', 'border-'), 'bg-white') : 'border-slate-300 bg-white',
          )}
        >
          {selected && <span className={cn('h-2.5 w-2.5 rounded-full', palette.chip)} />}
        </span>
      )}
      <Icon className={cn('h-5 w-5 flex-shrink-0', selected ? 'text-slate-700' : tone)} />
      <span className={cn('flex-1 text-sm font-semibold leading-snug', selected ? 'text-slate-900' : 'text-slate-700')}>
        {label}
      </span>
    </button>
  )
}

interface Props {
  question: CitizenSurveyQuestion
  index: number
  answer: string
  onChange: (value: string) => void
  /** 06.png tek-soru düzeni: başlık/rozet dışarıda çizilir, yalnızca cevap alanı gerekir. */
  bare?: boolean
}

/**
 * Tek bir soruyu 02.png düzeninde render eder. Desteklenmeyen tipler (emoji, ölçek…) için
 * ChipGrid'e düşer; böylece hiçbir soru tipi ekranda kaybolmaz.
 */
export const FieldQuestionCard = ({ question, index, answer, onChange, bare = false }: Props) => {
  const palette = paletteFor(index)
  const { type, options } = question

  const otherOption = useMemo(() => options.find((o) => isOtherOption(o)), [options])

  const header = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-black text-white', palette.chip)}>
        {index + 1}
      </span>
      <h3 className="text-[15px] font-bold leading-snug text-slate-900">{question.question}</h3>
      {type === 'checkbox' && (
        <span className="text-xs font-semibold text-slate-500">(Birden fazla seçebilirsiniz)</span>
      )}
      {question.required && (
        <span className="ml-auto rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-rose-600">
          Zorunlu
        </span>
      )}
    </div>
  )

  const body = (() => {
    // --- Tekli seçim (ikonlu ızgara) ---
    if (type === 'multiple_choice' || type === 'yes_no' || type === 'like_dislike') {
      const opts = type === 'yes_no' ? ['Evet', 'Hayır']
        : type === 'like_dislike' ? ['Beğendim', 'Beğenmedim']
        : options
      const isOtherSelected = !!otherOption && (answer === otherOption || answer.startsWith(`${otherOption}:`))
      const otherText = isOtherSelected ? answer.split(':').slice(1).join(':').trim() : ''
      return (
        <div className="space-y-2.5">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {opts.map((opt) => (
              <OptionCard
                key={opt}
                label={opt}
                multi={false}
                palette={palette}
                selected={isOtherOption(opt) ? isOtherSelected : answer === opt}
                onClick={() => onChange(opt)}
              />
            ))}
          </div>
          {isOtherSelected && otherOption && (
            <textarea
              value={otherText}
              onChange={(e) => onChange(`${otherOption}: ${e.target.value}`)}
              placeholder="Lütfen belirtiniz…"
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400"
            />
          )}
        </div>
      )
    }

    // --- Çoklu seçim ---
    if (type === 'checkbox') {
      const sel = parseCheckboxAnswer(answer)
      const isOtherSelected = !!otherOption && sel.some((s) => s === otherOption || s.startsWith(`${otherOption}:`))
      const otherEntry = otherOption ? sel.find((s) => s === otherOption || s.startsWith(`${otherOption}:`)) : undefined
      const otherText = otherEntry ? otherEntry.split(':').slice(1).join(':').trim() : ''
      const toggle = (opt: string) => {
        const next = sel.includes(opt) ? sel.filter((x) => x !== opt) : [...sel, opt]
        onChange(next.length > 0 ? JSON.stringify(next) : '')
      }
      const setOtherText = (text: string) => {
        if (!otherOption) return
        const rest = sel.filter((s) => s !== otherOption && !s.startsWith(`${otherOption}:`))
        onChange(JSON.stringify([...rest, `${otherOption}: ${text}`]))
      }
      return (
        <div className="space-y-2.5">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {options.map((opt) => (
              <OptionCard
                key={opt}
                label={opt}
                multi
                palette={palette}
                selected={isOtherOption(opt) ? isOtherSelected : sel.includes(opt)}
                onClick={() => toggle(opt)}
              />
            ))}
          </div>
          {isOtherSelected && otherOption && (
            <textarea
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="Lütfen belirtiniz…"
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400"
            />
          )}
        </div>
      )
    }

    // --- 1-5 yıldızlı memnuniyet satırı (02.png'deki 3. soru) ---
    if (type === 'rating' || type === 'satisfaction' || type === 'agreement' || type === 'emoji_rating') {
      const count = type === 'rating' ? (question.ratingCount ?? 5) : 5
      const selected = parseInt(answer || '0', 10)
      return (
        <div className={cn('grid gap-2.5', count <= 5 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-3 sm:grid-cols-5')}>
          {Array.from({ length: count }, (_, i) => i + 1).map((v) => {
            const isSel = selected === v
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={isSel}
                aria-label={`${v} puan`}
                onClick={() => onChange(String(v))}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-2xl border-2 bg-white px-3 py-2.5 transition-all duration-150 active:scale-[0.98]',
                  isSel
                    ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <span className={cn('text-base font-black', isSel ? 'text-slate-900' : 'text-slate-500')}>{v}</span>
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: v }, (_, i) => (
                    <StarIcon
                      key={i}
                      className={cn('h-4 w-4', isSel ? 'text-blue-500' : 'text-amber-400')}
                      fill={isSel ? 'currentColor' : 'none'}
                      strokeWidth={2}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      )
    }

    // --- Ölçek (1-10 gibi) ---
    if (type === 'scale') {
      const min = question.scaleMin ?? 1
      const max = question.scaleMax ?? 10
      const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i)
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {steps.map((v) => {
              const isSel = answer === String(v)
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange(String(v))}
                  className={cn(
                    'min-w-[52px] rounded-xl border-2 bg-white px-3 py-2.5 text-sm font-bold transition-all active:scale-95',
                    isSel ? cn(palette.sel, 'text-slate-900 ring-1', palette.ring) : 'border-slate-200 text-slate-600 hover:border-slate-300',
                  )}
                >
                  {v}
                </button>
              )
            })}
          </div>
          {(question.minLabel || question.maxLabel) && (
            <div className="flex justify-between text-xs font-semibold text-slate-400">
              <span>{question.minLabel}</span>
              <span>{question.maxLabel}</span>
            </div>
          )}
        </div>
      )
    }

    // --- Serbest metin (500 karakter sayaçlı) ---
    // Kullanıcı isteği (2026-09-03): "görüş ve talep detki ciklama alanına sesli yazma
    // sigesi olsun" — saha ekranındaki serbest metin sorularına da mikrofon eklendi
    // (talep formunda zaten vardı, anket içi metin sorularında eksikti).
    return (
      <div className="relative">
        <textarea
          value={answer}
          maxLength={TEXT_MAX}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Görüş ve önerilerinizi buraya yazabilirsiniz…"
          rows={3}
          className="w-full resize-none rounded-2xl border-2 border-slate-200 bg-white px-3.5 py-3 pr-14 text-sm font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
        />
        <MicButton
          size="md"
          className="absolute right-3 top-3"
          onText={(t) => onChange(answer.trim() ? `${answer.trim()} ${t}` : t)}
        />
        <div className="mt-1 text-right text-xs font-semibold text-slate-400">
          {answer.length} / {TEXT_MAX}
        </div>
      </div>
    )
  })()

  const isText = type === 'text'

  if (bare) return <div id={`fq-${question.id}`}>{body}</div>

  return (
    <section id={`fq-${question.id}`} className={cn('scroll-mt-4 rounded-2xl border p-3.5 sm:p-4 transition-shadow', palette.card)}>
      {isText ? (
        <div className="mb-3 flex items-center gap-2">
          <MessageSquareIcon className="h-5 w-5 text-violet-500" />
          <h3 className="text-[15px] font-bold leading-snug text-slate-900">
            {index + 1}. {question.question}
          </h3>
          {question.required && (
            <span className="ml-auto rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-rose-600">
              Zorunlu
            </span>
          )}
        </div>
      ) : header}
      {question.description && !isText && (
        <p className="-mt-1.5 mb-3 text-xs font-medium text-slate-500">{question.description}</p>
      )}
      {body}
    </section>
  )
}
