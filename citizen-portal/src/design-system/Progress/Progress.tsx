import { cn } from '@/lib/utils'

export interface ProgressProps {
  value: number
  tone?: 'primary' | 'success' | 'warning' | 'danger'
  className?: string
}

const TONE: Record<NonNullable<ProgressProps['tone']>, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

export const Progress = ({ value, tone = 'primary', className }: ProgressProps) => {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-pill bg-surface-2', className)}>
      <div className={cn('h-full rounded-pill transition-all', TONE[tone])} style={{ width: `${v}%` }} />
    </div>
  )
}
