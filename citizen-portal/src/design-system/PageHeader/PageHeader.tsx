import { cn } from '@/lib/utils'

interface PageHeaderProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  title: string
  subtitle?: string
  count?: number | string
  actions?: React.ReactNode
  className?: string
  gradient?: string
  scale?: number
}

export const PageHeader = ({ icon: Icon, title, subtitle, count, actions, className, gradient, scale = 1 }: PageHeaderProps) => {
  const accentColor = gradient
    ? (gradient.match(/#[0-9a-fA-F]{6}/g)?.[0] ?? '#6366F1')
    : '#6366F1'

  return (
    <div
      className={cn('relative flex items-center justify-between px-3 py-2.5 flex-shrink-0 border-b border-border', className)}
      style={{ background: `linear-gradient(135deg, ${accentColor}12 0%, ${accentColor}05 60%, transparent 100%)` }}
    >
      <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full" style={{ background: accentColor }} />

      <div className="flex items-center gap-2 pl-2">
        <div
          className="flex flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${accentColor}18`, height: `${1.5 * scale}rem`, width: `${1.5 * scale}rem` }}
        >
          <Icon style={{ color: accentColor, height: `${1 * scale}rem`, width: `${1 * scale}rem` }} />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-bold text-foreground-strong leading-tight" style={{ fontSize: `${11 * scale}px` }}>{title}</h1>
            {count !== undefined && count !== null && (
              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 font-semibold"
                style={{ background: `${accentColor}15`, color: accentColor, fontSize: `${8 * scale}px` }}>
                {count}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-0.5 text-foreground-subtle" style={{ fontSize: `${9 * scale}px` }}>{subtitle}</p>}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
