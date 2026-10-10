import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOverlayDismiss } from '@/lib/useOverlayDismiss'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ className?: string }>
  width?: number
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export const Drawer = ({ open, onClose, title, subtitle, icon: Icon, width = 480, footer, children, className }: DrawerProps) => {
  useOverlayDismiss(open, onClose)

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className={cn('relative z-10 flex h-full flex-col overflow-hidden border-l border-border bg-surface-0 shadow-panel', className)} style={{ width }}>
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-field bg-gradient-brand">
                <Icon className="h-4 w-4 text-white" />
              </div>
            )}
            <div>
              <h2 className="text-sm font-semibold text-foreground-strong">{title}</h2>
              {subtitle && <p className="text-[11px] text-foreground-muted">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-field border border-border text-foreground-muted transition-colors hover:bg-surface-1 hover:text-foreground-strong"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
        {footer && <div className="flex-shrink-0 border-t border-border bg-surface-1/40 px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
