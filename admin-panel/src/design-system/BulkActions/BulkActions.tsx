import type { LucideIcon } from 'lucide-react'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/design-system/Tooltip'

export interface BulkAction {
  key: string
  label: string
  icon: LucideIcon
  tone?: 'default' | 'success' | 'warning' | 'danger'
  disabled?: boolean
  hidden?: boolean
  onClick: () => void
}

export interface BulkActionsProps {
  count: number
  actions: BulkAction[]
  onClear?: () => void
  className?: string
}

const toneClass: Record<NonNullable<BulkAction['tone']>, string> = {
  default: 'text-[hsl(var(--foreground-default))] hover:bg-[hsl(var(--surface-1))]',
  success: 'text-[hsl(var(--success))] hover:bg-[hsl(var(--success-soft))]',
  warning: 'text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning-soft))]',
  danger: 'text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger-soft))]',
}

export const BulkActions = ({ count, actions, onClear, className }: BulkActionsProps) => {
  if (count === 0) return null
  return (
    <div data-bulk-actions role="toolbar" aria-label="Toplu işlemler"
      className={cn('inline-flex h-[var(--control-h-sm)] items-center overflow-hidden rounded-field border border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--primary-soft))]', className)}>
      <span className="flex h-full items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold text-[hsl(var(--primary))]" aria-live="polite">
        {count} seçili
        {onClear && (
          <Tooltip label="Seçimi temizle">
            <button type="button" aria-label="Seçimi temizle" onClick={onClear}
              className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-[hsl(var(--primary)/0.12)]">
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        )}
      </span>
      {actions.filter((a) => !a.hidden).map(({ key, label, icon: Icon, tone = 'default', disabled, onClick }) => (
        <button key={key} type="button" disabled={disabled} onClick={onClick}
          className={cn('flex h-full items-center gap-1.5 whitespace-nowrap border-l border-[hsl(var(--primary)/0.2)] bg-white px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50', toneClass[tone])}>
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}
