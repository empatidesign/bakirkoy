import { cn } from '@/lib/utils'

interface SwitchProps extends Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'aria-labelledby' | 'aria-describedby'> {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  id?: string
  className?: string
}

export const Switch = ({ checked, onCheckedChange, disabled, id, className, ...aria }: SwitchProps) => (
  <button
    type="button"
    role="switch"
    id={id}
    aria-checked={checked}
    {...aria}
    disabled={disabled}
    onClick={() => onCheckedChange?.(!checked)}
    className={cn(
      'relative inline-flex h-5 w-9 shrink-0 items-center rounded-pill border transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1',
      checked ? 'border-transparent bg-[hsl(var(--primary))]' : 'border-border bg-[hsl(var(--surface-2))]',
      disabled && 'cursor-not-allowed opacity-50',
      className,
    )}
  >
    <span
      className={cn(
        'inline-block h-4 w-4 transform rounded-full bg-[hsl(var(--surface-0))] shadow-sm transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5',
      )}
    />
  </button>
)
