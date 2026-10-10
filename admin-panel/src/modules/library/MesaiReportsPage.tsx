import { useCallback, useEffect, useState } from 'react'
import {
  TrophyIcon, FilterIcon, ClockIcon, UsersRoundIcon, CalendarDaysIcon,
  BarChart3Icon, AlertTriangleIcon, PencilRulerIcon, RefreshCwIcon,
} from 'lucide-react'
import {
  SectionToolbar, StatCard, DataTable, FilterBar, FilterField, Input, Select, Badge,
  EmptyState, Button, PageHeader, type DataTableColumn,
} from '@/design-system'
import libraryService from '@/services/library.service'
import type { LibraryShift, MesaiReportSummary, TopMesaiStaff } from '@/types/library.types'
import type { SelectOption } from '@/types/common'
import { fmtDate, fmtTime, fmtDuration, initiationLabel } from './libraryHelpers'

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

const todayIso = () => new Date().toISOString().slice(0, 10)
const daysAgoIso = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

type QuickRange = 'today' | 'week' | 'month' | 'custom'

export const MesaiReportsPage = ({ embedded }: { embedded?: boolean } = {}) => {
  const [libraryOptions, setLibraryOptions] = useState<SelectOption[]>([])
  const [staffOptions, setStaffOptions] = useState<SelectOption[]>([])

  const [quickRange, setQuickRange] = useState<QuickRange>('month')
  const [startDate, setStartDate] = useState(daysAgoIso(30))
  const [endDate, setEndDate] = useState(todayIso())
  const [libraryFilter, setLibraryFilter] = useState('')
  const [staffFilter, setStaffFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'ended'>('')

  const [rows, setRows] = useState<LibraryShift[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [loading, setLoading] = useState(true)

  const [summary, setSummary] = useState<MesaiReportSummary | null>(null)

  const [leaderYear, setLeaderYear] = useState(new Date().getFullYear())
  const [leaderMonth, setLeaderMonth] = useState(new Date().getMonth() + 1)
  const [leaderLibrary, setLeaderLibrary] = useState('')
  const [leaderboard, setLeaderboard] = useState<TopMesaiStaff[]>([])
  const [leaderLoading, setLeaderLoading] = useState(true)

  useEffect(() => {
    libraryService.getOptions().then(setLibraryOptions).catch(() => setLibraryOptions([]))
    libraryService.staff.getList({ page: 1, limit: 500 })
      .then((r) => setStaffOptions(r.items.map((s) => ({ value: s.id, label: s.fullName }))))
      .catch(() => setStaffOptions([]))
  }, [])

  const applyQuickRange = (range: QuickRange) => {
    setQuickRange(range)
    if (range === 'today') { setStartDate(todayIso()); setEndDate(todayIso()) }
    else if (range === 'week') { setStartDate(daysAgoIso(7)); setEndDate(todayIso()) }
    else if (range === 'month') { setStartDate(daysAgoIso(30)); setEndDate(todayIso()) }
  }

  const filterParams = useCallback(() => {
    const params: Record<string, unknown> = {
      page, limit, sort: 'startTime', order: 'desc',
      startDate: startDate ? `${startDate}T00:00:00.000Z` : undefined,
      endDate: endDate ? `${endDate}T23:59:59.999Z` : undefined,
      libraryId: libraryFilter || undefined,
      staffId: staffFilter || undefined,
      status: statusFilter || undefined,
    }
    return params
  }, [page, limit, startDate, endDate, libraryFilter, staffFilter, statusFilter])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = filterParams()
      const [list, sum] = await Promise.all([
        libraryService.shifts.getOverviewShifts(params),
        libraryService.shifts.getReportSummary(params),
      ])
      setRows(list.items)
      setTotal(list.total)
      setTotalPages(list.totalPages)
      setSummary(sum)
    } catch {
      setRows([]); setTotal(0); setTotalPages(1); setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [filterParams])
  useEffect(() => { load() }, [load])

  const loadLeaderboard = useCallback(async () => {
    setLeaderLoading(true)
    try {
      const data = await libraryService.shifts.getLeaderboard({
        year: leaderYear, month: leaderMonth, libraryId: leaderLibrary || undefined, limit: 20,
      })
      setLeaderboard(data)
    } catch {
      setLeaderboard([])
    } finally {
      setLeaderLoading(false)
    }
  }, [leaderYear, leaderMonth, leaderLibrary])
  useEffect(() => { loadLeaderboard() }, [loadLeaderboard])

  const hasActiveFilters = !!libraryFilter || !!staffFilter || !!statusFilter || quickRange !== 'month'
  const clearFilters = () => {
    setLibraryFilter(''); setStaffFilter(''); setStatusFilter('')
    applyQuickRange('month')
    setPage(1)
  }

  const columns: DataTableColumn<LibraryShift>[] = [
    { key: 'staff', header: 'Personel', cell: (r) => <span className="type-body-strong">{r.staffName}</span> },
    { key: 'library', header: 'Kütüphane', cell: (r) => <span className="type-body">{r.libraryName}</span> },
    { key: 'date', header: 'Tarih', cell: (r) => <span className="type-muted">{fmtDate(r.startTime)}</span> },
    {
      key: 'time', header: 'Giriş – Çıkış', cell: (r) => (
        <span className="tabular-nums type-muted">
          {fmtTime(r.startTime)} – {r.endTime ? fmtTime(r.endTime) : 'devam ediyor'}
        </span>
      ),
    },
    {
      key: 'duration', header: 'Süre', cell: (r) => (
        <span className="flex items-center gap-1 tabular-nums text-foreground-strong">
          {fmtDuration(r.workedMinutes ?? 0)}
          {r.isAnomalousDuration && (
            <span title="Beklenenden çok uzun mesai — kontrol edilmeli">
              <AlertTriangleIcon className="h-3.5 w-3.5 text-danger" />
            </span>
          )}
        </span>
      ),
    },
    { key: 'by', header: 'Başlatan', cell: (r) => <span className="type-muted">{initiationLabel(r.initiationType, r.initiatedByName)}</span> },
    {
      key: 'status', header: 'Durum', align: 'center', cell: (r) => (
        <div className="flex flex-col items-center gap-1">
          <Badge tone={r.status === 'active' ? 'success' : 'neutral'}>{r.status === 'active' ? 'Çalışıyor' : 'Bitti'}</Badge>
          <div className="flex gap-1">
            {r.autoClosedAtCutoff && (
              <span title="Gün sonu (23:59) otomatik kapatıldı">
                <Badge tone="warning"><AlertTriangleIcon className="mr-1 inline h-3 w-3" />Otomatik</Badge>
              </span>
            )}
            {r.wasEdited && (
              <span title={r.editReason ?? 'Giriş/çıkış saati düzenlendi'}>
                <Badge tone="info"><PencilRulerIcon className="mr-1 inline h-3 w-3" />Düzenlendi</Badge>
              </span>
            )}
          </div>
        </div>
      ),
    },
  ]

  const leaderColumns: DataTableColumn<TopMesaiStaff>[] = [
    {
      key: 'rank', header: '#', align: 'center', cell: (_r, i) => (
        <span className={`type-caption tabular-nums font-bold ${i < 3 ? 'text-primary' : 'text-foreground-muted'}`}>{i + 1}</span>
      ),
    },
    { key: 'staff', header: 'Personel', cell: (r) => <span className="type-body-strong">{r.staffName}</span> },
    { key: 'total', header: 'Toplam Süre', align: 'center', sortable: false, cell: (r) => <span className="type-body-strong tabular-nums">{fmtDuration(r.totalMinutes)}</span> },
    { key: 'shifts', header: 'Mesai Sayısı', align: 'center', cell: (r) => <span className="tabular-nums type-muted">{r.shiftCount}</span> },
    { key: 'libraries', header: 'Kütüphane Sayısı', align: 'center', cell: (r) => <span className="tabular-nums type-muted">{r.distinctLibraryCount}</span> },
  ]

  return (
    <div className="flex h-full flex-col bg-surface-0">
      {!embedded && (
        <PageHeader
          icon={BarChart3Icon}
          title="Mesai Raporları"
          subtitle="Tüm kütüphaneler için detaylı, filtrelenebilir mesai raporlaması"
          breadcrumb="Hizmetlerimiz / Mesai Yönetimi / Raporlar"
        />
      )}

      <div className={embedded ? 'flex-1 space-y-5 overflow-auto' : 'pilot-content flex-1 space-y-5 overflow-auto'}>
        <div className={embedded ? 'grid grid-cols-2 gap-3 lg:grid-cols-5' : 'pilot-stat-grid'}>
          <StatCard label="Toplam Mesai" value={summary?.totalShifts ?? 0} icon={ClockIcon} accent="blue" loading={loading} />
          <StatCard label="Toplam Süre" value={fmtDuration(summary?.totalMinutes ?? 0)} icon={CalendarDaysIcon} accent="green" loading={loading} />
          <StatCard label="Farklı Personel" value={summary?.distinctStaffCount ?? 0} icon={UsersRoundIcon} accent="violet" loading={loading} />
          <StatCard label="Otomatik Kapatılan" value={summary?.autoClosedCount ?? 0} icon={AlertTriangleIcon} accent="orange" loading={loading}
            hint="Gün sonu 23:59 kesiminde" />
          <StatCard label="Düzenlenen" value={summary?.editedCount ?? 0} icon={PencilRulerIcon} accent="primary" loading={loading}
            hint="Saati sonradan değiştirilen" />
        </div>

        {((summary?.shortLivedCount ?? 0) > 0 || (summary?.ipTakeoverCount ?? 0) > 0) && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Kısa Süreli Mesai" value={summary?.shortLivedCount ?? 0} icon={AlertTriangleIcon} accent="danger" loading={loading}
              hint="5 dakikadan kısa — muhtemelen hatalı kayıt" />
            <StatCard label="Terminal Devralma" value={summary?.ipTakeoverCount ?? 0} icon={RefreshCwIcon} accent="danger" loading={loading}
              hint="Aynı IP'den başka personel giriş yaptı" />
          </div>
        )}

        <SectionToolbar
          icon={FilterIcon}
          title="Detaylı Mesai Listesi"
          subtitle="Personel, kütüphane, tarih aralığı ve durum bazlı tam filtreleme"
          actions={<Button variant="outline" size="sm" onClick={() => load()}><RefreshCwIcon className="h-4 w-4" /> Yenile</Button>}
        />

        <div className="flex flex-wrap gap-2">
          {(['today', 'week', 'month', 'custom'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => applyQuickRange(r)}
              className={`rounded-pill border px-3 py-1.5 text-xs font-semibold transition-colors ${
                quickRange === r ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface-1 text-foreground-muted hover:bg-surface-2'
              }`}
            >
              {r === 'today' ? 'Bugün' : r === 'week' ? 'Son 7 Gün' : r === 'month' ? 'Son 30 Gün' : 'Özel Aralık'}
            </button>
          ))}
        </div>

        <FilterBar
          columns={4}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
        >
          <FilterField label="Başlangıç Tarihi">
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setQuickRange('custom'); setPage(1) }} />
          </FilterField>
          <FilterField label="Bitiş Tarihi">
            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setQuickRange('custom'); setPage(1) }} />
          </FilterField>
          <FilterField label="Kütüphane">
            <Select value={libraryFilter} onChange={(e) => { setLibraryFilter(e.target.value); setPage(1) }}>
              <option value="">Tüm Kütüphaneler</option>
              {libraryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Personel">
            <Select searchable searchPlaceholder="Personel ara..." value={staffFilter} onChange={(e) => { setStaffFilter(e.target.value); setPage(1) }}>
              <option value="">Tüm Personel</option>
              {staffOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Durum">
            <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }}>
              <option value="">Tümü</option>
              <option value="active">Çalışıyor</option>
              <option value="ended">Bitti</option>
            </Select>
          </FilterField>
        </FilterBar>

        <DataTable<LibraryShift>
          showRowNumbers
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading}
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={(l) => { setLimit(l); setPage(1) }}
          empty={<EmptyState icon={ClockIcon} title="Kayıt bulunamadı" description="Seçili filtrelere uygun mesai kaydı yok." />}
        />

        <SectionToolbar
          icon={TrophyIcon}
          title="En Çok Mesai Yapanlar"
          subtitle="Seçili ay için personel bazlı toplam çalışma süresi sıralaması"
        />

        <FilterBar columns={3} hasActiveFilters={false} onClear={() => {}}>
          <FilterField label="Yıl">
            <Select value={String(leaderYear)} onChange={(e) => setLeaderYear(Number(e.target.value))}>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Ay">
            <Select value={String(leaderMonth)} onChange={(e) => setLeaderMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Kütüphane">
            <Select value={leaderLibrary} onChange={(e) => setLeaderLibrary(e.target.value)}>
              <option value="">Tüm Kütüphaneler</option>
              {libraryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FilterField>
        </FilterBar>

        <DataTable<TopMesaiStaff>
          columns={leaderColumns}
          rows={leaderboard}
          rowKey={(r) => r.staffId}
          loading={leaderLoading}
          total={leaderboard.length}
          empty={<EmptyState icon={TrophyIcon} title="Veri yok" description="Seçili ay için mesai kaydı bulunamadı." />}
        />
      </div>
    </div>
  )
}
