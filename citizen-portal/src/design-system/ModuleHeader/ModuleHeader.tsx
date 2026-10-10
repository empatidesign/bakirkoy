
export interface ModuleHeaderTab {
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  count?: number
}

interface ModuleHeaderProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  gradient: string
  tabs?: ModuleHeaderTab[]
  value?: string
  onValueChange?: (key: string) => void
  actions?: React.ReactNode
}

export const ModuleHeader = ({ icon: Icon, title, subtitle, gradient, tabs, value, onValueChange, actions }: ModuleHeaderProps) => {
  const colors = gradient.match(/#[0-9a-fA-F]{6}/g)
  const activeColor = colors?.[colors.length - 1] ?? '#0E3054'

  return (
    <div className="flex-shrink-0">
    <div className="relative overflow-hidden px-5 py-5" style={{ background: gradient }}>
      <div className="relative flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[16px] font-black text-white leading-none md:text-[18px]" style={{ letterSpacing: '-0.02em' }}>{title}</h1>
          {subtitle && <p className="mt-0.5 text-[10px] text-white/40">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
      </div>

    </div>

      {tabs && tabs.length > 0 && (
        <div className="flex items-stretch gap-1 border-b border-border bg-card px-3">
          {tabs.map(({ key, label, icon: TabIcon, count }) => {
            const active = value === key
            return (
              <button
                key={key}
                onClick={() => onValueChange?.(key)}
                className={`relative flex items-center gap-1.5 px-3 py-3 text-[13px] transition-colors duration-150 ${
                  active ? 'font-semibold' : 'font-medium text-foreground-muted hover:text-foreground-strong'
                }`}
                style={active ? { color: activeColor } : undefined}
              >
                {TabIcon && <TabIcon className="h-4 w-4 flex-shrink-0" />}
                <span className="truncate">{label}</span>
                {typeof count === 'number' && (
                  <span
                    className={`ml-0.5 rounded-full px-1.5 py-px text-[11px] font-semibold ${
                      active ? '' : 'bg-surface-2 text-foreground-muted'
                    }`}
                    style={active ? { color: activeColor, backgroundColor: `${activeColor}14` } : undefined}
                  >
                    {count}
                  </span>
                )}
                {active && (
                  <span
                    className="absolute inset-x-2 bottom-0 h-0.5 rounded-full"
                    style={{ backgroundColor: activeColor }}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
