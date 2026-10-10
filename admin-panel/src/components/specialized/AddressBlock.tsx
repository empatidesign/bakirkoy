import type { ComponentType } from 'react'
import { MapPinIcon } from 'lucide-react'
import { Badge, DetailRow } from '@/design-system'
import { type CitizenAddress, formatAddressLine, isSultangaziResident, hasAnyAddress } from '@/lib/residency'

interface AddressBlockProps {
  address?: CitizenAddress | null
  label?: string
  icon?: ComponentType<{ className?: string }>
  layout?: 'stack' | 'inline'
  showResidencyBadge?: boolean
  emptyText?: string
}

export function AddressBlock({
  address,
  label = 'Adres',
  icon = MapPinIcon,
  layout = 'stack',
  showResidencyBadge = true,
  emptyText = '—',
}: AddressBlockProps) {
  const line = formatAddressLine(address)
  const resident = isSultangaziResident(address)
  return (
    <DetailRow label={label} icon={icon} layout={layout}>
      <div className="flex flex-wrap items-center gap-2">
        <span>{line || emptyText}</span>
        {showResidencyBadge && hasAnyAddress(address) && (
          <Badge tone={resident ? 'info' : 'neutral'}>{resident ? 'Bakırköy sakini' : 'Bakırköy dışı'}</Badge>
        )}
      </div>
    </DetailRow>
  )
}
