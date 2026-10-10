import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon, XIcon, SearchIcon, CheckIcon } from 'lucide-react'
import { cn, inheritToneClass } from '@/lib/utils'
import type { SelectOption } from '@/types/common'

export interface MultiSelectProps {
  values: string[]
  onChange: (values: string[]) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  emptyText?: string
  className?: string
  searchable?: boolean
  searchPlaceholder?: string
  showBulkActions?: boolean
  selectAllLabel?: string
  clearAllLabel?: string
  maxVisibleRows?: number
  selectedSummary?: string
  placement?: 'auto' | 'bottom' | 'top'
}

const normalize = (value: string) => value.toLocaleLowerCase('tr-TR')

export const MultiSelect = ({
  values, onChange, options, placeholder = 'Seçiniz...', disabled,
  emptyText = 'Seçenek bulunamadı', className,
  searchable = true, searchPlaceholder = 'Ara...',
  showBulkActions = true, selectAllLabel = 'Tümünü Seç', clearAllLabel = 'Temizle',
  maxVisibleRows = 3,
  selectedSummary,
  placement = 'auto',
}: MultiSelectProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null)

  const position = useCallback(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const popH = 360
    const below = window.innerHeight - r.bottom
    const openUp = placement === 'top' || (placement === 'auto' && below < popH && r.top > below)
    setCoords(openUp
      ? { bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width }
      : { top: r.bottom + 4, left: r.left, width: r.width })
  }, [placement])

  useLayoutEffect(() => { if (open) position() }, [open, position])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('scroll', position, true)
    window.addEventListener('resize', position)
    document.addEventListener('mousedown', handler)
    return () => {
      window.removeEventListener('scroll', position, true)
      window.removeEventListener('resize', position)
      document.removeEventListener('mousedown', handler)
    }
  }, [open, position])

  useEffect(() => { if (!open) setQuery('') }, [open])

  const toggle = (val: string) => {
    if (values.includes(val)) onChange(values.filter((v) => v !== val))
    else onChange([...values, val])
  }

  const remove = (val: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(values.filter((v) => v !== val))
  }

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return options
    return options.filter((o) => normalize(o.label).includes(q))
  }, [options, query])

  const filteredValues = useMemo(() => filtered.map((o) => o.value), [filtered])
  const allFilteredSelected = filteredValues.length > 0 && filteredValues.every((v) => values.includes(v))

  const toggleAllFiltered = () => {
    if (allFilteredSelected) onChange(values.filter((v) => !filteredValues.includes(v)))
    else onChange([...new Set([...values, ...filteredValues])])
  }

  const clearAll = () => onChange([])

  const selected = values.map((v) => ({ value: v, label: options.find((o) => o.value === v)?.label ?? v }))

  return (
    <div ref={ref} className={cn('relative w-full', className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        aria-disabled={disabled}
        onClick={() => { if (!disabled) setOpen((o) => !o) }}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) }
          if (e.key === 'Escape') setOpen(false)
        }}
        className={cn(
          'flex min-h-11 w-full cursor-pointer items-start gap-2 rounded-field border border-border bg-surface-2 px-2 py-1.5 text-left text-sm text-foreground-default transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
          open && 'border-primary ring-2 ring-primary/30',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {selected.length === 0 ? (
          <span className="type-muted flex-1 self-center">{placeholder}</span>
        ) : selectedSummary ? (
          <span className="min-w-0 flex-1 self-center truncate text-sm font-medium text-foreground-default">
            {selectedSummary}
          </span>
        ) : (
          <span
            className="flex min-w-0 flex-1 flex-wrap gap-1 overflow-y-auto"
            style={{ maxHeight: `calc(${maxVisibleRows} * 1.625rem)` }}
          >
            {selected.map((item) => (
              <span
                key={item.value}
                className="inline-flex min-h-6 max-w-full items-center gap-1 rounded-pill bg-primary/10 px-2 py-0.5 text-xs text-primary"
              >
                <span className="truncate">{item.label}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`${item.label} seçimini kaldır`}
                  onClick={(e) => remove(item.value, e)}
                  className="shrink-0 cursor-pointer rounded-full hover:bg-primary/20"
                >
                  <XIcon className="h-3 w-3" />
                </span>
              </span>
            ))}
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1.5 self-center">
          {selected.length > 0 && !selectedSummary && (
            <span className="rounded-pill bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{selected.length}</span>
          )}
          <ChevronDownIcon className={cn('h-4 w-4 text-foreground-muted transition-transform', open && 'rotate-180')} />
        </span>
      </div>

      {open && coords && createPortal(
        <div
          ref={popRef}
          data-ds-popover=""
          style={{ position: 'fixed', top: coords.top, bottom: coords.bottom, left: coords.left, width: coords.width }}
          className={cn('z-[70] overflow-hidden rounded-card border border-border bg-surface-1 shadow-pop', inheritToneClass(ref.current))}
        >
          {searchable && (
            <div className="border-b border-border p-1.5">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-foreground-subtle">
                  <SearchIcon className="h-3.5 w-3.5" />
                </span>
                <input
                  type="text"
                  autoFocus
                  value={query}
                  placeholder={searchPlaceholder}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
                  className="h-10 w-full rounded-field border border-border bg-surface-2 pl-8 pr-2.5 text-sm text-foreground-default placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>
          )}

          {showBulkActions && options.length > 0 && (
            <div className="flex min-h-10 items-center justify-between gap-2 border-b border-border px-2 py-1">
              <span
                role="button"
                tabIndex={0}
                onClick={toggleAllFiltered}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAllFiltered() } }}
                className={cn(
                  'inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-field px-1.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10',
                  filteredValues.length === 0 && 'pointer-events-none opacity-40',
                )}
              >
                <span
                  className={cn(
                    'flex h-3.5 w-3.5 items-center justify-center rounded border border-border transition-colors',
                    allFilteredSelected && 'border-primary bg-primary',
                  )}
                >
                  {allFilteredSelected && <CheckIcon className="h-2.5 w-2.5 text-white" />}
                </span>
                {selectAllLabel}
              </span>
              <span className="flex items-center gap-2">
                <span className="type-caption text-foreground-muted">{values.length}/{options.length}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={clearAll}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clearAll() } }}
                  className={cn(
                    'inline-flex min-h-8 cursor-pointer items-center rounded-field px-1.5 py-0.5 text-xs font-medium text-foreground-muted transition-colors hover:bg-danger-soft hover:text-danger',
                    values.length === 0 && 'pointer-events-none opacity-40',
                  )}
                >
                  {clearAllLabel}
                </span>
              </span>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="px-3 py-3 type-muted text-sm">{emptyText}</div>
          ) : (
            <ul className="max-h-[min(16rem,40vh)] overflow-y-auto py-1">
              {filtered.map((opt) => {
                const isSelected = values.includes(opt.value)
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => toggle(opt.value)}
                      className={cn(
                        'flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-primary/5',
                        isSelected && 'bg-primary/10 text-primary font-medium',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border transition-colors',
                          isSelected && 'border-primary bg-primary',
                        )}
                      >
                        {isSelected && <CheckIcon className="h-2.5 w-2.5 text-white" />}
                      </span>
                      <span className="min-w-0 flex-1">{opt.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
