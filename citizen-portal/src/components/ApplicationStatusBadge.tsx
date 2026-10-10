import { Badge } from '@/design-system'
import { statusMeta } from '@/types/applicationStatus'

export const ApplicationStatusBadge = ({ status, className }: { status: string; className?: string }) => {
  const { label, tone } = statusMeta(status)
  return <Badge tone={tone} className={className}>{label}</Badge>
}

export default ApplicationStatusBadge
