import { useEffect, useState, type ComponentType } from 'react'
import {
  Building2Icon, ClockIcon, CheckCircle2Icon, TicketPercentIcon, ReceiptTextIcon, TrendingUpIcon,
  PieChartIcon, UsersIcon,
} from 'lucide-react'
import { StatCard, FormSection, Progress, EmptyState, SkeletonRows } from '@/design-system'
import companyService from '@/services/company.service'
import type { CompanyDashboard } from '@/types/company.types'
import { COMPANY_STATUS_LABELS } from '@/types/company.types'

const STATUS_ROWS: { key: keyof CompanyDashboard['statusDistribution']; label: string; tone: 'success' | 'warning' | 'danger' | 'primary' }[] = [
  { key: 'approved', label: COMPANY_STATUS_LABELS.Approved, tone: 'success' },
  { key: 'pending', label: COMPANY_STATUS_LABELS.Pending, tone: 'warning' },
  { key: 'rejected', label: COMPANY_STATUS_LABELS.Rejected, tone: 'danger' },
  { key: 'passive', label: COMPANY_STATUS_LABELS.Passive, tone: 'primary' },
]

const RankedList = ({
  rows, valueLabel, icon: Icon,
}: { rows: { id: string; name: string; value: number }[]; valueLabel: string; icon: ComponentType<{ className?: string }> }) =>
  rows.length === 0
    ? <EmptyState icon={Icon} title="Veri yok" />
    : (
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-center gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 type-caption tabular-nums text-foreground-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground-strong">{r.name}</p>
            </div>
            <span className="flex-shrink-0 tabular-nums text-foreground-default">
              {(r.value ?? 0).toLocaleString('tr-TR')} <span className="type-caption">{valueLabel}</span>
            </span>
          </div>
        ))}
      </div>
    )

export const OverviewTab = () => {
  const [data, setData] = useState<CompanyDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    companyService.getDashboard()
      .then((d) => { if (active) setData(d) })
      .catch(() => { if (active) setData(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const dist = data?.statusDistribution
  const distTotal = dist ? dist.approved + dist.pending + dist.rejected + dist.passive : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard size="compact" label="Toplam Firma" value={data?.totalCompanies ?? 0} icon={Building2Icon} accent="blue" loading={loading} />
        <StatCard size="compact" label="Beklemede" value={data?.pendingCompanies ?? 0} icon={ClockIcon} accent="orange" loading={loading} />
        <StatCard size="compact" label="Onaylı Firma" value={data?.approvedCompanies ?? 0} icon={CheckCircle2Icon} accent="green" loading={loading} />
        <StatCard size="compact" label="Aktif Kampanya" value={data?.activeCampaigns ?? 0} icon={TicketPercentIcon} accent="violet" loading={loading} />
        <StatCard size="compact" label="Toplam Kullanım" value={data?.totalUsages ?? 0} icon={ReceiptTextIcon} accent="primary" loading={loading} />
        <StatCard size="compact" label="Bu Ay Kullanım" value={data?.monthlyUsages ?? 0} icon={TrendingUpIcon} accent="green" loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FormSection title="Firma Statü Dağılımı" subtitle={`${distTotal} firma`} icon={PieChartIcon} variant="card">
          {loading ? <SkeletonRows rows={4} /> : (
            <div className="space-y-3">
              {STATUS_ROWS.map((s) => {
                const value = dist?.[s.key] ?? 0
                const pct = distTotal > 0 ? Math.round((value / distTotal) * 100) : 0
                return (
                  <div key={s.key}>
                    <div className="mb-1 flex items-center justify-between type-caption">
                      <span className="text-foreground-default">{s.label}</span>
                      <span className="tabular-nums">{value} · %{pct}</span>
                    </div>
                    <Progress value={pct} tone={s.tone} />
                  </div>
                )
              })}
            </div>
          )}
        </FormSection>

        <FormSection title="En Çok Kampanya Açan Firmalar" subtitle="Kampanya sayısına göre" icon={TicketPercentIcon} variant="card">
          {loading ? <SkeletonRows rows={5} /> : (
            <RankedList
              icon={Building2Icon}
              valueLabel="kampanya"
              rows={(data?.topByCampaigns ?? []).map((c) => ({ id: c.id, name: c.name, value: c.count }))}
            />
          )}
        </FormSection>

        <FormSection title="En Çok İndirim Kullanılan Firmalar" subtitle="Kullanım sayısına göre" icon={UsersIcon} variant="card">
          {loading ? <SkeletonRows rows={5} /> : (
            <RankedList
              icon={Building2Icon}
              valueLabel="kullanım"
              rows={(data?.topByUsages ?? []).map((c) => ({ id: c.id, name: c.name, value: c.count }))}
            />
          )}
        </FormSection>
      </div>
    </div>
  )
}
