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
  allowZero?: boolean
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
  allowZero = false,
  width = 1180,
}: DrilldownCountProps) => {
  const [open, setOpen] = useState(false)
  const safeCount = typeof count === 'number' && Number.isFinite(count) ? count : 0

  if (safeCount <= 0 && !allowZero) {
    return <span className="text-foreground-muted">{zeroContent ?? safeCount.toLocaleString('tr-TR')}</span>
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
        {triggerLabel ?? safeCount.toLocaleString('tr-TR')}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        width={width}
        className="max-w-[96vw]"
        bodyClassName="bg-surface-2 p-[15px]"
        header={
          <div className="flex items-center gap-3 pr-10">
            {Icon && (
              <div className="pilot-form-icon flex h-10 w-10 flex-shrink-0 items-center justify-center">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="truncate">{title}</h3>
              {subtitle && <p className="mt-0.5 type-caption">{subtitle}</p>}
            </div>
          </div>
        }
      >
        <div className="[&_[data-table-body]]:min-h-0">
          {open && children}
        </div>
      </Modal>
    </>
  )
}
