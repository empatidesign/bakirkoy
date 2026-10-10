import type React from 'react'
import { cn } from '@/lib/utils'

type BannerTone = 'danger' | 'warning' | 'success' | 'info' | 'primary'

interface BannerProps {
  tone?: BannerTone
  variant?: 'solid' | 'soft'
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  action?: React.ReactNode
  fixed?: boolean
  className?: string
}

const solidByTone: Record<BannerTone, string> = {
  danger: 'bg-danger text-[hsl(var(--danger-foreground))]',
  warning: 'bg-warning text-[hsl(var(--warning-foreground))]',
  success: 'bg-success text-[hsl(var(--success-foreground))]',
  info: 'bg-info text-[hsl(var(--info-foreground))]',
  primary: 'bg-primary text-[hsl(var(--primary-foreground))]',
}

const softByTone: Record<BannerTone, string> = {
  danger: 'bg-danger-soft text-danger border border-danger/20',
  warning: 'bg-warning-soft text-warning border border-warning/20',
  success: 'bg-success-soft text-success border border-success/20',
  info: 'bg-info-soft text-info border border-info/20',
  primary: 'bg-primary-soft text-primary border border-primary/20',
}

export const Banner = ({ tone = 'info', variant = 'solid', icon: Icon, children, action, fixed, className }: BannerProps) => (
  <div
    className={cn(
      'flex items-center justify-between gap-4 px-6 py-3',
      variant === 'solid' ? solidByTone[tone] : softByTone[tone],
      fixed ? 'fixed inset-x-0 top-0 z-[9999] shadow-lg' : 'rounded-card',
      className
    )}
  >
    <div className="flex items-center gap-3">
      {Icon && <Icon className="h-5 w-5 shrink-0" />}
      <div className="text-sm font-medium">{children}</div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
)
