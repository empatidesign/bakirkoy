import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { FormSection, type FormSectionTone } from '@/design-system'

export const SettingsSection = ({
  icon, title, subtitle, action, tone, children,
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: ReactNode
  tone?: FormSectionTone
  children: ReactNode
}) => (
  <FormSection variant="card" icon={icon} title={title} subtitle={subtitle} action={action} tone={tone}>
    {children}
  </FormSection>
)
