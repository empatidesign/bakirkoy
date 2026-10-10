import { useState, type ComponentType, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Modal } from '@/design-system/Modal'

export interface DrilldownCountProps {
  count: number
  title: string
  subtitle?: string
  icon?: ComponentType<{ className?: string }>
  children: ReactNode
  triggerLabel?: ReactNode
  triggerClassName?: string
  zeroContent?: ReactNode
  width?: number
}

export const DrilldownCount = ({
  count,
  title,
  subtitle,
  icon: Icon,
  children,
  triggerLabel,
  triggerClassName,
  zeroContent,
  width = 1180,
}: DrilldownCountProps) => {
  const [open, setOpen] = useState(false)
  const safeCount = typeof count === 'number' && Number.isFinite(count) ? count : 0

  if (safeCount <= 0) {
    return <span className="text-foreground-muted">{zeroContent ?? safeCount}</span>
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Listeyi görüntüle"
        className={cn(
          'inline-flex items-center gap-1 rounded-field px-1.5 py-0.5 font-medium text-primary transition-colors hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/20',
          triggerClassName,
        )}
      >
        {Icon && <Icon className="h-3 w-3" />}
        {triggerLabel ?? safeCount}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        width={width}
        className="max-w-[96vw]"
        bodyClassName="p-4"
        header={
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-field bg-primary-soft">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-foreground-strong">{title}</h3>
              {subtitle && <p className="type-caption">{subtitle}</p>}
            </div>
          </div>
        }
      >
        {open && children}
      </Modal>
    </>
  )
}
