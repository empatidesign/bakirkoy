import { cn } from '@/lib/utils'
import { useUiStandards } from '@/design-system/UiStandards/UiStandards'

interface TabItem {
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  count?: number
}

interface TabsProps {
  tabs: TabItem[]
  value: string
  onValueChange: (key: string) => void
  action?: React.ReactNode
  variant?: 'default' | 'pill' | 'compact' | 'fitted'
  className?: string
}

export const Tabs = ({ tabs, value, onValueChange, action, variant = 'default', className }: TabsProps) => {
  const pilot = useUiStandards()
  const isPill = variant === 'pill'
  const isCompact = variant === 'compact'
  const isFitted = variant === 'fitted'
  const stretched = isFitted || isCompact

  return (
    <div className={cn(
      'flex shrink-0 flex-wrap items-center justify-between gap-3 min-w-0',
      !isPill && 'bg-white border-b border-border pr-3',
      pilot && 'pilot-detail-tabs',
      className
    )}>
      <div className={cn('flex min-w-0 overflow-x-auto no-scrollbar', stretched && 'flex-1')}>
        {tabs.map((tab) => {
          const active = value === tab.key
          return (
            <button
              key={tab.key}
              data-tab={tab.key}
              onClick={() => onValueChange(tab.key)}
              className={cn(
                'relative shrink-0 font-bold transition-all flex items-center justify-center gap-2',
                isCompact
                  ? 'flex-col h-[52px] min-w-0 flex-1 px-1 text-[10px] border-r border-border last:border-r-0'
                  : isFitted
                    ? 'h-[50px] flex-1 px-4 text-xs border-r border-border last:border-r-0'
                    : isPill 
                      ? 'h-12 px-6 text-[13px] transition-colors rounded-full'
                      : 'h-10 px-4 text-[11px]',
                active
                  ? isPill 
                    ? 'text-blue-600 after:absolute after:bottom-1.5 after:left-6 after:right-6 after:h-[2.5px] after:bg-blue-600 after:rounded-full'
                    : 'text-[hsl(var(--primary))] after:absolute after:bottom-0 after:left-3 after:right-3 after:h-[2px] after:bg-[hsl(var(--primary))] after:rounded-t-full'
                  : isPill 
                    ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-50/50'
                    : 'text-[hsl(var(--foreground-muted))] hover:text-[hsl(var(--foreground-default))] hover:bg-[hsl(var(--surface-0))]'
              )}
            >
              {tab.icon && (
                <tab.icon
                  className={cn(
                    isPill ? 'h-5 w-5' : 'h-4 w-4',
                    'shrink-0',
                    active 
                      ? (isPill ? 'text-blue-600' : 'text-[hsl(var(--primary))]') 
                      : (isPill ? 'text-slate-400' : 'text-[hsl(var(--foreground-subtle))]')
                  )}
                />
              )}
              <span className="max-w-full truncate">{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold',
                  active
                    ? 'bg-blue-600/10 text-blue-600'
                    : 'bg-slate-100 text-slate-500'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}
