import { type ReactNode, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOverlayDismiss } from '@/lib/useOverlayDismiss'
import { Button } from '@/design-system/Button'
import { useUiStandards } from '@/design-system/UiStandards/UiStandards'
import { DialogHeaderContext } from '@/design-system/AdminFormShell'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  width?: number
  className?: string
  bodyClassName?: string
  hideCloseButton?: boolean
}

export const Modal = ({ open, onClose, title, subtitle, header, footer, children, width = 400, className, bodyClassName, hideCloseButton }: ModalProps) => {
  useOverlayDismiss(open, onClose)
  const pilot = useUiStandards()

  if (!open) return null

  const hasHeader = !!header || !!title
  const panelled = hasHeader || !!footer

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 rounded-panel border border-border bg-surface-0 shadow-modal',
          panelled && 'flex max-h-[90vh] flex-col overflow-hidden',
          'pilot-form-dialog',
          pilot && 'facility-ui-pilot',
          className,
        )}
        style={{ width }}
      >
        {!hideCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className={cn(
              'pilot-form-close absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-field transition-colors',
              hasHeader ? 'ds-glass-btn' : 'text-foreground-muted hover:bg-surface-1 hover:text-foreground-strong',
            )}
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}

        {panelled ? (
          <>
            {hasHeader && (
              <div className={cn(
                'pilot-form-header ds-hero flex-shrink-0 px-6 py-4',
                !header && 'pr-14',
              )}>
                {header ?? (
                  <>
                    <h3 className="text-sm font-semibold text-foreground-strong">{title}</h3>
                    {subtitle && <p className="mt-0.5 type-caption">{subtitle}</p>}
                  </>
                )}
              </div>
            )}

            <div className={cn('pilot-form-body flex-1 overflow-y-auto overscroll-contain bg-surface-2', !footer && 'rounded-b-panel', bodyClassName)}>
              <DialogHeaderContext.Provider value={hasHeader}>{children}</DialogHeaderContext.Provider>
            </div>

            {footer && <div className="pilot-form-footer flex-shrink-0 border-t border-border bg-surface-0 px-6 py-4 rounded-b-panel">{footer}</div>}
          </>
        ) : (
          <DialogHeaderContext.Provider value={false}>{children}</DialogHeaderContext.Provider>
        )}
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  icon?: ComponentType<{ className?: string }>
  loading?: boolean
  className?: string
}

export const ConfirmModal = ({ open, onClose, onConfirm, title, description, confirmLabel = 'Onayla', cancelLabel = 'İptal', tone = 'danger', icon: Icon, loading, className }: ConfirmModalProps) => {
  return (
    <Modal open={open} onClose={onClose} className={className}>
      <div className="p-6">
        <div className="mb-5 flex items-start gap-4 pr-8">
          {Icon && (
            <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-field', tone === 'danger' ? 'bg-danger-soft' : 'bg-primary-soft')}>
              <Icon className={cn('h-5 w-5', tone === 'danger' ? 'text-danger' : 'text-primary')} />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-foreground-strong">{title}</h3>
            {description && <p className="mt-1 type-muted">{description}</p>}
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} className="flex-1" isLoading={loading} disabled={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
