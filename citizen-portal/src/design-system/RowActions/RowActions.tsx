import { EyeIcon, PencilIcon, Trash2Icon, PowerIcon, PowerOffIcon } from 'lucide-react'
import { IconButton } from '@/design-system/IconButton'

export interface RowActionsProps {
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
}: RowActionsProps) => (
  <div className="flex items-center justify-center gap-1.5">
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
        <IconButton tone="warning" onClick={onToggleStatus} title={deactivateTitle}>
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
  </div>
)
