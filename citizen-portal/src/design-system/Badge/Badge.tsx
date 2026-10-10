import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const BADGE_BASE = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap'

const badgeVariants = cva(
  BADGE_BASE,
  {
    variants: {
      tone: {
        success: 'bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]',
        warning: 'bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]',
        danger: 'bg-[hsl(var(--danger-soft))] text-[hsl(var(--danger))]',
        info: 'bg-[hsl(var(--info-soft))] text-[hsl(var(--info))]',
        neutral: 'bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground-muted))]',
        primary: 'bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary))]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
)

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode
  className?: string
  color?: string
}

export const Badge = ({ tone, color, children, className }: BadgeProps) => {
  if (color) {
    return (
      <span className={cn(BADGE_BASE, className)} style={{ color, backgroundColor: `${color}26` }}>
        {children}
      </span>
    )
  }
  return (
    <span className={cn(badgeVariants({ tone }), className)}>
      {children}
    </span>
  )
}
