import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-panel bg-surface-1">
        <Icon className="h-8 w-8 text-foreground-subtle" />
      </div>
      <p className="type-section">{title}</p>
      {description && <p className="mt-1 type-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
