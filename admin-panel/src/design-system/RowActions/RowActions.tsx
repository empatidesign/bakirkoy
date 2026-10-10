import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EyeIcon, PencilIcon, Trash2Icon, PowerIcon, PowerOffIcon, EllipsisVerticalIcon } from 'lucide-react'
import { IconButton } from '@/design-system/IconButton'
import { useOverlayDismiss } from '@/lib/useOverlayDismiss'

export interface RowActionMenuItem {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick?: () => void
  tone?: 'default' | 'primary' | 'info' | 'warning' | 'danger'
  disabled?: boolean
  divider?: boolean
}

const MENU_TONE: Record<NonNullable<RowActionMenuItem['tone']>, { item: string; icon: string }> = {
  default: { item: 'text-foreground-default hover:bg-surface-2', icon: 'text-foreground-muted' },
  primary: { item: 'font-semibold text-primary hover:bg-primary-soft', icon: 'text-primary' },
  info: { item: 'text-foreground-default hover:bg-surface-2', icon: 'text-accent-violet' },
  warning: { item: 'text-foreground-default hover:bg-surface-2', icon: 'text-warning' },
  danger: { item: 'text-danger hover:bg-danger-soft', icon: 'text-danger' },
}

export interface RowActionsProps {
  menu?: RowActionMenuItem[]
  menuTitle?: string

  onView?: () => void
  viewTitle?: string

  onEdit?: () => void
  editTitle?: string

  onToggleStatus?: () => void
  isActive?: boolean
  canToggle?: boolean
  activateTitle?: string
  deactivateTitle?: string

  onDelete?: () => void
  canDelete?: boolean
  deleteTitle?: string

  extra?: React.ReactNode
  collapse?: boolean
}

export const RowActions = ({
  onView,
  viewTitle = 'Görüntüle',
  onEdit,
  editTitle = 'Düzenle',
  onToggleStatus,
  isActive = true,
  canToggle = true,
  activateTitle = 'Aktif Et',
  deactivateTitle = 'Pasife Al',
  onDelete,
  canDelete = true,
  deleteTitle = 'Sil',
  extra,
  collapse = false,
  menu,
  menuTitle = 'İşlemler',
}: RowActionsProps) => {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, right: 0 })
  useOverlayDismiss(open, () => setOpen(false))

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }
    const openedAt = triggerRef.current?.getBoundingClientRect().top
    const closeOnScroll = () => {
      if (triggerRef.current?.getBoundingClientRect().top !== openedAt) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    window.addEventListener('scroll', closeOnScroll, true)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      window.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!(collapse || menu) || !open || !panelRef.current || !triggerRef.current) return
    const panelRect = panelRef.current.getBoundingClientRect()
    const triggerRect = triggerRef.current.getBoundingClientRect()
    if (panelRect.bottom > window.innerHeight) {
      const flippedTop = Math.max(8, triggerRect.top - panelRect.height - 6)
      setPosition((p) => (p.top === flippedTop ? p : { ...p, top: flippedTop }))
    }
  }, [collapse, menu, open])

  const actions = (
    <>
    {extra}
    {onView && (
      <IconButton tone="default" onClick={onView} title={viewTitle}>
        <EyeIcon className="h-4 w-4" />
      </IconButton>
    )}
    {onEdit && (
      <IconButton tone="primary" onClick={onEdit} title={editTitle}>
        <PencilIcon className="h-4 w-4" />
      </IconButton>
    )}
    {onToggleStatus && canToggle && (
      isActive ? (
        <IconButton tone="danger" onClick={onToggleStatus} title={deactivateTitle}>
          <PowerOffIcon className="h-4 w-4" />
        </IconButton>
      ) : (
        <IconButton tone="success" onClick={onToggleStatus} title={activateTitle}>
          <PowerIcon className="h-4 w-4" />
        </IconButton>
      )
    )}
    {onDelete && canDelete && (
      <IconButton tone="danger" onClick={onDelete} title={deleteTitle}>
        <Trash2Icon className="h-4 w-4" />
      </IconButton>
    )}
    </>
  )

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) })
    }
    setOpen((value) => !value)
  }

  if (menu) {
    return (
      <div className="flex items-center justify-end gap-1">
        {extra}
        <IconButton ref={triggerRef} tone="default" title={menuTitle} aria-label={menuTitle} aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
          <EllipsisVerticalIcon className="h-4 w-4" />
        </IconButton>
        {open && createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ position: 'fixed', top: position.top, right: position.right }}
            className="z-[80] w-52 rounded-card border border-border bg-surface-1 py-1 text-xs shadow-pop"
          >
            {menu.map((item, i) => item.divider ? (
              <div key={`d${i}`} role="separator" className="my-1 border-t border-border" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => { setOpen(false); item.onClick?.() }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${MENU_TONE[item.tone ?? 'default'].item}`}
              >
                {item.icon && <item.icon className={`h-3.5 w-3.5 shrink-0 ${MENU_TONE[item.tone ?? 'default'].icon}`} />}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
      </div>
    )
  }

  if (collapse) {

    return (
      <div className="flex items-center justify-end">
        <IconButton ref={triggerRef} tone="default" title="Tüm işlemleri göster" onClick={toggle} aria-expanded={open}>
          <EllipsisVerticalIcon className="h-4 w-4" />
        </IconButton>
        {open && createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: position.top, right: position.right }}
            className="z-[80] min-w-[220px] rounded-card border border-border bg-surface-1 p-2 shadow-pop"
          >
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle">Tüm işlemler</p>
            <div className="flex max-w-[320px] flex-wrap items-center justify-end gap-1.5" onClick={() => setOpen(false)}>
              {actions}
            </div>
          </div>,
          document.body,
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {actions}
    </div>
  )
}
