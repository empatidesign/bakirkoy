import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboardIcon, TicketPercentIcon, Building2Icon, UsersRoundIcon, ChevronRightIcon, ScanLineIcon } from 'lucide-react'
import { ModuleHeader, Card, Avatar, Badge, StatCard } from '@/design-system'
import { useCompanyAuth } from '@/framework/companyAuth/CompanyAuthContext'
import { COMPANY_STATUS_LABELS, COMPANY_STATUS_TONE } from '@/types/companyAuth.types'
import { CompanyStatusBanner } from './CompanyStatusBanner'

export const CompanyHomePage = () => {
  const { state, refreshCompany } = useCompanyAuth()

  useEffect(() => { void refreshCompany().catch(() => undefined) }, [refreshCompany])

  if (state.status !== 'authenticated') return null
  const company = state.company

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader icon={LayoutDashboardIcon} title="Panel" subtitle={company.name} gradient="linear-gradient(160deg, #7c2d12 0%, #c2410c 55%, #f97316 100%)" />
      <div className="flex-1 space-y-4 overflow-auto p-4">
        <CompanyStatusBanner status={company.status} rejectReason={company.rejectReason} showApproved />

        <Card padded>
          <div className="flex items-center gap-3">
            <Avatar name={company.name} src={company.logo ?? undefined} size="md" />
            <div className="min-w-0 flex-1">
              <p className="type-caption">Firma</p>
              <p className="type-section truncate">{company.name}</p>
            </div>
            <Badge tone={COMPANY_STATUS_TONE[company.status]}>{COMPANY_STATUS_LABELS[company.status]}</Badge>
          </div>
        </Card>

        {company.status === 'Approved' && (
          <Link to="/firma/redeem" className="block">
            <div className="flex items-center gap-3 rounded-card bg-gradient-brand p-4 text-white shadow-card transition-opacity active:opacity-90">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <ScanLineIcon className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="type-section text-white">Kampanya Kullandır</p>
                <p className="type-caption text-white/85">QR okutun veya TC / telefon ile kullandırın</p>
              </div>
              <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-white/80" />
            </div>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Kampanya" value={company.totalCampaigns} icon={TicketPercentIcon} accent="violet" />
          <StatCard label="Kullanım" value={company.totalUsages} icon={UsersRoundIcon} accent="green" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/firma/campaigns">
            <Card padded className="h-full">
              <span className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-card bg-accent-violet/10 text-accent-violet">
                <TicketPercentIcon className="h-5 w-5" />
              </span>
              <p className="type-body-strong">Kampanyalar</p>
              <p className="type-caption">Oluştur ve yönet</p>
            </Card>
          </Link>
          <Link to="/firma/profile">
            <Card padded className="h-full">
              <span className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-card bg-accent-blue/10 text-accent-blue">
                <Building2Icon className="h-5 w-5" />
              </span>
              <p className="type-body-strong">Firma Profili</p>
              <p className="type-caption">Bilgiler ve iletişim</p>
            </Card>
          </Link>
        </div>

        <Card padded>
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="type-section">İletişim Bilgileri</p>
              <p className="type-caption truncate">{company.phone}{company.email ? ` · ${company.email}` : ''}</p>
            </div>
            <Link to="/firma/profile" className="type-link-sm inline-flex flex-shrink-0 items-center gap-0.5">
              Düzenle <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
