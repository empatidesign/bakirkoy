import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select } from '@/design-system/Select'

export interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  showTime?: boolean
  placeholder?: string
  min?: string
  max?: string
  error?: string
  disabled?: boolean
  clearable?: boolean
  className?: string
}

const WEEKDAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const pad = (n: number) => String(n).padStart(2, '0')

interface Parsed { y: number; m: number; d: number; hh: number; mm: number }

const parse = (value: string): Parsed | null => {
  if (!value) return null
  const [datePart, timePart] = value.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  if (!y || !m || !d) return null
  const [hh, mm] = (timePart ?? '00:00').split(':').map(Number)
  return { y, m, d, hh: hh || 0, mm: mm || 0 }
}

const parseTyped = (raw: string): Parsed | null => {
  const m = raw.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/)
  if (!m) return null
  const d = +m[1], mo = +m[2], y = +m[3]
  const hh = m[4] != null ? +m[4] : 0
  const mm = m[5] != null ? +m[5] : 0
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return { y, m: mo, d, hh, mm }
}

const buildValue = (y: number, m: number, d: number, hh: number, mm: number, showTime: boolean): string =>
  `${y}-${pad(m)}-${pad(d)}${showTime ? `T${pad(hh)}:${pad(mm)}` : ''}`

const display = (p: Parsed, showTime: boolean): string =>
  `${pad(p.d)}.${pad(p.m)}.${p.y}${showTime ? ` ${pad(p.hh)}:${pad(p.mm)}` : ''}`

const maskDate = (raw: string, showTime: boolean): string => {
  const d = raw.replace(/\D/g, '').slice(0, showTime ? 12 : 8)
  const parts = [d.slice(0, 2)]
  if (d.length > 2) parts.push(d.slice(2, 4))
  if (d.length > 4) parts.push(d.slice(4, 8))
  let out = parts.filter(Boolean).join('.')
  if (showTime && d.length > 8) {
    out += ' ' + d.slice(8, 10)
    if (d.length > 10) out += ':' + d.slice(10, 12)
  }
  return out
}

const TimeColumn = ({ count, value, onSelect }: { count: number; value: number; onSelect: (n: number) => void }) => (
  <div className="max-h-[132px] flex-1 overflow-y-auto rounded-field border border-border bg-surface-1">
    {Array.from({ length: count }, (_, n) => (
      <button
        key={n}
        type="button"
        onClick={() => onSelect(n)}
        className={cn(
          'flex w-full items-center justify-center py-1 text-[12px] tabular-nums transition-colors',
          value === n ? 'bg-primary font-semibold text-[hsl(var(--primary-foreground))]' : 'text-foreground-default hover:bg-surface-2',
        )}
      >
        {pad(n)}
      </button>
    ))}
  </div>
)

export const DatePicker = ({
  value, onChange, showTime = false, placeholder, min, max, error, disabled, clearable = true, className,
}: DatePickerProps) => {
  const parsed = parse(value)
  const today = new Date()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(parsed ? display(parsed, showTime) : '')
  const [view, setView] = useState(() => ({ y: parsed?.y ?? today.getFullYear(), m: parsed?.m ?? today.getMonth() + 1 }))
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (document.activeElement === inputRef.current) return
    const p = parse(value)
    setText(p ? display(p, showTime) : '')
  }, [value, showTime])

  const position = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const popH = 380
    const below = window.innerHeight - r.bottom
    const top = below < popH && r.top > below ? Math.max(8, r.top - popH - 6) : r.bottom + 6
    setCoords({ top, left: Math.min(r.left, window.innerWidth - 312) })
  }, [])

  useLayoutEffect(() => { if (open) position() }, [open, position])
  useEffect(() => {
    if (!open) return
    const onScroll = () => position()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (popRef.current?.contains(t) || wrapRef.current?.contains(t)) return
      if (t instanceof Element && t.closest('[data-ds-popover]')) return
      setOpen(false)
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, position])

  const maxY = max ? Number(max.slice(0, 4)) : today.getFullYear() + 5
  const minY = min ? Number(min.slice(0, 4)) : 1900
  const years: number[] = []
  for (let y = maxY; y >= minY; y--) years.push(y)

  const firstWeekday = (new Date(view.y, view.m - 1, 1).getDay() + 6) % 7
  const daysInMonth = new Date(view.y, view.m, 0).getDate()
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const minDate = min?.slice(0, 10)
  const maxDate = max?.slice(0, 10)
  const isDisabled = (d: number) => {
    const iso = `${view.y}-${pad(view.m)}-${pad(d)}`
    return (minDate && iso < minDate) || (maxDate && iso > maxDate) || false
  }
  const isSelected = (d: number) => parsed && parsed.y === view.y && parsed.m === view.m && parsed.d === d
  const isToday = (d: number) => today.getFullYear() === view.y && today.getMonth() + 1 === view.m && today.getDate() === d

  const shiftMonth = (delta: number) => setView((v) => {
    const idx = (v.m - 1) + delta
    return { y: v.y + Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 + 1 }
  })

  const commit = (y: number, m: number, d: number, hh: number, mm: number) => {
    const iso = buildValue(y, m, d, hh, mm, showTime)
    onChange(iso)
    setText(display({ y, m, d, hh, mm }, showTime))
  }
  const pick = (d: number) => {
    commit(view.y, view.m, d, parsed?.hh ?? 0, parsed?.mm ?? 0)
    if (!showTime) setOpen(false)
  }
  const setTime = (hh: number, mm: number) => {
    const base = parsed ?? { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() }
    commit(base.y, base.m, base.d, hh, mm)
  }

  const handleType = (raw: string) => {
    const masked = maskDate(raw, showTime)
    setText(masked)
    const digits = raw.replace(/\D/g, '')
    if (digits.length === 0) { onChange(''); return }
    if (digits.length >= 8) {
      const p = parseTyped(masked)
      if (p) { onChange(buildValue(p.y, p.m, p.d, p.hh, p.mm, showTime)); setView({ y: p.y, m: p.m }) }
    }
  }

  return (
    <div className={cn('w-full', className)}>
      <div ref={wrapRef} className="relative w-full">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => { if (!disabled) { setOpen((o) => !o); inputRef.current?.focus() } }}
          className="absolute inset-y-0 left-0 flex items-center pl-3 text-foreground-subtle disabled:cursor-not-allowed"
          aria-label="Takvimi aç"
        >
          <CalendarIcon className="h-3.5 w-3.5" />
        </button>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={text}
          placeholder={placeholder ?? (showTime ? 'gg.aa.yyyy ss:dd' : 'gg.aa.yyyy')}
          onChange={(e) => handleType(e.target.value)}
          onFocus={() => { if (!disabled) setOpen(true) }}
          onBlur={() => { const p = parse(value); setText(p ? display(p, showTime) : '') }}
          className={cn(
            'h-[var(--control-h)] w-full rounded-field border bg-surface-1 pl-10 pr-9 text-sm text-foreground-default placeholder:text-foreground-subtle transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 focus:border-[hsl(var(--primary))]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            open ? 'border-[hsl(var(--primary))]' : 'border-border',
            error && 'border-danger',
          )}
        />
        {clearable && parsed && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Temizle"
            onClick={() => { onChange(''); setText('') }}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-foreground-subtle hover:text-foreground-strong"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-[hsl(var(--danger))]">{error}</p>}

      {open && coords && createPortal(
        <div
          ref={popRef}
          data-ds-popover=""
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: 304 }}
          className="z-[60] rounded-card border border-border bg-surface-0 p-3 shadow-pop"
        >
          <div className="mb-2 flex items-center gap-1.5">
            <button type="button" onClick={() => shiftMonth(-1)} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-field text-foreground-muted hover:bg-surface-1" aria-label="Önceki ay"><ChevronLeftIcon className="h-4 w-4" /></button>
            <div className="min-w-0 flex-1"><Select value={String(view.m)} onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))}>{MONTHS.map((mo, i) => <option key={mo} value={i + 1}>{mo}</option>)}</Select></div>
            <div className="w-[88px] flex-shrink-0"><Select value={String(view.y)} onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) }))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select></div>
            <button type="button" onClick={() => shiftMonth(1)} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-field text-foreground-muted hover:bg-surface-1" aria-label="Sonraki ay"><ChevronRightIcon className="h-4 w-4" /></button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map((w) => <div key={w} className="py-1 text-center type-caption font-medium">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => d === null ? <div key={i} /> : (
              <button
                key={i}
                type="button"
                disabled={isDisabled(d)}
                onClick={() => pick(d)}
                className={cn(
                  'flex h-9 items-center justify-center rounded-field text-[12px] tabular-nums transition-colors',
                  isSelected(d) ? 'bg-primary text-[hsl(var(--primary-foreground))] font-semibold'
                    : isToday(d) ? 'border border-primary/40 text-foreground-strong hover:bg-surface-1'
                      : 'text-foreground-default hover:bg-surface-1',
                  'disabled:cursor-not-allowed disabled:text-foreground-subtle disabled:opacity-40 disabled:hover:bg-transparent',
                )}
              >
                {d}
              </button>
            ))}
          </div>

          {showTime && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="type-caption">Saat (kaydırarak seçin)</span>
                <span className="type-caption tabular-nums text-foreground-strong">{pad(parsed?.hh ?? 0)}:{pad(parsed?.mm ?? 0)}</span>
              </div>
              <div className="flex items-stretch gap-2">
                <TimeColumn count={24} value={parsed?.hh ?? 0} onSelect={(h) => setTime(h, parsed?.mm ?? 0)} />
                <span className="self-center type-muted">:</span>
                <TimeColumn count={60} value={parsed?.mm ?? 0} onSelect={(m) => setTime(parsed?.hh ?? 0, m)} />
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
            <button type="button" onClick={() => { onChange(''); setText(''); setOpen(false) }} className="type-link-sm">Temizle</button>
            <button
              type="button"
              onClick={() => {
                const t = new Date()
                commit(t.getFullYear(), t.getMonth() + 1, t.getDate(), showTime ? t.getHours() : 0, showTime ? t.getMinutes() : 0)
                setView({ y: t.getFullYear(), m: t.getMonth() + 1 })
                if (!showTime) setOpen(false)
              }}
              className="type-link-sm"
            >
              {showTime ? 'Şimdi' : 'Bugün'}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

export const DateTimePicker = (props: Omit<DatePickerProps, 'showTime'>) => <DatePicker {...props} showTime />
