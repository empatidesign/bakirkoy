import { useEffect, useMemo, useState } from 'react'
import {
  UsersIcon, MapPinIcon, CakeIcon, PieChartIcon, ShieldCheckIcon, Users2Icon,
  BabyIcon, UserCheckIcon, XIcon, SlidersHorizontalIcon, MapIcon, SparklesIcon, Grid3X3Icon, UsersRoundIcon,
} from 'lucide-react'
import {
  StatCard, Badge, Button, Card, DataTable, EmptyState, IconButton, Input, Modal, Progress, SegmentedControl, Select,
  FilterBar, FilterField, Skeleton, type DataTableColumn,
} from '@/design-system'
import { DonutChart, GroupedBarChart } from '@/design-system/charts'
import { BakirkoyNeighborhoodMap } from '@/components/specialized/BakirkoyNeighborhoodMap'
import participantService from '@/services/participant.service'
import { maskTC } from '@/lib/utils'
import { GENDER_LABELS, PARTICIPANT_STATUS_LABELS } from '@/types/participant.types'
import type {
  ParticipantDemographicsOverview, NeighborhoodStat, NeighborhoodDetail, NeighborhoodParticipantRow,
} from '@/types/participant.types'

const fmt = (n: number) => n.toLocaleString('tr-TR')
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part * 1000) / whole) / 10 : 0)

const formatDate = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const FEMALE_COLOR = 'hsl(var(--accent-pink))'
const MALE_COLOR = 'hsl(var(--accent-blue))'

interface ReportCardProps { title: string; icon: typeof UsersIcon; children: React.ReactNode; sub?: string; actions?: React.ReactNode; className?: string }
const ReportCard = ({ title, icon: Icon, children, sub, actions, className }: ReportCardProps) => (
  <Card padded className={className}>
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-1"><Icon className="h-4 w-4 text-foreground-muted" /></span>
        <div>
          <p className="type-section uppercase">{title}</p>
          {sub && <p className="type-section-sub">{sub}</p>}
        </div>
      </div>
      {actions}
    </div>
    {children}
  </Card>
)

const ChartSkeleton = () => <Skeleton className="h-60 w-full rounded-lg" />

type MapLayer = 'total' | 'female' | 'male' | 'youth' | 'age'

const LAYER_TONE: Record<MapLayer, { token: string; swatchLow: string; swatchHigh: string }> = {
  total: { token: '--accent-violet', swatchLow: 'bg-accent-violet-soft', swatchHigh: 'bg-accent-violet' },
  female: { token: '--accent-pink', swatchLow: 'bg-accent-pink-soft', swatchHigh: 'bg-accent-pink' },
  male: { token: '--accent-blue', swatchLow: 'bg-accent-blue-soft', swatchHigh: 'bg-accent-blue' },
  youth: { token: '--accent-green', swatchLow: 'bg-accent-green-soft', swatchHigh: 'bg-accent-green' },
  age: { token: '--accent-orange', swatchLow: 'bg-accent-orange-soft', swatchHigh: 'bg-accent-orange' },
}

const LAYER_OPTIONS = [
  { value: 'total', label: 'Toplam', tone: 'violet' as const },
  { value: 'female', label: 'Kadın oranı', tone: 'pink' as const },
  { value: 'male', label: 'Erkek oranı', tone: 'blue' as const },
  { value: 'youth', label: 'Gençlik oranı', tone: 'green' as const },
  { value: 'age', label: 'Yaş grubu', tone: 'orange' as const },
]

const layerValue = (n: NeighborhoodStat, layer: MapLayer, band: string) => {
  if (layer === 'total') return n.total
  if (layer === 'female') return pct(n.female, n.total)
  if (layer === 'male') return pct(n.male, n.total)
  if (layer === 'youth') return n.youthPercent
  return n.ageBands.find((b) => b.band === band)?.percentOfTotal ?? 0
}

const layerDisplay = (v: number, layer: MapLayer) => (layer === 'total' ? `${fmt(v)} üye` : `%${v}`)

const NeighborhoodDetailModal = ({
  neighborhood, onClose,
}: { neighborhood: string | null; onClose: () => void }) => {
  const [detail, setDetail] = useState<NeighborhoodDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!neighborhood) { setDetail(null); setPage(1); return }
    setLoading(true)
    participantService.getNeighborhoodDetail(neighborhood, { page, limit: 10 })
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [neighborhood, page])

  const columns: DataTableColumn<NeighborhoodParticipantRow>[] = [
    { key: 'fullName', header: 'Ad Soyad', cell: (r) => <span className="type-body-strong">{r.fullName}</span> },
    { key: 'tckn', header: 'T.C. Kimlik', cell: (r) => <span className="type-caption tabular-nums">{maskTC(r.tckn)}</span> },
    { key: 'age', header: 'Yaş', align: 'center', cell: (r) => <span className="tabular-nums">{r.age}</span> },
    { key: 'gender', header: 'Cinsiyet', cell: (r) => <Badge tone="neutral">{GENDER_LABELS[r.gender] ?? r.gender}</Badge> },
    { key: 'phone', header: 'Telefon', cell: (r) => <span className="tabular-nums">{r.phone ?? '—'}</span> },
    { key: 'status', header: 'Durum', cell: (r) => <Badge tone="neutral">{PARTICIPANT_STATUS_LABELS[r.status] ?? r.status}</Badge> },
    { key: 'registeredAt', header: 'Kayıt', cell: (r) => <span className="type-muted whitespace-nowrap">{formatDate(r.registeredAt)}</span> },
  ]

  return (
    <Modal open={!!neighborhood} onClose={onClose} width={960} className="max-w-[96vw]" bodyClassName="p-0">
      {neighborhood && (
        <div className="flex flex-col">
          <div className="ds-hero">
            <div className="flex items-center justify-between gap-4 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-white/35 bg-white/20 text-white shadow-lg">
                  <MapPinIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="type-section text-white">{neighborhood} Mahallesi</p>
                  <p className="mt-0.5 type-caption text-white/70">{fmt(detail?.total ?? 0)} kayıtlı üye</p>
                </div>
              </div>
              <IconButton title="Kapat" onClick={onClose} className="text-white/70 hover:bg-white/10 hover:text-white">
                <XIcon className="h-5 w-5" />
              </IconButton>
            </div>
          </div>
          <div className="p-5">
            {loading && !detail ? (
              <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
            ) : (
              <DataTable<NeighborhoodParticipantRow>
                columns={columns}
                rows={detail?.items ?? []}
                rowKey={(r) => r.id}
                loading={loading}
                showRowNumbers
                page={detail?.page ?? 1}
                totalPages={detail?.totalPages ?? 1}
                total={detail?.total ?? 0}
                onPageChange={setPage}
                empty={<EmptyState icon={UsersIcon} title="Kayıt yok" description="Bu mahallede üye bulunamadı." />}
              />
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

export const ParticipantsReportsTab = () => {
  const [data, setData] = useState<ParticipantDemographicsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [neighborhoodSearch, setNeighborhoodSearch] = useState('')
  const [memberRange, setMemberRange] = useState('all')
  const [ageProfile, setAgeProfile] = useState('all')
  const [mapLayer, setMapLayer] = useState<MapLayer>('total')
  const [mapBand, setMapBand] = useState('18-25')

  useEffect(() => {
    setLoading(true)
    participantService.getDemographics({})
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const neighborhoods = useMemo(() => data?.neighborhoods ?? [], [data])
  const bandLabels = (data?.ageBands ?? []).map((b) => b.band)

  const genderData = data ? [
    { label: 'Kadın', value: data.gender.female },
    { label: 'Erkek', value: data.gender.male },
  ] : []
  const ageBandGenderData = (data?.ageBands ?? []).map((b) => ({ label: b.band, Kadın: b.female, Erkek: b.male }))
  const minorAdultData = data ? [
    { label: 'Yetişkin (18+)', value: data.adults },
    { label: 'Reşit Olmayan (0-17)', value: data.minors },
  ] : []
  const statusData = data ? [
    { label: 'Aktif', value: data.active },
    { label: 'Pasif', value: data.passive },
    { label: 'Engelli', value: data.blocked },
  ].filter((s) => s.value > 0) : []

  const neighborhoodGenderData = neighborhoods.map((n) => ({ label: n.name, Kadın: n.female, Erkek: n.male }))

  const totalYouth = neighborhoods.reduce((s, n) => s + n.youth, 0)
  const avgYouthPercent = pct(totalYouth, neighborhoods.reduce((s, n) => s + n.total, 0))
  const youthRanking = [...neighborhoods].sort((a, b) => b.youthPercent - a.youthPercent)
  const youthChartData = [...neighborhoods]
    .sort((a, b) => b.youth - a.youth)
    .map((n) => ({ label: n.name, 'Genç Kadın': n.youthFemale, 'Genç Erkek': n.youthMale }))

  const mapValues = useMemo(
    () => new Map(neighborhoods.map((n) => [n.name, layerValue(n, mapLayer, mapBand)])),
    [neighborhoods, mapLayer, mapBand],
  )
  const mapMin = Math.min(...mapValues.values(), Infinity)
  const mapMax = Math.max(...mapValues.values(), -Infinity)
  const mapData = neighborhoods.map((n) => ({
    neighborhood: n.name,
    percent: mapValues.get(n.name) ?? null,
    responseCount: n.total,
    openSubmissionCount: 0,
  }))
  const mapColorFor = (v: number | null) => {
    if (v === null || !Number.isFinite(mapMin)) return 'hsl(var(--surface-2))'
    const t = mapMax > mapMin ? (v - mapMin) / (mapMax - mapMin) : 1
    return `hsl(var(${LAYER_TONE[mapLayer].token}) / ${(0.15 + t * 0.8).toFixed(2)})`
  }
  const mapRanking = [...neighborhoods].sort((a, b) => (mapValues.get(b.name) ?? 0) - (mapValues.get(a.name) ?? 0))
  const byName = useMemo(() => new Map(neighborhoods.map((n) => [n.name, n])), [neighborhoods])

  const renderMapTooltip = (name: string) => {
    const n = byName.get(name)
    if (!n) return null
    return (
      <div className="mt-1 min-w-48 space-y-1">
        <p className="type-caption tabular-nums">{fmt(n.total)} üye · ilçenin %{n.percentOfTotal}</p>
        <div className="flex items-center justify-between gap-3 type-caption tabular-nums">
          <span className="text-accent-pink">Kadın {fmt(n.female)}</span><b>%{pct(n.female, n.total)}</b>
        </div>
        <div className="flex items-center justify-between gap-3 type-caption tabular-nums">
          <span className="text-accent-blue">Erkek {fmt(n.male)}</span><b>%{pct(n.male, n.total)}</b>
        </div>
        <div className="flex items-center justify-between gap-3 type-caption tabular-nums">
          <span className="text-accent-green">Genç (15-29) {fmt(n.youth)}</span><b>%{n.youthPercent}</b>
        </div>
        <div className="mt-1.5 border-t border-border pt-1.5">
          {n.ageBands.map((b) => (
            <div key={b.band} className="flex items-center justify-between gap-3 type-caption tabular-nums">
              <span>{b.band}</span>
              <span>{fmt(b.total)} · K {fmt(b.female)} / E {fmt(b.male)} · <b>%{b.percentOfTotal}</b></span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const neighborhoodColumns: DataTableColumn<NeighborhoodStat>[] = [
    {
      key: 'name', header: 'Mahalle',
      cell: (r) => (
        <Button variant="ghost" size="sm" className="-ml-3" iconLeft={<MapPinIcon className="h-3.5 w-3.5 text-foreground-subtle" />} onClick={() => setSelectedNeighborhood(r.name)}>
          <span className="type-body-strong">{r.name}</span>
        </Button>
      ),
    },
    { key: 'total', header: 'Üye Sayısı', align: 'center', cell: (r) => <span className="type-body-strong tabular-nums">{fmt(r.total)}</span> },
    { key: 'percent', header: 'Oran', align: 'center', cell: (r) => <Badge tone="info">%{r.percentOfTotal}</Badge> },
    {
      key: 'gender', header: 'Kız / Erkek',
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <Badge tone="neutral">♀ {fmt(r.female)} · %{pct(r.female, r.total)}</Badge>
          <Badge tone="neutral">♂ {fmt(r.male)} · %{pct(r.male, r.total)}</Badge>
        </div>
      ),
    },
    {
      key: 'age', header: 'Yetişkin / Reşit Olmayan',
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <Badge tone="success">{fmt(r.adults)} yetişkin</Badge>
          <Badge tone="warning">{fmt(r.minors)} 18-</Badge>
        </div>
      ),
    },
    { key: 'youth', header: 'Genç (15-29)', align: 'center', cell: (r) => <Badge tone="primary">{fmt(r.youth)} · %{r.youthPercent}</Badge> },
  ]

  const matrixColumns: DataTableColumn<NeighborhoodStat>[] = [
    { key: 'name', header: 'Mahalle', cell: (r) => <span className="type-body-strong whitespace-nowrap">{r.name}</span> },
    { key: 'total', header: 'Toplam', align: 'center', cell: (r) => <span className="type-body-strong tabular-nums">{fmt(r.total)}</span> },
    ...bandLabels.map<DataTableColumn<NeighborhoodStat>>((band) => ({
      key: `band-${band}`,
      header: band,
      align: 'center',
      cell: (r) => {
        const b = r.ageBands.find((x) => x.band === band)
        if (!b || b.total === 0) return <span className="type-caption">—</span>
        return (
          <div className="flex flex-col items-center gap-0.5 tabular-nums">
            <span className="type-body-strong">{fmt(b.total)} <span className="type-caption">%{b.percentOfTotal}</span></span>
            <span className="type-caption whitespace-nowrap"><span className="text-accent-pink">K {fmt(b.female)}</span> · <span className="text-accent-blue">E {fmt(b.male)}</span></span>
          </div>
        )
      },
    })),
    {
      key: 'youth', header: 'Genç (15-29)', align: 'center',
      cell: (r) => (
        <div className="flex flex-col items-center gap-0.5 tabular-nums">
          <span className="type-body-strong">{fmt(r.youth)} <span className="type-caption">%{r.youthPercent}</span></span>
          <span className="type-caption whitespace-nowrap"><span className="text-accent-pink">K {fmt(r.youthFemale)}</span> · <span className="text-accent-blue">E {fmt(r.youthMale)}</span></span>
        </div>
      ),
    },
  ]

  const filteredNeighborhoods = neighborhoods.filter((item) => {
    const matchesName = item.name.toLocaleLowerCase('tr').includes(neighborhoodSearch.trim().toLocaleLowerCase('tr'))
    const matchesMemberRange =
      memberRange === 'all'
      || (memberRange === 'high' && item.total >= 10000)
      || (memberRange === 'medium' && item.total >= 5000 && item.total < 10000)
      || (memberRange === 'low' && item.total < 5000)
    const matchesAgeProfile =
      ageProfile === 'all'
      || (ageProfile === 'adult' && item.adults >= item.minors)
      || (ageProfile === 'minor' && item.minors > item.adults)
    return matchesName && matchesMemberRange && matchesAgeProfile
  })

  const activeFilterCount = [
    neighborhoodSearch.trim() !== '',
    memberRange !== 'all',
    ageProfile !== 'all',
  ].filter(Boolean).length

  const clearNeighborhoodFilters = () => {
    setNeighborhoodSearch('')
    setMemberRange('all')
    setAgeProfile('all')
  }

  const kpis = [
    { key: 'total', label: 'Toplam Üye', value: data?.total, icon: UsersIcon, accent: 'blue' as const },
    { key: 'avgAge', label: 'Ortalama Yaş', value: data?.averageAge, icon: CakeIcon, accent: 'orange' as const },
    { key: 'verified', label: 'Doğrulanmış Üye', value: data?.verified, icon: ShieldCheckIcon, accent: 'green' as const },
    { key: 'withChildren', label: 'Veli (Çocuğu Bağlı)', value: data?.withChildren, icon: Users2Icon, accent: 'violet' as const },
  ]

  const tone = LAYER_TONE[mapLayer]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <StatCard
            key={k.key}
            label={k.label}
            value={loading ? '—' : (k.value?.toLocaleString('tr-TR') ?? '—')}
            icon={k.icon}
            accent={k.accent}
            loading={loading}
            className="rounded-lg border-none shadow-sm"
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ReportCard title="Cinsiyet Dağılımı" icon={PieChartIcon} sub={data ? `%${data.gender.femalePercent} kadın · %${data.gender.malePercent} erkek` : undefined}>
          {loading ? <ChartSkeleton /> : <DonutChart data={genderData} centerValue={data?.total.toLocaleString('tr-TR')} centerLabel="üye" />}
        </ReportCard>
        <ReportCard title="Yetişkin / Reşit Olmayan" icon={BabyIcon} sub={data ? `${fmt(data.minors)} kişi 18 yaş altı` : undefined}>
          {loading ? <ChartSkeleton /> : <DonutChart data={minorAdultData} centerValue={data?.total.toLocaleString('tr-TR')} centerLabel="üye" />}
        </ReportCard>
        <ReportCard title="Üyelik Durumu" icon={UserCheckIcon} sub="Aktif / Pasif / Engelli">
          {loading ? <ChartSkeleton /> : statusData.length === 0
            ? <EmptyState icon={UserCheckIcon} title="Veri yok" />
            : <DonutChart data={statusData} centerValue={data?.total.toLocaleString('tr-TR')} centerLabel="üye" />}
        </ReportCard>
      </div>

      <ReportCard title="Yaş Grupları × Cinsiyet" icon={CakeIcon} sub="Her yaş aralığında kadın ve erkek üye sayısı">
        {loading ? <ChartSkeleton /> : (
          <GroupedBarChart
            data={ageBandGenderData}
            xKey="label"
            series={[{ key: 'Kadın', label: 'Kadın', color: FEMALE_COLOR }, { key: 'Erkek', label: 'Erkek', color: MALE_COLOR }]}
          />
        )}
      </ReportCard>

      <ReportCard
        title="Mahalle Haritası"
        icon={MapIcon}
        sub="Mahalleler seçili katmana göre renklendirilir; üzerine gelince cinsiyet ve yaş kırılımı görünür"
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start">
          <SegmentedControl
            value={mapLayer}
            onChange={(v) => setMapLayer(v as MapLayer)}
            options={LAYER_OPTIONS}
            columns={4}
            className="flex-1"
          />
          {mapLayer === 'age' && (
            <div className="lg:w-48">
              <Select value={mapBand} onChange={(event) => setMapBand(event.target.value)}>
                {bandLabels.map((b) => <option key={b} value={b}>{b} yaş</option>)}
              </Select>
            </div>
          )}
        </div>
        {loading ? <Skeleton className="h-96 w-full rounded-lg" /> : neighborhoods.length === 0 ? (
          <EmptyState icon={MapIcon} title="Veri yok" description="Haritada gösterilecek mahalle verisi bulunamadı." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <BakirkoyNeighborhoodMap data={mapData} colorFor={mapColorFor} height={460} renderTooltip={renderMapTooltip} />
              <div className="mt-2 flex items-center gap-2 type-caption tabular-nums">
                <span>{Number.isFinite(mapMin) ? layerDisplay(mapMin, mapLayer) : '—'}</span>
                <span className={`h-2 w-10 rounded-pill ${tone.swatchLow}`} />
                <span className={`h-2 w-10 rounded-pill ${tone.swatchHigh}`} />
                <span>{Number.isFinite(mapMax) ? layerDisplay(mapMax, mapLayer) : '—'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="type-section">Sıralama</p>
              {mapRanking.map((n, i) => {
                const v = mapValues.get(n.name) ?? 0
                return (
                  <div key={n.name} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="type-body-strong">{i + 1}. {n.name}</span>
                      <span className="type-caption tabular-nums">{layerDisplay(v, mapLayer)}</span>
                    </div>
                    <Progress value={mapMax > 0 ? (v * 100) / mapMax : 0} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </ReportCard>

      <ReportCard title="Mahalle Bazlı Kadın / Erkek" icon={UsersRoundIcon} sub="Her mahallede kadın ve erkek üye sayısı (tooltip'te değerler)">
        {loading ? <ChartSkeleton /> : (
          <GroupedBarChart
            data={neighborhoodGenderData}
            xKey="label"
            height={340}
            series={[{ key: 'Kadın', label: 'Kadın', color: FEMALE_COLOR }, { key: 'Erkek', label: 'Erkek', color: MALE_COLOR }]}
          />
        )}
      </ReportCard>

      <ReportCard
        title="Gençlik Nüfusu Karşılaştırması"
        icon={SparklesIcon}
        sub={data ? `15-29 yaş: toplam ${fmt(totalYouth)} genç · ilçe ortalaması %${avgYouthPercent}` : undefined}
      >
        {loading ? <ChartSkeleton /> : (
          <div className="grid gap-4 lg:grid-cols-2">
            <GroupedBarChart
              data={youthChartData}
              xKey="label"
              layout="vertical"
              stacked
              height={Math.max(280, youthChartData.length * 28)}
              series={[{ key: 'Genç Kadın', label: 'Genç Kadın', color: FEMALE_COLOR }, { key: 'Genç Erkek', label: 'Genç Erkek', color: MALE_COLOR }]}
            />
            <div className="space-y-2">
              <p className="type-section">Gençlik oranına göre sıralama</p>
              {youthRanking.map((n, i) => {
                const diff = Math.round((n.youthPercent - avgYouthPercent) * 10) / 10
                return (
                  <div key={n.name} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="type-body-strong">{i + 1}. {n.name}</span>
                      <span className="flex items-center gap-1.5 type-caption tabular-nums">
                        {fmt(n.youth)} genç · %{n.youthPercent}
                        <Badge tone={diff >= 0 ? 'success' : 'warning'}>{diff >= 0 ? '+' : ''}{diff} puan</Badge>
                      </span>
                    </div>
                    <Progress value={n.youthPercent} tone={diff >= 0 ? 'success' : 'warning'} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </ReportCard>

      <ReportCard title="Mahalle × Yaş Grubu Matrisi" icon={Grid3X3Icon} sub="Her hücre: toplam · mahalle içi oran · kadın (K) / erkek (E)">
        <DataTable<NeighborhoodStat>
          columns={matrixColumns}
          rows={neighborhoods}
          rowKey={(r) => r.name}
          loading={loading}
          showRowNumbers
          empty={<EmptyState icon={Grid3X3Icon} title="Veri yok" description="Mahalle bazlı yaş verisi bulunamadı." />}
        />
      </ReportCard>

      <ReportCard title="Mahalle Bazlı Üyelik Dağılımı" icon={MapPinIcon} sub="Bakırköy'ün 15 resmi mahallesine göre üye sayısı, yaş ve cinsiyet kırılımı">
        {filtersOpen && (
          <FilterBar
            columns={3}
            hasActiveFilters={activeFilterCount > 0}
            onClear={clearNeighborhoodFilters}
            className="mb-3"
          >
            <FilterField label="Mahalle ara">
              <Input
                value={neighborhoodSearch}
                onChange={(event) => setNeighborhoodSearch(event.target.value)}
                placeholder="Mahalle adı yazın..."
              />
            </FilterField>
            <FilterField label="Üye sayısı">
              <Select value={memberRange} onChange={(event) => setMemberRange(event.target.value)}>
                <option value="all">Tüm aralıklar</option>
                <option value="high">10.000 ve üzeri</option>
                <option value="medium">5.000 – 9.999</option>
                <option value="low">5.000 altı</option>
              </Select>
            </FilterField>
            <FilterField label="Yaş dağılımı">
              <Select value={ageProfile} onChange={(event) => setAgeProfile(event.target.value)}>
                <option value="all">Tüm yaş profilleri</option>
                <option value="adult">Yetişkin ağırlıklı</option>
                <option value="minor">18 yaş altı ağırlıklı</option>
              </Select>
            </FilterField>
          </FilterBar>
        )}
        <DataTable<NeighborhoodStat>
          columns={neighborhoodColumns}
          rows={filteredNeighborhoods}
          rowKey={(r) => r.name}
          loading={loading}
          showRowNumbers
          toolbarActions={
            <Button
              variant={filtersOpen || activeFilterCount > 0 ? 'primary' : 'outline'}
              size="sm"
              iconLeft={<SlidersHorizontalIcon className="h-4 w-4" />}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              Filtreler
              {activeFilterCount > 0 && <Badge tone="neutral">{activeFilterCount}</Badge>}
            </Button>
          }
          empty={<EmptyState icon={MapPinIcon} title="Veri yok" description="Mahalle bazlı üye verisi bulunamadı." />}
        />
      </ReportCard>

      <NeighborhoodDetailModal neighborhood={selectedNeighborhood} onClose={() => setSelectedNeighborhood(null)} />
    </div>
  )
}
