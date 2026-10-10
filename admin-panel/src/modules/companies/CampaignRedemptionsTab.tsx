import { useCallback, useEffect, useState } from 'react'
import {
  GiftIcon, UsersIcon, UserIcon, ClockIcon, QrCodeIcon,
} from 'lucide-react'
import {
  Select, Combobox, FilterField, Badge, FormSection, DetailRow,
} from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import { formatDateTime } from '@/lib/utils'
import campaignRedemptionService from '@/services/campaignRedemption.service'
import companyService from '@/services/company.service'
import campaignService from '@/services/campaign.service'
import type { SelectOption } from '@/types/common'
import type { CampaignRedemption, CampaignRedemptionSummary } from '@/types/campaignRedemption.types'
import { CAMPAIGN_REDEMPTION_TYPE_LABELS } from '@/types/campaignRedemption.types'
import { campaignRedemptionColumns, campaignRedemptionColumnsWithCompany } from './campaignRedemptionColumns'

// DiscountUsage'ın admin tarafındaki UsagesTab'ıyla birebir aynı desende — admin panelin
// CampaignRedemption (çark/QR üzerinden gerçekleşen kampanya kullanımı) kayıtlarını da
// görüp raporlayabilmesi için eklendi. Önceden bu veriler yalnızca firmanın kendi panelinden
// görülebiliyordu, admin'in hiçbir görünürlüğü yoktu
// (bkz. loyalty-ecosystem-audit-2026-08-04 P0 bulgusu).
type NoForm = Record<string, never>

const DATE_FILTER_OPTIONS = [
  { value: 'today', label: 'Bugün' },
  { value: 'week', label: 'Son 7 Gün' },
  { value: 'month', label: 'Son 30 Gün' },
]

interface Scope {
  companyId?: string
  campaignId?: string
}

export const CampaignRedemptionsTab = ({ scope, embedded, onMutated }: { scope?: Scope; embedded?: boolean; onMutated?: () => void } = {}) => {
  const scopedCompanyId = scope?.companyId
  const [companyFilter, setCompanyFilter] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [companyOptions, setCompanyOptions] = useState<SelectOption[]>([])
  const [campaignOptions, setCampaignOptions] = useState<SelectOption[]>([])
  const [summary, setSummary] = useState<CampaignRedemptionSummary | null>(null)

  const effectiveCompanyId = scopedCompanyId ?? companyFilter

  useEffect(() => {
    let active = true
    companyService.getOptions()
      .then((o) => { if (active) setCompanyOptions(o) })
      .catch(() => { if (active) setCompanyOptions([]) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    campaignService.getOptions(effectiveCompanyId || undefined)
      .then((o) => { if (active) setCampaignOptions(o) })
      .catch(() => { if (active) setCampaignOptions([]) })
    return () => { active = false }
  }, [effectiveCompanyId])

  const fetchSummary = useCallback(async () => {
    const params: Record<string, string> = {}
    if (effectiveCompanyId) params.companyId = effectiveCompanyId
    if (scope?.campaignId) params.campaignId = scope.campaignId
    try { setSummary(await campaignRedemptionService.getSummary(params)) }
    catch { setSummary(null) }
  }, [effectiveCompanyId, scope?.campaignId])
  useEffect(() => { fetchSummary() }, [fetchSummary])

  const handleMutated = () => { fetchSummary(); onMutated?.() }

  const extraParams: Record<string, string> = {}
  if (effectiveCompanyId) extraParams.companyId = effectiveCompanyId
  if (scope?.campaignId) extraParams.campaignId = scope.campaignId
  else if (campaignFilter) extraParams.campaignId = campaignFilter
  if (dateFilter) extraParams.dateRange = dateFilter

  const userFilterCount = (companyFilter ? 1 : 0) + (campaignFilter ? 1 : 0) + (dateFilter ? 1 : 0)

  return (
    <CrudListTemplate<CampaignRedemption, NoForm>
      icon={GiftIcon}
      title="Kampanya Kullanımları"
      subtitle="Çark/QR üzerinden gerçekleşen kampanya kullanımlarını izleyin"
      resourceName="Kullanım"
      listTitle="Kullanım Takibi"
      creatable={false}
      service={{ getList: (p) => campaignRedemptionService.getList(p) }}
      rowKey={(r) => r.id}
      columns={scopedCompanyId ? campaignRedemptionColumns : campaignRedemptionColumnsWithCompany}
      defaultSort={{ key: 'redeemedAt', dir: 'desc' }}
      searchPlaceholder="Vatandaş, kampanya veya kod ara..."
      embedded={embedded}
      onMutated={handleMutated}
      filterColumns={3}
      extraParams={extraParams}
      selectable
      hasActiveFilters={embedded ? false : userFilterCount > 0}
      filterCount={userFilterCount}
      onClearFilters={() => { setCompanyFilter(''); setCampaignFilter(''); setDateFilter('') }}
      renderFilters={embedded ? undefined : () => (
        <>
          <FilterField label="Firma">
            <Combobox
              value={companyFilter}
              displayValue={companyOptions.find((o) => o.value === companyFilter)?.label}
              options={companyOptions}
              onChange={(v) => { setCompanyFilter(v); setCampaignFilter('') }}
              clearable
              placeholder="Tüm Firmalar"
              emptyText="Firma bulunamadı"
            />
          </FilterField>
          <FilterField label="Kampanya">
            <Combobox
              value={campaignFilter}
              displayValue={campaignOptions.find((o) => o.value === campaignFilter)?.label}
              options={campaignOptions}
              onChange={(v) => setCampaignFilter(v)}
              clearable
              placeholder="Tüm Kampanyalar"
              emptyText="Kampanya bulunamadı"
            />
          </FilterField>
          <FilterField label="Tarih">
            <Select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
              <option value="">Tüm Zamanlar</option>
              {DATE_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FilterField>
        </>
      )}
      stats={({ total }) => [
        { label: 'Toplam Kullanım', value: summary?.total ?? total, icon: GiftIcon, accent: 'blue' },
        { label: 'Benzersiz Vatandaş', value: summary?.uniqueParticipants ?? 0, icon: UsersIcon, accent: 'violet' },
        { label: 'QR Okutma', value: summary?.qrScanCount ?? 0, icon: QrCodeIcon, accent: 'primary' },
      ]}
      emptyForm={{} as NoForm}
      toForm={() => ({} as NoForm)}
      canEdit={() => false}
      viewable
      renderView={(row) => (
        <div className="space-y-4">
          <FormSection title="Vatandaş Bilgileri" icon={UserIcon} variant="card">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              <DetailRow label="Ad Soyad">{row.participantName}</DetailRow>
              <DetailRow label="Telefon">{row.participantPhone || '—'}</DetailRow>
            </div>
          </FormSection>
          <FormSection title="Kampanya" icon={GiftIcon} variant="card">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              <DetailRow label="Firma">{row.companyName || '—'}</DetailRow>
              <DetailRow label="Kampanya">{row.campaignName || '—'}</DetailRow>
              <DetailRow label="Kullanım Kodu" icon={QrCodeIcon}>
                <span className="font-mono tabular-nums">{row.redemptionCode || '—'}</span>
              </DetailRow>
              <DetailRow label="Tür">
                <Badge tone={row.redemptionType === 'QrScan' ? 'primary' : 'info'}>{CAMPAIGN_REDEMPTION_TYPE_LABELS[row.redemptionType]}</Badge>
              </DetailRow>
              {row.notes && <DetailRow label="Not">{row.notes}</DetailRow>}
            </div>
          </FormSection>
          <FormSection title="Tarih Bilgisi" icon={ClockIcon} variant="card">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              <DetailRow label="Kullanım Tarihi">{formatDateTime(row.redeemedAt)}</DetailRow>
            </div>
          </FormSection>
        </div>
      )}
      renderForm={() => null}
    />
  )
}
