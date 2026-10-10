import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const BADGE_BASE = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap leading-snug'

const badgeVariants = cva(BADGE_BASE, {
  variants: {
    tone: {
      success: 'bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]',
      warning: 'bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]',
      danger:  'bg-[hsl(var(--danger-soft))]  text-[hsl(var(--danger))]',
      info:    'bg-[hsl(var(--info-soft))]    text-[hsl(var(--info))]',
      neutral: 'bg-[hsl(var(--surface-2))]    text-[hsl(var(--foreground-muted))]',
      primary: 'bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary))]',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode
  className?: string
  color?: string
  dot?: boolean
}

export const Badge = ({ tone, color, dot, children, className }: BadgeProps) => {
  if (color) {
    return (
      <span className={cn(BADGE_BASE, className)} style={{ color, backgroundColor: `${color}1a` }}>
        {dot && <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />}
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
