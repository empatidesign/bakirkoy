import { StarIcon, ThumbsUpIcon, ThumbsDownIcon } from 'lucide-react'
import { Icon2D, type Icon2DKind } from '@/components/Icon2D'
import { Textarea } from '@/design-system'
import { cn } from '@/lib/utils'
import type { CitizenSurveyQuestion } from '@/types/survey.types'
import { MicButton } from './MicButton'

// Kullanıcı isteği (2026-09-01): saha anketörü ekranı (FieldSurveyRunner) ile vatandaşın kendi
// anket modalı (SurveyFormModal) aynı soru bileşenlerini kullanmalı — iki ayrı kopya, soru
// tipi davranışlarının (Diğer... seçeneği, checkbox JSON biçimi, ölçek etiketleri) zamanla
// birbirinden ayrılmasına yol açardı. Bu dosya iki ekranın ortak kaynağıdır.
// `size="lg"` saha (tablet) modunda daha büyük dokunma hedefleri verir.

export type QuestionWidgetSize = 'md' | 'lg'

// Memnuniyet yüzleri emoji idi; platforma göre farklı render ediliyordu (Apple/Google/Windows
// üç ayrı çizim) ve "resim ikon" görünüyordu. 2D yüzlere çevrildi; renk kötü→iyi sıralamasını
// emojideki gibi taşımaya devam eder.
const EMOJI_OPTIONS: { kind: Icon2DKind; color: string }[] = [
  { kind: 'face-1', color: '#ef4444' },
  { kind: 'face-2', color: '#f97316' },
  { kind: 'face-3', color: '#eab308' },
  { kind: 'face-4', color: '#84cc16' },
  { kind: 'face-5', color: '#22c55e' },
]
const SATISFACTION_OPTIONS = ['Çok Kötü', 'Kötü', 'Orta', 'İyi', 'Çok İyi']
const AGREEMENT_OPTIONS = ['Kesinlikle Hayır', 'Hayır', 'Kararsız', 'Evet', 'Kesinlikle Evet']

const ANIM_STYLES = `
@keyframes sq-from-right { from { opacity: 0; transform: translateX(48px); } to { opacity: 1; transform: translateX(0); } }
@keyframes sq-from-left  { from { opacity: 0; transform: translateX(-48px); } to { opacity: 1; transform: translateX(0); } }
/* Zorunlu soru boş bırakıldığında kartı kısa süre vurgular (FieldSurveyRunner.submit). */
@keyframes fq-flash { 0%, 100% { box-shadow: 0 0 0 0 rgba(244,63,94,0); } 30%, 70% { box-shadow: 0 0 0 3px rgba(244,63,94,0.45); } }
.fq-flash { animation: fq-flash 1.4s ease-in-out; }
`

export function injectAnimStyles() {
  if (document.getElementById('sq-anim')) return
  const el = document.createElement('style')
  el.id = 'sq-anim'
  el.textContent = ANIM_STYLES
  document.head.appendChild(el)
}

type ChipButtonProps = {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}

export const ChipButton = ({ selected, onClick, children, className }: ChipButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    style={selected ? {
      background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
      boxShadow: '0 6px 16px rgba(20,184,166,0.35)',
    } : undefined}
    className={cn(
      'rounded-field border px-3.5 py-2 text-sm font-semibold transition-all duration-150',
      selected
        ? 'border-transparent text-white scale-[1.03]'
        : 'border-border bg-surface-1 text-foreground-default hover:border-teal-400 hover:bg-teal-50 hover:text-teal-600',
      className,
    )}
  >
    {children}
  </button>
)

type WidgetProps = {
  question: CitizenSurveyQuestion
  answer: string
  onChange: (val: string) => void
  /** 'lg' = saha/tablet modu: daha büyük yazı ve dokunma hedefleri. */
  size?: QuestionWidgetSize
}

export const isOtherOption = (opt: string) => opt.trim().toLowerCase().startsWith('diğer')

// Hata #13: checkbox cevaplarını JSON dizisi olarak okur. Eski kayıtlar (virgülle ayrılmış düz
// string) veya boş cevaplar için geriye uyumlu fallback uygular.
export const parseCheckboxAnswer = (answer: string): string[] => {
  if (!answer) return []
  const trimmed = answer.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === 'string')
    } catch {
      // JSON dizisi gibi görünüp bozuksa aşağıdaki eski-format fallback'ine düş.
    }
  }
  return answer.split(',')
}

export const QuestionWidget = ({ question, answer, onChange, size = 'md' }: WidgetProps) => {
  const { type, options, scaleMin, scaleMax, minLabel, maxLabel, ratingCount } = question
  const count = ratingCount ?? 5
  const lg = size === 'lg'
  const chipSize = lg ? 'px-6 py-4 text-lg' : undefined
  const starSize = lg ? 'h-14 w-14' : 'h-10 w-10'

  if (type === 'rating') {
    const selected = parseInt(answer || '0', 10)
    return (
      <div className="flex gap-2 flex-wrap justify-center">
        {Array.from({ length: count }, (_, i) => i + 1).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(String(v))}
            className={cn(
              'transition-all duration-150',
              v <= selected ? 'scale-110 drop-shadow-[0_4px_8px_rgba(245,158,11,0.4)]' : 'text-gray-200 hover:scale-105 hover:text-amber-300',
            )}
            style={v <= selected ? { color: '#f59e0b' } : undefined}
          >
            <StarIcon className={starSize} fill={v <= selected ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
    )
  }

  if (type === 'emoji_rating') {
    return (
      <div className="flex gap-3 flex-wrap justify-center">
        {EMOJI_OPTIONS.map((face, i) => {
          const val = String(i + 1)
          return (
            <button
              key={face.kind}
              type="button"
              onClick={() => onChange(val)}
              style={answer === val ? {
                background: 'linear-gradient(135deg, rgba(20,184,166,0.15), rgba(13,148,136,0.1))',
                boxShadow: '0 8px 20px rgba(20,184,166,0.3)',
              } : undefined}
              className={cn(
                'rounded-2xl border-2 transition-all duration-150',
                lg ? 'p-5' : 'p-3',
                answer === val
                  ? 'border-teal-400 scale-125'
                  : 'border-transparent grayscale-[0.3] opacity-60 hover:opacity-100 hover:grayscale-0 hover:scale-110',
              )}
            >
              <Icon2D kind={face.kind} className={lg ? 'h-12 w-12' : 'h-8 w-8'} style={{ color: face.color }} />
            </button>
          )
        })}
      </div>
    )
  }

  if (type === 'like_dislike') {
    return (
      <div className="flex gap-4 justify-center">
        {[
          { val: 'Beğendim', icon: <ThumbsUpIcon className="h-5 w-5" />, tone: 'success' },
          { val: 'Beğenmedim', icon: <ThumbsDownIcon className="h-5 w-5" />, tone: 'danger' },
        ].map(({ val, icon, tone }) => (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className={cn(
              'flex items-center gap-2 rounded-field border-2 font-medium transition-all duration-150',
              lg ? 'px-10 py-5 text-lg' : 'px-6 py-3 text-sm',
              answer === val
                ? tone === 'success'
                  ? 'border-success bg-success text-white scale-105 shadow-md'
                  : 'border-danger bg-danger text-white scale-105 shadow-md'
                : tone === 'success'
                  ? 'border-border bg-surface-1 hover:border-success hover:text-success'
                  : 'border-border bg-surface-1 hover:border-danger hover:text-danger',
            )}
          >
            {icon}
            {val}
          </button>
        ))}
      </div>
    )
  }

  if (type === 'satisfaction') {
    return (
      <div className="flex gap-2 flex-wrap justify-center">
        {SATISFACTION_OPTIONS.map((label, i) => (
          <ChipButton key={label} selected={answer === String(i + 1)} onClick={() => onChange(String(i + 1))} className={chipSize}>
            {label}
          </ChipButton>
        ))}
      </div>
    )
  }

  if (type === 'agreement') {
    return (
      <div className="flex gap-2 flex-wrap justify-center">
        {AGREEMENT_OPTIONS.map((label, i) => (
          <ChipButton key={label} selected={answer === String(i + 1)} onClick={() => onChange(String(i + 1))} className={chipSize}>
            {label}
          </ChipButton>
        ))}
      </div>
    )
  }

  if (type === 'multiple_choice') {
    // Kullanıcı isteği (2026-08-12): "Diğer... (Belirtiniz)" seçeneği — SULTANGAZİ BELEDİYESİ
    // ana anketinde 2. ve 3. sorularda var. Backend şemasında ayrı bir alan açmadan, seçenek
    // metni "Diğer" ile başlıyorsa seçildiğinde altında bir serbest metin kutusu açılır; cevap
    // "Diğer seçeneği: <yazılan metin>" formatında tek bir string olarak gönderilir (admin
    // panelde SurveyResponseAnswer.answerDisplay olduğu gibi okunabilir kalır).
    const otherOption = options.find((o) => isOtherOption(o))
    const isOtherSelected = !!otherOption && (answer === otherOption || answer.startsWith(`${otherOption}:`))
    const otherText = isOtherSelected ? (answer.split(':').slice(1).join(':').trim()) : ''
    return (
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap justify-center">
          {options.map((opt) => (
            <ChipButton
              key={opt}
              selected={isOtherOption(opt) ? isOtherSelected : answer === opt}
              onClick={() => onChange(opt)}
              className={chipSize}
            >
              {opt}
            </ChipButton>
          ))}
        </div>
        {isOtherSelected && otherOption && (
          <Textarea
            value={otherText}
            onChange={(e) => onChange(`${otherOption}: ${e.target.value}`)}
            placeholder="Lütfen belirtiniz…"
            rows={2}
            className="resize-none"
          />
        )}
      </div>
    )
  }

  if (type === 'checkbox') {
    // Hata #13: checkbox cevapları eskiden virgülle birleştirilmiş tek string'de saklanıyordu;
    // seçenek metninde virgül geçtiğinde cevaplar yanlış parçalara bölünüyordu. Artık JSON dizisi
    // olarak (de)serialize ediliyor. Eski (virgülle ayrılmış) taslak cevaplar için geriye uyumlu
    // fallback korunuyor.
    const sel = parseCheckboxAnswer(answer)
    const toggle = (opt: string) => {
      const next = sel.includes(opt) ? sel.filter((x) => x !== opt) : [...sel, opt]
      onChange(next.length > 0 ? JSON.stringify(next) : '')
    }
    const otherOption = options.find((o) => isOtherOption(o))
    const isOtherSelected = !!otherOption && sel.some((s) => s === otherOption || s.startsWith(`${otherOption}:`))
    const otherEntry = otherOption ? sel.find((s) => s === otherOption || s.startsWith(`${otherOption}:`)) : undefined
    const otherText = otherEntry ? otherEntry.split(':').slice(1).join(':').trim() : ''
    const setOtherText = (text: string) => {
      if (!otherOption) return
      const withoutOther = sel.filter((s) => s !== otherOption && !s.startsWith(`${otherOption}:`))
      onChange(JSON.stringify([...withoutOther, `${otherOption}: ${text}`]))
    }
    return (
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap justify-center">
          {options.map((opt) => (
            <ChipButton key={opt} selected={isOtherOption(opt) ? isOtherSelected : sel.includes(opt)} onClick={() => toggle(opt)} className={chipSize}>
              {opt}
            </ChipButton>
          ))}
        </div>
        {isOtherSelected && otherOption && (
          <Textarea
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder="Lütfen belirtiniz…"
            rows={2}
            className="resize-none"
          />
        )}
      </div>
    )
  }

  if (type === 'yes_no') {
    return (
      <div className="flex gap-4 justify-center">
        {['Evet', 'Hayır'].map((val) => (
          <ChipButton key={val} selected={answer === val} onClick={() => onChange(val)} className={cn('min-w-[96px] justify-center py-3 text-base', lg && 'min-w-[160px] px-8 py-5 text-xl')}>
            {val}
          </ChipButton>
        ))}
      </div>
    )
  }

  if (type === 'scale') {
    const min = scaleMin ?? 1
    const max = scaleMax ?? 10
    const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i)
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 justify-center">
          {steps.map((v) => (
            <ChipButton
              key={v}
              selected={answer === String(v)}
              onClick={() => onChange(String(v))}
              className={cn('min-w-[44px] justify-center px-2 py-2.5', lg && 'min-w-[64px] px-4 py-4 text-lg')}
            >
              {v}
            </ChipButton>
          ))}
        </div>
        {(minLabel || maxLabel) && (
          <div className="flex justify-between px-1">
            {minLabel && <span className="type-caption text-foreground-subtle">{minLabel}</span>}
            {maxLabel && <span className="type-caption text-foreground-subtle">{maxLabel}</span>}
          </div>
        )}
      </div>
    )
  }

  if (type === 'text') {
    // Kullanıcı isteği (2026-09-02): serbest metin sorularda sesli yazma — anketör
    // tablette tek elle yazmak yerine vatandaşın cevabını sesle diğerleyebilir.
    // Ek doğrulama (2026-09-03): MicButton dokunmatik minimuma (44px) çıkarıldığında
    // burada da tutarlı olması için size="md" verildi (öncesi 28px varsayılan).
    return (
      <div className="relative">
        <Textarea
          value={answer}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Yanıtınızı buraya yazın…"
          rows={lg ? 6 : 4}
          className={cn('resize-none pr-14', lg && 'text-lg')}
        />
        <MicButton
          size="md"
          className="absolute right-2 top-2"
          onText={(t) => onChange(answer.trim() ? `${answer.trim()} ${t}` : t)}
        />
      </div>
    )
  }

  return null
}
