import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon,
  UsersIcon, UserCheckIcon, HourglassIcon, MapPinIcon, CalendarRangeIcon, InfoIcon,
  BuildingIcon, CheckCircle2Icon, ClockIcon, XIcon, SearchIcon, CheckIcon, CarIcon,
  SlidersHorizontalIcon,
} from 'lucide-react'
import { OCCUPANCY_LEGEND } from '../sports/sportsData'
import { SkeletonRows } from '@/design-system'
import type { CitizenFacilityGroup } from '@/types/facility.types'
import type { CitizenChild } from '@/types/family.types'
import { FACILITY_MODULES } from './facilityModules'
import facilityService from '@/services/facility.service'
import familyService from '@/services/family.service'
import { CapacityRow } from '@/framework/ui/CapacityRow'
import { DistanceBadge } from '@/components/specialized/DistanceBadge'
import { FacilityDetailModal } from './FacilityDetailModal'

const BRANCH_COLORS: Record<string, { from: string; to: string; bg: string; text: string }> = {
  'Futsal':      { from: '#3b82f6', to: '#1d4ed8', bg: '#eff6ff', text: '#1d4ed8' },
  'Basketbol':   { from: '#f97316', to: '#c2410c', bg: '#fff7ed', text: '#c2410c' },
  'Voleybol':    { from: '#8b5cf6', to: '#6d28d9', bg: '#f5f3ff', text: '#6d28d9' },
  'Badminton':   { from: '#10b981', to: '#047857', bg: '#ecfdf5', text: '#047857' },
  'Masa Tenisi': { from: '#06b6d4', to: '#0e7490', bg: '#ecfeff', text: '#0e7490' },
  'Yüzme':       { from: '#0ea5e9', to: '#0369a1', bg: '#f0f9ff', text: '#0369a1' },
  'Su Aerobiği': { from: '#38bdf8', to: '#0284c7', bg: '#f0f9ff', text: '#0284c7' },
}

function getBranchColor(name: string) {
  return BRANCH_COLORS[name] ?? { from: '#6366f1', to: '#4338ca', bg: '#eef2ff', text: '#4338ca' }
}

function cleanGroupName(name: string): string {
  return name
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\b\d+\s*g[üu]n\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function parseScheduleSummary(summary: string): { days: string[]; time: string } {
  if (!summary) return { days: [], time: '' }
  const [daysPart, timePart] = summary.split('·').map((s) => s.trim())
  const days = daysPart.split(',').map((d) => d.trim()).filter(Boolean)
  return { days, time: timePart ?? '' }
}

function groupByBranch(groups: CitizenFacilityGroup[]): Map<string, CitizenFacilityGroup[]> {
  const map = new Map<string, CitizenFacilityGroup[]>()
  for (const g of groups) {
    if (!map.has(g.branchName)) map.set(g.branchName, [])
    map.get(g.branchName)!.push(g)
  }
  return map
}

function childMatchesGroup(child: CitizenChild, g: Pick<CitizenFacilityGroup, 'gender' | 'ageMin' | 'ageMax'>): boolean {
  if (g.gender === 'male' || g.gender === 'female') {
    const childGender = child.gender === 'Male' ? 'male' : 'female'
    if (g.gender !== childGender) return false
  }
  if (g.ageMin > 0 && child.age < g.ageMin) return false
  if (g.ageMax > 0 && child.age > g.ageMax) return false
  return true
}

const ProgramCard = ({
  group,
  color,
  onClick,
}: {
  group: CitizenFacilityGroup
  color: ReturnType<typeof getBranchColor>
  onClick: () => void
}) => {
  const { days, time } = parseScheduleSummary(group.scheduleSummary ?? '')
  const isFull = group.capacity > 0 && group.registeredCount >= group.capacity
  const waitRoom = Math.max(0, group.reserveCapacity - group.waitlistCount)
  const isWaitlist = isFull && waitRoom > 0
  const isClosed = isFull && waitRoom <= 0
  const hasAge = group.ageMin > 0 && group.ageMax > 0 && !(group.ageMin === 0 && group.ageMax === 0)
  const cleanName = cleanGroupName(group.name)

  const statusChip = group.alreadyApplied
    ? { label: 'Başvuruldu', className: 'bg-emerald-50 border-emerald-100 text-emerald-700' }
    : isClosed
      ? { label: 'Kontenjan dolu', className: 'bg-red-50 border-red-100 text-red-600' }
      : isWaitlist
        ? { label: 'Yedek açık', className: 'bg-amber-50 border-amber-100 text-amber-700' }
        : { label: 'Tümü açık', className: 'bg-emerald-50 border-emerald-100 text-emerald-700' }

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
    >
      <div className="flex items-stretch gap-3 p-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            {hasAge ? (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ background: color.bg, color: color.text }}>
                {group.ageMin}–{group.ageMax} yaş
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                Tüm yaşlar
              </span>
            )}
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusChip.className}`}>
              <CheckCircle2Icon className="h-3 w-3" /> {statusChip.label}
            </span>
          </div>

          <p className="text-[15px] font-bold leading-snug text-gray-900">{cleanName}</p>

          {days.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {days.map((d) => (
                <span key={d} className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
                  style={{ background: `${color.from}14`, color: color.text }}>
                  {d}
                </span>
              ))}
              {time && <span className="inline-flex items-center gap-1 text-[12px] text-gray-500 tabular-nums ml-0.5"><ClockIcon className="h-3 w-3 text-gray-400" />{time}</span>}
            </div>
          ) : (
            <span className="text-[11px] text-gray-400">Gün belirtilmemiş</span>
          )}

          {(group.periodStart || group.periodEnd) && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <CalendarRangeIcon className="h-3 w-3 flex-shrink-0" />
              {group.periodStart ? new Date(group.periodStart).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : '—'}
              {' – '}
              {group.periodEnd ? new Date(group.periodEnd).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : '—'}
            </div>
          )}
        </div>

        <ChevronRightIcon className="h-4 w-4 flex-shrink-0 self-center text-gray-300" />
      </div>

      <div className="px-3 pb-3">
        <CapacityRow data={group} />
      </div>
    </button>
  )
}

const BranchGroup = ({
  branchName,
  groups,
  onSelect,
}: {
  branchName: string
  groups: CitizenFacilityGroup[]
  onSelect: (g: CitizenFacilityGroup) => void
}) => {
  const color = getBranchColor(branchName)
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 px-1">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white text-[11px] font-bold"
          style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}>
          {branchName.slice(0, 2).toUpperCase()}
        </span>
        <p className="text-sm font-bold text-gray-800">{branchName}</p>
        <span className="text-[11px] text-gray-400">· {groups.length} program</span>
      </div>
      <div className="space-y-2.5">
        {groups.map((g) => (
          <ProgramCard key={g.id} group={g} color={color} onClick={() => onSelect(g)} />
        ))}
      </div>
    </div>
  )
}

const FacilitySummary = ({ groups }: { groups: CitizenFacilityGroup[] }) => {
  const capacity = groups.reduce((s, g) => s + g.capacity, 0)
  const registered = groups.reduce((s, g) => s + g.registeredCount, 0)
  const free = Math.max(0, capacity - registered)
  const waitlist = groups.reduce((s, g) => s + g.waitlistCount, 0)
  const total = registered + waitlist

  const stats = [
    { icon: UsersIcon, value: `${free.toLocaleString('tr-TR')}/${capacity.toLocaleString('tr-TR')}`, label: 'Kontenjan', sub: 'Boş / Toplam', tone: 'text-emerald-600', chip: 'bg-emerald-50 text-emerald-600' },
    { icon: UserCheckIcon, value: registered.toLocaleString('tr-TR'), label: 'Başvuru', sub: 'Onaylı', tone: 'text-blue-600', chip: 'bg-blue-50 text-blue-600' },
    { icon: HourglassIcon, value: waitlist.toLocaleString('tr-TR'), label: 'Yedek', sub: 'Sıradaki', tone: 'text-orange-500', chip: 'bg-amber-50 text-orange-500' },
    { icon: UsersIcon, value: total.toLocaleString('tr-TR'), label: 'Toplam Kişi', sub: 'Dahil', tone: 'text-violet-600', chip: 'bg-violet-50 text-violet-600' },
  ]

  return (
    <div className="grid grid-cols-4 gap-1 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      {stats.map((s, i) => (
        <div key={i} className="flex flex-col items-center gap-1 text-center">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.chip}`}>
            <s.icon className="h-4 w-4" />
          </span>
          <span className={`text-lg font-black leading-none tabular-nums ${s.tone}`}>{s.value}</span>
          <span className="text-[11px] font-medium text-gray-700 leading-none">{s.label}</span>
          <span className="text-[10px] text-gray-400 leading-none">{s.sub}</span>
        </div>
      ))}
    </div>
  )
}

const FacilitySection = ({
  facilityName,
  serviceFacilityName,
  facilityAddress,
  facilityLat,
  facilityLng,
  hasParking,
  parkingCapacity,
  groups,
  onSelectGroup,
}: {
  facilityName: string
  serviceFacilityName?: string | null
  facilityAddress?: string | null
  facilityLat?: number | null
  facilityLng?: number | null
  hasParking?: boolean
  parkingCapacity?: number | null
  groups: CitizenFacilityGroup[]
  onSelectGroup: (g: CitizenFacilityGroup) => void
}) => {
  const branchMap = useMemo(() => groupByBranch(groups), [groups])

  if (groups.length === 0) return null

  const showComplex = serviceFacilityName && serviceFacilityName !== facilityName

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 px-1 pt-1">
        <div className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center">
          <BuildingIcon className="h-3.5 w-3.5 text-gray-500" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-gray-700">{facilityName}</p>
            {hasParking && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                <CarIcon className="h-3 w-3" />
                Otopark{parkingCapacity ? ` · ${parkingCapacity} araçlık` : ''}
              </span>
            )}
          </div>
          {showComplex && (
            <p className="text-xs text-gray-400 mt-0.5">{serviceFacilityName}</p>
          )}
          {facilityAddress && (
            <p className="inline-flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <MapPinIcon className="h-3 w-3 flex-shrink-0" />{facilityAddress}
            </p>
          )}
          <DistanceBadge
            className="mt-0.5"
            target={facilityLat != null && facilityLng != null ? { latitude: facilityLat, longitude: facilityLng } : null}
          />
        </div>
      </div>

      <FacilitySummary groups={groups} />

      <div className="space-y-5">
        {Array.from(branchMap.entries()).map(([branch, bGroups]) => (
          <BranchGroup
            key={branch}
            branchName={branch}
            groups={bGroups}
            onSelect={onSelectGroup}
          />
        ))}
      </div>
    </div>
  )
}

export const FacilityProgramsTab = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [moduleKey, setModuleKey] = useState<string | null>(searchParams.get('m'))
  const [groups, setGroups] = useState<CitizenFacilityGroup[] | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [selected, setSelected] = useState<{ module: string; groupId: string } | null>(() => {
    const m = searchParams.get('m')
    const g = searchParams.get('g')
    return m && g ? { module: m, groupId: g } : null
  })
  const [refresh, setRefresh] = useState(0)
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [onlyWithParking, setOnlyWithParking] = useState(false)
  const [facilityFilter, setFacilityFilter] = useState<string | null>(null)
  const [onlyEligible, setOnlyEligible] = useState(true)
  const [facilitySheetOpen, setFacilitySheetOpen] = useState(false)
  const [facilitySearch, setFacilitySearch] = useState('')
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [onlyFull, setOnlyFull] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [children, setChildren] = useState<CitizenChild[]>([])
  const [selectedChildIds, setSelectedChildIds] = useState<Set<string>>(new Set())

  // Sol menudeki hizmetler ayni /hizmetler sayfasini farkli ?m= degerleriyle acar.
  // Bilesen route degismedigi icin yeniden mount olmaz; query'yi state'e canli olarak
  // yansitmazsak URL degisirken sag tarafta onceki hizmet gorunmeye devam eder.
  useEffect(() => {
    const requestedModule = searchParams.get('m')
    const nextModule = FACILITY_MODULES.some((m) => m.key === requestedModule)
      ? requestedModule
      : null
    const groupId = searchParams.get('g')

    setModuleKey(nextModule)
    setSelected(nextModule && groupId ? { module: nextModule, groupId } : null)
    setFacilityFilter(null)
    setOnlyAvailable(false)
    setOnlyWithParking(false)
    setOnlyFull(false)
    setSearch('')
  }, [searchParams])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let active = true
    familyService.getChildren()
      .then((list) => { if (active) setChildren(list) })
      .catch(() => { if (active) setChildren([]) })
    return () => { active = false }
  }, [])

  const toggleChild = (id: string) => {
    setSelectedChildIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearGroupParam = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('g')
      return next
    }, { replace: true })
  }

  const facilityNames = useMemo(() => {
    if (!groups) return [] as string[]
    const set = new Set<string>()
    for (const g of groups) set.add(g.facilityName || 'Diğer')
    return Array.from(set)
  }, [groups])

  const eligibleCountByFacility = useMemo(() => {
    const map = new Map<string, number>()
    if (!groups) return map
    for (const g of groups) {
      const key = g.facilityName || 'Diğer'
      if (!map.has(key)) map.set(key, 0)
      if (g.eligible || g.alreadyApplied) map.set(key, map.get(key)! + 1)
    }
    return map
  }, [groups])

  const totalEligibleCount = useMemo(
    () => Array.from(eligibleCountByFacility.values()).reduce((s, n) => s + n, 0),
    [eligibleCountByFacility],
  )

  const facilitySheetItems = useMemo(() => {
    const q = facilitySearch.toLocaleLowerCase('tr')
    return facilityNames
      .filter((f) => f.toLocaleLowerCase('tr').includes(q))
      .map((f) => ({ name: f, eligible: eligibleCountByFacility.get(f) ?? 0 }))
      .sort((a, b) => b.eligible - a.eligible || a.name.localeCompare(b.name, 'tr'))
  }, [facilityNames, eligibleCountByFacility, facilitySearch])

  const activeFilterCount = (onlyAvailable ? 1 : 0) + (onlyFull ? 1 : 0) + (onlyWithParking ? 1 : 0) + (facilityFilter ? 1 : 0) + (onlyEligible ? 0 : 1)

  const clearAllFilters = () => {
    setOnlyEligible(true)
    setOnlyAvailable(false)
    setOnlyFull(false)
    setOnlyWithParking(false)
    setFacilityFilter(null)
  }

  const visibleGroups = useMemo(() => {
    if (!groups) return [] as CitizenFacilityGroup[]
    const selectedChildren = children.filter((c) => selectedChildIds.has(c.id))
    const q = debouncedSearch.toLocaleLowerCase('tr')
    return groups.filter((g) => {
      if (onlyEligible || selectedChildren.length > 0) {
        const passesSelf = onlyEligible && g.eligible
        const passesChildren = selectedChildren.some((c) => childMatchesGroup(c, g))
        if (!(passesSelf || passesChildren || g.alreadyApplied)) return false
      }
      if (facilityFilter && g.facilityName !== facilityFilter) return false
      if (onlyFull) {
        const isFull = g.capacity > 0 && g.registeredCount >= g.capacity
        if (!isFull) return false
      }
      if (q) {
        const haystack = `${g.name} ${g.branchName} ${g.facilityName}`.toLocaleLowerCase('tr')
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [groups, onlyEligible, facilityFilter, onlyFull, children, selectedChildIds, debouncedSearch])

  const groupedByFacility = useMemo(() => {
    const map = new Map<string, CitizenFacilityGroup[]>()
    for (const g of visibleGroups) {
      const key = g.facilityName || 'Diğer'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(g)
    }
    return map
  }, [visibleGroups])

  const visibleTotal = visibleGroups.length

  useEffect(() => {
    let active = true
    Promise.all(
      FACILITY_MODULES.map((m) =>
        facilityService.discover(m.key, { page: 1, limit: 1 })
          .then((r) => [m.key, r.total] as const)
          .catch(() => [m.key, 0] as const),
      ),
    ).then((pairs) => { if (active) setCounts(Object.fromEntries(pairs)) })
    return () => { active = false }
  }, [refresh])

  useEffect(() => {
    if (!moduleKey) { setGroups(null); return }
    let active = true
    setLoadingList(true)
    // Bulgu (2026-09-17): onlySubGroups:true koşulsuz gönderiliyordu — backend bunu
    // "yalnızca alt grupları göster" olarak yorumluyor (ParentGroupId != null). Sistemde
    // 2.348 aktif gruptan sadece 13'ünün (%0.6) alt grubu var; alt grup admin panelde
    // isteğe bağlı bir hiyerarşi katmanı, zorunlu değil. Bu yüzden 6/8 modülde (pool,
    // science-center, youth-camp, scout-camp, accessible-life, women-family) vatandaşa
    // HİÇ program görünmüyordu — gerçek kapasiteli/kayıtlı ana gruplar dahi filtreleniyordu.
    // Parametre kaldırıldı: backend artık hem ana hem alt grupları döndürüyor.
    const base: Record<string, unknown> = { limit: 100 }
    if (onlyAvailable) base.onlyAvailable = true
    if (onlyWithParking) base.onlyWithParking = true
    // showAll olmadan backend YALNIZCA vatandaşın kendi uygunluğuna göre süzüyor;
    // çocuğun grubu (farklı yaş/cinsiyet) hiç gelmiyordu. Çocuk çipi seçiliyken veya
    // "sadece bana uygun" kapatılmışken çocuk/tüm gruplar da istenmeli — aksi halde
    // childMatchesGroup süzgeci boş listede çalışıyor ve ebeveyn çocuğu adına
    // başvuramıyordu. SportsPage.tsx:176 ile aynı desen.
    if (selectedChildIds.size > 0 || !onlyEligible) base.showAll = true
    const loadAll = async () => {
      const acc: CitizenFacilityGroup[] = []
      let page = 1
      let total = Infinity
      while (acc.length < total && page <= 20) {
        const r = await facilityService.discover(moduleKey, { ...base, page })
        acc.push(...r.items)
        total = r.total ?? acc.length
        if (r.items.length === 0) break
        page++
      }
      return acc
    }
    loadAll()
      .then((items) => { if (active) setGroups(items) })
      .catch(() => { if (active) setGroups([]) })
      .finally(() => { if (active) setLoadingList(false) })
    return () => { active = false }
  }, [moduleKey, refresh, onlyAvailable, onlyWithParking, selectedChildIds, onlyEligible])

  if (moduleKey) {
    const info = FACILITY_MODULES.find((m) => m.key === moduleKey)

    return (
      <div className="flex flex-col min-h-full">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setModuleKey(null); setSearchParams({}); setOnlyAvailable(false) }}
              className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <ChevronLeftIcon className="h-4 w-4 text-gray-600" />
            </button>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {info && (
                <div className="flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: info.gradient }}>
                  <info.icon className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 leading-tight truncate">{info?.label}</p>
                {groups && (
                  <p className="text-[11px] text-gray-400">
                    {visibleTotal} program
                    {onlyEligible && <span className="text-blue-500 font-medium"> · size uygun</span>}
                    {facilityNames.length > 1 && <span> · {facilityNames.length} tesis</span>}
                  </p>
                )}
              </div>
            </div>
            {!selectedChildIds.size && (
              <button
                type="button"
                onClick={() => setOnlyEligible((v) => !v)}
                className="flex-shrink-0 flex items-center gap-0.5 text-[13px] font-semibold text-blue-600"
              >
                {onlyEligible ? <>Tümünü Gör ({groups?.length ?? 0})</> : 'Uygunları Gör'} <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Spor, salon veya tesis ara..."
                className="w-full rounded-2xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm outline-none transition-colors focus:border-blue-300"
              />
            </div>
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              className="relative flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-2xl border bg-white shadow-sm transition-colors hover:bg-gray-50"
              style={{ borderColor: activeFilterCount > 0 ? '#2563eb' : '#e5e7eb', color: activeFilterCount > 0 ? '#2563eb' : '#6b7280' }}
            >
              <SlidersHorizontalIcon className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-[11px] font-bold text-white">{activeFilterCount}</span>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {OCCUPANCY_LEGEND.map((item) => {
              const isBos = item.key === 'bos'
              const isDolu = item.key === 'dolu'
              const clickable = isBos || isDolu
              const active = isBos ? onlyAvailable : isDolu ? onlyFull : false
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={!clickable}
                  onClick={() => {
                    if (isBos) { setOnlyAvailable((v) => !v); if (!onlyAvailable) setOnlyFull(false) }
                    if (isDolu) { setOnlyFull((v) => !v); if (!onlyFull) setOnlyAvailable(false) }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium shadow-sm transition-colors"
                  style={active
                    ? { background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }
                    : { background: '#fff', color: '#374151', borderColor: '#e5e7eb' }}
                >
                  {item.variant === 'pie' ? (
                    <span className="h-3 w-3 rounded-full" style={{ background: `conic-gradient(${item.color} 0 65%, ${item.color}33 65% 100%)` }} />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                  )}
                  {item.label}
                </button>
              )
            })}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold text-blue-600"
              >
                <XIcon className="h-3.5 w-3.5" /> Filtreleri temizle
              </button>
            )}
          </div>

          {children.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {children.map((child) => {
                const isSelected = selectedChildIds.has(child.id)
                const firstName = child.fullName.trim().split(/\s+/)[0] ?? child.fullName
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => toggleChild(child.id)}
                    className="flex-shrink-0 flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium transition-colors"
                    style={isSelected
                      ? { background: '#fdf2f8', color: '#db2777', border: '1px solid #fbcfe8' }
                      : { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}
                  >
                    {isSelected && <CheckIcon className="h-3 w-3" />}
                    {firstName}'e uygun · {child.age} yaş
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {filterSheetOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setFilterSheetOpen(false)}>
            <div className="max-h-[75vh] rounded-t-3xl bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <p className="text-base font-bold text-gray-900">Filtrele</p>
                <button type="button" onClick={() => setFilterSheetOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 hover:bg-gray-200">
                  <XIcon className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Filtreler</span>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="flex items-center gap-1 text-[13px] font-medium text-blue-600"
                    >
                      <XIcon className="h-3.5 w-3.5" /> Temizle ({activeFilterCount})
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Sadece yaşıma uygun</span>
                  <button type="button" role="switch" aria-checked={onlyEligible} onClick={() => setOnlyEligible((v) => !v)} className="h-6 w-11 rounded-full transition-colors" style={{ background: onlyEligible ? '#2563eb' : '#e5e7eb' }}>
                    <span className="block h-5 w-5 rounded-full bg-white transition-transform" style={{ transform: onlyEligible ? 'translateX(22px)' : 'translateX(2px)' }} />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[13px] font-medium text-gray-500">Kontenjan durumu</span>
                  <div className="flex flex-wrap gap-2">
                    {OCCUPANCY_LEGEND.map((item) => {
                      const isBos = item.key === 'bos'
                      const isDolu = item.key === 'dolu'
                      const clickable = isBos || isDolu
                      const active = isBos ? onlyAvailable : isDolu ? onlyFull : false
                      return (
                        <button
                          key={item.key}
                          type="button"
                          disabled={!clickable}
                          onClick={() => {
                            if (isBos) { setOnlyAvailable((v) => !v); if (!onlyAvailable) setOnlyFull(false) }
                            if (isDolu) { setOnlyFull((v) => !v); if (!onlyFull) setOnlyAvailable(false) }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
                          style={active
                            ? { background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }
                            : { background: '#fff', color: '#374151', borderColor: '#e5e7eb' }}
                        >
                          {item.variant === 'pie' ? (
                            <span className="h-3 w-3 rounded-full" style={{ background: `conic-gradient(${item.color} 0 65%, ${item.color}33 65% 100%)` }} />
                          ) : (
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                          )}
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Otoparklı tesisler</span>
                  <button type="button" onClick={() => setOnlyWithParking((v) => !v)} className="h-6 w-11 rounded-full transition-colors" style={{ background: onlyWithParking ? '#2563eb' : '#e5e7eb' }}>
                    <span className="block h-5 w-5 rounded-full bg-white transition-transform" style={{ transform: onlyWithParking ? 'translateX(22px)' : 'translateX(2px)' }} />
                  </button>
                </div>

                {facilityNames.length > 1 && (
                  <div className="space-y-1.5">
                    <span className="text-[13px] font-medium text-gray-500">Tesis</span>
                    <button
                      type="button"
                      onClick={() => { setFacilitySearch(''); setFilterSheetOpen(false); setFacilitySheetOpen(true) }}
                      className="flex w-full items-center gap-1.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors"
                      style={facilityFilter
                        ? { background: '#1f2937', color: '#fff' }
                        : { background: '#f3f4f6', color: '#374151' }}
                    >
                      <BuildingIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate flex-1">{facilityFilter ?? 'Tüm tesisler'}</span>
                      <ChevronDownIcon className="h-4 w-4 flex-shrink-0" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {facilitySheetOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setFacilitySheetOpen(false)}>
            <div className="max-h-[75vh] rounded-t-3xl bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <p className="text-base font-bold text-gray-900">Tesis seç</p>
                <button type="button" onClick={() => setFacilitySheetOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 hover:bg-gray-200">
                  <XIcon className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <div className="px-5 pb-3">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    value={facilitySearch}
                    onChange={(e) => setFacilitySearch(e.target.value)}
                    placeholder="Tesis ara…"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:bg-white"
                  />
                </div>
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
                <button
                  type="button"
                  onClick={() => { setFacilityFilter(null); setFacilitySheetOpen(false) }}
                  className={`flex w-full items-center justify-between gap-2 rounded-[15px] px-4 py-3 text-left text-sm transition-colors ${facilityFilter === null ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <span className="min-w-0 flex-1">Tüm tesisler</span>
                  {totalEligibleCount > 0 && (
                    <span className="flex-shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      {totalEligibleCount} program
                    </span>
                  )}
                  {facilityFilter === null && <CheckCircle2Icon className="h-4 w-4 flex-shrink-0 text-blue-600" />}
                </button>
                {facilitySheetItems.map(({ name: f, eligible }) => {
                  const disabled = eligible === 0
                  const active = facilityFilter === f
                  return (
                    <button
                      key={f}
                      type="button"
                      disabled={disabled}
                      onClick={disabled ? undefined : () => { setFacilityFilter(f); setFacilitySheetOpen(false) }}
                      className={`flex w-full items-center justify-between gap-2 rounded-[15px] px-4 py-3 text-left text-sm transition-colors ${
                        disabled
                          ? 'cursor-not-allowed text-gray-400 opacity-60'
                          : active
                            ? 'bg-blue-50 font-semibold text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{f}</span>
                      {eligible > 0 ? (
                        <span className="flex-shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                          {eligible} program
                        </span>
                      ) : (
                        <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400">
                          Uygun program yok
                        </span>
                      )}
                      {active && !disabled && <CheckCircle2Icon className="h-4 w-4 flex-shrink-0 text-blue-600" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <div className="p-4 space-y-6 flex-1">
          {loadingList ? (
            <SkeletonRows rows={5} />
          ) : !groups || visibleTotal === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white border border-gray-100 p-10 shadow-sm text-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50">
                <CalendarRangeIcon className="h-8 w-8 text-gray-300" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Program bulunamadı</p>
                <p className="mt-1 text-sm text-gray-500">
                  {onlyEligible ? 'Profilinize uygun aktif program şu an mevcut değil. Filtreyi kaldırarak tümünü görebilirsiniz.' : 'Bu filtrelere uygun program yok.'}
                </p>
              </div>
            </div>
          ) : (
            Array.from(groupedByFacility.entries()).map(([facilityName, facilityGroups]) => {
              const serviceFacilityName = facilityGroups[0]?.serviceFacilityName
              const addr = facilityGroups[0]?.serviceFacilityAddress
              const lat = facilityGroups[0]?.serviceFacilityLatitude
              const lng = facilityGroups[0]?.serviceFacilityLongitude
              const hasParking = facilityGroups[0]?.hasParking
              const parkingCapacity = facilityGroups[0]?.parkingCapacity
              return (
                <FacilitySection
                  key={facilityName}
                  facilityName={facilityName}
                  serviceFacilityName={serviceFacilityName}
                  facilityAddress={addr}
                  facilityLat={lat}
                  facilityLng={lng}
                  hasParking={hasParking}
                  parkingCapacity={parkingCapacity}
                  groups={facilityGroups}
                  onSelectGroup={(g) => setSelected({ module: g.module, groupId: g.id })}
                />
              )
            })
          )}
        </div>

        <FacilityDetailModal
          module={selected?.module ?? null}
          groupId={selected?.groupId ?? null}
          onClose={() => { setSelected(null); clearGroupParam() }}
          onApplied={() => { setSelected(null); clearGroupParam(); setRefresh((n) => n + 1) }}
        />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {FACILITY_MODULES.map((m) => {
          const count = counts?.[m.key]
          const hasPrograms = count && count > 0

          return (
            <button
              key={m.key}
              onClick={() => { setModuleKey(m.key); setSearchParams({ m: m.key }) }}
              className="group flex flex-col items-start rounded-2xl bg-white text-left border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.99] overflow-hidden"
            >
              {m.imageUrl ? (
                <div className="w-full h-32 overflow-hidden relative flex-shrink-0">
                  <img src={m.imageUrl} alt={m.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 40%, ${m.color}99 100%)` }} />
                  <div className="absolute bottom-2 left-3 flex h-9 w-9 items-center justify-center rounded-xl shadow-lg"
                    style={{ background: m.gradient }}>
                    <m.icon className="h-4.5 w-4.5 text-white" />
                  </div>
                </div>
              ) : (
                <div className="w-full h-28 flex items-center justify-center relative overflow-hidden flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${m.color}22 0%, ${m.color}08 100%)` }}>
                  <div className="pointer-events-none absolute -top-4 -right-4 h-20 w-20 rounded-full"
                    style={{ background: `${m.color}15` }} />
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-md"
                    style={{ background: m.gradient }}>
                    <m.icon className="h-7 w-7 text-white" />
                  </div>
                </div>
              )}

              <div className="p-3 w-full">
                <p className="mb-1.5 font-bold text-gray-900 text-sm leading-tight">{m.label}</p>
                {counts == null ? (
                  <span className="text-xs text-gray-400">Yükleniyor…</span>
                ) : hasPrograms ? (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: `${m.color}15`, color: m.color }}
                  >
                    {count} aktif program
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400">
                    Aktif program yok
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div
        className="flex items-start gap-3 rounded-2xl p-4"
        style={{ background: 'linear-gradient(135deg, #EFF6FF, #F0FDF4)' }}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100">
          <InfoIcon className="h-4 w-4 text-blue-600" />
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          Programlara <strong className="text-gray-800">siz</strong> ve{' '}
          <strong className="text-gray-800">18 yaş altı çocuklarınız</strong> adına başvurabilirsiniz.
          Başvurunuz onaylandığında bilgilendirilirsiniz.
        </p>
      </div>
    </div>
  )
}
