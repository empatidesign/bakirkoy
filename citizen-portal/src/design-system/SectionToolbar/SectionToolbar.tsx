import { cn } from '@/lib/utils'

interface SectionToolbarProps {
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ className?: string }>
  actions?: React.ReactNode
  className?: string
}

export const SectionToolbar = ({ title, subtitle, icon: Icon, actions, className }: SectionToolbarProps) => (
  <div className={cn('flex items-center justify-between gap-3', className)}>
    <div className="flex items-center gap-2.5">
      {Icon && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-field bg-primary-soft">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      )}
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground-strong">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[11px] text-foreground-muted">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
  </div>
)
