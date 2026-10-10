import type React from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/design-system/Card'

interface StatCardProps {
  label: string
  value: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  accent?: 'blue' | 'green' | 'orange' | 'violet' | 'primary'
  hint?: React.ReactNode
  loading?: boolean
  className?: string
}

const iconBgByAccent: Record<NonNullable<StatCardProps['accent']>, string> = {
  blue: 'bg-accent-blue-soft',
  green: 'bg-accent-green-soft',
  orange: 'bg-accent-orange-soft',
  violet: 'bg-accent-violet-soft',
  primary: 'bg-primary-soft',
}

const iconTextByAccent: Record<NonNullable<StatCardProps['accent']>, string> = {
  blue: 'text-accent-blue',
  green: 'text-accent-green',
  orange: 'text-accent-orange',
  violet: 'text-accent-violet',
  primary: 'text-primary',
}

export const StatCard = ({ label, value, icon: Icon, accent = 'blue', hint, loading, className }: StatCardProps) => {
  return (
    <Card padded className={cn('transition-colors hover:border-[hsl(var(--border))]/80', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="type-stat-label truncate">{label}</p>
          <p className="type-stat-value mt-1.5">{loading ? '—' : value}</p>
          {hint && <p className="type-caption mt-1 truncate">{hint}</p>}
        </div>
        <div className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-card', iconBgByAccent[accent])}>
          <Icon className={cn('h-[18px] w-[18px]', iconTextByAccent[accent])} />
        </div>
      </div>
    </Card>
  )
}
