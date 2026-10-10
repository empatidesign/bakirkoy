import { Badge } from '@/design-system/Badge'

export interface RoleBadgeProps {
  name?: string | null
  color?: string | null
  className?: string
}

export const RoleBadge = ({ name, color, className }: RoleBadgeProps) => (
  <Badge color={color ?? undefined} tone="info" className={className}>
    {name || '—'}
  </Badge>
)
