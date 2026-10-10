import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/design-system/Tooltip'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'default' | 'primary' | 'danger' | 'success' | 'warning'
}

const toneClass: Record<NonNullable<IconButtonProps['tone']>, string> = {
  default: 'text-foreground-muted hover:bg-surface-1 hover:text-foreground-strong',
  primary: 'text-primary hover:bg-primary-soft',
  danger: 'text-danger hover:bg-danger-soft',
  success: 'text-success hover:bg-success-soft',
  warning: 'text-warning hover:bg-warning-soft',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ tone = 'default', className, children, title, ...props }, ref) => (
    <Tooltip label={title}>
      <button
        ref={ref}
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-field transition-colors disabled:cursor-not-allowed disabled:opacity-40',
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
