import { ClockIcon, CheckCircle2Icon, XCircleIcon } from 'lucide-react'
import { Banner } from '@/design-system'
import type { CompanyStatus } from '@/types/companyAuth.types'

interface CompanyStatusBannerProps {
  status: CompanyStatus
  rejectReason?: string | null
  showApproved?: boolean
}

export const CompanyStatusBanner = ({ status, rejectReason, showApproved }: CompanyStatusBannerProps) => {
  if (status === 'Pending') {
    return (
      <Banner tone="warning" variant="soft" icon={ClockIcon}>
        Firma başvurunuz onay bekliyor. Belediye onayından sonra kampanya oluşturabilirsiniz.
      </Banner>
    )
  }

  if (status === 'Rejected') {
    return (
      <Banner tone="danger" variant="soft" icon={XCircleIcon}>
        Başvurunuz reddedildi.{rejectReason ? ` Gerekçe: ${rejectReason}` : ''} Bilgilerinizi güncelleyip belediye ile iletişime geçebilirsiniz.
      </Banner>
    )
  }

  if (status === 'Approved' && showApproved) {
    return (
      <Banner tone="success" variant="soft" icon={CheckCircle2Icon}>
        Firmanız onaylı. Kampanyalarınızı oluşturup yönetebilirsiniz.
      </Banner>
    )
  }

  return null
}
