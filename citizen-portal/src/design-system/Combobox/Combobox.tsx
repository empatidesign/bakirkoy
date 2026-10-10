import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon, XIcon, Loader2Icon } from 'lucide-react'
import { cn, inheritToneClass } from '@/lib/utils'
import { Badge } from '@/design-system/Badge'

export type ComboBadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'

export interface ComboOption {
  value: string
  label: string
  description?: string
  badge?: { label: string; tone?: ComboBadgeTone; color?: string }
}

export interface ComboboxProps {
  value: string
  onChange: (value: string, option?: ComboOption) => void | Promise<void>
  options?: ComboOption[]
  onSearch?: (query: string) => Promise<ComboOption[]>
  displayValue?: string
  placeholder?: string
  disabled?: boolean
  error?: string
  allowCustom?: boolean
  clearable?: boolean
  emptyText?: string
  iconLeft?: React.ReactNode
  className?: string
}

const lc = (s: string) => s.toLocaleLowerCase('tr')

export const Combobox = ({
  value, onChange, options, onSearch, displayValue, placeholder, disabled, error,
  allowCustom, clearable = true, emptyText = 'Sonuç bulunamadı', iconLeft, className,
}: ComboboxProps) => {
  const isAsync = !!onSearch
  const resolved = displayValue ?? options?.find((o) => o.value === value)?.label ?? value ?? ''

  const [open, setOpen] = useState(false)
  const [text, setText] = useState(resolved)
  const [typing, setTyping] = useState(false)
  const [active, setActive] = useState(0)
  const [asyncResults, setAsyncResults] = useState<ComboOption[]>([])
  const [loading, setLoading] = useState(false)
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ text, typing, resolved })
  stateRef.current = { text, typing, resolved }

  useEffect(() => {
    if (document.activeElement === inputRef.current) return
    setText(resolved)
    setTyping(false)
  }, [resolved])

  const query = typing ? text : ''
  const staticList = (options ?? []).filter((o) => {
    if (!query) return true
    const q = lc(query)
    return lc(o.label).includes(q) || lc(o.description ?? '').includes(q)
  })
  const list = isAsync ? asyncResults : staticList

  useEffect(() => {
    if (!open || !isAsync) return
    let alive = true
    setLoading(true)
    const handle = window.setTimeout(() => {
      onSearch!(query)
        .then((r) => { if (alive) setAsyncResults(r) })
        .catch(() => { if (alive) setAsyncResults([]) })
        .finally(() => { if (alive) setLoading(false) })
    }, 250)
    return () => { alive = false; window.clearTimeout(handle) }
  }, [open, isAsync, query, onSearch])

  const position = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const popH = 280
    const below = window.innerHeight - r.bottom
    const openUp = below < popH && r.top > below
    setCoords(openUp
      ? { bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width }
      : { top: r.bottom + 4, left: r.left, width: r.width })
  }, [])

  useLayoutEffect(() => { if (open) position() }, [open, position])

  const close = useCallback((): Promise<void> | undefined => {
    setOpen(false)
    const { text: t, typing: ty, resolved: rv } = stateRef.current
    if (ty) {
      const cur = t.trim()
      if (allowCustom && cur && cur !== rv) {
        const result = onChange(cur)
        setTyping(false)
        return result instanceof Promise ? result : undefined
      }
      setText(rv)
      setTyping(false)
    }
    return undefined
  }, [allowCustom, onChange])

  const pendingClickTargetRef = useRef<EventTarget | null>(null)

  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (!pendingClickTargetRef.current || e.target !== pendingClickTargetRef.current) return
      e.preventDefault()
      e.stopPropagation()
    }
    document.addEventListener('click', onClickCapture, true)
    return () => document.removeEventListener('click', onClickCapture, true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onScroll = () => position()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (popRef.current?.contains(t) || wrapRef.current?.contains(t)) return
      const { text: curText, typing: ty, resolved: rv } = stateRef.current
      const willCommitCustom = ty && allowCustom && curText.trim() && curText.trim() !== rv
      const pending = close()
      if (willCommitCustom && pending) {
        pendingClickTargetRef.current = e.target
        pending.finally(() => {
          requestAnimationFrame(() => {
            const target = pendingClickTargetRef.current
            pendingClickTargetRef.current = null
            if (target instanceof HTMLElement && document.contains(target)) {
              target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
            }
          })
        })
      }
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, position, close, allowCustom])

  const pick = (o: ComboOption) => {
    onChange(o.value, o)
    setText(o.label)
    setTyping(false)
    setOpen(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); setActive((i) => Math.min(list.length - 1, i + 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      const o = list[active]
      if (o) pick(o)
      else close()
    }
  }

  return (
    <div className={cn('w-full', className)}>
      <div ref={wrapRef} className="relative w-full">
        {iconLeft && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-foreground-subtle">{iconLeft}</span>
        )}
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={text}
          placeholder={placeholder}
          onChange={(e) => { setText(e.target.value); setTyping(true); setActive(0); if (!open) setOpen(true) }}
          onFocus={() => { if (!disabled) { setOpen(true); setActive(0) } }}
          onKeyDown={handleKey}
          className={cn(
            'h-[var(--control-h)] w-full rounded-field border bg-surface-1 pr-9 text-sm text-foreground-default placeholder:text-foreground-subtle transition-colors',
            iconLeft ? 'pl-10' : 'pl-3',
            'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 focus:border-[hsl(var(--primary))]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            open ? 'border-[hsl(var(--primary))]' : 'border-border',
            error && 'border-danger',
          )}
        />
        {clearable && !!value && !disabled ? (
          <button
            type="button" tabIndex={-1} aria-label="Temizle"
            onClick={() => { onChange(''); setText(''); setTyping(false) }}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-foreground-subtle hover:text-foreground-strong"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-foreground-muted">
            <ChevronDownIcon className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-[hsl(var(--danger))]">{error}</p>}

      {open && coords && createPortal(
        <div
          ref={popRef}
          data-ds-popover=""
          style={{ position: 'fixed', top: coords.top, bottom: coords.bottom, left: coords.left, width: coords.width }}
          className={cn('z-[70] max-h-[280px] overflow-y-auto rounded-card border border-border bg-surface-0 p-1 shadow-pop', inheritToneClass(wrapRef.current))}
        >
          {loading && (
            <div className="flex items-center gap-2 px-2.5 py-2 type-caption"><Loader2Icon className="h-3.5 w-3.5 animate-spin" /> Aranıyor...</div>
          )}
          {!loading && list.length === 0 && (
            <div className="px-2.5 py-2 type-caption">{isAsync && !query ? 'Aramak için yazın' : emptyText}</div>
          )}
          {list.map((o, i) => (
            <button
              key={`${o.value}-${i}`}
              type="button"
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(o) }}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-field px-2.5 py-1.5 text-left transition-colors',
                o.value === value ? 'bg-primary-soft' : i === active ? 'bg-surface-1' : '',
              )}
            >
              <span className="flex min-w-0 flex-col items-start gap-0.5">
                <span className={cn('truncate text-sm', o.value === value ? 'font-medium text-primary' : 'text-foreground-default')}>{o.label}</span>
                {o.description && <span className="truncate type-caption">{o.description}</span>}
              </span>
              {o.badge && <Badge tone={o.badge.tone} color={o.badge.color}>{o.badge.label}</Badge>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
