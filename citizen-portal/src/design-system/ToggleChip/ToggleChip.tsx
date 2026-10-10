import { CheckIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToggleChipTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface ToggleChipProps {
  active: boolean
  onClick: () => void
  disabled?: boolean
  tone?: ToggleChipTone
  color?: string
  children: React.ReactNode
  className?: string
}

const activeToneClass: Record<ToggleChipTone, string> = {
  primary: 'border-primary/40 bg-primary-soft text-primary',
  success: 'border-success/40 bg-success-soft text-success',
  warning: 'border-warning/40 bg-warning-soft text-warning',
  danger: 'border-danger/40 bg-danger-soft text-danger',
  info: 'border-info/40 bg-info-soft text-info',
  neutral: 'border-border bg-surface-2 text-foreground-muted',
}

const inactiveClass = 'border-border bg-surface-1 text-foreground-subtle hover:border-primary/40 hover:text-foreground-muted'

export const ToggleChip = ({ active, onClick, disabled, tone = 'primary', color, children, className }: ToggleChipProps) => {
  const useColor = !!color && active
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={useColor ? { color, backgroundColor: `${color}26`, borderColor: `${color}59` } : undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-field border px-2 py-1 text-[11px] font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        active ? (color ? '' : activeToneClass[tone]) : inactiveClass,
        className,
      )}
    >
      {active ? <CheckIcon className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
      {children}
    </button>
  )
}
