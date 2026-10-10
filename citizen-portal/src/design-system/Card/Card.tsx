import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean
  accent?: 'blue' | 'green' | 'orange' | 'violet' | 'primary'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padded, accent: _accent, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-surface-0 border border-border rounded-card shadow-card',
          padded && 'p-4',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)

Card.displayName = 'Card'
