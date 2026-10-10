import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ClockIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  error?: string
  clearable?: boolean
  minuteStep?: number
  className?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

const parse = (v: string): { hh: number; mm: number } | null => {
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hh = +m[1]
  const mm = +m[2]
  if (hh > 23 || mm > 59) return null
  return { hh, mm }
}

const TimeCol = ({ items, selected, onPick, label }: { items: number[]; selected?: number; onPick: (n: number) => void; label: string }) => (
  <div className="flex h-[210px] flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-1 py-1" aria-label={label}>
    {items.map((n) => {
      const isSel = selected === n
      return (
        <button
          key={n}
          type="button"
          data-selected={isSel}
          onClick={() => onPick(n)}
          className={cn(
            'flex-shrink-0 rounded-field py-1.5 text-center text-sm tabular-nums transition-colors',
            isSel ? 'bg-primary font-semibold text-[hsl(var(--primary-foreground))]' : 'text-foreground-default hover:bg-surface-1',
          )}
        >
          {pad(n)}
        </button>
      )
    })}
  </div>
)

export const TimePicker = ({
  value, onChange, placeholder = 'ss:dd', disabled, error, clearable = true, minuteStep = 5, className,
}: TimePickerProps) => {
  const parsed = parse(value)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(value)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (document.activeElement === inputRef.current) return
    setText(value)
  }, [value])

  const position = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const popH = 250
    const below = window.innerHeight - r.bottom
    const top = below < popH && r.top > below ? Math.max(8, r.top - popH - 6) : r.bottom + 6
    setCoords({ top, left: Math.min(r.left, window.innerWidth - 184) })
  }, [])

  useLayoutEffect(() => { if (open) position() }, [open, position])
  useEffect(() => {
    if (!open) return
    const onScroll = (e: Event) => {
      const t = e.target as Node
      if (popRef.current && t && popRef.current.contains(t)) return
      position()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (popRef.current?.contains(t) || wrapRef.current?.contains(t)) return
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

  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => {
      popRef.current?.querySelectorAll<HTMLElement>('[data-selected="true"]').forEach((el) => {
        el.scrollIntoView({ block: 'center' })
      })
    })
    return () => window.cancelAnimationFrame(id)
  }, [open])

  const hours = Array.from({ length: 24 }, (_, h) => h)
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep)

  const commit = (hh: number, mm: number) => {
    const v = `${pad(hh)}:${pad(mm)}`
    onChange(v)
    setText(v)
  }
  const pickHour = (h: number) => commit(h, parsed?.mm ?? 0)
  const pickMin = (m: number) => commit(parsed?.hh ?? 0, m)

  const handleType = (raw: string) => {
    setText(raw)
    if (raw.trim() === '') { onChange(''); return }
    const p = parse(raw)
    if (p) onChange(`${pad(p.hh)}:${pad(p.mm)}`)
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
          aria-label="Saat seç"
        >
          <ClockIcon className="h-3.5 w-3.5" />
        </button>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={text}
          placeholder={placeholder}
          onChange={(e) => handleType(e.target.value)}
          onFocus={() => { if (!disabled) setOpen(true) }}
          onBlur={() => setText(value)}
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
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: 176 }}
          className="z-[60] rounded-card border border-border bg-surface-0 p-2 shadow-pop"
        >
          <div className="mb-1 flex gap-1">
            <span className="flex-1 text-center type-caption font-medium">Saat</span>
            <span className="flex-1 text-center type-caption font-medium">Dakika</span>
          </div>
          <div className="flex gap-1">
            <TimeCol items={hours} selected={parsed?.hh} onPick={pickHour} label="Saat" />
            <div className="w-px bg-border" />
            <TimeCol items={minutes} selected={parsed?.mm} onPick={pickMin} label="Dakika" />
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
