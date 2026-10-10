import type { ComponentType, ReactNode } from 'react'

interface InfoTileProps {
  icon: ComponentType<{ className?: string }>
  value: ReactNode
  label?: ReactNode
}

export const InfoTile = ({ icon: Icon, value, label }: InfoTileProps) => (
  <div className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5">
    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
    <div className="min-w-0">
      <p className="type-caption truncate font-medium text-foreground">{value}</p>
      {label != null && label !== '' && <p className="type-caption truncate text-foreground-muted">{label}</p>}
    </div>
  </div>
)
