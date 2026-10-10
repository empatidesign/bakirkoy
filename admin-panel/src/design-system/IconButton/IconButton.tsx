import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/design-system/Tooltip'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'default' | 'primary' | 'danger' | 'success' | 'warning'
  size?: 'sm' | 'md'
}

const toneClass: Record<NonNullable<IconButtonProps['tone']>, string> = {
  default: 'text-[hsl(var(--foreground-subtle))] hover:bg-[hsl(var(--surface-0))] hover:text-[hsl(var(--foreground-strong))]',
  primary: 'text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.08)]',
  danger:  'text-[hsl(var(--danger))]  hover:bg-[hsl(var(--danger-soft))]',
  success: 'text-[hsl(var(--success))] hover:bg-[hsl(var(--success-soft))]',
  warning: 'text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning-soft))]',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ tone = 'default', size = 'md', className, children, title, ...props }, ref) => (
    <Tooltip label={title}>
      <button
        ref={ref}
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'flex items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40',
          size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
          toneClass[tone],
          className
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  )
)

IconButton.displayName = 'IconButton'
