import { useUiStandards } from '@/design-system/UiStandards/UiStandards'
import { useEffect, useMemo, useState } from 'react'
import {
  Users2Icon, UserCheck2Icon, ClockIcon, LayersIcon,
  ZapIcon,
  ArrowRightIcon, MapPinIcon, ToggleRightIcon, ToggleLeftIcon, MessageSquareIcon, Trash2Icon,
  CalendarClockIcon, ListIcon, LayoutGridIcon, DownloadIcon, WrenchIcon, RotateCcwIcon,
  Building2Icon, CpuIcon, SettingsIcon, EyeIcon, UsersIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, Button, Checkbox, Input, Select, FilterBar, FilterField, ConfirmModal, DataTable, Badge, IconButton, RowActions, BulkActions, type SortState } from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import { FacilitySendMessageModal } from './FacilitySendMessageModal'
import type { FacilityModuleConfig } from './moduleConfig'
import type { FacilityModuleService } from './types'
import type { FacilityRecord, FacilitySummary } from '@/types/facility.types'

interface Props {
  config: FacilityModuleConfig
  service: FacilityModuleService
  summary: FacilitySummary | null
  facilities: FacilityRecord[]
  loading: boolean
  onPick: (id: string) => void
  onRefresh: () => void
  onManage?: (id: string) => void
  onOpenTab?: (id: string, tab: string) => void
  onOpenSettings?: (id: string) => void
}

function OccBar({ value, height = 'h-2' }: { value: number; height?: string }) {
  const clamped = Math.max(0, Math.min(value, 100))
  const color = value >= 95 ? 'hsl(var(--danger))' : value >= 75 ? 'hsl(var(--warning))' : 'hsl(var(--success))'
  return (
    <div role="progressbar" aria-label="Kontenjan doluluğu" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} className={`w-full rounded-full bg-surface-2 overflow-hidden ${height}`}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${clamped}%`, background: color }} />
    </div>
  )
}

const SORTERS: Record<string, (f: FacilityRecord) => number | string> = {
  name: (f) => f.name.toLocaleLowerCase('tr-TR'),
  capacity: (f) => f.capacity || 0,
  registered: (f) => f.registeredCount || 0,
  waitlist: (f) => f.waitlistCount || 0,
  groups: (f) => f.groupCount || 0,
  occupancy: (f) => rateOf(f),
}

const DAY_OPTIONS = [
  { value: '1', label: 'Pazartesi' }, { value: '2', label: 'Salı' }, { value: '3', label: 'Çarşamba' },
  { value: '4', label: 'Perşembe' }, { value: '5', label: 'Cuma' }, { value: '6', label: 'Cumartesi' }, { value: '0', label: 'Pazar' },
]

const exportCsv = (rows: FacilityRecord[], fileName: string) => {
  const head = ['Tesis', 'İlçe', 'Kapasite', 'Kayıtlı', 'Bekleyen', 'Aktif Grup', 'Bugünkü Seans', 'Doluluk %', 'Durum']
  const body = rows.map((f) => [
    f.name, f.district ?? '', f.capacity, f.registeredCount ?? 0, f.waitlistCount ?? 0,
    f.groupCount ?? 0, f.todaySessionCount ?? 0, rateOf(f), f.isActive ? 'Aktif' : 'Pasif',
  ])
  const csv = [head, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

const rateOf = (f: FacilityRecord) => {
  const quota = f.totalGroupCapacity ?? 0
  return quota > 0 ? Math.round(((f.registeredCount || 0) / quota) * 100) : 0
}

export const FacilityDashboardOverview = ({ config, service, summary, facilities, loading, onPick, onRefresh, onManage, onOpenTab, onOpenSettings }: Props) => {
  const pilot = useUiStandards()
  const T = config.terminology
  const { can, isSuperAdmin } = useAuth()
  const canDelete = can('service-facilities.delete')

  const [search, setSearch] = useState('')
  const [occ, setOcc] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [district, setDistrict] = useState('')
  const [kind, setKind] = useState('')
  const [branch, setBranch] = useState('')
  const [day, setDay] = useState('')
  const hideViewToggle = Boolean(config.hideViewToggle || config.id === 'women_family' || config.routeId === 'women-family')
  const [view, setView] = useState<'table' | 'grid'>('table')
  const [sort, setSort] = useState<SortState | null>(null)
  const [groupMatchFacilityIds, setGroupMatchFacilityIds] = useState<Set<string> | null>(null)
  const [applicantMatchFacilityIds, setApplicantMatchFacilityIds] = useState<Set<string> | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [bulkKind, setBulkKind] = useState<'activate' | 'deactivate' | 'delete' | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FacilityRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [templateMessageIds, setTemplateMessageIds] = useState<string[] | null>(null)

  const districts = useMemo(
    () => Array.from(new Set(facilities.map((f) => f.district).filter(Boolean))) as string[],
    [facilities],
  )
  const branchOptions = useMemo(
    () => Array.from(new Set(facilities.flatMap((f) => f.branches ?? []))).sort((a, b) => a.localeCompare(b, 'tr-TR')),
    [facilities],
  )

  useEffect(() => {
    const q = search.trim()
    if (!q) { setGroupMatchFacilityIds(null); setApplicantMatchFacilityIds(null); return }
    let cancelled = false
    const timer = setTimeout(() => {
      service.groups.getList({ search: q, limit: 200 })
        .then((res) => {
          if (cancelled) return
          setGroupMatchFacilityIds(new Set(res.items.map((g) => g.facilityId)))
        })
        .catch(() => { if (!cancelled) setGroupMatchFacilityIds(new Set()) })
      service.applications.getList({ search: q, limit: 200 })
        .then((res) => {
          if (cancelled) return
          setApplicantMatchFacilityIds(new Set(res.items.map((a) => a.facilityId)))
        })
        .catch(() => { if (!cancelled) setApplicantMatchFacilityIds(new Set()) })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [search, service])

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return facilities.filter((f) => {
      if (q) {
        const nameMatch = f.name.toLocaleLowerCase('tr-TR').includes(q)
        const groupMatch = groupMatchFacilityIds?.has(f.id) ?? false
        const applicantMatch = applicantMatchFacilityIds?.has(f.id) ?? false
        if (!nameMatch && !groupMatch && !applicantMatch) return false
      }
      if (district && f.district !== district) return false
      if (kind && f.kind !== kind) return false
      if (branch && !(f.branches ?? []).includes(branch)) return false
      if (day && !(f.sessionDays ?? []).includes(Number(day))) return false
      if (statusFilter === 'active' && !f.isActive) return false
      if (statusFilter === 'passive' && f.isActive) return false
      if (occ) {
        const r = rateOf(f)
        if (occ === 'available' && r >= 75) return false
        if (occ === 'filling' && (r < 75 || r >= 95)) return false
        if (occ === 'full' && r < 95) return false
      }
      return true
    })
  }, [facilities, search, district, kind, branch, day, statusFilter, occ, groupMatchFacilityIds, applicantMatchFacilityIds])

  const ranked = useMemo(() => {
    const get = sort && SORTERS[sort.key]
    if (!get) return [...filtered].sort(
      (a, b) => ((b.registeredCount || 0) + (b.waitlistCount || 0)) - ((a.registeredCount || 0) + (a.waitlistCount || 0)),
    )
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const x = get(a), y = get(b)
      return (typeof x === 'string' ? x.localeCompare(String(y), 'tr-TR') : x - (y as number)) * dir
    })
  }, [filtered, sort])

  useEffect(() => { setPage(1) }, [search, occ, statusFilter, district, kind, branch, day])
  useEffect(() => { setPage(p => Math.min(p, Math.max(1, Math.ceil(ranked.length / limit)))) }, [ranked.length, limit])

  const hasActiveFilters = !!(search || occ || statusFilter || district || kind || branch || day)
  const clearFilters = () => { setSearch(''); setOcc(''); setStatusFilter(''); setDistrict(''); setKind(''); setBranch(''); setDay('') }

  const totalQuota      = facilities.reduce((s, f) => s + (f.totalGroupCapacity || 0), 0)
  const totalRegistered = facilities.reduce((s, f) => s + (f.registeredCount || 0), 0)
  const totalWaiting    = facilities.reduce((s, f) => s + (f.waitlistCount || 0), 0)
  const totalGroups     = facilities.reduce((s, f) => s + (f.groupCount || 0), 0)
  const overallRate     = totalQuota > 0 ? Math.round((totalRegistered / totalQuota) * 100) : 0
  const totalToday      = facilities.reduce((s, f) => s + (f.todaySessionCount || 0), 0)

  // Kullanıcı isteği (2026-10-07, ikinci revizyon): kartlar StatCard ile tutarlı ılımlı
  // 4 renkli palet kullanıyor (lacivert/yeşil/amber/mor) — rastgele "sultanşehir" rainbow'u
  // değil, her kart kendi anlamına uygun ayırt edici bir tona sahip.
  const STATS = [
    { label: 'Toplam Kontenjan',           value: totalQuota,                                  sub: `${facilities.length} ${T.facilitySingular}`,   icon: Users2Icon,    grad: 'linear-gradient(135deg,#0a3a66,#0f4c81)', glow: '#0f4c8120', pilotIconBg: 'bg-[#eef3f8]', pilotIconFg: 'text-[#0f4c81]' },
    { label: `Aktif ${T.participantPlural}`, value: (pilot ? totalRegistered : summary?.mainParticipants ?? totalRegistered), sub: 'kayıtlı',       icon: UserCheck2Icon, grad: 'linear-gradient(135deg,#3f5d1a,#80c242)', glow: '#80c24220', pilotIconBg: 'bg-[#f1f7e8]', pilotIconFg: 'text-[#5a8a2a]' },
    { label: 'Bekleyenler',                value: (pilot ? totalWaiting : summary?.waitlistParticipants ?? totalWaiting),  sub: 'yedek listede', icon: ClockIcon,       grad: 'linear-gradient(135deg,#7c2d12,#f97316)', glow: '#f9731620', pilotIconBg: 'bg-amber-50', pilotIconFg: 'text-amber-600' },
    { label: `${pilot ? "Toplam" : "Aktif"} ${T.groupPlural}`,     value: (pilot ? totalGroups : summary?.activeGroups ?? totalGroups),           sub: `%${overallRate} doluluk`, icon: LayersIcon, grad: 'linear-gradient(135deg,#4c1d95,#6d28d9)', glow: '#6d28d920', pilotIconBg: 'bg-[#f5f3ff]', pilotIconFg: 'text-[#6d28d9]' },
  ]

  if (pilot) {
    STATS.splice(2, 0, { label: 'Bugünkü Seans', value: totalToday, sub: 'bugün planlı seans', icon: CalendarClockIcon, grad: '', glow: '', pilotIconBg: 'bg-[#f1f7e8]', pilotIconFg: 'text-[#5a8a2a]' })
    STATS[4] = { ...STATS[4], label: `Aktif ${T.groupPlural}`, sub: `%${overallRate} ortalama doluluk` }
    const waiting = STATS.splice(3, 1)[0]
    STATS.push(waiting)
  }

  const selectedList = ranked.filter((f) => selected.has(f.id))

  const totalPages = Math.max(1, Math.ceil(ranked.length / limit))
  const pagedRows = ranked.slice((page - 1) * limit, page * limit)

  const bulkTargets = bulkKind === 'delete'
    ? selectedList
    : selectedList.filter((f) => bulkKind === 'activate' ? !f.isActive : bulkKind === 'deactivate' ? f.isActive : false)

  const runDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await service.facilities.remove(deleteTarget.id)
      toast.success(`${deleteTarget.name} silindi.`)
      setDeleteTarget(null)
      onRefresh()
    } finally {
      setDeleting(false)
    }
  }

  const runBulk = async () => {
    if (!bulkKind) return
    setBulkBusy(true)
    try {
      if (bulkKind === 'delete') {
        const results = await Promise.allSettled(bulkTargets.map((f) => service.facilities.remove(f.id)))
        const failed = results.filter((r) => r.status === 'rejected').length
        const succeeded = results.length - failed
        if (succeeded > 0) toast.success(`${succeeded} ${T.facilitySingular.toLowerCase()} silindi.`)
        if (failed > 0) toast.error(`${failed} ${T.facilitySingular.toLowerCase()} silinemedi.`)
      } else {
        const results = await Promise.allSettled(bulkTargets.map((f) => service.facilities.toggleStatus(f.id)))
        const failed = results.filter((r) => r.status === 'rejected').length
        const succeeded = results.length - failed
        if (succeeded > 0) toast.success(bulkKind === 'activate' ? `${succeeded} tesis aktif edildi.` : `${succeeded} tesis pasife alındı.`)
        if (failed > 0) toast.error(bulkKind === 'activate' ? `${failed} tesis aktif edilemedi.` : `${failed} tesis pasife alınamadı.`)
      }
      setBulkKind(null)
      setSelected(new Set())
      onRefresh()
    } finally {
      setBulkBusy(false)
    }
  }

  const renderCard = (f: FacilityRecord) => <article key={f.id} className="rounded-xl border border-border bg-white p-4">
          <div className="flex items-start gap-3"><Checkbox aria-label={`${f.name} tesisini seç`} checked={selected.has(f.id)} onCheckedChange={(checked) => setSelected(prev => { const next = new Set(prev); if (checked) next.add(f.id); else next.delete(f.id); return next })} />
            <div className="min-w-0 flex-1"><h3 className="font-semibold break-words">{f.name}</h3><p className="pilot-muted">{f.district || 'İlçe belirtilmedi'}</p></div>
            <Badge tone={f.isActive ? 'success' : 'neutral'}>{f.isActive ? 'Aktif' : 'Pasif'}</Badge>
          </div>
          <dl className="my-4 grid grid-cols-3 gap-2"><div><dt className="pilot-muted">Kapasite</dt><dd className="font-semibold">{f.capacity}</dd></div><div><dt className="pilot-muted">Kayıtlı</dt><dd className="font-semibold">{f.registeredCount || 0}</dd></div><div><dt className="pilot-muted">Yedek</dt><dd className="font-semibold">{f.waitlistCount || 0}</dd></div></dl>
          <OccBar value={rateOf(f)} /><div className="mt-3 flex items-center justify-between gap-2"><span className="pilot-muted">%{rateOf(f)} doluluk</span><Button variant="outline" onClick={() => onPick(f.id)} aria-label={`${f.name} tesisini aç`}>Tesisi aç <ArrowRightIcon aria-hidden="true" /></Button></div>
        </article>

  const selectionActions = (
          <>
            <Button variant="ghost" size="sm" onClick={() => setBulkKind('activate')}>
              <ToggleRightIcon className="h-4 w-4 text-success" /> Aktif Yap
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setBulkKind('deactivate')}>
              <ToggleLeftIcon className="h-4 w-4 text-foreground-subtle" /> Pasif Yap
            </Button>
            {isSuperAdmin && (
              <Button variant="primary" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setTemplateMessageIds(Array.from(selected))}>
                SMS / Bildirim Gönder
              </Button>
            )}
            {canDelete && (
              <Button variant="outline" size="sm" className="text-danger hover:bg-danger-soft" onClick={() => setBulkKind('delete')}>
                <Trash2Icon className="h-4 w-4" /> Sil
              </Button>
            )}
          </>
  )

  const bulkBar = (
    <BulkActions
      count={selected.size}
      onClear={() => setSelected(new Set())}
      actions={[
        { key: 'activate', label: 'Aktif Yap', icon: ToggleRightIcon, tone: 'success', onClick: () => setBulkKind('activate') },
        { key: 'deactivate', label: 'Pasif Yap', icon: ToggleLeftIcon, tone: 'warning', onClick: () => setBulkKind('deactivate') },
        { key: 'delete', label: 'Sil', icon: Trash2Icon, tone: 'danger', hidden: !canDelete, onClick: () => setBulkKind('delete') },
      ]}
    />
  )

  return (
    <div className={pilot ? "pilot-overview space-y-4" : "space-y-5"}>

      <div className={pilot ? "pilot-stat-grid" : "grid grid-cols-2 gap-3 sm:grid-cols-4"}>
        {STATS.map((s) => (
          <div key={s.label} className={pilot ? "pilot-stat-card" : "relative overflow-hidden rounded-2xl bg-[hsl(var(--card))] border border-border p-5 shadow-sm"}>
            {!pilot && <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-60" style={{ background: s.glow }} />}
            <div className="relative">
              <div className={pilot ? `pilot-stat-icon ${s.pilotIconBg} ${s.pilotIconFg}` : "mb-3 flex h-9 w-9 items-center justify-center rounded-xl"} style={pilot ? undefined : { background: s.grad }}>
                <s.icon className={pilot ? "h-5 w-5" : "h-4 w-4 text-white"} />
              </div>
              {loading
                ? <div className="h-8 w-16 animate-pulse rounded-lg bg-surface-2 mb-1" />
                : <p className={pilot ? "pilot-stat-value" : "text-[28px] font-black leading-none text-foreground-strong mb-0.5"}>{s.value.toLocaleString('tr-TR')}</p>
              }
              <p className={pilot ? "pilot-stat-label" : "text-[11px] font-semibold text-foreground-muted"}>{s.label}</p>
              <p className={pilot ? "pilot-stat-note" : "text-[10px] text-foreground-subtle mt-0.5"}>{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {!pilot && totalQuota > 0 && !loading && (
        <div className="rounded-2xl bg-[hsl(var(--card))] border border-border shadow-sm px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <ZapIcon className="h-4 w-4 text-[hsl(var(--accent-violet))]" />
              <span className="text-[13px] font-bold text-foreground-default">Genel Doluluk</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-foreground-subtle">{totalRegistered.toLocaleString('tr-TR')} / {totalQuota.toLocaleString('tr-TR')} kişi</span>
              <span className="font-black text-[15px]" style={{ color: overallRate >= 95 ? 'hsl(var(--danger))' : overallRate >= 75 ? 'hsl(var(--warning))' : 'hsl(var(--success))' }}>
                %{overallRate}
              </span>
            </div>
          </div>
          <OccBar value={overallRate} height="h-2.5" />
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-foreground-subtle">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[hsl(var(--success))] inline-block" />{totalRegistered.toLocaleString('tr-TR')} kayıtlı</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[hsl(var(--warning))] inline-block" />{totalWaiting.toLocaleString('tr-TR')} bekleyen</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-surface-2 inline-block" />{Math.max(0, totalQuota - totalRegistered).toLocaleString('tr-TR')} boş</span>
          </div>
        </div>
      )}

      <FilterBar className={pilot ? 'pilot-filters' : undefined} columns={pilot ? 6 : 4} filterCount={[search, occ, statusFilter, district, kind, branch, day].filter(Boolean).length} hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
        <FilterField label={pilot ? "Tesis Ara" : "Ara"}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`${T.facilitySingular}, ${T.groupSingular.toLowerCase()} veya başvuran adı/TC`} />
        </FilterField>
        {pilot && (
          <FilterField label="Salon Türü">
            <Select dropdown searchable searchPlaceholder="Seçenek ara..." value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Tüm salonlar</option>
              <option value="indoor">Kapalı ({facilities.filter((f) => f.kind === 'indoor').length})</option>
              <option value="outdoor">Açık ({facilities.filter((f) => f.kind === 'outdoor').length})</option>
              <option value="mixed">Karma ({facilities.filter((f) => f.kind === 'mixed').length})</option>
            </Select>
          </FilterField>
        )}
        {pilot && (
          <FilterField label="Branş">
            <Select dropdown searchable searchPlaceholder="Seçenek ara..." value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Tüm branşlar</option>
              {branchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
          </FilterField>
        )}
        <FilterField label={pilot ? "Doluluk Oranı" : "Doluluk"}>
          <Select dropdown={pilot} searchable={pilot} searchPlaceholder="Seçenek ara..." value={occ} onChange={(e) => setOcc(e.target.value)}>
            <option value="">{pilot ? 'Tüm oranlar' : 'Tümü'}</option>
            <option value="available">Müsait</option>
            <option value="filling">Dolmak Üzere</option>
            <option value="full">Dolu</option>
          </Select>
        </FilterField>
        <FilterField label="Durum">
          <Select dropdown={pilot} searchable={pilot} searchPlaceholder="Seçenek ara..." value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{pilot ? 'Tüm durumlar' : 'Tümü'}</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </Select>
        </FilterField>
        {pilot ? (
          <FilterField label="Seans Günü">
            <Select dropdown searchable searchPlaceholder="Seçenek ara..." value={day} onChange={(e) => setDay(e.target.value)}>
              <option value="">Tüm günler</option>
              {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </Select>
          </FilterField>
        ) : (
          <FilterField label="İlçe">
            <Select value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">Tümü</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </FilterField>
        )}
        {pilot && (
          <div className="pilot-filter-reset">
            <IconButton title="Filtreleri sıfırla" disabled={!hasActiveFilters} onClick={clearFilters}><RotateCcwIcon className="h-4 w-4" /></IconButton>
          </div>
        )}
      </FilterBar>

      <div className={pilot ? "pilot-desktop-table" : undefined}>
      <DataTable<FacilityRecord>
        title={`${T.facilityPlural} Listesi — ${ranked.length} tesis`}
        toolbarActions={pilot ? (
          <>
            {isSuperAdmin && (
              <Button variant="primary" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />}
                disabled={selected.size === 0} title={selected.size === 0 ? 'Önce tesis seçin' : undefined}
                onClick={() => setTemplateMessageIds(Array.from(selected))}>
                SMS &amp; Bildirim
              </Button>
            )}
            {!hideViewToggle && (
              <div className="pilot-view-toggle" role="group" aria-label="Görünüm">
                <Button variant="ghost" size="sm" title="Tablo görünümü" aria-pressed={view === 'table'} iconLeft={<ListIcon className="h-4 w-4" />} onClick={() => setView('table')}>Tablo</Button>
                <IconButton title="Kart görünümü" aria-pressed={view === 'grid'} tone={view === 'grid' ? 'primary' : 'default'} onClick={() => setView('grid')}><LayoutGridIcon className="h-4 w-4" /></IconButton>
              </div>
            )}
            <Button variant="outline" size="sm" iconLeft={<DownloadIcon className="h-4 w-4" />} disabled={ranked.length === 0}
              onClick={() => exportCsv(ranked, `${config.routeId}-tesisler.csv`)}>
              Dışa Aktar
            </Button>
          </>
        ) : undefined}
        rows={view === 'grid' ? [] : pagedRows}
        rowKey={(f) => f.id}
        loading={loading}
        showRowNumbers
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        page={page}
        totalPages={totalPages}
        total={ranked.length}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1) }}
        sort={pilot ? sort : undefined}
        onSortChange={pilot ? (st) => { setSort(st); setPage(1) } : undefined}
        selectionActions={pilot ? bulkBar : selectionActions}
        selectionPlacement={pilot ? 'end' : 'start'}

        columns={[
          {
            key: 'name',
            header: pilot ? `${T.facilitySingular} / Tesis Adı` : T.facilitySingular,
            sortable: true,
            cell: (f) => pilot ? (
              <button type="button" onClick={() => onPick(f.id)} title={f.name} className="pilot-name-cell">
                <span className="truncate">{f.name}</span>
                {!f.isActive && <Badge tone="neutral">Pasif</Badge>}
              </button>
            ) : (
              <button type="button" onClick={() => onPick(f.id)} className="min-w-0 text-left">
                <span className="flex items-center gap-1.5">
                  <span className="type-body-strong truncate text-[hsl(var(--primary))] hover:underline">{f.name}</span>
                  {!f.isActive && <Badge tone="neutral">Pasif</Badge>}
                </span>
                {(f.district || f.address) && (
                  <span className="mt-0.5 flex items-center gap-0.5 type-caption text-foreground-muted truncate">
                    <MapPinIcon className="h-2.5 w-2.5 shrink-0" />
                    {[f.district, f.address].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
            ),
          },
          {
            key: 'capacity', sortable: true, header: 'Kapasite', align: 'center',
            cell: (f) => <span className="tabular-nums font-bold text-[hsl(var(--primary))]">{(f.capacity || 0).toLocaleString('tr-TR')}</span>,
          },
          {
            key: 'registered', sortable: true, header: 'Kayıtlı', align: 'center',
            cell: (f) => <span className="tabular-nums font-bold text-[hsl(var(--success))]">{(f.registeredCount || 0).toLocaleString('tr-TR')}</span>,
          },
          {
            key: 'waitlist', sortable: true, header: 'Bekleyen', align: 'center',
            cell: (f) => <span className="tabular-nums font-bold text-[hsl(var(--warning))]">{(f.waitlistCount || 0).toLocaleString('tr-TR')}</span>,
          },
          {
            key: 'groups', sortable: true, header: pilot ? `Aktif ${T.groupSingular}` : T.groupSingular, align: 'center',
            cell: (f) => <span className="tabular-nums font-bold text-[hsl(var(--accent-violet))]">{(f.groupCount || 0).toLocaleString('tr-TR')}</span>,
          },
          ...(pilot ? [{
            key: 'sessions', header: 'Seans Bilgisi',
            cell: (f: FacilityRecord) => (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-foreground-default">
                <ClockIcon className="h-3.5 w-3.5 text-foreground-subtle" />
                {f.todaySessionCount ? `Bugün ${f.todaySessionCount} seans` : 'Bugün seans yok'}
              </span>
            ),
          }] : []),
          {
            key: 'occupancy', header: 'Doluluk', sortable: true,
            cell: (f) => {
              const rate = rateOf(f)
              if (pilot) return (
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-surface-2">
                    <span className="block h-full rounded-full" style={{ width: `${Math.min(rate, 100)}%`, background: rate > 80 ? '#f59e0b' : '#5a8a2a' }} />
                  </span>
                  <span className="min-w-[34px] text-right font-mono text-[11px] font-bold tabular-nums text-foreground-strong">%{rate}</span>
                </span>
              )
              return (
                <div className="w-[9rem] space-y-1">
                  <OccBar value={rate} />
                  <span className="block text-[10px] font-bold tabular-nums"
                    style={{ color: rate >= 95 ? 'hsl(var(--danger))' : rate >= 75 ? 'hsl(var(--warning))' : 'hsl(var(--success))' }}>
                    %{rate}
                  </span>
                </div>
              )
            },
          },
          {
            key: 'status', header: 'Durum', align: 'center',
            cell: (f) => <Badge color={f.isActive ? '#059669' : '#64748b'} dot className={pilot ? 'pilot-chip' : undefined}>{f.isActive ? 'Aktif' : 'Pasif'}</Badge>,
          },
        ]}
        rowActions={(f) => (
          pilot ? (
            <RowActions
              menuTitle={`${f.name} işlemleri`}
              extra={<>
                {onManage && <IconButton title={`${f.name} tesisini düzenle`} onClick={() => onManage(f.id)}><WrenchIcon className="h-4 w-4" /></IconButton>}
              </>}
              menu={[
                { label: 'Tesis & Salon Düzenle', icon: Building2Icon, tone: 'primary', disabled: !onManage, onClick: () => onManage?.(f.id) },
                { label: 'Cihaz & Ekipman Yönetimi', icon: CpuIcon, tone: 'info', disabled: !onOpenTab, onClick: () => onOpenTab?.(f.id, 'attendance') },
                { label: `Seans & ${T.groupSingular} Programı`, icon: ClockIcon, tone: 'warning', disabled: !onOpenTab, onClick: () => onOpenTab?.(f.id, 'sessions') },
                { label: 'Tesis Ayarları & Politikalar', icon: SettingsIcon, disabled: !onOpenSettings, onClick: () => onOpenSettings?.(f.id) },
                { label: '', divider: true },
                { label: 'Detay Sayfasını Aç', icon: EyeIcon, onClick: () => onPick(f.id) },
                { label: 'Katılımcı Listesi', icon: UsersIcon, disabled: !onOpenTab, onClick: () => onOpenTab?.(f.id, 'applications') },
                { label: '', divider: true },
                { label: 'Kaydı Sil', icon: Trash2Icon, tone: 'danger', disabled: !canDelete, onClick: () => setDeleteTarget(f) },
              ]}
            />
          ) : <IconButton tone="primary" title={`${T.facilitySingular} detayına git`} onClick={() => onPick(f.id)}>
            <ArrowRightIcon className="h-4 w-4" />
          </IconButton>
        )}
        empty={view === 'grid' && pagedRows.length > 0 ? (
          <div className="pilot-card-grid">{pagedRows.map(renderCard)}</div>
        ) :
          <EmptyState icon={config.icon}
            title={hasActiveFilters ? 'Filtreye uygun kayıt yok' : `Henüz ${T.facilitySingular.toLowerCase()} yok`}
            description={hasActiveFilters ? 'Filtreleri değiştirin veya temizleyin.' : `${T.facilityPlural} eklendiğinde burada listelenir.`} />
        }
      />

      </div>
      {pilot && <section className="pilot-mobile-list" aria-label="Tesis listesi">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{T.facilityPlural} <span className="pilot-muted">({ranked.length})</span></h2>
          <label className="flex items-center gap-2"><Checkbox aria-label="Bu sayfadaki tesisleri seç" checked={pagedRows.length > 0 && pagedRows.every(f => selected.has(f.id))} onCheckedChange={(checked) => setSelected(prev => { const next = new Set(prev); pagedRows.forEach(f => checked ? next.add(f.id) : next.delete(f.id)); return next })} />Tümünü seç</label>
        </div>
        {selected.size > 0 && <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-white p-3">{selectionActions}</div>}
        {loading ? <p role="status">Tesisler yükleniyor…</p> : pagedRows.length === 0 ? <EmptyState icon={config.icon} title="Tesis bulunamadı" description="Filtreleri değiştirerek tekrar deneyin." /> : pagedRows.map(renderCard)}
        <nav aria-label="Tesis sayfaları" className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Önceki</Button><span aria-live="polite">{page} / {totalPages}</span><Button variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Sonraki</Button>
        </nav>
      </section>}

      <ConfirmModal
        open={!!bulkKind}
        onClose={() => setBulkKind(null)}
        onConfirm={runBulk}
        icon={bulkKind === 'delete' ? Trash2Icon : undefined}
        tone={bulkKind === 'deactivate' || bulkKind === 'delete' ? 'danger' : 'primary'}
        title={
          bulkKind === 'activate' ? 'Seçili tesisleri aktif yap'
          : bulkKind === 'deactivate' ? 'Seçili tesisleri pasife al'
          : `Seçili ${T.facilityPlural.toLowerCase()} silinsin mi?`
        }
        description={
          bulkKind === 'delete'
            ? `Seçili ${bulkTargets.length} ${T.facilitySingular.toLowerCase()} kalıcı olarak silinecek. Bu tesislere bağlı TÜM ${T.groupPlural.toLowerCase()} ve içerikleri (seanslar, bekleyen başvurular) de birlikte silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`
            : `${bulkTargets.length} ${T.facilitySingular.toLowerCase()} durumu güncellenecek.`
        }
        confirmLabel={bulkKind === 'activate' ? 'Aktif Yap' : bulkKind === 'deactivate' ? 'Pasife Al' : 'Evet, Sil'}
        loading={bulkBusy}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={runDelete}
        icon={Trash2Icon}
        tone="danger"
        title={`${deleteTarget?.name ?? ''} silinsin mi?`}
        description={`Bu ${T.facilitySingular.toLowerCase()} kalıcı olarak silinecek. Bağlı TÜM ${T.groupPlural.toLowerCase()} ve içerikleri (seanslar, bekleyen başvurular) de birlikte silinecek. Bu işlem geri alınamaz.`}
        confirmLabel="Evet, Sil"
        loading={deleting}
      />

      {isSuperAdmin && (
        <FacilitySendMessageModal
          open={!!templateMessageIds}
          module={config.routeId}
          target="facility"
          ids={templateMessageIds ?? []}
          service={service}
          onClose={() => setTemplateMessageIds(null)}
          onSent={() => setSelected(new Set())}
        />
      )}
    </div>
  )
}
