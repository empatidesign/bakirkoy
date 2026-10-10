import { cn } from '@/lib/utils'

export interface SegmentOption {
  value: string
  label: React.ReactNode
  description?: string
  icon?: React.ComponentType<{ className?: string }>
}

interface SegmentedControlProps {
  value: string
  onChange: (value: string) => void
  options: SegmentOption[]
  disabled?: boolean
  columns?: 2 | 3 | 4
  className?: string
}

const COL_CLASS: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }

export const SegmentedControl = ({ value, onChange, options, disabled, columns, className }: SegmentedControlProps) => {
  const cols = columns ?? (Math.min(options.length, 3) as 2 | 3)
  return (
    <div className={cn('grid gap-2', COL_CLASS[cols] ?? 'grid-cols-3', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-field border px-3 py-2.5 text-left transition-colors',
              active ? 'border-primary bg-[hsl(var(--primary-soft))]' : 'border-border bg-surface-1 hover:border-[hsl(var(--primary))]/50',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <span className="flex items-center gap-2">
              {o.icon && <o.icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-foreground-muted')} />}
              <span className={cn('text-sm font-medium', active ? 'text-primary' : 'text-foreground-strong')}>{o.label}</span>
            </span>
            {o.description && <span className="type-caption">{o.description}</span>}
          </button>
        )
      })}
    </div>
  )
}
