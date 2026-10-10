import { cn } from '@/lib/utils'

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>

export const Skeleton = ({ className, ...props }: SkeletonProps) => (
  <div className={cn('animate-pulse rounded-md bg-surface-2', className)} {...props} />
)

interface SkeletonRowsProps {
  rows?: number
  className?: string
}

export const SkeletonRows = ({ rows = 8, className }: SkeletonRowsProps) => (
  <div className={cn('w-full', className)}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-11 border-b border-border animate-pulse bg-surface-1" />
    ))}
  </div>
)
