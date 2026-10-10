import { LayoutDashboardIcon, TicketPercentIcon, Building2Icon, ScanLineIcon, QrCodeIcon, UsersIcon } from 'lucide-react'

export interface CompanyNavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  end?: boolean
}

export const COMPANY_NAV: CompanyNavItem[] = [
  { to: '/firma', label: 'Panel', icon: LayoutDashboardIcon, end: true },
  { to: '/firma/redeem', label: 'Kullandır', icon: ScanLineIcon },
  { to: '/firma/campaigns', label: 'Kampanyalar', icon: TicketPercentIcon },
  { to: '/firma/qr', label: 'QR Kodum', icon: QrCodeIcon },
  { to: '/firma/personel', label: 'Personel', icon: UsersIcon },
  { to: '/firma/profile', label: 'Firma Profili', icon: Building2Icon },
]
