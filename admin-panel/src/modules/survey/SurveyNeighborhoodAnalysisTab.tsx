import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MapPinnedIcon,
  MessageSquareIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  StarIcon,
  AlertTriangleIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  FlameIcon,
  AwardIcon,
} from 'lucide-react'
import {
  Badge,
  DataTable,
  EmptyState,
  FilterBar,
  FilterField,
  Progress,
  Select,
  SkeletonRows,
  StatCard,
  type DataTableColumn,
} from '@/design-system'
import { AreaTrendChart, CategoryBarChart, DonutChart } from '@/design-system/charts'
import { BakirkoyNeighborhoodMap } from '@/components/specialized/BakirkoyNeighborhoodMap'
import surveyPlatformService from '@/services/surveyPlatform.service'
import { useNeighborhoodOptions } from '@/hooks/useNeighborhoodOptions'
import { SURVEY_TOPIC_OPTIONS } from '@/types/surveyPlatform.types'
import type {
  SurveyNeighborhoodStats,
  SurveyTopicStats,
  SurveyExecutiveDashboard,
} from '@/types/surveyPlatform.types'

// Kullanıcı isteği (2026-09-01, docs/ankettema/06.png "MAHALLE ANALİZİ" ekranı):
// mahalleler anket sonuçlarına göre haritada renklendirilsin (memnuniyet %80-100 yeşil →
// %0-20 kırmızı), olumlu/olumsuz oranlar, genel analiz ve grafikler tek raporda toplansın;
// en problemli mahalle ve en sık sorunlar öne çıkarılsın. Tabloda sıralama yapılabilsin.

/** 06.png lejantı: memnuniyet yüzdesine göre 5 kademeli renk skalası. */
const HEAT_BUCKETS = [
  { min: 80, label: '80-100', hex: '#16a34a', bg: 'bg-[#16a34a]', text: 'text-white' },
  { min: 60, label: '60-80', hex: '#84cc16', bg: 'bg-[#84cc16]', text: 'text-white' },
  { min: 40, label: '40-60', hex: '#facc15', bg: 'bg-[#facc15]', text: 'text-slate-900' },
  { min: 20, label: '20-40', hex: '#fb923c', bg: 'bg-[#fb923c]', text: 'text-white' },
  { min: 0, label: '0-20', hex: '#ef4444', bg: 'bg-[#ef4444]', text: 'text-white' },
] as const

const bucketOf = (percent: number) =>
  HEAT_BUCKETS.find((b) => percent >= b.min) ?? HEAT_BUCKETS[HEAT_BUCKETS.length - 1]

/**
 * Ölçüm bulgusu (2026-09-01, gerçek ekranda doğrulandı): hiç yanıtı/kaydı olmayan mahalleler
 * %0 ile en koyu kırmızıya boyanıyor ve "en problemli mahalle" olarak öne çıkıyordu — bu
 * yanıltıcıdır (veri yokluğu ≠ memnuniyetsizlik). Veri yoksa artık null döner, haritada gri
 * "veri yok" olarak gösterilir ve en problemli/en memnun hesabına girmez.
 */
const satisfactionPercent = (n: SurveyNeighborhoodStats): number | null => {
  if (n.satisfactionScore > 0) return Math.round((n.satisfactionScore / 5) * 100)
  if (n.totalSubmissionCount > 0) return Math.round(n.resolutionRate)
  return null
}

const hasData = (n: SurveyNeighborhoodStats) => satisfactionPercent(n) !== null

/**
 * Hata bulgusu (2026-09-02, ekran doğrulaması): "Diğer / Belirsiz" satırı (sistemdeki
 * resmî 15 mahalleyle eşleşmeyen kayıtlar için — ör. eski "Hürriyet Mahallesi" test
 * verisi) "En Problemli Mahalle" olarak öne çıkabiliyordu. Coğrafi haritada resmî
 * mahalle olmadığı için hiç görünmüyor, ama KPI kartında yönetici var olmayan bir yeri
 * "kritik" olarak görüyordu. Resmî mahalle sıralamalarından her zaman dışlanır.
 */
const isOfficialNeighborhood = (n: SurveyNeighborhoodStats) => n.neighborhood !== 'Diğer / Belirsiz'

const NO_DATA = { hex: '#cbd5e1', label: 'Veri yok' } as const

const TrendBadge = ({ value }: { value: number }) => {
  if (value === 0) return <span className="type-muted">—</span>
  const up = value > 0
  return (
    <span className={`inline-flex items-center gap-1 type-caption font-medium ${up ? 'text-[hsl(var(--danger))]' : 'text-[hsl(var(--success))]'}`}>
      {up ? <TrendingUpIcon className="h-3.5 w-3.5" /> : <TrendingDownIcon className="h-3.5 w-3.5" />}
      %{Math.abs(value).toFixed(1)}
    </span>
  )
}

type SortKey = 'satisfaction' | 'responses' | 'submissions' | 'open' | 'resolution' | 'name'

export const SurveyNeighborhoodAnalysisTab = () => {
  const neighborhoodOptions = useNeighborhoodOptions()
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('')
  const [topicFilter, setTopicFilter] = useState('')
  const [neighborhoods, setNeighborhoods] = useState<SurveyNeighborhoodStats[]>([])
  const [topics, setTopics] = useState<SurveyTopicStats[]>([])
  const [executive, setExecutive] = useState<SurveyExecutiveDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  // Kullanıcı isteği: mahalle analizi sayfasında sıralama olsun.
  const [sortKey, setSortKey] = useState<SortKey>('satisfaction')
  const [sortAsc, setSortAsc] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const filters = {
      neighborhood: neighborhoodFilter || undefined,
      topic: topicFilter || undefined,
    }
    Promise.all([
      surveyPlatformService.getNeighborhoodStats(filters),
      surveyPlatformService.getTopicStats(filters),
      surveyPlatformService.getExecutiveDashboard(filters).catch(() => null),
    ])
      .then(([n, t, e]) => { setNeighborhoods(n); setTopics(t); setExecutive(e) })
      .catch(() => { setNeighborhoods([]); setTopics([]); setExecutive(null) })
      .finally(() => setLoading(false))
  }, [neighborhoodFilter, topicFilter])

  useEffect(() => { load() }, [load])

  const sorted = useMemo(() => {
    const dir = sortAsc ? 1 : -1
    return neighborhoods.slice().sort((a, b) => {
      switch (sortKey) {
        case 'name': return dir * a.neighborhood.localeCompare(b.neighborhood, 'tr')
        case 'responses': return dir * (a.responseCount - b.responseCount)
        case 'submissions': return dir * (a.totalSubmissionCount - b.totalSubmissionCount)
        case 'open': return dir * (a.openSubmissionCount - b.openSubmissionCount)
        case 'resolution': return dir * (a.resolutionRate - b.resolutionRate)
        default: {
          // Veri olmayan mahalleler her zaman listenin sonunda kalır.
          const pa = satisfactionPercent(a); const pb = satisfactionPercent(b)
          if (pa === null && pb === null) return 0
          if (pa === null) return 1
          if (pb === null) return -1
          return dir * (pa - pb)
        }
      }
    })
  }, [neighborhoods, sortKey, sortAsc])

  /** Genel analiz: en problemli / en iyi mahalle, en sık sorunlar, olumlu-olumsuz oran. */
  const analysis = useMemo(() => {
    if (neighborhoods.length === 0) return null
    // Yalnızca gerçekten verisi olan RESMİ mahalleler değerlendirilir.
    const withData = neighborhoods.filter((n) => hasData(n) && isOfficialNeighborhood(n))
    const byScore = withData.slice().sort((a, b) => satisfactionPercent(a)! - satisfactionPercent(b)!)
    const worst = byScore[0]
    const best = byScore[byScore.length - 1]
    const mostOpen = neighborhoods.filter(isOfficialNeighborhood).slice().sort((a, b) => b.openSubmissionCount - a.openSubmissionCount)[0]

    const issueTally = new Map<string, number>()
    for (const n of neighborhoods) {
      for (const i of n.topIssues) issueTally.set(i.label, (issueTally.get(i.label) ?? 0) + i.count)
    }
    const topIssues = [...issueTally.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)

    const avgPercent = withData.length > 0
      ? Math.round(withData.reduce((s, n) => s + satisfactionPercent(n)!, 0) / withData.length)
      : null
    const positive = withData.filter((n) => satisfactionPercent(n)! >= 60).length
    const negative = withData.filter((n) => satisfactionPercent(n)! < 40).length

    return {
      worst, best, mostOpen, topIssues, avgPercent, positive, negative,
      neutral: withData.length - positive - negative,
      withDataCount: withData.length,
      noDataCount: neighborhoods.length - withData.length,
    }
  }, [neighborhoods])

  const heatLegendCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of neighborhoods) {
      const p = satisfactionPercent(n)
      if (p === null) { counts.set(NO_DATA.label, (counts.get(NO_DATA.label) ?? 0) + 1); continue }
      const b = bucketOf(p)
      counts.set(b.label, (counts.get(b.label) ?? 0) + 1)
    }
    return counts
  }, [neighborhoods])

  const hoodColumns: DataTableColumn<SurveyNeighborhoodStats>[] = [
    {
      key: 'neighborhood', header: 'Mahalle', sortable: true,
      cell: (r) => {
        const p = satisfactionPercent(r)
        const hex = p === null ? NO_DATA.hex : bucketOf(p).hex
        return (
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 flex-shrink-0 rounded-sm" style={{ background: hex }} />
            <span className="type-body-strong">{r.neighborhood}</span>
          </span>
        )
      },
    },
    {
      key: 'satisfactionPercent', header: 'Memnuniyet %', align: 'center', sortable: true,
      cell: (r) => {
        const p = satisfactionPercent(r)
        if (p === null) return <span className="type-muted">Veri yok</span>
        const b = bucketOf(p)
        return (
          <span
            className="inline-block min-w-[52px] rounded-md px-2 py-0.5 text-xs font-bold tabular-nums text-white"
            style={{ background: b.hex, color: b.hex === '#facc15' ? '#0f172a' : undefined }}
          >
            %{p}
          </span>
        )
      },
    },
    { key: 'responseCount', header: 'Anket Yanıtı', align: 'center', sortable: true, cell: (r) => <span className="tabular-nums">{r.responseCount}</span> },
    {
      key: 'satisfactionScore', header: 'Skor', align: 'center', sortable: true,
      cell: (r) => (
        <span className="inline-flex items-center gap-1 tabular-nums">
          <StarIcon className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />
          {r.satisfactionScore.toFixed(1)}
        </span>
      ),
    },
    {
      key: 'submissions', header: 'Talep/Şikâyet', sortable: true,
      cell: (r) => (
        <div className="min-w-[130px] space-y-1">
          <div className="flex items-center justify-between type-caption">
            <span className="tabular-nums">{r.resolvedSubmissionCount} / {r.totalSubmissionCount}</span>
            <span className="tabular-nums">%{Math.round(r.resolutionRate)}</span>
          </div>
          <Progress value={r.resolutionRate} tone={r.resolutionRate >= 70 ? 'success' : r.resolutionRate >= 40 ? 'warning' : 'danger'} />
        </div>
      ),
    },
    { key: 'openSubmissionCount', header: 'Açık Kayıt', align: 'center', sortable: true, cell: (r) => r.openSubmissionCount > 0 ? <Badge tone="warning">{r.openSubmissionCount}</Badge> : <span className="type-muted">0</span> },
    {
      key: 'topIssues', header: 'En Çok Şikâyet',
      cell: (r) => r.topIssues.length > 0
        ? <span className="type-caption line-clamp-1">{r.topIssues.slice(0, 3).map((i) => i.label).join(', ')}</span>
        : <span className="type-muted">—</span>,
    },
    { key: 'trend', header: '30 Gün Trend', align: 'center', sortable: true, cell: (r) => <TrendBadge value={r.trendChangePercent} /> },
  ]

  const topicColumns: DataTableColumn<SurveyTopicStats>[] = [
    { key: 'topic', header: 'Konu', sortable: true, cell: (r) => <Badge tone="neutral">{r.topic}</Badge> },
    { key: 'responseCount', header: 'Anket Yanıtı', align: 'center', sortable: true, cell: (r) => <span className="tabular-nums">{r.responseCount}</span> },
    { key: 'satisfactionScore', header: 'Memnuniyet', align: 'center', sortable: true, cell: (r) => <span className="tabular-nums">{r.satisfactionScore.toFixed(1)}</span> },
    { key: 'submissionCount', header: 'Başvuru', align: 'center', sortable: true, cell: (r) => <span className="tabular-nums">{r.submissionCount}</span> },
    { key: 'resolutionRate', header: 'Çözüm Oranı', align: 'center', sortable: true, cell: (r) => <span className="tabular-nums">%{Math.round(r.resolutionRate)}</span> },
    { key: 'trend', header: '30 Gün Trend', align: 'center', sortable: true, cell: (r) => <TrendBadge value={r.trendChangePercent} /> },
  ]

  const SortButton = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => {
        if (sortKey === k) setSortAsc((v) => !v)
        else { setSortKey(k); setSortAsc(k === 'satisfaction') }
      }}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 type-caption font-medium transition-colors ${
        sortKey === k
          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]'
          : 'border-border text-foreground-muted hover:bg-surface-2'
      }`}
    >
      {label}
      {sortKey === k
        ? (sortAsc ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />)
        : <ArrowUpDownIcon className="h-3 w-3 opacity-50" />}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Mahalle Sayısı" value={neighborhoods.length} icon={MapPinnedIcon} accent="blue" />
        <StatCard label="Genel Memnuniyet" value={analysis?.avgPercent !== null && analysis?.avgPercent !== undefined ? `%${analysis.avgPercent}` : '—'} icon={StarIcon} accent="green" hint={analysis ? `${analysis.withDataCount} mahallede veri var` : 'Tüm mahalle ortalaması'} />
        <StatCard label="Açık Kayıt" value={neighborhoods.reduce((s, n) => s + n.openSubmissionCount, 0)} icon={MessageSquareIcon} accent="orange" />
        <StatCard
          label="En Problemli Mahalle"
          value={analysis?.worst?.neighborhood ?? '—'}
          icon={AlertTriangleIcon}
          accent="danger"
          hint={analysis?.worst ? `%${satisfactionPercent(analysis.worst)} memnuniyet` : 'Yeterli veri yok'}
        />
      </div>

      <FilterBar
        hasActiveFilters={!!neighborhoodFilter || !!topicFilter}
        onClear={() => { setNeighborhoodFilter(''); setTopicFilter('') }}
        columns={2}
      >
        <FilterField label="Mahalle">
          <Select value={neighborhoodFilter} onChange={(e) => setNeighborhoodFilter(e.target.value)}>
            <option value="">Tüm Mahalleler</option>
            {neighborhoodOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterField>
        <FilterField label="Konu">
          <Select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
            <option value="">Tüm Konular</option>
            {SURVEY_TOPIC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterField>
      </FilterBar>

      {loading ? (
        <SkeletonRows rows={8} />
      ) : neighborhoods.length === 0 ? (
        <EmptyState icon={MapPinnedIcon} title="Veri yok" description="Henüz mahalle bazında anket veya başvuru kaydı bulunmuyor." />
      ) : (
        <div className="space-y-6">
          {/* 06.png "MAHALLE ANALİZİ": Sultangazi'nin GERÇEK mahalle sınırlarıyla ısı haritası. */}
          <section className="rounded-panel border border-border bg-surface-1 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPinnedIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                <p className="type-section">Bakırköy Mahalle Isı Haritası</p>
                <span className="type-caption text-foreground-muted">
                  Anket sonuçlarına göre memnuniyet renklendirmesi — gerçek mahalle sınırları
                </span>
              </div>
            </div>

            <BakirkoyNeighborhoodMap
              data={neighborhoods.map((n) => ({
                neighborhood: n.neighborhood,
                percent: satisfactionPercent(n),
                responseCount: n.responseCount,
                openSubmissionCount: n.openSubmissionCount,
                topIssues: n.topIssues,
              }))}
              colorFor={(p) => (p === null ? NO_DATA.hex : bucketOf(p).hex)}
            />

            {/* Lejant (06.png alt şeridi) */}
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
              <span className="type-caption font-medium text-foreground-muted">Memnuniyet Oranı (%)</span>
              {HEAT_BUCKETS.map((b) => (
                <span key={b.label} className="inline-flex items-center gap-1.5 type-caption">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.hex }} />
                  {b.label}
                  <span className="text-foreground-muted">({heatLegendCounts.get(b.label) ?? 0})</span>
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 type-caption">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: NO_DATA.hex }} />
                {NO_DATA.label}
                <span className="text-foreground-muted">({heatLegendCounts.get(NO_DATA.label) ?? 0})</span>
              </span>
            </div>
          </section>

          {/* Sıralanabilir detay listesi (kutu görünümü) — haritanın altında ek bilgi. */}
          <section className="rounded-panel border border-border bg-surface-1 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="type-section">Detaylı Mahalle Listesi</p>
              <div className="flex flex-wrap items-center gap-2">
                <SortButton k="satisfaction" label="Memnuniyet" />
                <SortButton k="submissions" label="Talep" />
                <SortButton k="open" label="Açık" />
                <SortButton k="responses" label="Yanıt" />
                <SortButton k="name" label="A-Z" />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {sorted.map((n) => {
                const p = satisfactionPercent(n)
                const hex = p === null ? NO_DATA.hex : bucketOf(p).hex
                const dark = hex === '#facc15' || hex === NO_DATA.hex
                return (
                  <div
                    key={n.neighborhood}
                    title={`${n.neighborhood} · ${p === null ? 'veri yok' : `%${p} memnuniyet`} · ${n.responseCount} yanıt · ${n.openSubmissionCount} açık kayıt`}
                    className="group relative overflow-hidden rounded-xl p-3 transition-transform hover:scale-[1.03]"
                    style={{ background: hex }}
                  >
                    <div className={`type-caption font-bold leading-tight ${dark ? 'text-slate-900' : 'text-white'}`}>
                      {n.neighborhood}
                    </div>
                    <div className={`mt-1 text-lg font-black tabular-nums ${dark ? 'text-slate-900' : 'text-white'}`}>
                      {p === null ? '—' : `%${p}`}
                    </div>
                    <div className={`type-caption tabular-nums ${dark ? 'text-slate-700' : 'text-white/80'}`}>
                      {n.responseCount} yanıt · {n.openSubmissionCount} açık
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Genel analiz: olumlu/olumsuz oran + en sık sorunlar */}
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-panel border border-border bg-surface-1 p-4">
              <p className="type-section mb-3">Olumlu / Olumsuz Dağılım</p>
              <DonutChart
                height={210}
                data={[
                  { label: 'Olumlu (%60+)', value: analysis?.positive ?? 0 },
                  { label: 'Nötr (%40-60)', value: analysis?.neutral ?? 0 },
                  { label: 'Olumsuz (<%40)', value: analysis?.negative ?? 0 },
                ]}
                centerLabel="Verili Mahalle"
                centerValue={analysis?.withDataCount ?? 0}
              />
            </section>

            <section className="rounded-panel border border-border bg-surface-1 p-4 lg:col-span-2">
              <div className="mb-3 flex items-center gap-2">
                <FlameIcon className="h-4 w-4 text-[hsl(var(--danger))]" />
                <p className="type-section">En Sık Bildirilen Sorunlar</p>
              </div>
              {(analysis?.topIssues.length ?? 0) === 0 ? (
                <EmptyState icon={MessageSquareIcon} title="Sorun kaydı yok" description="Bu filtrede öne çıkan bir şikâyet başlığı bulunmuyor." />
              ) : (
                <CategoryBarChart data={analysis!.topIssues} height={210} layout="vertical" multicolor />
              )}
            </section>
          </div>

          {/* Öne çıkan bulgular */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-panel border border-[hsl(var(--danger)/0.35)] bg-[hsl(var(--danger)/0.06)] p-4">
              <div className="mb-1 flex items-center gap-2">
                <ThumbsDownIcon className="h-4 w-4 text-[hsl(var(--danger))]" />
                <span className="type-caption font-semibold text-[hsl(var(--danger))]">En Problemli Mahalle</span>
              </div>
              <p className="type-body-strong">{analysis?.worst?.neighborhood ?? '—'}</p>
              <p className="type-caption text-foreground-muted">
                {analysis?.worst ? `%${satisfactionPercent(analysis.worst)} memnuniyet` : 'Yeterli veri yok'} ·{' '}
                {analysis?.worst?.openSubmissionCount ?? 0} açık kayıt
              </p>
              {(analysis?.worst?.topIssues.length ?? 0) > 0 && (
                <p className="mt-1 type-caption">
                  Başlıca sorun: <b>{analysis!.worst.topIssues[0].label}</b>
                </p>
              )}
            </div>

            <div className="rounded-panel border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.06)] p-4">
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangleIcon className="h-4 w-4 text-[hsl(var(--warning))]" />
                <span className="type-caption font-semibold text-[hsl(var(--warning))]">En Çok Açık Kayıt</span>
              </div>
              <p className="type-body-strong">{analysis?.mostOpen?.neighborhood ?? '—'}</p>
              <p className="type-caption text-foreground-muted">
                {analysis?.mostOpen?.openSubmissionCount ?? 0} açık ·{' '}
                {analysis?.mostOpen?.totalSubmissionCount ?? 0} toplam kayıt
              </p>
              <p className="mt-1 type-caption">
                Çözüm oranı: <b>%{Math.round(analysis?.mostOpen?.resolutionRate ?? 0)}</b>
              </p>
            </div>

            <div className="rounded-panel border border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success)/0.06)] p-4">
              <div className="mb-1 flex items-center gap-2">
                <ThumbsUpIcon className="h-4 w-4 text-[hsl(var(--success))]" />
                <span className="type-caption font-semibold text-[hsl(var(--success))]">En Memnun Mahalle</span>
              </div>
              <p className="type-body-strong">{analysis?.best?.neighborhood ?? '—'}</p>
              <p className="type-caption text-foreground-muted">
                {analysis?.best ? `%${satisfactionPercent(analysis.best)} memnuniyet` : 'Yeterli veri yok'} ·{' '}
                {analysis?.best?.responseCount ?? 0} yanıt
              </p>
              <p className="mt-1 type-caption">
                Toplam kayıt: <b>{analysis?.best?.totalSubmissionCount ?? 0}</b>
              </p>
            </div>
          </div>

          {/* Trend + yaş/konu dağılımı (varsa) */}
          {executive && (
            <div className="grid gap-4 lg:grid-cols-2">
              {executive.satisfactionTrend.length > 0 && (
                <section className="rounded-panel border border-border bg-surface-1 p-4">
                  <p className="type-section mb-3">Memnuniyet Trendi</p>
                  <AreaTrendChart
                    data={executive.satisfactionTrend}
                    xKey="period"
                    series={[{ key: 'satisfaction', label: 'Memnuniyet' }]}
                    height={210}
                  />
                </section>
              )}
              {executive.topComplaints.length > 0 && (
                <section className="rounded-panel border border-border bg-surface-1 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <AwardIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                    <p className="type-section">Konu Bazında Şikâyet Yoğunluğu</p>
                  </div>
                  <CategoryBarChart
                    data={executive.topComplaints.map((c) => ({ label: c.topic, value: c.count }))}
                    height={210}
                    layout="vertical"
                    multicolor
                  />
                </section>
              )}
            </div>
          )}

          <div>
            <p className="type-section mb-2">Mahalle Bazında Durum</p>
            <DataTable columns={hoodColumns} rows={sorted} rowKey={(r) => r.neighborhood} />
          </div>

          <div>
            <p className="type-section mb-2">Konu Bazında Durum</p>
            {topics.length === 0 ? (
              <EmptyState icon={MessageSquareIcon} title="Veri yok" description="Henüz konu bazında anket veya başvuru kaydı bulunmuyor." />
            ) : (
              <DataTable columns={topicColumns} rows={topics} rowKey={(r) => r.topic} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
