import { useEffect, useState } from 'react'
import {
  MessageSquareIcon, ShieldAlertIcon, KeyRoundIcon, UsersIcon, ScrollTextIcon, ActivityIcon,
  ClockIcon, BuildingIcon, TrendingUpIcon, SmartphoneIcon,
} from 'lucide-react'
import {
  StatCard, Badge, FilterField, Select, DateRangeSelect, DataTable, type DateRangeValue, type DataTableColumn,
} from '@/design-system'
import { AreaTrendChart, CategoryBarChart } from '@/design-system/charts'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import smsAuditService from '@/services/smsAudit.service'
import type {
  SmsSendLogListItem, SmsDashboardSummary, SmsDailyStatItem, SmsUserStatItem, SmsDepartmentStatItem,
} from '@/types/smsAudit.types'

const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const fmtDate = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
}

interface PanelProps { title: string; icon: typeof MessageSquareIcon; children: React.ReactNode; sub?: string }
const Panel = ({ title, icon: Icon, children, sub }: PanelProps) => (
  <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-1 border border-border"><Icon className="h-4 w-4 text-foreground-muted" /></span>
      <div>
        <p className="text-sm font-bold text-foreground-strong uppercase tracking-tight">{title}</p>
        {sub && <p className="text-xs text-foreground-muted font-medium">{sub}</p>}
      </div>
    </div>
    {children}
  </div>
)

const ChartSkeleton = ({ h = 240 }: { h?: number }) => <div className="animate-pulse rounded-lg bg-surface-2" style={{ height: h }} />

const todayIso = () => new Date().toISOString().slice(0, 10)
const daysAgoIso = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

const userStatsColumns: DataTableColumn<SmsUserStatItem>[] = [
  { key: 'adminUserName', header: 'Kullanıcı', cell: (r) => (
    <div className="min-w-0">
      <p className="type-body-strong truncate">{r.adminUserName}</p>
      {r.department && <p className="type-caption truncate">{r.department}</p>}
    </div>
  ) },
  { key: 'sent', header: 'Gönderilen', align: 'center', cell: (r) => <span className="tabular-nums type-body-strong">{r.sent}</span> },
  { key: 'blocked', header: 'Engellenen', align: 'center', cell: (r) => <span className="tabular-nums text-danger">{r.blocked}</span> },
  { key: 'pinOverrides', header: 'PIN ile', align: 'center', cell: (r) => <span className="tabular-nums text-warning">{r.pinOverrides}</span> },
  { key: 'otpVerified', header: 'OTP ile', align: 'center', cell: (r) => <span className="tabular-nums text-info">{r.otpVerified}</span> },
  { key: 'totalRecipients', header: 'Toplam Alıcı', align: 'center', cell: (r) => <span className="tabular-nums">{r.totalRecipients}</span> },
]

const listColumns: DataTableColumn<SmsSendLogListItem>[] = [
  { key: 'createdAt', header: 'Tarih', sortable: true, sortKey: 'createdAt', cell: (r) => (
    <span className="inline-flex items-center gap-1.5 text-foreground-muted">
      <ClockIcon className="h-3.5 w-3.5 flex-shrink-0" />
      {fmtDateTime(r.createdAt)}
    </span>
  ) },
  { key: 'adminUserName', header: 'Kullanıcı', cell: (r) => (
    <div className="min-w-0">
      <p className="type-body-strong truncate">{r.adminUserName}</p>
      {r.department && <p className="type-caption truncate">{r.department}</p>}
    </div>
  ) },
  { key: 'module', header: 'Modül', cell: (r) => <span className="text-foreground-muted">{r.module}</span> },
  { key: 'description', header: 'Açıklama', cell: (r) => <span className="type-body-strong">{r.description ?? '—'}</span> },
  { key: 'recipientCount', header: 'Alıcı', align: 'center', cell: (r) => <span className="tabular-nums">{r.recipientCount}</span> },
  { key: 'usedPinOverride', header: 'Doğrulama', align: 'center', cell: (r) => r.usedPinOverride ? <Badge tone="warning">PIN</Badge> : r.usedOtp ? <Badge tone="info">OTP</Badge> : <span className="type-caption">—</span> },
  { key: 'wasBlocked', header: 'Durum', align: 'center', cell: (r) => r.wasBlocked ? <Badge tone="danger">Engellendi</Badge> : <Badge tone="success">Gönderildi</Badge> },
  { key: 'ipAddress', header: 'IP', cell: (r) => <span className="type-caption">{r.ipAddress ?? '—'}</span> },
]

export const SmsAuditTab = () => {
  const [range, setRange] = useState<DateRangeValue>({ preset: 'month', from: daysAgoIso(30), to: todayIso() })
  const [summary, setSummary] = useState<SmsDashboardSummary | null>(null)
  const [daily, setDaily] = useState<SmsDailyStatItem[]>([])
  const [userStats, setUserStats] = useState<SmsUserStatItem[]>([])
  const [deptStats, setDeptStats] = useState<SmsDepartmentStatItem[]>([])
  const [loading, setLoading] = useState(true)

  const [department, setDepartment] = useState('')
  const [blockedFilter, setBlockedFilter] = useState('')
  const [sortFilter, setSortFilter] = useState('')

  useEffect(() => {
    smsAuditService.getSummary().then(setSummary).catch(() => setSummary(null))
  }, [])

  useEffect(() => {
    setLoading(true)
    const from = range.from ?? daysAgoIso(30)
    const to = range.to ?? todayIso()
    Promise.all([
      smsAuditService.getDailyStats({ from, to }),
      smsAuditService.getUserStats({ from, to }),
      smsAuditService.getDepartmentStats({ from, to }),
    ])
      .then(([d, u, dep]) => { setDaily(d); setUserStats(u); setDeptStats(dep) })
      .catch(() => { setDaily([]); setUserStats([]); setDeptStats([]) })
      .finally(() => setLoading(false))
  }, [range.from, range.to])

  const trendData = daily.map((d) => ({ date: d.date, sent: d.sent, blocked: d.blocked, pinOverrides: d.pinOverrides, otpVerified: d.otpVerified }))
  const deptBars = deptStats.map((d) => ({ label: d.department, value: d.sent }))

  const [sortKey, sortDir] = sortFilter ? (sortFilter.split('-') as [string, string]) : ['', '']
  const sortParams: Record<string, string> = sortFilter ? { sort: sortKey, order: sortDir } : {}

  const extraParams: Record<string, string> = { ...sortParams }
  if (department) extraParams.department = department
  if (blockedFilter) extraParams.wasBlocked = blockedFilter
  if (range.from) extraParams.dateFrom = range.from
  if (range.to) extraParams.dateTo = range.to

  const hasFilters = !!(department || blockedFilter || sortFilter)
  const filterCount = (department ? 1 : 0) + (blockedFilter ? 1 : 0) + (sortFilter ? 1 : 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Bugün Gönderilen" value={summary?.todaySentCount ?? '—'} icon={MessageSquareIcon} accent="blue" loading={!summary} />
        <StatCard label="Bugün Engellenen" value={summary?.todayBlockedCount ?? '—'} icon={ShieldAlertIcon} accent="danger" loading={!summary} />
        <StatCard label="PIN ile Doğrulanan" value={summary?.todayPinOverrideCount ?? '—'} icon={KeyRoundIcon} accent="orange" loading={!summary} />
        <StatCard label="OTP ile Doğrulanan" value={summary?.todayOtpVerifiedCount ?? '—'} icon={SmartphoneIcon} accent="blue" loading={!summary} />
        <StatCard label="Aktif Kullanıcı" value={summary?.activeUserCount ?? '—'} icon={UsersIcon} accent="violet" loading={!summary} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Tarih Aralığı">
          <DateRangeSelect value={range} onChange={setRange} />
        </FilterField>
      </div>

      <Panel title="Gönderim / Engelleme Trendi" icon={TrendingUpIcon} sub="Seçilen tarih aralığındaki günlük SMS gönderim ve engelleme sayıları">
        {loading ? <ChartSkeleton /> : trendData.length === 0
          ? <div className="flex h-[260px] items-center justify-center type-caption text-foreground-muted">Veri yok</div>
          : <AreaTrendChart
              data={trendData}
              xKey="date"
              series={[
                { key: 'sent', label: 'Gönderilen' },
                { key: 'blocked', label: 'Engellenen' },
                { key: 'pinOverrides', label: 'PIN ile' },
                { key: 'otpVerified', label: 'OTP ile' },
              ]}
              formatX={fmtDate}
            />}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Departman Bazlı Dağılım" icon={BuildingIcon} sub="Gönderim sayısına göre">
          {loading ? <ChartSkeleton /> : deptBars.length === 0
            ? <div className="flex h-[260px] items-center justify-center type-caption text-foreground-muted">Veri yok</div>
            : <CategoryBarChart data={deptBars} layout="vertical" multicolor />}
        </Panel>
        <Panel title="Kullanıcı Bazlı İstatistik" icon={ActivityIcon} sub="En çok gönderen kullanıcılar">
          <DataTable<SmsUserStatItem>
            columns={userStatsColumns}
            rows={userStats.slice(0, 8)}
            rowKey={(r) => r.adminUserId}
            loading={loading}
          />
        </Panel>
      </div>

      <CrudListTemplate<SmsSendLogListItem, Record<string, never>>
        icon={ScrollTextIcon}
        title="SMS Gönderim Kayıtları"
        subtitle="Kullanıcı ve departman bazında detaylı SMS gönderim denetim kaydı"
        resourceName="SMS Kaydı"
        service={{ getList: (p) => smsAuditService.getList(p) }}
        rowKey={(r) => r.id}
        columns={listColumns}
        creatable={false}
        canEdit={() => false}
        viewable={false}
        defaultSort={{ key: 'createdAt', dir: 'desc' }}
        searchPlaceholder="Kullanıcı, departman veya açıklama ara..."
        extraParams={extraParams}
        hasActiveFilters={hasFilters}
        filterCount={filterCount}
        onClearFilters={() => { setDepartment(''); setBlockedFilter(''); setSortFilter('') }}
        renderFilters={() => (
          <>
            <FilterField label="Sıralama">
              <Select value={sortFilter} onChange={(e) => setSortFilter(e.target.value)}>
                <option value="">Tarihe Göre (En Yeni)</option>
                <option value="createdat-asc">Tarihe Göre (En Eski)</option>
                <option value="createdat-desc">Tarihe Göre (En Yeni)</option>
                <option value="adminusername-asc">Kullanıcı (A-Z)</option>
                <option value="department-asc">Departman (A-Z)</option>
                <option value="module-asc">Modül (A-Z)</option>
              </Select>
            </FilterField>
            <FilterField label="Departman">
              <Select searchable value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="">Tüm Departmanlar</option>
                {deptStats.map((d) => <option key={d.department} value={d.department}>{d.department}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Durum">
              <Select value={blockedFilter} onChange={(e) => setBlockedFilter(e.target.value)}>
                <option value="">Tümü</option>
                <option value="false">Gönderildi</option>
                <option value="true">Engellendi</option>
              </Select>
            </FilterField>
          </>
        )}
        emptyForm={{}}
        toForm={() => ({})}
        renderForm={() => null}
      />
    </div>
  )
}
