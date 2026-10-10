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
          'bg-white rounded-lg',
          padded && 'p-4',
          className,
        )}
        style={{ border: '0.5px solid hsl(var(--border))', boxShadow: '0 1px 4px rgb(0 0 0 / 0.05)' }}
        {...props}
      >
        {children}
      </div>
    )
  },
)

Card.displayName = 'Card'
