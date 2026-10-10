import { type ReactNode, type ComponentType, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOverlayDismiss } from '@/lib/useOverlayDismiss'
import { Button } from '@/design-system/Button'

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
  fullscreen?: boolean
  fullscreenDesktopWidth?: number
  hideClose?: boolean
}

export const Modal = ({ open, onClose, title, subtitle, header, footer, children, width = 400, className, bodyClassName, fullscreen, fullscreenDesktopWidth, hideClose }: ModalProps) => {
  useOverlayDismiss(open, onClose)

  if (!open) return null

  const hasHeader = !!header || !!title
  const panelled = hasHeader || !!footer
  const constrainedFullscreen = fullscreen && !!fullscreenDesktopWidth

  return createPortal(
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center', fullscreen ? 'p-0' : 'p-4', constrainedFullscreen && 'lg:p-6')}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 border-border bg-surface-0',
          fullscreen
            ? 'flex h-full w-full flex-col overflow-hidden'
            : 'rounded-panel border shadow-modal',
          panelled && !fullscreen && 'flex max-h-[90vh] flex-col overflow-hidden',
          constrainedFullscreen && 'lg:mx-auto lg:h-[min(90vh,860px)] lg:w-full lg:max-w-[var(--modal-desktop-w)] lg:rounded-panel lg:border lg:shadow-modal',
          className,
        )}
        style={
          fullscreen
            ? constrainedFullscreen
              ? ({ '--modal-desktop-w': `${fullscreenDesktopWidth}px` } as CSSProperties)
              : undefined
            : { width }
        }
      >
        {!hideClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className={cn(
              'absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-field transition-colors',
              header
                ? 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                : 'text-foreground-muted hover:bg-surface-1 hover:text-foreground-strong',
            )}
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}

        {panelled || fullscreen ? (
          <>
            {hasHeader && (
              <div className={cn(
                'flex-shrink-0 border-b border-border px-6 py-4',
                !header && 'pr-14',
              )}>
                {header ?? (
                  <>
                    {/* Hata raporu (docs/hata.md #6.2): uzun kütüphane adları başlıkta
                        sınırsız satıra bölünüp QR ekranını aşağı uzatıyordu. Başlık en fazla
                        iki satır, alt başlık tek satır; taşan kısım "…" ile kısaltılır ve
                        tamamı title özniteliğinde okunabilir kalır. */}
                    <h3 className="line-clamp-2 break-words text-sm font-semibold text-foreground-strong" title={title}>{title}</h3>
                    {subtitle && <p className="mt-0.5 truncate type-caption" title={subtitle}>{subtitle}</p>}
                  </>
                )}
              </div>
            )}

            <div className={cn('flex-1 overflow-y-auto overscroll-contain', bodyClassName)}>
              {children}
            </div>

            {footer && <div className="flex-shrink-0 border-t border-border px-6 py-4">{footer}</div>}
          </>
        ) : (
          children
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
