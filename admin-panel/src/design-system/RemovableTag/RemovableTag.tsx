import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface RemovableTagProps {
  label: string
  onRemove: () => void
  disabled?: boolean
  className?: string
}

export const RemovableTag = ({ label, onRemove, disabled, className }: RemovableTagProps) => (
  <div className={cn('flex items-center justify-between gap-2 rounded-field border border-border bg-surface-1 px-3 py-2.5', className)}>
    <span className="type-body truncate">{label}</span>
    <button
      type="button"
      onClick={onRemove}
      disabled={disabled}
      aria-label="Kaldır"
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-field text-foreground-subtle transition-colors hover:bg-[hsl(var(--danger-soft))] hover:text-[hsl(var(--danger))] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <XIcon className="h-4 w-4" />
    </button>
  </div>
)
