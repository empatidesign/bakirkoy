import { cn } from '@/lib/utils'
import { BadgeCheckIcon } from 'lucide-react'
import { useUiStandards } from '@/design-system/UiStandards/UiStandards'

interface PageHeaderProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: React.ReactNode
  accentLabel?: string
  gradient?: string
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
  /** @deprecated Breadcrumb artık gösterilmiyor (2026-10-03 kullanıcı isteği). */
  breadcrumb?: React.ReactNode
}

export const PageHeader = ({
  icon: Icon,
  title,
  subtitle,
  accentLabel,
  gradient = 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
  actions,
  children,
  className,
}: PageHeaderProps) => {
  const pilot = useUiStandards()

  if (pilot) {
    return (
      <header className={cn('facility-ui-pilot pilot-page-header', className)}>
        <div className="pilot-header-row">
          <div className="pilot-header-identity">
            <span className="pilot-heading-icon"><Icon aria-hidden="true" /></span>
            <div className="min-w-0">
              <h1 className="pilot-title">{title}</h1>
              {subtitle && <p className="pilot-muted">{subtitle}</p>}
            </div>
          </div>
          {accentLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary">
              <BadgeCheckIcon className="h-3 w-3" /> {accentLabel}
            </span>
          )}
          <div className="pilot-header-slot" />
          {actions && <div className="pilot-header-actions pilot-header-toolbar">{actions}</div>}
        </div>
        {children}
      </header>
    )
  }

  return (
    <div className={cn("relative min-w-0 shrink-0 overflow-hidden px-4 py-3", className)} style={{ background: gradient }}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 blur-xl rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
      
      <div className="relative z-10 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 text-left">
        <div className="flex min-w-0 flex-[1_1_18rem] items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg">
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="break-words text-xs leading-[1.25] font-black text-white tracking-tight drop-shadow-md uppercase">
                {title}
              </h1>
              {accentLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[8px] font-black text-white border border-white/20 backdrop-blur-md uppercase tracking-[0.1em]">
                  <BadgeCheckIcon className="h-2.5 w-2.5" />
                  {accentLabel}
                </span>
              )}
            </div>
            {subtitle && (
              <div className="break-words text-xs font-medium text-white/80 max-w-2xl leading-relaxed">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 [&>*]:max-w-full">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
