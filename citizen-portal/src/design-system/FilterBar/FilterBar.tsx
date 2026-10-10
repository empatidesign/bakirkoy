import React from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/design-system/Card'
import { Field } from '@/design-system/Field'

interface FilterFieldProps {
  label: string
  children: React.ReactNode
  className?: string
}

export const FilterField = ({ label, children, className }: FilterFieldProps) => (
  <Field label={label} className={className}>{children}</Field>
)

interface FilterBarProps {
  children: React.ReactNode
  columns?: 1 | 2 | 3 | 4
  onClear?: () => void
  hasActiveFilters?: boolean
  className?: string
}

export const FilterBar = ({
  children,
  columns = 3,
  onClear,
  hasActiveFilters,
  className,
}: FilterBarProps) => {
  const cols = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[columns]

  return (
    <Card padded className={className}>
      <div className={cn('grid gap-3', cols)}>{children}</div>
      {hasActiveFilters && onClear ? (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <p className="text-[11px] text-foreground-muted">Filtreler aktif</p>
          <button
            onClick={onClear}
            className="text-[11px] font-medium text-danger hover:underline"
          >
            Temizle
          </button>
        </div>
      ) : null}
    </Card>
  )
}
