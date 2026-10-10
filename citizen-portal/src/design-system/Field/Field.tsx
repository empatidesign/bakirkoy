import type { ReactNode, ComponentType } from 'react'
import { LockIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/design-system/Label'
import { Switch } from '@/design-system/Switch'
import { Checkbox } from '@/design-system/Checkbox'
import { Card } from '@/design-system/Card'

export interface FieldProps {
  label?: ReactNode
  required?: boolean
  hint?: ReactNode
  error?: ReactNode
  className?: string
  children: ReactNode
}

export const Field = ({ label, required, hint, error, className, children }: FieldProps) => (
  <div className={cn('space-y-1.5', className)}>
    {label != null && label !== '' && <Label required={required}>{label}</Label>}
    {children}
    {error
      ? <p className="text-xs text-[hsl(var(--danger))]">{error}</p>
      : hint ? <p className="type-caption">{hint}</p> : null}
  </div>
)

export interface FormSectionProps {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ComponentType<{ className?: string }>
  variant?: 'plain' | 'bordered' | 'card'
  full?: boolean
  action?: ReactNode
  className?: string
  children: ReactNode
}

const SectionHeader = ({
  icon: Icon, title, subtitle, action,
}: { icon?: ComponentType<{ className?: string }>; title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex items-start gap-2">
      {Icon && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field bg-[hsl(var(--primary-soft))] text-primary">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div>
        <h3 className="type-section">{title}</h3>
        {subtitle && <p className="type-section-sub">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
)

export const FormSection = ({ title, subtitle, icon, variant = 'bordered', full, action, className, children }: FormSectionProps) => {
  const header = <SectionHeader icon={icon} title={title} subtitle={subtitle} action={action} />
  if (variant === 'card') {
    return (
      <Card padded className={cn(full && 'lg:col-span-2', className)}>
        {header}
        <div className="mt-4 space-y-3">{children}</div>
      </Card>
    )
  }
  if (variant === 'plain') {
    return (
      <section className={cn('space-y-3', className)}>
        {header}
        <div className="space-y-3">{children}</div>
      </section>
    )
  }
  return (
    <section className={cn('space-y-3 border-t border-border pt-5 first:border-t-0 first:pt-0', className)}>
      {header}
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export interface ToggleRowProps {
  label: ReactNode
  description?: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  className?: string
}

export const ToggleRow = ({ label, description, checked, onChange, disabled, className }: ToggleRowProps) => (
  <div className={cn('flex items-center justify-between gap-3 rounded-card border border-border bg-surface-1 px-3 py-2.5', className)}>
    <div className="min-w-0">
      <p className="type-body-strong">{label}</p>
      {description && <p className="type-caption">{description}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
  </div>
)

export interface CheckboxRowProps {
  label: ReactNode
  description?: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  variant?: 'card' | 'inline'
  className?: string
}

export const CheckboxRow = ({ label, description, checked, onChange, disabled, variant = 'card', className }: CheckboxRowProps) => {
  const body = (
    <>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} disabled={disabled} className={variant === 'card' ? 'mt-0.5' : undefined} />
      <div className="min-w-0">
        <p className={variant === 'card' ? 'type-body-strong' : 'type-body'}>{label}</p>
        {description && <p className="type-caption">{description}</p>}
      </div>
    </>
  )
  if (variant === 'inline') {
    return <label className={cn('flex cursor-pointer select-none items-center gap-2', disabled && 'cursor-not-allowed opacity-50', className)}>{body}</label>
  }
  return <label className={cn('flex cursor-pointer items-start gap-2.5 rounded-card border border-border bg-surface-1 p-3', disabled && 'cursor-not-allowed opacity-50', className)}>{body}</label>
}

export const ReadonlyField = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('flex min-h-[var(--control-h)] items-center rounded-field border border-border bg-surface-2 px-3 py-2 type-body text-foreground-strong', className)}>
    {children}
  </div>
)

export const LockedField = ({ value, placeholder, className }: { value?: ReactNode; placeholder?: string; className?: string }) => (
  <div className={cn('flex h-[var(--control-h)] items-center gap-2 rounded-field border border-border bg-surface-2 px-3', className)}>
    <LockIcon className="h-3.5 w-3.5 shrink-0 text-foreground-subtle" />
    <span className="type-body truncate text-foreground-strong">{value || placeholder || '—'}</span>
  </div>
)

export interface DetailRowProps {
  label: ReactNode
  icon?: ComponentType<{ className?: string }>
  layout?: 'stack' | 'inline'
  className?: string
  children: ReactNode
}

export const DetailRow = ({ label, icon: Icon, layout = 'stack', className, children }: DetailRowProps) => {
  if (layout === 'inline') {
    return (
      <div className={cn('flex items-center justify-between gap-3 py-1.5', className)}>
        <span className="flex items-center gap-1.5 type-muted">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</span>
        <span className="type-body-strong break-words text-right">{children}</span>
      </div>
    )
  }
  return (
    <div className={cn('flex items-start gap-3', className)}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" />}
      <div className="min-w-0">
        <p className="type-caption">{label}</p>
        <div className="type-body-strong break-words">{children}</div>
      </div>
    </div>
  )
}
