import { useEffect, useState } from 'react'
import {
  TrendingUpIcon, CheckCircle2Icon, ClockIcon, UserCheckIcon, LayersIcon,
  ArrowUpIcon, ArrowDownIcon, ActivityIcon, Users2Icon, GlobeIcon, CakeIcon,
  StarIcon, FlameIcon, HeartIcon, TrophyIcon, ClipboardListIcon, DownloadIcon,
  BarChart3Icon, SparklesIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { StatCard, Badge, Tabs, Select, Button, PageHeader, Modal } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { DateRangeSelect } from '@/design-system/DateRangeSelect'
import { AreaTrendChart, CategoryBarChart, DonutChart } from '@/design-system/charts'
import { useReportsOverview } from './useReportsOverview'
import { ReportsModuleBreakdownTab } from './ReportsModuleBreakdownTab'
import { ReportsParticipantsTab } from './ReportsParticipantsTab'
import { ReportsParticipantActivityTab } from './ReportsParticipantActivityTab'
import { ParticipantDetailModal } from './ParticipantDetailModal'
import reportsService from '@/services/reports.service'
import { REPORTS_MODULE_LABELS } from '@/types/reports.types'
import type { ReportsOverview, ReportsOverviewParams, ReportsTopItem, ReportsTopParticipant } from '@/types/reports.types'

const KPI_ICONS: Record<string, typeof TrendingUpIcon> = {
  total: TrendingUpIcon, approved: CheckCircle2Icon, pending: ClockIcon, people: UserCheckIcon, modules: LayersIcon,
}
const KPI_ACCENT: Record<string, 'blue' | 'green' | 'orange' | 'violet' | 'primary'> = {
  total: 'blue', approved: 'green', pending: 'orange', people: 'violet', modules: 'primary',
}

const Delta = ({ pct }: { pct: number }) => {
  const up = pct >= 0
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
      style={{ background: up ? 'hsl(var(--success-soft))' : 'hsl(var(--danger-soft))', color: up ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>
      {up ? <ArrowUpIcon className="h-2.5 w-2.5" /> : <ArrowDownIcon className="h-2.5 w-2.5" />}
      {Math.abs(pct)}%
    </span>
  )
}

interface PanelProps { title: string; icon: typeof TrendingUpIcon; children: React.ReactNode; sub?: string; action?: React.ReactNode }
const Panel = ({ title, icon: Icon, children, sub, action }: PanelProps) => (
  <div className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 border border-slate-100"><Icon className="h-4 w-4 text-slate-600" /></span>
        <div>
          <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">{title}</p>
          {sub && <p className="text-xs text-slate-500 font-medium">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </div>
)

const ChartSkeleton = ({ h = 260 }: { h?: number }) => <div className="animate-pulse rounded-lg bg-surface-2" style={{ height: h }} />

const formatDate = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
}
const formatDateTime = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const TopItemsList = ({ items, kind }: { items: ReportsTopItem[]; kind: 'demand' | 'rated' }) => {
  if (items.length === 0) return <div className="flex h-32 items-center justify-center type-caption text-foreground-muted">Henüz veri yok</div>
  return (
    <div className="space-y-2">
      {items.map((p, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-50 bg-slate-50/50 px-3 py-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm border border-slate-100 text-[10px] font-black text-slate-900">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-900 leading-none mb-1">{p.name}</p>
            <p className="text-[10px] text-slate-500 font-medium">{p.moduleLabel}</p>
          </div>
          {kind === 'demand' ? (
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone={p.fillRate >= 90 ? 'danger' : p.fillRate >= 60 ? 'warning' : 'success'}>%{p.fillRate} dolu</Badge>
              <span className="tabular-nums text-xs font-black text-slate-900">{p.applications}</span>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1">
              <StarIcon className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="tabular-nums text-xs font-black text-slate-900">{p.avgRating.toFixed(1)}</span>
              <span className="text-[10px] text-slate-500 font-medium">({p.reviewCount})</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const exportParticipantsCsv = (rows: ReportsTopParticipant[]) => {
  if (rows.length === 0) return
  const head = ['Ad Soyad', 'TC Kimlik', 'Toplam Katılım', 'Modül Dağılımı', 'Son Aktivite', 'Son Aktivite Tarihi']
  const lines = rows.map((r) => [
    r.fullName, r.tckn ?? '', r.totalParticipations,
    Object.entries(r.moduleBreakdown).map(([m, c]) => `${REPORTS_MODULE_LABELS[m] ?? m}: ${c}`).join(' | '),
    r.lastActivityName ?? '',
    formatDateTime(r.lastActivityAt),
  ])
  const csv = [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `en-aktif-katilimcilar-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('Excel dosyası indirildi.')
}

const TABS = [
  { key: 'overview', label: 'Genel Bakış', icon: ActivityIcon },
  { key: 'modules', label: 'Modül Kırılımı', icon: LayersIcon },
  { key: 'participants', label: 'En Aktif Katılımcılar', icon: TrophyIcon },
  { key: 'activity', label: 'Katılımcı Aktivite Raporu', icon: ClipboardListIcon },
  { key: 'demographics', label: 'Demografi', icon: Users2Icon },
]

const AiSummaryModal = ({ onClose, params }: { onClose: () => void; params: ReportsOverviewParams }) => {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    reportsService.getAiSummary(params)
      .then((s) => setSummary(s))
      .catch((err) => {
        const msg = err?.response?.data?.message
        setErrorMsg(typeof msg === 'string' && msg
          ? msg
          : 'Yapay zeka özeti oluşturulamadı. Ayarlar > Entegrasyonlar bölümünden bir AI sağlayıcı etkinleştirin.')
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Modal open onClose={onClose} title="Yapay Zeka Özeti" width={512} bodyClassName="px-5 py-4">
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        </div>
      ) : errorMsg ? (
        <p className="text-sm text-slate-600">{errorMsg}</p>
      ) : (
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{summary}</p>
      )}
    </Modal>
  )
}

export const ReportsPage = () => {
  const { data, loading, range, setRange, moduleFilter, setModuleFilter } = useReportsOverview()
  const [tab, setTab] = useState('overview')
  const [selectedParticipant, setSelectedParticipant] = useState<ReportsTopParticipant | null>(null)
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false)
  const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const trendSeries = Object.keys(REPORTS_MODULE_LABELS)
    .filter((k) => !moduleFilter || k === moduleFilter)
    .map((k) => ({ key: k, label: REPORTS_MODULE_LABELS[k] }))
  const trendData = (data?.trend ?? []).map((p) => ({ date: p.date, ...p.values }))

  const genderData = data ? [
    { label: 'Erkek', value: data.gender.male },
    { label: 'Kadın', value: data.gender.female },
    ...(data.gender.unknown > 0 ? [{ label: 'Belirsiz', value: data.gender.unknown }] : []),
  ] : []
  const nationalityData = data ? [
    { label: 'Türk', value: data.nationality.turkish },
    { label: 'Yabancı', value: data.nationality.foreign },
    ...(data.nationality.unknown > 0 ? [{ label: 'Belirsiz', value: data.nationality.unknown }] : []),
  ] : []
  const ageData = (data?.ageBuckets ?? []).map((a) => ({ label: a.bucket, value: a.count }))
  const ratingData = (data?.rating.distribution ?? []).map((v, i) => ({ label: `${i + 1}★`, value: v }))
  const genderTotal = data ? data.gender.male + data.gender.female + data.gender.unknown : 0
  const natTotal = data ? data.nationality.turkish + data.nationality.foreign + data.nationality.unknown : 0
  const statusData = (data?.statusBreakdown ?? []).map((s) => ({ label: s.label, value: s.count }))

  const kpiPlaceholders = [{ key: 'total' }, { key: 'approved' }, { key: 'pending' }, { key: 'people' }, { key: 'modules' }] as ReportsOverview['kpis']

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={BarChart3Icon}
          title="Raporlama & Analiz"
          subtitle={`${today} · Modül performansı ve katılım analizi`}
          breadcrumb="Raporlama / Genel Analiz"
          actions={
            <Button
              variant="outline"
              size="sm"
              iconLeft={<SparklesIcon className="h-4 w-4" />}
              onClick={() => setAiSummaryOpen(true)}
            >
              Yapay Zeka ile Özetle
            </Button>
          }
        />

        <Tabs
          value={tab}
          onValueChange={setTab}
          tabs={TABS}
          action={
            <div
              className="flex items-center gap-2 text-xs"
              style={{ '--radius-field': '0px', '--control-h': '2rem' } as React.CSSProperties}
            >
              <Select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="w-[160px]">
                <option value="">Tüm Modüller</option>
                {Object.entries(REPORTS_MODULE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </Select>
              <DateRangeSelect value={range} onChange={setRange} />
            </div>
          }
        />

        <div className="pilot-content flex-1 space-y-6 overflow-auto">
        <div className="pilot-stat-grid">
          {(data?.kpis ?? kpiPlaceholders).map((k) => (
            <div key={k.key} className="relative">
              <StatCard
                label={k.label ?? ''}
                value={loading ? '—' : (k.current?.toLocaleString('tr-TR') ?? '—')}
                icon={KPI_ICONS[k.key] ?? TrendingUpIcon}
                accent={KPI_ACCENT[k.key] ?? 'blue'}
                loading={loading}
                hint={!loading && k.previous != null ? `Önceki dönem: ${k.previous.toLocaleString('tr-TR')}` : undefined}
                className="rounded-lg border-none shadow-sm"
              />
              {!loading && k.deltaPct != null && (
                <div className="absolute right-4 top-4"><Delta pct={k.deltaPct} /></div>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-white shadow-sm border border-slate-100 overflow-hidden min-h-[500px] p-6 space-y-6">
          {tab === 'overview' && (
            <>
              <Panel title="Katılım Trendi" icon={ActivityIcon} sub="Tüm modüller, seçili döneme göre">
                {loading ? <ChartSkeleton />
                  : trendData.length === 0 ? <div className="flex h-[260px] items-center justify-center type-caption text-foreground-muted">Veri yok</div>
                  : <AreaTrendChart data={trendData} xKey="date" series={trendSeries} formatX={formatDate} />}
              </Panel>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="En Çok Talep Gören Programlar" icon={FlameIcon} sub="Başvuru sayısı ve doluluk">
                  {loading ? <ChartSkeleton h={128} /> : <TopItemsList items={data?.topDemand ?? []} kind="demand" />}
                </Panel>
                <Panel title="En Çok Beğenilen Programlar" icon={HeartIcon} sub="Ortalama değerlendirme puanı">
                  {loading ? <ChartSkeleton h={128} /> : <TopItemsList items={data?.topRated ?? []} kind="rated" />}
                </Panel>
              </div>

              <Panel title="Başvuru Durum Dağılımı" icon={ClipboardListIcon} sub="Tüm modüller birleşik">
                {loading ? <ChartSkeleton /> : statusData.length === 0 ? <div className="flex h-[260px] items-center justify-center type-caption text-foreground-muted">Veri yok</div> : <CategoryBarChart data={statusData} multicolor />}
              </Panel>
            </>
          )}

          {tab === 'modules' && data && (
            <ReportsModuleBreakdownTab data={data} loading={loading} />
          )}

          {tab === 'participants' && data && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" iconLeft={<DownloadIcon className="h-4 w-4" />} onClick={() => exportParticipantsCsv(data.topParticipants)}>
                  Excel'e Aktar
                </Button>
              </div>
              <ReportsParticipantsTab data={data} onPick={setSelectedParticipant} />
            </div>
          )}

          {tab === 'activity' && <ReportsParticipantActivityTab />}

          {tab === 'demographics' && (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <Panel title="Cinsiyet Dağılımı" icon={Users2Icon}>
                  {loading ? <ChartSkeleton h={240} /> : <DonutChart data={genderData} centerValue={genderTotal.toLocaleString('tr-TR')} centerLabel="kişi" />}
                </Panel>
                <Panel title="Uyruk (Türk / Yabancı)" icon={GlobeIcon} sub="TCKN'den türetilir">
                  {loading ? <ChartSkeleton h={240} /> : <DonutChart data={nationalityData} centerValue={natTotal.toLocaleString('tr-TR')} centerLabel="kişi" />}
                </Panel>
                <Panel title="Değerlendirme (Puan)" icon={StarIcon} sub={data ? `Ortalama ★${data.rating.average.toFixed(1)} · ${data.rating.totalReviews} değerlendirme` : undefined}>
                  {loading ? <ChartSkeleton h={240} />
                    : data && data.rating.totalReviews === 0
                      ? <div className="flex h-[240px] items-center justify-center type-caption text-foreground-muted">Henüz değerlendirme yok</div>
                      : <CategoryBarChart data={ratingData} height={240} color="hsl(var(--accent-orange))" />}
                </Panel>
              </div>
              <Panel title="Yaş Grupları" icon={CakeIcon} sub="Katılımcı yaş dağılımı">
                {loading ? <ChartSkeleton /> : <CategoryBarChart data={ageData} multicolor />}
              </Panel>
            </>
          )}
        </div>
        </div>

        <ParticipantDetailModal
          participant={selectedParticipant}
          range={range}
          onClose={() => setSelectedParticipant(null)}
        />

        {aiSummaryOpen && (
          <AiSummaryModal
            onClose={() => setAiSummaryOpen(false)}
            params={{
              preset: range.preset,
              from: range.preset === 'custom' ? range.from : undefined,
              to: range.preset === 'custom' ? range.to : undefined,
              module: moduleFilter || undefined,
            }}
          />
        )}
      </div>
    </UiStandardsContext.Provider>
  )
}
