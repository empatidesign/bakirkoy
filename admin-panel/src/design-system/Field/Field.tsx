import { useId } from 'react'
import { FieldControlContext, useUiStandards } from '@/design-system/UiStandards/UiStandards'
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

export const Field = ({ label, required, hint, error, className, children }: FieldProps) => {
  const id = useId()
  const pilot = useUiStandards()
  return <div className={cn('space-y-1.5', className)}>
    {label != null && label !== '' && <Label id={pilot ? `${id}-label` : undefined} htmlFor={pilot ? id : undefined} required={required}>{label}</Label>}
    <FieldControlContext.Provider value={pilot ? { id, 'aria-labelledby': label ? `${id}-label` : undefined, 'aria-describedby': hint || error ? `${id}-hint` : undefined, 'aria-invalid': !!error, 'aria-required': required } : {}}>
      {children}
    </FieldControlContext.Provider>
    {error ? <p id={pilot ? `${id}-hint` : undefined} role="alert" className="text-xs text-[hsl(var(--danger))]">{error}</p>
      : hint ? <p id={pilot ? `${id}-hint` : undefined} className="type-caption">{hint}</p> : null}
  </div>
}

export interface FormSectionProps {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ComponentType<{ className?: string }>
  variant?: 'plain' | 'bordered' | 'card'
  tone?: FormSectionTone
  full?: boolean
  action?: ReactNode
  className?: string
  children: ReactNode
}

export type FormSectionTone = 'blue' | 'green' | 'orange' | 'violet' | 'pink' | 'info' | 'success' | 'warning' | 'danger'

const SECTION_TONES: Record<FormSectionTone, { header: string; icon: string; border: string }> = {
  blue: { header: 'bg-[hsl(var(--accent-blue-soft))]', icon: 'bg-[hsl(var(--accent-blue))] text-white', border: 'border-l-4 border-l-[hsl(var(--accent-blue))]' },
  green: { header: 'bg-[hsl(var(--accent-green-soft))]', icon: 'bg-[hsl(var(--accent-green))] text-white', border: 'border-l-4 border-l-[hsl(var(--accent-green))]' },
  orange: { header: 'bg-[hsl(var(--accent-orange-soft))]', icon: 'bg-[hsl(var(--accent-orange))] text-white', border: 'border-l-4 border-l-[hsl(var(--accent-orange))]' },
  violet: { header: 'bg-[hsl(var(--accent-violet-soft))]', icon: 'bg-[hsl(var(--accent-violet))] text-white', border: 'border-l-4 border-l-[hsl(var(--accent-violet))]' },
  pink: { header: 'bg-[hsl(var(--accent-pink-soft))]', icon: 'bg-[hsl(var(--accent-pink))] text-white', border: 'border-l-4 border-l-[hsl(var(--accent-pink))]' },
  info: { header: 'bg-[hsl(var(--info-soft))]', icon: 'bg-[hsl(var(--info))] text-white', border: 'border-l-4 border-l-[hsl(var(--info))]' },
  success: { header: 'bg-[hsl(var(--success-soft))]', icon: 'bg-[hsl(var(--success))] text-white', border: 'border-l-4 border-l-[hsl(var(--success))]' },
  warning: { header: 'bg-[hsl(var(--warning-soft))]', icon: 'bg-[hsl(var(--warning))] text-white', border: 'border-l-4 border-l-[hsl(var(--warning))]' },
  danger: { header: 'bg-[hsl(var(--danger-soft))]', icon: 'bg-[hsl(var(--danger))] text-white', border: 'border-l-4 border-l-[hsl(var(--danger))]' },
}

const SectionHeader = ({
  icon: Icon, title, subtitle, action, tone,
}: { icon?: ComponentType<{ className?: string }>; title: ReactNode; subtitle?: ReactNode; action?: ReactNode; tone?: FormSectionTone }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex items-start gap-2">
      {Icon && (
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-field', tone ? SECTION_TONES[tone].icon : 'bg-[hsl(var(--primary-soft))] text-primary')}>
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

export const FormSection = ({ title, subtitle, icon, variant = 'bordered', tone, full, action, className, children }: FormSectionProps) => {
  const header = <SectionHeader icon={icon} title={title} subtitle={subtitle} action={action} tone={tone} />
  if (variant === 'card') {
    return (
      <Card data-form-section="card" data-tone={tone} className={cn('overflow-hidden', tone && SECTION_TONES[tone].border, full && 'lg:col-span-2', className)}>
        <div className={cn('px-4 py-3 border-b border-[hsl(var(--border))]', tone && SECTION_TONES[tone].header)}>{header}</div>
        <div className="p-4 space-y-3">{children}</div>
      </Card>
    )
  }
  if (variant === 'plain') {
    return (
      <section data-form-section="plain" className={cn('space-y-3', className)}>
        {header}
        <div className="space-y-3">{children}</div>
      </section>
    )
  }
  return (
    <section data-form-section="bordered" className={cn('space-y-3 border-t border-border pt-5 first:border-t-0 first:pt-0', className)}>
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

export const ToggleRow = ({ label, description, checked, onChange, disabled, className }: ToggleRowProps) => {
  const id = useId()
  return (
  <div data-toggle-row title={typeof description === 'string' ? description : undefined} className={cn(
    'flex items-center justify-between gap-3 rounded-card border px-3 py-2.5 transition-colors',
    checked
      ? 'border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.12)]'
      : 'border-border bg-surface-0',
    className,
  )}>
    <div className="min-w-0">
      <label id={`${id}-label`} htmlFor={id} className="type-body-strong cursor-pointer">{label}</label>
      {description && <p id={`${id}-description`} className="type-caption">{description}</p>}
    </div>
    <Switch id={id} aria-labelledby={`${id}-label`} aria-describedby={description ? `${id}-description` : undefined} checked={checked} onCheckedChange={onChange} disabled={disabled} />
  </div>
)
}

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
