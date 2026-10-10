import { Field } from '@/design-system/Field/Field'
import { useUiStandards } from '@/design-system/UiStandards/UiStandards'
import React, { useState } from 'react'
import { SlidersHorizontalIcon, ChevronDownIcon, XIcon, RotateCcwIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/design-system/Button'
import { IconButton } from '@/design-system/IconButton/IconButton'

const countFields = (nodes: React.ReactNode): number =>
  React.Children.toArray(nodes).reduce<number>((n, c) =>
    n + (React.isValidElement<{ children?: React.ReactNode }>(c) && c.type === React.Fragment ? countFields(c.props.children) : 1), 0)

interface FilterFieldProps {
  label: string
  children: React.ReactNode
  className?: string
}

export const FilterField = ({ label, children, className }: FilterFieldProps) => {
  const pilot = useUiStandards()
  if (pilot) return <Field label={label} className={className}>{children}</Field>
  return (
  <div className={cn('flex flex-col gap-1', className)}>
    <span className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--foreground-subtle))]">
      {label}
    </span>
    {children}
  </div>
)

}

interface FilterBarProps {
  children?: React.ReactNode
  search?: React.ReactNode
  searchLabel?: string
  columns?: 1 | 2 | 3 | 4 | 5 | 6
  filterCount?: number
  onClear?: () => void
  hasActiveFilters?: boolean
  defaultOpen?: boolean
  className?: string
}

const colsClass = (columns: 1 | 2 | 3 | 4 | 5 | 6) =>
  ({ 1: 'grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4', 5: 'sm:grid-cols-3 lg:grid-cols-5', 6: 'sm:grid-cols-3 lg:grid-cols-6' }[columns])

export const FilterBar = ({
  children,
  search,
  searchLabel = 'Ara',
  columns = 3,
  filterCount,
  onClear,
  hasActiveFilters,
  defaultOpen,
  className,
}: FilterBarProps) => {
  const hasFilters = React.Children.count(children) > 0
  const count = filterCount ?? 0
  const pilot = useUiStandards()

  if (pilot && search) {
    const fields = countFields(children)
    const tail = onClear ? ' auto' : ''
    const cols = fields > 5
      ? `repeat(${Math.ceil((fields + 2) / 2)},minmax(0,1fr))`
      : fields === 0 ? `minmax(0,1fr)${tail}` : `minmax(0,1.6fr) repeat(${fields},minmax(0,1fr))${tail}`
    return (
      <div className={cn('pilot-filters rounded-lg border border-border bg-white p-3', className)}>
        <div className="pilot-filter-row" style={{ '--pilot-filter-cols': cols } as React.CSSProperties}>
          <Field label={searchLabel}>{search}</Field>
          {children}
          {onClear && <IconButton title="Filtreleri sıfırla" disabled={!hasActiveFilters} onClick={onClear}><RotateCcwIcon className="h-4 w-4" /></IconButton>}
        </div>
      </div>
    )
  }

  if (!search) {
    return (
      <div
        className={cn('rounded-lg bg-white p-[15px]', className)}
        style={{ border: '0.5px solid hsl(var(--border))', boxShadow: '0 1px 4px rgb(0 0 0 / 0.05)' }}
      >
        <div className={cn('grid gap-3 grid-cols-1', colsClass(columns))}>{children}</div>
        {hasActiveFilters && onClear && (
          <div className="mt-3 flex items-center justify-between pt-3" style={{ borderTop: '0.5px solid hsl(var(--border))' }}>
            <p className="text-[11px] text-[hsl(var(--foreground-muted))]">
              <span className="font-semibold text-[hsl(var(--primary))]">{count}</span> filtre aktif
            </p>
            <Button variant="ghost" size="sm" onClick={onClear}>
              <XIcon className="h-3.5 w-3.5" /> Temizle
            </Button>
          </div>
        )}
      </div>
    )
  }

  return <FilterBarCollapsible {...{ children, search, columns, count, onClear, hasActiveFilters, defaultOpen, className, hasFilters }} />
}

const FilterBarCollapsible = ({
  children, search, columns, count, onClear, hasActiveFilters, defaultOpen, className, hasFilters,
}: { columns: 1 | 2 | 3 | 4 | 5 | 6 } & {
  children?: React.ReactNode
  search?: React.ReactNode
  count: number
  onClear?: () => void
  hasActiveFilters?: boolean
  defaultOpen?: boolean
  className?: string
  hasFilters: boolean
}) => {
  const [open, setOpen] = useState(defaultOpen ?? count > 0)

  return (
    <div
      className={cn('rounded-lg bg-white p-[15px]', className)}
      style={{ border: '0.5px solid hsl(var(--border))', boxShadow: '0 1px 4px rgb(0 0 0 / 0.05)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[240px] flex-1">{search}</div>
        {hasFilters && (
          <button
            onClick={() => setOpen(o => !o)}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-colors',
              count > 0
                ? 'bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]'
                : 'text-[hsl(var(--foreground-muted))] hover:bg-[hsl(var(--surface-0))] hover:text-[hsl(var(--foreground-strong))]'
            )}
            style={{ border: `0.5px solid ${count > 0 ? 'hsl(var(--primary)/0.3)' : 'hsl(var(--border))'}` }}
          >
            <SlidersHorizontalIcon className="h-3.5 w-3.5" />
            Filtreler
            {count > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--primary))] px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
            <ChevronDownIcon className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
          </button>
        )}
        {hasActiveFilters && onClear && (
          <button
            onClick={onClear}
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-[hsl(var(--foreground-muted))] transition-colors hover:text-[hsl(var(--danger))]"
          >
            <XIcon className="h-3.5 w-3.5" /> Temizle
          </button>
        )}
      </div>
      {hasFilters && open && (
        <div className="mt-3 pt-3" style={{ borderTop: '0.5px solid hsl(var(--border))' }}>
          <div className={cn('grid gap-3 grid-cols-1', colsClass(columns))}>{children}</div>
        </div>
      )}
    </div>
  )
}
