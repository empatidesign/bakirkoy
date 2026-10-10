import { cn } from '@/lib/utils'

interface SelectableCardProps {
  selected: boolean
  onClick: () => void
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  disabled?: boolean
  className?: string
}

export const SelectableCard = ({ selected, onClick, icon: Icon, title, description, disabled, className }: SelectableCardProps) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'flex w-full items-start gap-3 rounded-card border px-4 py-3 text-left transition-colors',
      selected ? 'border-primary bg-[hsl(var(--primary-soft))]' : 'border-border bg-surface-1 hover:border-[hsl(var(--primary))]/50',
      disabled && 'cursor-not-allowed opacity-60',
      className,
    )}
  >
    {Icon && (
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-field',
          selected ? 'bg-[hsl(var(--primary))] text-white' : 'bg-surface-2 text-foreground-muted',
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
    )}
    <span className="min-w-0">
      <span className={cn('block text-sm font-medium', selected ? 'text-primary' : 'text-foreground-strong')}>{title}</span>
      {description && <span className="mt-0.5 block type-caption">{description}</span>}
    </span>
  </button>
)
