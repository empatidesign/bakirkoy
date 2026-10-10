import { useRef, type LegacyRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOverlayDismiss } from '@/lib/useOverlayDismiss'
import { useUiStandards } from '@/design-system/UiStandards/UiStandards'
import { DialogHeaderContext } from '@/design-system/AdminFormShell'

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
  bodyRef?: React.RefObject<HTMLDivElement | null>
  hideHeader?: boolean
}

export const Drawer = ({ open, onClose, title, subtitle, icon: Icon, width = 480, footer, children, className, bodyRef, hideHeader }: DrawerProps) => {
  useOverlayDismiss(open, onClose)
  const pilot = useUiStandards()
  const internalRef = useRef<HTMLDivElement>(null)
  const resolvedRef = bodyRef ?? internalRef

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className={cn('relative z-10 flex h-full flex-col overflow-hidden border-l border-border bg-surface-0 shadow-panel', 'pilot-form-dialog', pilot && 'facility-ui-pilot', className)} style={{ width }}>
        {hideHeader ? (
          <button
            onClick={onClose}
            className="pilot-form-close absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-field border border-white/25 bg-white/15 text-white transition-colors hover:bg-white/25"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <div className="pilot-form-header ds-hero flex flex-shrink-0 items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="pilot-form-icon flex h-8 w-8 items-center justify-center rounded-field">
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
              className="pilot-form-close ds-glass-btn flex h-8 w-8 items-center justify-center rounded-field transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div ref={resolvedRef as LegacyRef<HTMLDivElement>} className="pilot-form-body flex-1 overflow-y-auto bg-surface-2 p-5 space-y-5"><DialogHeaderContext.Provider value={!hideHeader}>{children}</DialogHeaderContext.Provider></div>
        {footer && <div className="pilot-form-footer flex-shrink-0 border-t border-border bg-surface-0 px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
