import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  UsersIcon, CheckCircle2Icon, ClockIcon, UserCheckIcon,
  ArrowUpIcon, ArrowDownIcon, TrendingUpIcon, LayersIcon,
  Users2Icon, GlobeIcon, CakeIcon, StarIcon, FlameIcon, HeartIcon, ActivityIcon,
  CalendarIcon, LayoutDashboardIcon, UserPlusIcon, CalendarDaysIcon, LogInIcon, ClipboardListIcon,
  BookOpenIcon, HourglassIcon,
} from 'lucide-react'
import { PageHeader, StatCard, Select, Badge, Tabs } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { AreaTrendChart, CategoryBarChart, DonutChart } from '@/design-system/charts'
import { useAuth } from '@/framework/auth/AuthContext'
import { SCOPABLE_MODULES } from '@/framework/auth/scopableModules'
import { MODULE_ROUTES } from '@/framework/auth/moduleRoutes'
import { useHasFacilityScopeRestriction } from '@/framework/auth/useFacilityScopeRestriction'
import { useAnalyticsOverview, resolveDateRange, type DateRangePreset } from './useAnalyticsOverview'
import { useDashboardActivity } from './useDashboardActivity'
import { RecentMembersPanel } from './RecentMembersPanel'
import { OnlineUsersPanel } from './OnlineUsersPanel'
import { RecentEventsPanel } from './RecentEventsPanel'
import { RecentLoginsPanel } from './RecentLoginsPanel'
import { RecentApplicationsPanel } from './RecentApplicationsPanel'
import { ModuleSummariesPanel } from './ModuleSummariesPanel'
import { LibraryAnalyticsPanel } from '@/modules/library/LibraryAnalyticsPanel'
import { MODULE_LABELS } from '@/types/analytics.types'
import type { AnalyticsOverview } from '@/types/analytics.types'

const KPI_ICONS: Record<string, typeof UsersIcon> = {
  total: TrendingUpIcon, approved: CheckCircle2Icon, pending: ClockIcon, people: UserCheckIcon,
}
const KPI_ACCENT: Record<string, 'blue' | 'green' | 'orange' | 'violet'> = {
  total: 'blue', approved: 'green', pending: 'orange', people: 'violet',
}

const RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Bugün' },
  { value: 'yesterday', label: 'Dün' },
  { value: 'week', label: 'Bu Hafta' },
  { value: 'month', label: 'Bu Ay' },
  { value: 'year', label: 'Bu Yıl' },
  { value: 'custom', label: 'Özel Tarih Aralığı' },
]

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

interface PanelProps { title: string; icon: typeof UsersIcon; children: React.ReactNode; sub?: string }
const Panel = ({ title, icon: Icon, children, sub }: PanelProps) => (
  <div className="rounded-card border border-border bg-surface-1 p-4 shadow-card">
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-soft"><Icon className="h-4 w-4 text-primary" /></span>
      <div>
        <p className="type-section text-foreground-strong">{title}</p>
        {sub && <p className="type-caption text-foreground-subtle">{sub}</p>}
      </div>
    </div>
    {children}
  </div>
)

const formatDate = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
}

const TopList = ({ items, kind }: { items: AnalyticsOverview['topDemand']; kind: 'demand' | 'rated' }) => {
  if (items.length === 0) return <div className="flex h-32 items-center justify-center type-caption text-foreground-muted">Henüz veri yok</div>
  return (
    <div className="space-y-2">
      {items.map((p, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-surface-0 px-3 py-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft type-caption font-bold text-primary">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate type-body-strong text-foreground-strong">{p.name}</p>
            <p className="type-caption text-foreground-muted">{p.label}</p>
          </div>
          {kind === 'demand' ? (
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone={p.fillRate >= 90 ? 'danger' : p.fillRate >= 60 ? 'warning' : 'success'}>%{p.fillRate} dolu</Badge>
              <span className="tabular-nums type-body-strong text-foreground-strong">{p.applications}</span>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1">
              <StarIcon className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="tabular-nums type-body-strong text-foreground-strong">{p.avgRating.toFixed(1)}</span>
              <span className="type-caption text-foreground-muted">({p.reviewCount})</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const ChartSkeleton = ({ h = 260 }: { h?: number }) => <div className="animate-pulse rounded-lg bg-surface-2" style={{ height: h }} />

const pickSingleRoute = (matches: string[]): string | null =>
  matches.length === 1 ? matches[0] : null

const useSingleModuleRedirect = (): string | null => {
  const { getFacilityScope, can, isSuperAdmin } = useAuth()
  const hasRestriction = useHasFacilityScopeRestriction()

  return useMemo(() => {
    if (isSuperAdmin || !hasRestriction) return null

    const scoped = SCOPABLE_MODULES.filter((cfg) => getFacilityScope(cfg.moduleKey) !== null)
    if (scoped.length > 0) return pickSingleRoute(scoped.map((cfg) => cfg.routePath))

    const permitted = MODULE_ROUTES.filter((cfg) => can(cfg.permissionKey))
    return pickSingleRoute(permitted.map((cfg) => cfg.routePath))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRestriction, isSuperAdmin])
}

const TABS = [
  { key: 'overview', label: 'Genel Bakış', icon: ActivityIcon },
  { key: 'demographics', label: 'Demografi', icon: Users2Icon },
  { key: 'library', label: 'Kütüphane', icon: BookOpenIcon },
  { key: 'activity', label: 'Son Hareketler', icon: ClipboardListIcon },
] as const

export const DashboardPage = () => {
  const singleModuleRedirect = useSingleModuleRedirect()
  const { can } = useAuth()
  const { data, loading, preset, setPreset, customFrom, customTo } = useAnalyticsOverview()
  const { data: activity, loading: activityLoading } = useDashboardActivity()
  const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const defaultCustom = resolveDateRange('custom')
  const [draftFrom, setDraftFrom] = useState(customFrom ?? defaultCustom.from)
  const [draftTo, setDraftTo] = useState(customTo ?? defaultCustom.to)

  const canLibrary = can('library.view')
  const visibleTabs = TABS.filter((t) => t.key !== 'library' || canLibrary)
  const [tab, setTab] = useState<string>('overview')

  if (singleModuleRedirect) {
    return <Navigate to={singleModuleRedirect} replace />
  }

  const handlePresetChange = (value: string) => {
    if (value === 'custom') {
      setPreset('custom', { from: draftFrom, to: draftTo })
    } else {
      setPreset(value)
    }
  }

  const applyCustomRange = () => {
    if (draftFrom && draftTo) setPreset('custom', { from: draftFrom, to: draftTo })
  }

  const trendData = (data?.trend ?? []).map((p) => ({ date: p.date, ...p.values }))
  const trendSeries = (data?.modules ?? []).map((m) => ({ key: m.module, label: MODULE_LABELS[m.module] ?? m.label }))
  const moduleBars = (data?.modules ?? []).map((m) => ({ label: m.label, value: m.total }))
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

  const kpiPlaceholders = [{ key: 'total' }, { key: 'approved' }, { key: 'pending' }, { key: 'people' }] as AnalyticsOverview['kpis']
  const globalStats = activity?.globalStats
  const library = globalStats?.library

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex min-h-full flex-col">
        <PageHeader
          icon={LayoutDashboardIcon}
          title="Dashboard"
          subtitle={today}
          breadcrumb="Ana Sayfa / Dashboard"
          actions={(
            <div className="w-56 shrink-0">
              <Select
                dropdown
                aria-label="Tarih aralığı"
                value={preset}
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
          )}
        />

        <div className="pilot-content flex-1 space-y-6">
        {preset === 'custom' && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-1.5 rounded-field border border-border bg-surface-1 px-2 py-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-foreground-subtle" />
              <input
                type="date"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
                onBlur={applyCustomRange}
                className="bg-transparent text-[12px] text-foreground-default outline-none"
              />
              <span className="text-foreground-subtle">—</span>
              <input
                type="date"
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
                onBlur={applyCustomRange}
                className="bg-transparent text-[12px] text-foreground-default outline-none"
              />
            </div>
          </div>
        )}

        <div className="pilot-stat-grid pilot-stat-grid-4">
          {(data?.kpis ?? kpiPlaceholders).map((k) => (
            <div key={k.key} className="relative">
              <StatCard
                label={k.label ?? ''}
                value={loading ? '—' : (k.current?.toLocaleString('tr-TR') ?? '—')}
                icon={KPI_ICONS[k.key] ?? TrendingUpIcon}
                accent={KPI_ACCENT[k.key] ?? 'blue'}
                loading={loading}
                hint={!loading && k.previous != null ? `Önceki dönem: ${k.previous.toLocaleString('tr-TR')}` : undefined}
              />
              {!loading && k.deltaPct != null && (
                <div className="absolute right-3 top-3"><Delta pct={k.deltaPct} /></div>
              )}
            </div>
          ))}
        </div>

        <div className="pilot-stat-grid pilot-stat-grid-4">
          <StatCard
            label="Toplam Üye"
            value={activityLoading ? '—' : (globalStats?.totalParticipants.toLocaleString('tr-TR') ?? '—')}
            icon={UsersIcon}
            accent="blue"
            loading={activityLoading}
            hint={!activityLoading && globalStats ? `+${globalStats.newParticipantsToday} bugün · +${globalStats.newParticipantsThisWeek} bu hafta` : undefined}
          />
          <StatCard
            label="Bu Ay Yeni Üye"
            value={activityLoading ? '—' : (globalStats?.newParticipantsThisMonth.toLocaleString('tr-TR') ?? '—')}
            icon={UserPlusIcon}
            accent="violet"
            loading={activityLoading}
            hint={!activityLoading && globalStats ? `${globalStats.newParticipantsToday} kişi bugün kayıt oldu` : undefined}
          />
          <StatCard
            label="Toplam Etkinlik"
            value={activityLoading ? '—' : (globalStats?.totalEvents.toLocaleString('tr-TR') ?? '—')}
            icon={CalendarDaysIcon}
            accent="orange"
            loading={activityLoading}
            hint={!activityLoading && globalStats ? `${globalStats.activeEvents} aktif · ${globalStats.eventsThisMonth} bu ay yeni` : undefined}
          />
          <StatCard
            label="Toplam Kütüphane"
            value={activityLoading ? '—' : (library ? library.totalLibraries.toLocaleString('tr-TR') : '—')}
            icon={BookOpenIcon}
            accent="green"
            loading={activityLoading}
            hint={!activityLoading && library ? `${library.activeLibraries} aktif · kapasite ${library.totalCapacity.toLocaleString('tr-TR')}` : undefined}
          />
        </div>

        <OnlineUsersPanel />

        <Tabs tabs={visibleTabs} value={tab} onValueChange={setTab} />

        {tab === 'overview' && (
          <div className="space-y-6">
            <Panel title="Modül Özetleri" icon={LayersIcon} sub="Yetkili olduğunuz her modülün toplam kaydı">
              <ModuleSummariesPanel items={activity?.moduleSummaries ?? []} loading={activityLoading} />
            </Panel>

            <Panel title="Başvuru Trendi" icon={ActivityIcon} sub="Yetkili olduğunuz modüller, seçili döneme göre">
              {loading ? <ChartSkeleton />
                : trendData.length === 0 ? <div className="flex h-[260px] items-center justify-center type-caption text-foreground-muted">Veri yok</div>
                : <AreaTrendChart data={trendData} xKey="date" series={trendSeries} formatX={formatDate} />}
            </Panel>

            <Panel title="Modül Kırılımı" icon={LayersIcon} sub="Başvuru sayısı">
              {loading ? <ChartSkeleton /> : <CategoryBarChart data={moduleBars} layout="vertical" multicolor />}
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="En Çok Talep Gören Programlar" icon={FlameIcon} sub="Başvuru sayısı ve doluluk">
                {loading ? <ChartSkeleton h={128} /> : <TopList items={data?.topDemand ?? []} kind="demand" />}
              </Panel>
              <Panel title="En Çok Beğenilen Programlar" icon={HeartIcon} sub="Ortalama değerlendirme puanı">
                {loading ? <ChartSkeleton h={128} /> : <TopList items={data?.topRated ?? []} kind="rated" />}
              </Panel>
            </div>
          </div>
        )}

        {tab === 'demographics' && (
          <div className="space-y-6">
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

            <Panel title="Yaş Grupları" icon={CakeIcon} sub="Başvuran yaş dağılımı">
              {loading ? <ChartSkeleton /> : <CategoryBarChart data={ageData} multicolor />}
            </Panel>
          </div>
        )}

        {tab === 'library' && canLibrary && (
          <div className="space-y-6">
            {library && (
              <Panel title="Anlık Genel Durum" icon={HourglassIcon} sub="Yetkili olduğunuz kütüphaneler birleşik">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="İçeride" value={library.currentOccupancy} icon={UserCheckIcon} accent="green" />
                  <StatCard label="Molada" value={library.onBreakNow} icon={ClockIcon} accent="orange" />
                  <StatCard label="Sırada" value={library.waitingNow} icon={HourglassIcon} accent="violet" />
                  <StatCard label="Doluluk" value={`%${library.occupancyRate.toFixed(1)}`} icon={TrendingUpIcon} accent="blue" />
                </div>
              </Panel>
            )}
            <LibraryAnalyticsPanel showTopLibraries />
          </div>
        )}

        {tab === 'activity' && (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Yeni Üyeler" icon={UserPlusIcon} sub="Son kayıt olan vatandaşlar">
                <RecentMembersPanel items={activity?.recentMembers ?? []} loading={activityLoading} />
              </Panel>
              <Panel title="Son Etkinlikler" icon={CalendarDaysIcon} sub="Son oluşturulan etkinlikler ve doluluk">
                <RecentEventsPanel items={activity?.recentEvents ?? []} loading={activityLoading} />
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Son Giriş / Çıkışlar" icon={LogInIcon} sub="Personel ve vatandaş oturum hareketleri">
                <RecentLoginsPanel items={activity?.recentLogins ?? []} loading={activityLoading} />
              </Panel>
              <Panel title="Yeni Başvurular" icon={ClipboardListIcon} sub="Yetkili olduğunuz modüllerden en son başvurular">
                <RecentApplicationsPanel items={activity?.recentApplications ?? []} loading={activityLoading} />
              </Panel>
            </div>
          </div>
        )}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
