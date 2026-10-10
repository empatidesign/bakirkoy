import { createContext, useContext, type ComponentType, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AdminFormShellProps {
  icon: ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  badge?: string
  children: ReactNode
  /** Artık etkisiz (2026-10-04): tüm başlıklar tek tema tonu (.ds-hero). Çağıranlar bozulmasın diye duruyor. */
  tone?: 'blue' | 'green' | 'violet' | 'orange'
  className?: string
}

export const DialogHeaderContext = createContext(false)

export const AdminFormShell = ({
  icon: Icon,
  title,
  subtitle,
  badge,
  children,
  className,
}: AdminFormShellProps) => {
  const inHeaderedDialog = useContext(DialogHeaderContext)
  if (inHeaderedDialog) {
    return (
      <div className={cn('-m-5 flex min-h-full flex-col', className)}>
        <div className="space-y-[15px] p-[15px]">{children}</div>
      </div>
    )
  }
  return (
  <div className={cn('-m-5 flex min-h-full flex-col', className)}>
    <div className="relative overflow-hidden ds-hero">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
      <div className="absolute bottom-0 left-8 h-20 w-20 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
      <div className="relative flex items-center gap-4 px-8 py-7">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg shadow-lg" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold text-white">{title}</p>
            {badge && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.2)', color: '#e0e7ff' }}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-0.5 text-[12px] text-white/70">{subtitle}</p>}
        </div>
      </div>
    </div>

    <div className="space-y-[15px] p-[15px]">
      {children}
    </div>
  </div>
  )
}
