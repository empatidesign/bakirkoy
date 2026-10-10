import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowRightLeftIcon, LogInIcon, LogOutIcon, ChevronLeftIcon, ChevronRightIcon,
  MonitorIcon, UserPlusIcon, SearchIcon, DownloadIcon,
} from 'lucide-react'
import {
  DataTable, FilterBar, FilterField, Input, DatePicker, Badge, IconButton,
  StatCard, EmptyState, SegmentedControl, Button, Select,
  type DataTableColumn, type SortState,
} from '@/design-system'
import attendanceService from '@/services/attendance.service'
import hallService from '@/services/hall.service'
import eventService from '@/services/event.service'
import sessionService from '@/services/session.service'
import { ACTIVITY_KIND_LABELS, ACTION_FILTER_OPTIONS, METHOD_TONE } from '@/types/attendance.types'
import type { ActivityEntry, ActivitySummary } from '@/types/attendance.types'
import type { PagedResult } from '@/types/common'

const pad = (n: number) => String(n).padStart(2, '0')
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const shiftIso = (iso: string, delta: number) => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—')
const fmtDateLong = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '')
const maskTc = (tc: string) => (tc && tc.length >= 5 ? `${tc.slice(0, 3)}*****${tc.slice(-2)}` : tc)

type Opt = { value: string; label: string }

const ActivityView = ({ fixedEventId }: { fixedEventId?: string }) => {
  const [date, setDate] = useState(todayIso())
  const [hallFilter, setHallFilter] = useState('')
  const [eventFilter, setEventFilter] = useState(fixedEventId ?? '')
  const [sessionFilter, setSessionFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [sort, setSort] = useState<SortState | null>({ key: 'at', dir: 'desc' })
  const [result, setResult] = useState<PagedResult<ActivityEntry> | null>(null)
  const [summary, setSummary] = useState<ActivitySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [hallOptions, setHallOptions] = useState<Opt[]>([])
  const [eventOptions, setEventOptions] = useState<Opt[]>([])
  const [sessionOptions, setSessionOptions] = useState<Opt[]>([])
  const [exporting, setExporting] = useState(false)

  useEffect(() => { setEventFilter(fixedEventId ?? '') }, [fixedEventId])

  useEffect(() => {
    if (fixedEventId) return
    hallService.getList({ page: 1, limit: 200 })
      .then(res => setHallOptions(res.items.map(h => ({ value: h.id, label: h.name }))))
      .catch(() => {})
  }, [fixedEventId])

  useEffect(() => {
    if (fixedEventId) return
    const params: Record<string, unknown> = { page: 1, limit: 200 }
    if (hallFilter) params.hallId = hallFilter
    eventService.getList(params)
      .then(res => setEventOptions(res.items.map(e => ({ value: e.id, label: e.name }))))
      .catch(() => setEventOptions([]))
  }, [fixedEventId, hallFilter])

  useEffect(() => {
    if (!eventFilter) { setSessionOptions([]); setSessionFilter(''); return }
    sessionService.getOptionsByEvent(eventFilter)
      .then(opts => { setSessionOptions(opts); setSessionFilter('') })
      .catch(() => { setSessionOptions([]); setSessionFilter('') })
  }, [eventFilter])

  const extra = useCallback(() => {
    const p: Record<string, unknown> = { date }
    if (eventFilter) p.eventId = eventFilter
    if (hallFilter && !fixedEventId) p.hallId = hallFilter
    if (sessionFilter) p.sessionId = sessionFilter
    if (actionFilter) p.kind = actionFilter
    if (search) p.search = search
    return p
  }, [date, eventFilter, hallFilter, sessionFilter, actionFilter, search, fixedEventId])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, limit, ...extra() }
      if (sort) { params.sort = sort.key; params.order = sort.dir }
      setResult(await attendanceService.getActivity(params))
    } catch { setResult(null) } finally { setLoading(false) }
  }, [page, limit, sort, extra])
  useEffect(() => { fetchList() }, [fetchList])

  const loadSummary = useCallback(() => {
    attendanceService.getActivitySummary(extra()).then(setSummary).catch(() => setSummary(null))
  }, [extra])
  useEffect(() => { loadSummary() }, [loadSummary])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const goDate = (iso: string) => { setDate(iso); setPage(1) }

  const handleExport = async () => {
    setExporting(true)
    try {
      const { blob, fileName } = await attendanceService.exportActivity(extra())
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fileName; a.click()
      URL.revokeObjectURL(url)
    } catch {} finally { setExporting(false) }
  }

  const rows = result?.items ?? []
  const stats = [
    { label: 'Giriş', value: summary?.checkIn ?? 0, icon: LogInIcon, accent: 'green' as const },
    { label: 'Çıkış', value: summary?.checkOut ?? 0, icon: LogOutIcon, accent: 'blue' as const },
    { label: 'Kiosk', value: summary?.kiosk ?? 0, icon: MonitorIcon, accent: 'violet' as const },
    { label: 'Başvurusuz', value: summary?.walkIn ?? 0, icon: UserPlusIcon, accent: 'orange' as const },
  ]

  const columns: DataTableColumn<ActivityEntry>[] = [
    { key: 'time', header: 'Saat', sortable: true, sortKey: 'at', cell: (r) => <span className="tabular-nums text-foreground-strong">{fmtTime(r.at)}</span> },
    {
      key: 'kind', header: 'İşlem', align: 'center',
      cell: (r) => (
        <Badge tone={r.kind === 'check_in' ? 'success' : 'info'}>
          {r.kind === 'check_in' ? <LogInIcon className="mr-1 inline h-3 w-3" /> : <LogOutIcon className="mr-1 inline h-3 w-3" />}
          {ACTIVITY_KIND_LABELS[r.kind]}
        </Badge>
      ),
    },
    { key: 'name', header: 'Ad Soyad', cell: (r) => <span className="type-body-strong">{r.participantName}</span> },
    { key: 'tc', header: 'TC', hideable: true, cell: (r) => <span className="tabular-nums type-muted">{maskTc(r.tckn)}</span> },
    {
      key: 'event', header: 'Etkinlik · Seans',
      cell: (r) => (
        <div className="leading-tight">
          <span className="type-body-strong">{r.eventName}</span>
          {r.sessionLabel && <span className="block type-caption">{r.sessionLabel}</span>}
        </div>
      ),
    },
    { key: 'method', header: 'Yöntem', align: 'center', cell: (r) => <Badge tone={METHOD_TONE[r.method]}>{r.method === '-' ? '—' : r.method}</Badge> },
    {
      key: 'status', header: 'Durum', align: 'center',
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="type-muted">{r.status || '—'}</span>
          {r.walkIn && <Badge tone="warning">Başvurusuz</Badge>}
        </span>
      ),
    },
  ]

  const isGlobal = !fixedEventId
  const hasActiveFilters = !!searchInput || (isGlobal && (!!hallFilter || !!eventFilter || !!sessionFilter))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface-1 px-3 py-2">
        <div className="flex items-center gap-2">
          <IconButton title="Önceki gün" onClick={() => goDate(shiftIso(date, -1))}><ChevronLeftIcon className="h-4 w-4" /></IconButton>
          <div className="w-40"><DatePicker value={date} onChange={(v) => goDate(v || todayIso())} /></div>
          <IconButton title="Sonraki gün" onClick={() => goDate(shiftIso(date, 1))}><ChevronRightIcon className="h-4 w-4" /></IconButton>
          <Button variant="outline" size="sm" onClick={() => goDate(todayIso())}>Bugün</Button>
          <span className="ml-1 hidden type-muted sm:inline">{fmtDateLong(date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-full sm:w-64">
            <SegmentedControl
              value={actionFilter}
              onChange={(v) => { setActionFilter(v); setPage(1) }}
              columns={3}
              options={ACTION_FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} isLoading={exporting}>
            <DownloadIcon className="mr-1.5 h-4 w-4" />Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} accent={s.accent} loading={loading} />)}
      </div>

      <FilterBar
        columns={isGlobal ? 4 : 2}
        search={<Input placeholder="Ad, TC veya etkinlik ara..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} iconLeft={<SearchIcon className="h-3.5 w-3.5" />} />}
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setSearchInput(''); setSearch(''); setPage(1)
          if (isGlobal) { setHallFilter(''); setEventFilter(''); setSessionFilter('') }
        }}
      >
        {isGlobal && (
          <>
            <FilterField label="Salon">
              <Select value={hallFilter} onChange={(e) => { setHallFilter(e.target.value); setEventFilter(''); setSessionFilter(''); setPage(1) }}>
                <option value="">Tüm salonlar</option>
                {hallOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Etkinlik">
              <Select value={eventFilter} onChange={(e) => { setEventFilter(e.target.value); setSessionFilter(''); setPage(1) }}>
                <option value="">Tüm etkinlikler</option>
                {eventOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Seans">
              <Select value={sessionFilter} onChange={(e) => { setSessionFilter(e.target.value); setPage(1) }} disabled={!eventFilter}>
                <option value="">Tüm seanslar</option>
                {sessionOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
          </>
        )}
        {!isGlobal && sessionOptions.length > 0 && (
          <FilterField label="Seans">
            <Select value={sessionFilter} onChange={(e) => { setSessionFilter(e.target.value); setPage(1) }}>
              <option value="">Tüm seanslar</option>
              {sessionOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FilterField>
        )}
      </FilterBar>

      <DataTable<ActivityEntry>
        title="Günlük Giriş / Çıkış Kayıtları"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        showRowNumbers
        page={result?.page ?? 1}
        totalPages={result?.totalPages ?? 1}
        total={result?.total ?? 0}
        onPageChange={setPage}
        limit={limit}
        onLimitChange={(n) => { setLimit(n); setPage(1) }}
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1) }}
        empty={<EmptyState icon={ArrowRightLeftIcon} title="Kayıt yok" description="Seçilen gün ve filtrelere uygun giriş/çıkış kaydı bulunamadı." />}
      />
    </div>
  )
}

export const ControlTab = () => {
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('eventId') ?? ''
  return <ActivityView fixedEventId={eventId || undefined} />
}
