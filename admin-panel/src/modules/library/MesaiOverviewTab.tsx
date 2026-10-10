import { useCallback, useEffect, useState } from 'react'
import {
  BriefcaseIcon, ClockIcon, UsersRoundIcon, CalendarCheckIcon, BuildingIcon,
  SearchIcon, SquareIcon, EyeIcon, RefreshCwIcon,
} from 'lucide-react'
import {
  SectionToolbar, StatCard, DataTable, FilterBar, FilterField, Input, Select, Badge,
  IconButton, EmptyState, ConfirmModal, type DataTableColumn,
} from '@/design-system'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import libraryService from '@/services/library.service'
import type { LibraryShift, LibraryStaff, MesaiOverviewSummary } from '@/types/library.types'
import type { SelectOption } from '@/types/common'
import { fmtTime, fmtDuration, initiationLabel } from './libraryHelpers'
import { StaffDetailModal } from './StaffDetailModal'

const MONTH_NAMES_SHORT = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

// 2026-10-05 kullanıcı isteği ("kütüphane sayfasını gezi sistemindeki gibi genel tab menülü
// hale getir"): daha önce ayrı bir route'tu (/library-mesai, kendi PageHeader + Tabs'ı
// vardı). Artık LibraryPage'in "Mesai Yönetimi" üst-sekmesinin içeriği olarak embed ediliyor
// — "Genel Bakış" alt-sekmesinin eski içeriği budur (Aylık Rapor ve Raporlar artık kardeş
// üst-sekmeler: bkz. LibraryPage.tsx).
export const MesaiOverviewTab = () => {
  const { can } = useAuth()
  const canManage = can('library-mesai.edit')

  const [summary, setSummary] = useState<MesaiOverviewSummary | null>(null)
  const [activeShifts, setActiveShifts] = useState<LibraryShift[]>([])
  const [staff, setStaff] = useState<LibraryStaff[]>([])
  const [staffTotal, setStaffTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [libraryOptions, setLibraryOptions] = useState<SelectOption[]>([])
  const [monthlyTotals, setMonthlyTotals] = useState<Record<string, { totalMinutes: number; shiftCount: number }>>({})

  const [libraryFilter, setLibraryFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'working' | 'available'>('')

  const [detail, setDetail] = useState<LibraryStaff | null>(null)
  const [ending, setEnding] = useState<LibraryShift | null>(null)
  const [endBusy, setEndBusy] = useState(false)

  useEffect(() => {
    libraryService.getOptions().then(setLibraryOptions).catch(() => setLibraryOptions([]))
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const now = new Date()
      const [sum, shifts, staffRes, leaderboard] = await Promise.all([
        libraryService.shifts.getOverviewSummary(),
        libraryService.shifts.getAllActive(),
        libraryService.staff.getList({
          page: 1,
          limit: 500,
          search: search || undefined,
          libraryId: libraryFilter || undefined,
        }),
        libraryService.shifts.getLeaderboard({ year: now.getFullYear(), month: now.getMonth() + 1, limit: 1000 }),
      ])
      setSummary(sum)
      setActiveShifts(shifts)
      setStaff(staffRes.items)
      setStaffTotal(staffRes.total)
      setMonthlyTotals(Object.fromEntries(leaderboard.map((l) => [l.staffId, { totalMinutes: l.totalMinutes, shiftCount: l.shiftCount }])))
    } catch {
      setSummary(null); setActiveShifts([]); setStaff([]); setStaffTotal(0); setMonthlyTotals({})
    } finally {
      if (!silent) setLoading(false)
    }
  }, [search, libraryFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const endShift = async () => {
    if (!ending) return
    setEndBusy(true)
    try {
      await libraryService.shifts.end(ending.id)
      toast.success(`${ending.staffName} mesaisi bitirildi.`)
      setEnding(null)
      await load()
    } finally {
      setEndBusy(false)
    }
  }

  const filteredStaff = staff.filter((s) => {
    if (statusFilter === 'working') return !!s.activeShiftId
    if (statusFilter === 'available') return s.isActive && !s.activeShiftId
    return true
  })

  const activeColumns: DataTableColumn<LibraryShift>[] = [
    { key: 'staff', header: 'Personel', cell: (r) => <span className="type-body-strong">{r.staffName}</span> },
    { key: 'library', header: 'Kütüphane', cell: (r) => <span className="flex items-center gap-1.5 type-body"><BuildingIcon className="h-3.5 w-3.5 text-foreground-subtle" />{r.libraryName}</span> },
    { key: 'start', header: 'Başlangıç', cell: (r) => <span className="tabular-nums type-muted"><ClockIcon className="mr-1 inline h-3 w-3 text-success" />{fmtTime(r.startTime)}</span> },
    { key: 'duration', header: 'Çalışma Süresi', cell: (r) => <span className="tabular-nums text-foreground-strong">{fmtDuration(r.workedMinutes ?? 0)}</span> },
    { key: 'by', header: 'Başlatan', cell: (r) => <span className="type-muted">{initiationLabel(r.initiationType, r.initiatedByName)}</span> },
    { key: 'status', header: 'Durum', align: 'center', cell: () => <Badge tone="success">Çalışıyor</Badge> },
  ]

  const staffColumns: DataTableColumn<LibraryStaff>[] = [
    {
      key: 'name', header: 'Personel', cell: (r) => (
        <div className="min-w-0">
          <p className="type-body-strong truncate">{r.fullName}</p>
          <p className="type-caption truncate">{r.phone || r.email || '—'}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Rol', cell: (r) => <span className="type-muted">{r.roleName || '—'}</span> },
    {
      key: 'libraries', header: 'Çalışabildiği Kütüphaneler', cell: (r) => (
        <span className="type-muted">{r.workingLibraryIds.length} kütüphane</span>
      ),
    },
    {
      key: 'monthlyTotal', header: `${MONTH_NAMES_SHORT[new Date().getMonth()]} Ayı Toplamı`, align: 'center', cell: (r) => {
        const t = monthlyTotals[r.id]
        if (!t || t.totalMinutes <= 0) return <span className="type-caption text-foreground-subtle">—</span>
        return (
          <div className="flex flex-col items-center gap-0.5">
            <span className="tabular-nums type-body-strong text-primary">{fmtDuration(t.totalMinutes)}</span>
            <span className="type-caption tabular-nums text-foreground-subtle">{t.shiftCount} mesai</span>
          </div>
        )
      },
    },
    {
      key: 'status', header: 'Durum', align: 'center', cell: (r) => r.activeShiftId
        ? (
          <div className="flex flex-col items-center gap-0.5">
            <Badge tone="success">Mesaide</Badge>
            {r.activeLibraryName && <span className="type-caption truncate">{r.activeLibraryName}</span>}
          </div>
        )
        : <Badge tone={r.isActive ? 'neutral' : 'warning'}>{r.isActive ? 'Müsait' : 'Pasif'}</Badge>,
    },
  ]

  const hasActiveFilters = !!searchInput || !!libraryFilter || !!statusFilter

  return (
    <div className="space-y-4">
      <div className="pilot-stat-grid">
        <StatCard label="Şu An Mesaide" value={summary?.activeShifts ?? 0} icon={BriefcaseIcon} accent="green" loading={loading} />
        <StatCard label="Bugünkü Mesai" value={summary?.todayShifts ?? 0} icon={CalendarCheckIcon} accent="blue" loading={loading} />
        <StatCard label="Aktif Personel" value={summary?.eligibleStaff ?? 0} icon={UsersRoundIcon} accent="violet" loading={loading} />
        <StatCard label="Mesaili Kütüphane" value={summary?.librariesWithActiveShift ?? 0} icon={BuildingIcon} accent="orange" loading={loading} />
      </div>

      <SectionToolbar
        icon={BriefcaseIcon}
        title="Aktif Mesailer"
        subtitle="Şu anda mesaide olan tüm personel, kütüphane bilgisiyle birlikte"
        actions={
          <IconButton title="Yenile" onClick={() => load()}><RefreshCwIcon className="h-4 w-4" /></IconButton>
        }
      />
      <DataTable<LibraryShift>
        showRowNumbers
        columns={activeColumns}
        rows={activeShifts}
        rowKey={(r) => r.id}
        loading={loading}
        total={activeShifts.length}
        rowActions={(r) => canManage ? (
          <IconButton tone="danger" title="Mesai bitir" onClick={() => setEnding(r)}><SquareIcon className="h-4 w-4" /></IconButton>
        ) : undefined}
        empty={<EmptyState icon={BriefcaseIcon} title="Aktif mesai yok" description="Şu anda hiçbir kütüphanede mesaide personel bulunmuyor." />}
      />

      <SectionToolbar
        icon={UsersRoundIcon}
        title="Tüm Personel"
        subtitle={`${staffTotal} kayıtlı kütüphane personeli`}
      />

      <FilterBar
        columns={3}
        hasActiveFilters={hasActiveFilters}
        onClear={() => { setSearchInput(''); setSearch(''); setLibraryFilter(''); setStatusFilter('') }}
      >
        <FilterField label="Ara">
          <Input
            placeholder="Personel adı, rol, telefon..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
          />
        </FilterField>
        <FilterField label="Kütüphane">
          <Select value={libraryFilter} onChange={(e) => setLibraryFilter(e.target.value)}>
            <option value="">Tüm Kütüphaneler</option>
            {libraryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterField>
        <FilterField label="Durum">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="">Tümü</option>
            <option value="working">Mesaide</option>
            <option value="available">Müsait</option>
          </Select>
        </FilterField>
      </FilterBar>

      <DataTable<LibraryStaff>
        showRowNumbers
        columns={staffColumns}
        rows={filteredStaff}
        rowKey={(r) => r.id}
        loading={loading}
        total={filteredStaff.length}
        rowActions={(r) => (
          <IconButton title="Geçmiş / detay" onClick={() => setDetail(r)}><EyeIcon className="h-4 w-4" /></IconButton>
        )}
        empty={<EmptyState icon={UsersRoundIcon} title="Personel bulunamadı" description="Filtrelerle eşleşen kütüphane personeli yok." />}
      />

      <StaffDetailModal staff={detail} onClose={() => setDetail(null)} canEdit={canManage} />

      <ConfirmModal
        open={!!ending}
        onClose={() => setEnding(null)}
        onConfirm={endShift}
        loading={endBusy}
        tone="danger"
        title="Mesai Bitir"
        description={`"${ending?.staffName}" personelinin (${ending?.libraryName}) mesaisi bitirilecek ve çalışma süresi kaydedilecek. Devam edilsin mi?`}
        confirmLabel="Mesai Bitir"
      />
    </div>
  )
}
