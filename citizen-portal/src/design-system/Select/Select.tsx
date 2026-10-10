import { useState, useRef, useLayoutEffect, useEffect, useCallback, Children, isValidElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { cn, inheritToneClass } from '@/lib/utils'

interface Opt { value: string; label: ReactNode; disabled?: boolean }

export interface SelectChangeEvent { target: { value: string } }

export interface SelectProps {
  value?: string | number
  onChange?: (e: SelectChangeEvent) => void
  children?: ReactNode
  disabled?: boolean
  className?: string
  placeholder?: string
  id?: string
  name?: string
}

const collectOptions = (children: ReactNode): Opt[] => {
  const out: Opt[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    const el = child as { type: unknown; props: { value?: unknown; children?: ReactNode; disabled?: boolean } }
    if (el.type === 'option') {
      out.push({ value: String(el.props.value ?? ''), label: el.props.children ?? '', disabled: el.props.disabled })
    } else if (el.props && el.props.children) {
      out.push(...collectOptions(el.props.children))
    }
  })
  return out
}

export const Select = ({ value, onChange, children, disabled, className, placeholder, id, name }: SelectProps) => {
  const options = collectOptions(children)
  const current = value === undefined ? '' : String(value)
  const selected = options.find((o) => o.value === current)

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number; width: number; maxH: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const position = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const MAX = 260
    const gap = 4
    const below = window.innerHeight - r.bottom
    const flipUp = below < MAX && r.top > below
    if (flipUp) {
      setCoords({ bottom: window.innerHeight - r.top + gap, left: r.left, width: r.width, maxH: Math.min(MAX, r.top - 8) })
    } else {
      setCoords({ top: r.bottom + gap, left: r.left, width: r.width, maxH: Math.min(MAX, below - 8) })
    }
  }, [])

  useLayoutEffect(() => { if (open) position() }, [open, position])
  useEffect(() => {
    if (!open) return
    const onScroll = () => position()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
      if (e.key === 'Enter') { e.preventDefault(); const o = options[active]; if (o && !o.disabled) { onChange?.({ target: { value: o.value } }); setOpen(false) } }
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!popRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false)
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
  }, [open, position, options, active, onChange])

  const openMenu = () => {
    if (disabled) return
    const idx = options.findIndex((o) => o.value === current)
    setActive(idx < 0 ? 0 : idx)
    setOpen(true)
  }

  const pick = (o: Opt) => {
    if (o.disabled) return
    onChange?.({ target: { value: o.value } })
    setOpen(false)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={cn(
          'flex h-[var(--control-h)] w-full items-center justify-between gap-2 rounded-field border bg-surface-1 pl-3 pr-2.5 text-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open ? 'border-primary ring-2 ring-primary/20' : 'border-border',
          className,
        )}
      >
        <span className={cn('truncate text-left', selected ? 'text-foreground-strong' : 'text-foreground-subtle')}>
          {selected ? selected.label : (placeholder ?? '')}
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 flex-shrink-0 text-foreground-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && coords && createPortal(
        <div
          ref={popRef}
          data-ds-popover=""
          style={{ position: 'fixed', left: coords.left, width: coords.width, maxHeight: coords.maxH, ...(coords.top != null ? { top: coords.top } : { bottom: coords.bottom }) }}
          className={cn('z-[70] overflow-y-auto rounded-card border border-border bg-surface-0 p-1 shadow-pop', inheritToneClass(triggerRef.current))}
        >
          {options.length === 0 && <div className="px-2 py-2 type-caption">Seçenek yok</div>}
          {options.map((o, i) => {
            const isSel = o.value === current
            return (
              <button
                key={`${o.value}-${i}`}
                type="button"
                disabled={o.disabled}
                onClick={() => pick(o)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-field px-2.5 py-2 text-left text-sm transition-colors',
                  isSel ? 'bg-primary-soft text-primary font-medium' : i === active ? 'bg-surface-1 text-foreground-strong' : 'text-foreground-default',
                  o.disabled && 'cursor-not-allowed opacity-40',
                )}
              >
                <span className="truncate">{o.label}</span>
                {isSel && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
