import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Building2Icon, MailIcon, PhoneIcon, MapPinIcon, GlobeIcon, ShareIcon, InfoIcon,
  PackageIcon, TicketPercentIcon, ReceiptTextIcon, CheckCircle2Icon, ExternalLinkIcon, Loader2Icon,
  XIcon, NavigationIcon, GiftIcon,
} from 'lucide-react'
import {
  Modal, Tabs, Badge, DataTable, DetailRow, FormSection, EmptyState, type DataTableColumn,
} from '@/design-system'
import { formatDate, safeExternalUrl } from '@/lib/utils'
import { directionsUrl } from '@/lib/distance'
import { citizenPortalBase } from '@/lib/citizenPortal'
import { useAuth } from '@/framework/auth/AuthContext'
import companyService from '@/services/company.service'
import type { Company, CompanyServiceItem } from '@/types/company.types'
import { COMPANY_STATUS_LABELS, COMPANY_STATUS_TONE } from '@/types/company.types'
import { CampaignsTab } from './CampaignsTab'
import { UsagesTab } from './UsagesTab'
import { CampaignRedemptionsTab } from './CampaignRedemptionsTab'

type DetailTab = 'genel' | 'hizmetler' | 'kampanyalar' | 'kullanimlar' | 'cark-kullanimlari'

const serviceColumns: DataTableColumn<CompanyServiceItem>[] = [
  { key: 'name', header: 'Hizmet Adı', cell: (r) => <span className="font-medium text-foreground-strong">{r.name}</span> },
  { key: 'category', header: 'Kategori', cell: (r) => <span className="text-foreground-muted">{r.category || '—'}</span> },
  { key: 'price', header: 'Fiyat', align: 'right', cell: (r) => <span className="tabular-nums text-foreground-default">{r.price != null ? `${r.price.toLocaleString('tr-TR')} TL` : '—'}</span> },
  { key: 'status', header: 'Durum', align: 'center', cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge> },
]

const SocialLink = ({ label, href }: { label: string; href?: string }) => {
  const safe = safeExternalUrl(href)
  return safe ? <a href={safe} target="_blank" rel="noopener noreferrer" className="type-link truncate">{label}</a> : <span className="text-foreground-subtle">—</span>
}

interface Props {
  company: Company | null
  onClose: () => void
  onMutated?: () => void
}

export const CompanyDetailModal = ({ company, onClose, onMutated }: Props) => {
  const { can } = useAuth()
  const [tab, setTab] = useState<DetailTab>('genel')
  const [services, setServices] = useState<CompanyServiceItem[]>([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [bypassing, setBypassing] = useState(false)

  useEffect(() => {
    setTab('genel')
  }, [company?.id])

  useEffect(() => {
    if (!company?.id) return
    let active = true
    setLoadingServices(true)
    companyService.getServices(company.id)
      .then((s) => { if (active) setServices(s) })
      .catch(() => { if (active) setServices([]) })
      .finally(() => { if (active) setLoadingServices(false) })
    return () => { active = false }
  }, [company?.id])

  const openBypass = async () => {
    if (!company || !can('companies.impersonate')) return

    const portalWindow = window.open('about:blank', `company_portal_${company.id}`)
    if (!portalWindow) {
      toast.error('Tarayıcı yeni pencereyi engelledi. Açılır pencerelere izin verin.')
      return
    }
    portalWindow.opener = null

    setBypassing(true)
    try {
      const { code } = await companyService.generateBypassCode(company.id)
      const base = citizenPortalBase()
      const url = `${base}/bypass?code=${encodeURIComponent(code)}&kind=company`
      portalWindow.location.replace(url)
    } catch {
      portalWindow.close()
      toast.error('Firma paneli açılamadı.')
    } finally {
      setBypassing(false)
    }
  }

  if (!company) return null
  const social = company.socialMedia ?? {}

  return (
    <Modal
      open={!!company}
      onClose={onClose}
      width={1080}
      className="max-w-[96vw]"
      bodyClassName="p-0"
      hideCloseButton
      header={
        <div className="relative -mx-6 -my-4 overflow-hidden ds-hero">
          <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
          <div className="absolute -bottom-6 right-24 h-32 w-32 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
          <div className="absolute left-0 bottom-0 h-24 w-24 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <div className="relative flex items-start justify-between px-8 py-7 pr-14">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg shadow-xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.15))', border: '3px solid rgba(255,255,255,0.35)' }}>
                  {company.logo ? <img src={company.logo} alt="" className="h-full w-full object-cover" /> : <Building2Icon className="h-9 w-9 text-white" />}
                </span>
                <span className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: company.status === 'Approved' ? '#22c55e' : '#94a3b8' }} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{company.name}</h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-white/20 text-white">{COMPANY_STATUS_LABELS[company.status]}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1.5 text-[13px] text-white/70">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/15">
                      <ReceiptTextIcon className="h-3 w-3 text-white" />
                    </div>
                    VKN: {company.taxNumber}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="px-6 pt-3">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as DetailTab)}
          tabs={[
            { key: 'genel', label: 'Genel Bilgiler', icon: InfoIcon },
            { key: 'hizmetler', label: 'Hizmetler', icon: PackageIcon, count: company.totalServices },
            { key: 'kampanyalar', label: 'Kampanyalar', icon: TicketPercentIcon, count: company.totalCampaigns },
            { key: 'kullanimlar', label: 'Kullanımlar', icon: ReceiptTextIcon, count: company.totalUsages },
            { key: 'cark-kullanimlari', label: 'Çark/QR Kullanımları', icon: GiftIcon },
          ]}
          action={can('companies.impersonate') ? (
            <button
              type="button"
              onClick={openBypass}
              disabled={bypassing}
              className="flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[11px] font-semibold text-foreground-default shadow-sm transition-colors hover:bg-surface-0 disabled:opacity-60"
              title="Firma panelini bu firma olarak görüntüle"
            >
              {bypassing ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <ExternalLinkIcon className="h-3.5 w-3.5" />}
              Panele Bağlan
            </button>
          ) : undefined}
        />
      </div>

      <div className="max-h-[64vh] overflow-auto px-6 py-5">
        {tab === 'genel' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormSection title="İletişim Bilgileri" icon={MailIcon} variant="card">
                <div className="space-y-1">
                  <DetailRow label="E-posta" icon={MailIcon}>
                    <span className="inline-flex items-center gap-1.5">
                      {company.email ?? '—'}
                      {company.email && company.emailVerified && <CheckCircle2Icon className="h-3.5 w-3.5 text-success" />}
                    </span>
                  </DetailRow>
                  <DetailRow label="Telefon" icon={PhoneIcon}>
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      {company.phone}
                      {company.phoneVerified && <CheckCircle2Icon className="h-3.5 w-3.5 text-success" />}
                    </span>
                  </DetailRow>
                  <DetailRow label="Adres" icon={MapPinIcon}>
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span>{company.address} · {company.district}</span>
                      {company.latitude != null && company.longitude != null && (
                        <a
                          href={directionsUrl({ latitude: company.latitude, longitude: company.longitude }, company.googlePlaceId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <NavigationIcon className="h-3 w-3" /> Haritada Göster
                        </a>
                      )}
                    </span>
                  </DetailRow>
                  <DetailRow label="Web Sitesi" icon={GlobeIcon}><SocialLink label={company.website ?? '—'} href={company.website} /></DetailRow>
                </div>
              </FormSection>

              <FormSection title="Sosyal Medya" icon={ShareIcon} variant="card">
                <div className="space-y-1">
                  <DetailRow label="Facebook"><SocialLink label="Facebook" href={social.facebook} /></DetailRow>
                  <DetailRow label="Instagram"><SocialLink label="Instagram" href={social.instagram} /></DetailRow>
                  <DetailRow label="Twitter / X"><SocialLink label="Twitter" href={social.twitter} /></DetailRow>
                  <DetailRow label="LinkedIn"><SocialLink label="LinkedIn" href={social.linkedin} /></DetailRow>
                </div>
              </FormSection>
            </div>

            <FormSection title="Firma Bilgileri" icon={InfoIcon} variant="card">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                <DetailRow label="Vergi Numarası"><span className="tabular-nums">{company.taxNumber}</span></DetailRow>
                <DetailRow label="Durum"><Badge tone={COMPANY_STATUS_TONE[company.status]}>{COMPANY_STATUS_LABELS[company.status]}</Badge></DetailRow>
                <DetailRow label="Kayıt Tarihi">{formatDate(company.createdAt)}</DetailRow>
                <DetailRow label="Son Güncelleme">{formatDate(company.updatedAt)}</DetailRow>
              </div>
              <div className="mt-3">
                <p className="type-caption mb-1.5">Hizmet Kategorisi</p>
                {company.serviceCategory ? (
                  <Badge color={company.serviceCategory.color}>{company.serviceCategory.name}</Badge>
                ) : (
                  <span className="type-muted">—</span>
                )}
              </div>
              {company.description && <p className="mt-3 type-body text-foreground-muted">{company.description}</p>}
              {company.status === 'Rejected' && company.rejectReason && (
                <p className="mt-3 type-caption text-danger">Red sebebi: {company.rejectReason}</p>
              )}
            </FormSection>
          </div>
        )}

        {tab === 'hizmetler' && (
          <DataTable<CompanyServiceItem>
            columns={serviceColumns}
            rows={services}
            rowKey={(r) => r.id}
            loading={loadingServices}
            empty={<EmptyState icon={PackageIcon} title="Hizmet bulunmuyor" description="Bu firmaya tanımlı hizmet yok." />}
          />
        )}

        {tab === 'kampanyalar' && (
          <CampaignsTab embedded scope={{ companyId: company.id }} onMutated={onMutated} />
        )}

        {tab === 'kullanimlar' && (
          <UsagesTab embedded scope={{ companyId: company.id }} onMutated={onMutated} />
        )}

        {tab === 'cark-kullanimlari' && (
          <CampaignRedemptionsTab embedded scope={{ companyId: company.id }} onMutated={onMutated} />
        )}
      </div>
    </Modal>
  )
}
