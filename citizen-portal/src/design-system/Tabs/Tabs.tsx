import { cn } from '@/lib/utils'

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
  className?: string
}

export const Tabs = ({ tabs, value, onValueChange, action, className }: TabsProps) => {
  return (
    <div className={cn('flex flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-white pr-3', className)}>
      <div className="flex min-w-0 overflow-x-auto no-scrollbar px-3">
        {tabs.map((tab) => {
          const active = value === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => onValueChange(tab.key)}
              className={cn(
                'relative flex h-11 flex-shrink-0 items-center gap-1.5 px-3 text-[12px] font-semibold transition-colors',
                active
                  ? 'text-primary after:absolute after:bottom-0 after:left-2 after:right-2 after:h-[2px] after:bg-primary after:rounded-t-lg'
                  : 'text-foreground-muted hover:bg-surface-1 hover:text-foreground-default'
              )}
            >
              {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
              {tab.label}
              {typeof tab.count === 'number' && (
                <span className="rounded-pill bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
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
