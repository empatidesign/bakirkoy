import { useCallback, useEffect, useState } from 'react'
import {
  ReceiptTextIcon, UsersIcon, UserIcon, GiftIcon, ClockIcon, QrCodeIcon,
} from 'lucide-react'
import {
  Select, Combobox, FilterField, Badge, FormSection, DetailRow,
} from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import { formatDateTime } from '@/lib/utils'
import discountUsageService from '@/services/discountUsage.service'
import companyService from '@/services/company.service'
import campaignService from '@/services/campaign.service'
import type { SelectOption } from '@/types/common'
import type { DiscountUsage, DiscountUsageSummary } from '@/types/discountUsage.types'
import {
  DISCOUNT_USAGE_STATUS_LABELS, DISCOUNT_USAGE_STATUS_TONE,
} from '@/types/discountUsage.types'
import { discountUsageColumns, discountUsageColumnsWithCompany } from './discountUsageColumns'

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

export const UsagesTab = ({ scope, embedded, onMutated }: { scope?: Scope; embedded?: boolean; onMutated?: () => void } = {}) => {
  const scopedCompanyId = scope?.companyId
  const [companyFilter, setCompanyFilter] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [companyOptions, setCompanyOptions] = useState<SelectOption[]>([])
  const [campaignOptions, setCampaignOptions] = useState<SelectOption[]>([])
  const [summary, setSummary] = useState<DiscountUsageSummary | null>(null)

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
    try { setSummary(await discountUsageService.getSummary(params)) }
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
    <CrudListTemplate<DiscountUsage, NoForm>
      icon={ReceiptTextIcon}
      title="İndirim Kullanımları"
      subtitle="Firmalarda kullanılan indirim kuponlarını ve QR kullanımlarını izleyin"
      resourceName="Kullanım"
      listTitle="Kullanım Takibi"
      creatable={false}
      service={{ getList: (p) => discountUsageService.getList(p) }}
      rowKey={(r) => r.id}
      columns={scopedCompanyId ? discountUsageColumns : discountUsageColumnsWithCompany}
      defaultSort={{ key: 'usedAt', dir: 'desc' }}
      searchPlaceholder="Kullanıcı, kampanya, hizmet veya kod ara..."
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
        { label: 'Toplam Kullanım', value: summary?.total ?? total, icon: ReceiptTextIcon, accent: 'blue' },
        { label: 'Benzersiz Kullanıcı', value: summary?.uniqueUsers ?? 0, icon: UsersIcon, accent: 'violet' },
      ]}
      emptyForm={{} as NoForm}
      toForm={() => ({} as NoForm)}
      canEdit={() => false}
      viewable
      renderView={(row) => (
        <div className="space-y-4">
          <FormSection title="Kullanıcı Bilgileri" icon={UserIcon} variant="card">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              <DetailRow label="Ad Soyad">{row.userName}</DetailRow>
              <DetailRow label="Telefon">{row.userPhone || '—'}</DetailRow>
            </div>
          </FormSection>
          <FormSection title="Kampanya ve Hizmet" icon={GiftIcon} variant="card">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              <DetailRow label="Firma">{row.companyName || '—'}</DetailRow>
              <DetailRow label="Kampanya">{row.campaignName || '—'}</DetailRow>
              <DetailRow label="Hizmet">{row.serviceName || '—'}</DetailRow>
              <DetailRow label="İndirim Kodu" icon={QrCodeIcon}>
                <span className="font-mono tabular-nums">{row.discountCode || '—'}</span>
              </DetailRow>
              <DetailRow label="Durum">
                <Badge tone={DISCOUNT_USAGE_STATUS_TONE[row.status]}>{DISCOUNT_USAGE_STATUS_LABELS[row.status]}</Badge>
              </DetailRow>
            </div>
          </FormSection>
          <FormSection title="Tarih Bilgileri" icon={ClockIcon} variant="card">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              <DetailRow label="QR Okutma">{row.qrScannedAt ? formatDateTime(row.qrScannedAt) : '—'}</DetailRow>
              <DetailRow label="Kullanım Tarihi">{formatDateTime(row.usedAt)}</DetailRow>
            </div>
          </FormSection>
        </div>
      )}
      renderForm={() => null}
    />
  )
}
