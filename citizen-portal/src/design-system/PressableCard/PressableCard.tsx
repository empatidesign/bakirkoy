import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type PressableCardProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export const PressableCard = forwardRef<HTMLButtonElement, PressableCardProps>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded-card border border-border bg-surface-0 p-3.5 text-left shadow-card transition-colors',
        'hover:border-[hsl(var(--primary))]/40 hover:bg-surface-1 active:scale-[0.99]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
)

PressableCard.displayName = 'PressableCard'
