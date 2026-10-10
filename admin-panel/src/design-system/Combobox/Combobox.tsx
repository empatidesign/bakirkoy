import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon, XIcon, Loader2Icon, SearchIcon, CheckIcon, ArrowRightIcon } from 'lucide-react'
import { cn, inheritToneClass } from '@/lib/utils'
import { Badge } from '@/design-system/Badge'

export type ComboBadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'

export interface ComboOption {
  value: string
  label: string
  description?: string
  badge?: { label: string; tone?: ComboBadgeTone; color?: string }
  icon?: React.ReactNode
  actionLabel?: string
}

export interface ComboFilter {
  value: string
  label: React.ReactNode
  tone?: ComboBadgeTone
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
  searchInList?: boolean
  searchPlaceholder?: string
  filters?: ComboFilter[]
  filterValue?: string
  onFilterChange?: (value: string) => void
  badgePlacement?: 'end' | 'inline'
}

const FILTER_TONE: Record<ComboBadgeTone, { on: string; off: string }> = {
  primary: { on: 'border-primary bg-primary text-white', off: 'border-primary/30 bg-primary-soft text-primary' },
  neutral: { on: 'border-primary bg-primary text-white', off: 'border-border bg-surface-1 text-foreground-muted' },
  danger: { on: 'border-danger bg-danger text-white', off: 'border-danger/30 bg-danger-soft text-danger' },
  info: { on: 'border-info bg-info text-white', off: 'border-info/30 bg-info-soft text-info' },
  success: { on: 'border-success bg-success text-white', off: 'border-success/30 bg-success-soft text-success' },
  warning: { on: 'border-warning bg-warning text-white', off: 'border-warning/30 bg-warning-soft text-warning' },
}

const lc = (s: string) => s.toLocaleLowerCase('tr')

export const Combobox = ({
  value, onChange, options, onSearch, displayValue, placeholder, disabled, error,
  allowCustom, clearable = true, emptyText = 'Sonuç bulunamadı', iconLeft, className,
  searchInList, searchPlaceholder = 'Ara...', filters, filterValue, onFilterChange, badgePlacement = 'end',
}: ComboboxProps) => {
  const isAsync = !!onSearch
  const resolved = displayValue ?? options?.find((o) => o.value === value)?.label ?? value ?? ''

  const [open, setOpen] = useState(false)
  const [text, setText] = useState(resolved)
  const [typing, setTyping] = useState(false)
  const [listQuery, setListQuery] = useState('')
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

  const query = searchInList ? listQuery : (typing ? text : '')
  const staticList = (options ?? []).filter((o) => {
    if (!query) return true
    const q = lc(query)
    return lc(o.label).includes(q) || lc(o.description ?? '').includes(q)
  })
  const list = isAsync ? asyncResults : staticList

  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch

  useEffect(() => {
    if (!open || !isAsync) return
    let alive = true
    setLoading(true)
    const handle = window.setTimeout(() => {
      onSearchRef.current!(query)
        .then((r) => { if (alive) setAsyncResults(r) })
        .catch(() => { if (alive) setAsyncResults([]) })
        .finally(() => { if (alive) setLoading(false) })
    }, 250)
    return () => { alive = false; window.clearTimeout(handle) }
  }, [open, isAsync, query])

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
    setListQuery('')
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
    setListQuery('')
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
          readOnly={searchInList}
          value={text}
          placeholder={placeholder}
          onChange={(e) => { if (searchInList) return; setText(e.target.value); setTyping(true); setActive(0); if (!open) setOpen(true) }}
          onClick={() => { if (!disabled) { setOpen(true); setActive(0) } }}
          onFocus={() => { if (!disabled) { setOpen(true); setActive(0); if (!searchInList) inputRef.current?.select() } }}
          onKeyDown={handleKey}
          className={cn(
            'h-[var(--control-h)] w-full rounded-field border bg-surface-1 pr-9 text-sm text-foreground-default placeholder:text-foreground-subtle transition-colors',
            iconLeft ? 'pl-10' : 'pl-3',
            searchInList && 'cursor-pointer select-none',
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
          style={{ position: 'fixed', top: coords.top, bottom: coords.bottom, left: coords.left, width: filters?.length ? Math.min(Math.max(coords.width, 600), window.innerWidth - coords.left - 16) : coords.width }}
          className={cn('z-[70] overflow-y-auto', filters?.length ? 'max-h-[400px]' : 'max-h-[280px]', 'rounded-card border border-border bg-surface-0 p-1 shadow-pop', inheritToneClass(wrapRef.current))}
        >
          {searchInList && (
            <div className="sticky top-0 z-10 -m-1 mb-1 border-b border-border bg-surface-0 p-1.5">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-foreground-subtle">
                  <SearchIcon className="h-3.5 w-3.5" />
                </span>
                <input
                  type="text"
                  autoFocus
                  value={listQuery}
                  placeholder={searchPlaceholder}
                  onChange={(e) => { setListQuery(e.target.value); setActive(0) }}
                  onKeyDown={handleKey}
                  className="h-8 w-full rounded-field border border-border bg-surface-1 pl-8 pr-2.5 text-sm text-foreground-default placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 focus:border-[hsl(var(--primary))]"
                />
              </div>
              {filters && filters.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {filters.map((f) => {
                    const t = FILTER_TONE[f.tone ?? 'neutral']
                    return (
                      <button
                        key={f.value}
                        type="button"
                        aria-pressed={filterValue === f.value}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { onFilterChange?.(f.value); setActive(0) }}
                        className={cn('inline-flex items-center gap-1 rounded-field border px-2 py-1 text-xs font-semibold transition-colors', filterValue === f.value ? t.on : t.off)}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {loading && list.length === 0 && (
            <div className="flex items-center gap-2 px-2.5 py-2 type-caption"><Loader2Icon className="h-3.5 w-3.5 animate-spin" /> Aranıyor...</div>
          )}
          {!loading && list.length === 0 && (
            <div className="px-2.5 py-2 type-caption">{isAsync && !query ? 'Aramak için yazın' : emptyText}</div>
          )}
          {list.map((o, i) => {
            const selected = o.value === value
            const badge = o.badge && <Badge tone={o.badge.tone} color={o.badge.color}>{o.badge.label}</Badge>
            return (
              <button
                key={`${o.value}-${i}`}
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(o) }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-field px-2.5 py-1.5 text-left transition-colors',
                  selected ? 'bg-primary-soft' : i === active ? 'bg-surface-1' : '',
                )}
              >
                {o.icon && (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-field border border-border bg-surface-1">{o.icon}</span>
                )}
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                  <span className="flex min-w-0 max-w-full items-center gap-1.5">
                    <span className={cn('truncate', o.icon ? 'text-xs font-semibold' : 'text-sm', selected ? 'font-medium text-primary' : o.icon ? 'text-foreground-strong' : 'text-foreground-default')}>{o.label}</span>
                    {badgePlacement === 'inline' && badge}
                  </span>
                  {o.description && <span className="max-w-full truncate type-caption">{o.description}</span>}
                </span>
                {badgePlacement === 'end' && badge}
                {o.actionLabel && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-field bg-primary-soft px-2 py-1 text-xs font-medium text-primary">
                    {o.actionLabel} <ArrowRightIcon className="h-3 w-3" />
                  </span>
                )}
                {o.icon && !o.actionLabel && selected && <CheckIcon className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
