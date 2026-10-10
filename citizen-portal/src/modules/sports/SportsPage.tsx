import { useEffect, useMemo, useState } from 'react'
import { Icon2D } from '@/components/Icon2D'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeftIcon, BellIcon, SearchIcon, SlidersHorizontalIcon,
  UsersIcon, MapPinIcon, CalendarIcon, ChevronRightIcon, XIcon,
  CheckIcon, BabyIcon, UserRoundIcon, UsersRoundIcon, CarIcon,
} from 'lucide-react'
import facilityService from '@/services/facility.service'
import familyService from '@/services/family.service'
import type { CitizenFacilityGroup, CitizenFacilityBranch, CitizenFacilityFilters } from '@/types/facility.types'
import { GENDER_LABEL } from '@/types/facility.types'
import type { CitizenChild } from '@/types/family.types'
import { visualForBranch, OCCUPANCY_LEGEND } from './sportsData'
import { CapacityRow } from '@/framework/ui/CapacityRow'

const EMPTY_FILTERS: CitizenFacilityFilters = {
  facilities: [], branches: [], genders: [], ageGroups: [], availableCount: 0, totalCount: 0, withParkingCount: 0,
}

const HERO_GRADIENT = 'linear-gradient(150deg, #4C1D95 0%, #5B21B6 34%, #4338CA 68%, #3730A3 100%)'
const MODULE = 'sports'

const FilterChip = ({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors"
    style={{
      borderColor: active ? 'hsl(var(--primary))' : 'hsl(var(--border))',
      background: active ? 'hsl(var(--primary))' : 'hsl(var(--card))',
      color: active ? '#fff' : 'hsl(var(--foreground-muted))',
    }}
  >
    <span className="truncate max-w-[160px]">{label}</span>
    {typeof count === 'number' && (
      <span className="rounded-full px-1.5 text-[11px] font-semibold" style={{ background: active ? 'rgba(255,255,255,0.22)' : 'hsl(var(--surface-2))', color: active ? '#fff' : 'hsl(var(--foreground-subtle))' }}>{count}</span>
    )}
  </button>
)

const ageGroupLabel = (g: CitizenFacilityGroup): string => {
  const range = g.ageMin > 0 && g.ageMax > 0 ? `${g.ageMin}–${g.ageMax} Yaş`
    : g.ageMin > 0 ? `${g.ageMin}+ Yaş`
    : g.ageMax > 0 ? `0–${g.ageMax} Yaş` : 'Tüm yaşlar'
  return `${range} ${GENDER_LABEL[g.gender] ?? ''}`.trim()
}

function facilityAudienceIcon(g: Pick<CitizenFacilityGroup, 'gender' | 'ageMin' | 'ageMax'>) {
  const isChildOnly = g.ageMax > 0 && g.ageMax < 12
  const isFemale = g.gender === 'female'
  const isMale = g.gender === 'male'
  if (isChildOnly) {
    return isFemale
      ? { Icon: BabyIcon, color: '#DB2777' }
      : isMale
        ? { Icon: BabyIcon, color: '#2563EB' }
        : { Icon: BabyIcon, color: '#7C3AED' }
  }
  if (isFemale) return { Icon: UserRoundIcon, color: '#DB2777' }
  if (isMale) return { Icon: UserRoundIcon, color: '#4F46E5' }
  return { Icon: UsersRoundIcon, color: '#7C3AED' }
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

export const SportsPage = () => {
  const navigate = useNavigate()
  const [branches, setBranches] = useState<CitizenFacilityBranch[]>([])
  const [branchName, setBranchName] = useState<string | null>(null)
  const [facilityId, setFacilityId] = useState<string | null>(null)
  const [ageGroupKey, setAgeGroupKey] = useState<string | null>(null)
  const [filters, setFilters] = useState<CitizenFacilityFilters>(EMPTY_FILTERS)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [onlyWithParking, setOnlyWithParking] = useState(false)
  const [gender, setGender] = useState<string>('')
  const [showAll, setShowAll] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [groups, setGroups] = useState<CitizenFacilityGroup[]>([])
  const [eligibleCount, setEligibleCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [children, setChildren] = useState<CitizenChild[]>([])
  const [selectedChildIds, setSelectedChildIds] = useState<Set<string>>(new Set())

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

  const childFilterActive = selectedChildIds.size > 0

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const ageGroup = useMemo(() => {
    if (!ageGroupKey) return null
    const [min, max] = ageGroupKey.split('-').map(Number)
    return { ageMin: min, ageMax: max }
  }, [ageGroupKey])

  const activeFilterCount = (facilityId ? 1 : 0) + (gender ? 1 : 0) + (ageGroupKey ? 1 : 0) + (onlyAvailable ? 1 : 0) + (onlyWithParking ? 1 : 0)

  const clearFilters = () => {
    setFacilityId(null)
    setGender('')
    setAgeGroupKey(null)
    setOnlyAvailable(false)
    setOnlyWithParking(false)
  }

  const selectedFacilityName = useMemo(
    () => filters.facilities.find((f) => f.id === facilityId)?.name ?? null,
    [filters.facilities, facilityId],
  )
  const selectedGenderLabel = useMemo(
    () => filters.genders.find((g) => g.value === gender)?.label ?? null,
    [filters.genders, gender],
  )
  const selectedAgeLabel = useMemo(
    () => filters.ageGroups.find((a) => `${a.ageMin}-${a.ageMax}` === ageGroupKey)?.label ?? null,
    [filters.ageGroups, ageGroupKey],
  )

  useEffect(() => {
    let active = true
    const params: Record<string, unknown> = {
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }
    facilityService.filters(MODULE, params)
      .then((res) => {
        if (!active) return
        setFilters(res)
        setBranches(res.branches)
      })
      .catch(() => { if (active) { setFilters(EMPTY_FILTERS); setBranches([]) } })
    return () => { active = false }
  }, [debouncedSearch])

  useEffect(() => {
    let active = true
    setLoading(true)
    // Bulgu (2026-09-17): onlySubGroups:true kaldırıldı — bkz. FacilityProgramsTab.tsx
    // aynı tarihli yorum. Gerçek kapasiteli ana gruplar bu filtre nedeniyle vatandaşa
    // hiç görünmüyordu.
    const params: Record<string, unknown> = {
      page: 1, limit: 100,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(branchName ? { branchName } : {}),
      ...(facilityId ? { facilityId } : {}),
      ...(onlyAvailable ? { onlyAvailable: true } : {}),
      ...(onlyWithParking ? { onlyWithParking: true } : {}),
      ...(gender ? { gender } : {}),
      ...(ageGroup ? { ageMin: ageGroup.ageMin, ageMax: ageGroup.ageMax } : {}),
      ...(showAll || childFilterActive ? { showAll: true } : {}),
    }
    facilityService.discover(MODULE, params)
      .then((res) => {
        if (!active) return
        setGroups(res.items)
        setEligibleCount(res.eligibleCount)
        setTotalCount(res.totalCount)
      })
      .catch(() => {
        if (!active) return
        setGroups([])
        setEligibleCount(0)
        setTotalCount(0)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [debouncedSearch, branchName, facilityId, onlyAvailable, onlyWithParking, gender, ageGroup, showAll, childFilterActive])

  const visibleGroups = useMemo(() => {
    if (!childFilterActive) return groups
    const selectedChildren = children.filter((c) => selectedChildIds.has(c.id))
    return groups.filter((g) => selectedChildren.some((c) => childMatchesGroup(c, g)) || g.alreadyApplied)
  }, [groups, childFilterActive, children, selectedChildIds])

  const groupedByFacility = useMemo(() => {
    const map = new Map<string, CitizenFacilityGroup[]>()
    for (const g of visibleGroups) {
      const key = g.facilityName || g.serviceFacilityName || 'Diğer'
      map.set(key, [...(map.get(key) ?? []), g])
    }
    return [...map.entries()]
  }, [visibleGroups])

  return (
    <div className="relative flex h-full flex-col bg-surface-1">
      <div className="relative overflow-hidden px-5 pb-16 pt-12" style={{ background: HERO_GRADIENT }}>
        <div className="relative flex items-center justify-between">
          <button type="button" onClick={() => navigate(-1)} className="grid h-10 w-10 place-items-center rounded-full bg-white/12 backdrop-blur-sm transition-colors hover:bg-white/20">
            <ChevronLeftIcon className="h-5 w-5 text-white" />
          </button>
          <button type="button" onClick={() => navigate('/bildirimler')} className="grid h-10 w-10 place-items-center rounded-full bg-white/12 backdrop-blur-sm transition-colors hover:bg-white/20">
            <BellIcon className="h-5 w-5 text-white" />
          </button>
        </div>

        <div className="relative mt-5">
          <h1 className="text-[34px] font-black italic leading-[0.92] tracking-tight text-white drop-shadow-sm">SPOR</h1>
          <div className="mt-1 inline-block rounded-md bg-white/10 px-2 py-0.5 backdrop-blur-sm">
            <span className="text-[26px] font-black italic leading-none tracking-tight text-cyan-300 drop-shadow">FAALİYETLERİMİZ</span>
          </div>
        </div>

        <div className="relative mt-7 flex items-start gap-3.5 overflow-x-auto">
          <button type="button" onClick={() => setBranchName(null)} className="flex w-[52px] flex-shrink-0 flex-col items-center gap-1.5 outline-none">
            <span className="grid h-[52px] w-[52px] place-items-center rounded-full text-2xl" style={{ background: branchName === null ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)', border: branchName === null ? '1.5px solid rgba(255,255,255,0.9)' : '1.5px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}><Icon2D kind="medal" className="h-6 w-6 text-white" /></span>
            <span className="whitespace-pre-line text-center text-[11px] font-medium leading-tight text-white/90">Tümü</span>
          </button>
          {branches.map((b) => {
            const active = b.branchName === branchName
            return (
              <button key={b.branchName} type="button" onClick={() => setBranchName(b.branchName)} className="flex w-[52px] flex-shrink-0 flex-col items-center gap-1.5 outline-none">
                <span className="grid h-[52px] w-[52px] place-items-center rounded-full text-2xl transition-all duration-200" style={{ background: active ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)', border: active ? '1.5px solid rgba(255,255,255,0.9)' : '1.5px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}>
                  <Icon2D kind={visualForBranch(b.branchName).icon} className="h-6 w-6 text-white" />
                </span>
                <span className="whitespace-pre-line text-center text-[11px] font-medium leading-tight text-white/90">{b.branchName}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative -mt-8 flex-1 overflow-y-auto rounded-t-[28px] bg-surface-1 pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <div className="space-y-4 px-4 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[hsl(var(--foreground-subtle))]" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Spor, salon veya tesis ara..." className="w-full rounded-2xl border border-border bg-card py-3.5 pl-11 pr-4 text-sm text-[hsl(var(--foreground-default))] placeholder:text-[hsl(var(--foreground-subtle))] shadow-[0_2px_10px_rgba(0,0,0,0.04)] outline-none transition-all focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary-soft))]" />
            </div>
            <button type="button" onClick={() => setFilterOpen((v) => !v)} className="relative grid h-[50px] w-[50px] flex-shrink-0 place-items-center rounded-2xl border bg-card shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition-colors hover:bg-surface-2" style={{ borderColor: activeFilterCount > 0 ? 'hsl(var(--primary))' : 'hsl(var(--border))', color: filterOpen || activeFilterCount > 0 ? 'hsl(var(--primary))' : 'hsl(var(--foreground-muted))' }}>
              <SlidersHorizontalIcon className="h-[18px] w-[18px]" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[hsl(var(--primary))] text-[11px] font-bold text-white">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {activeFilterCount > 0 && !filterOpen && (
            <div className="flex flex-wrap items-center gap-2">
              {selectedFacilityName && <FilterChip label={selectedFacilityName} active onClick={() => setFacilityId(null)} />}
              {selectedGenderLabel && <FilterChip label={selectedGenderLabel} active onClick={() => setGender('')} />}
              {selectedAgeLabel && <FilterChip label={selectedAgeLabel} active onClick={() => setAgeGroupKey(null)} />}
              {onlyAvailable && <FilterChip label="Boş yer var" active onClick={() => setOnlyAvailable(false)} />}
              {onlyWithParking && <FilterChip label="Otoparklı" active onClick={() => setOnlyWithParking(false)} />}
              <button type="button" onClick={clearFilters} className="text-[13px] font-medium text-[hsl(var(--foreground-subtle))] underline">Temizle</button>
            </div>
          )}

          {children.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {children.map((child) => {
                const isSelected = selectedChildIds.has(child.id)
                const firstName = child.fullName.trim().split(/\s+/)[0] ?? child.fullName
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => toggleChild(child.id)}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200"
                    style={isSelected
                      ? { background: 'rgba(219,39,119,0.1)', color: '#DB2777', border: '1.5px solid rgba(219,39,119,0.3)' }
                      : { background: 'hsl(var(--card))', color: 'hsl(var(--foreground-muted))', border: '1.5px solid hsl(var(--border))' }}
                  >
                    {isSelected && <CheckIcon className="h-3.5 w-3.5" />}
                    {firstName}'e uygun · {child.age} yaş
                  </button>
                )
              })}
            </div>
          )}

          {filterOpen && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[hsl(var(--foreground-strong))]">Filtrele</span>
                {activeFilterCount > 0 && (
                  <button type="button" onClick={clearFilters} className="flex items-center gap-1 text-[13px] font-medium text-[hsl(var(--primary))]">
                    <XIcon className="h-3.5 w-3.5" /> Temizle ({activeFilterCount})
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[hsl(var(--foreground-default))]">Sadece boş yer olanlar</span>
                <button type="button" onClick={() => setOnlyAvailable((v) => !v)} className="h-6 w-11 rounded-full transition-colors" style={{ background: onlyAvailable ? 'hsl(var(--primary))' : 'hsl(var(--surface-2))' }}>
                  <span className="block h-5 w-5 rounded-full bg-card transition-transform" style={{ transform: onlyAvailable ? 'translateX(22px)' : 'translateX(2px)' }} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[hsl(var(--foreground-default))]">Otoparklı tesisler ({filters.withParkingCount})</span>
                <button type="button" onClick={() => setOnlyWithParking((v) => !v)} className="h-6 w-11 rounded-full transition-colors" style={{ background: onlyWithParking ? 'hsl(var(--primary))' : 'hsl(var(--surface-2))' }}>
                  <span className="block h-5 w-5 rounded-full bg-card transition-transform" style={{ transform: onlyWithParking ? 'translateX(22px)' : 'translateX(2px)' }} />
                </button>
              </div>

              {filters.facilities.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[13px] font-medium text-[hsl(var(--foreground-muted))]">Tesis</span>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip label="Tüm tesisler" active={facilityId === null} onClick={() => setFacilityId(null)} />
                    {filters.facilities.map((f) => (
                      <FilterChip key={f.id} label={f.name} count={f.count} active={facilityId === f.id} onClick={() => setFacilityId((v) => v === f.id ? null : f.id)} />
                    ))}
                  </div>
                </div>
              )}

              {filters.genders.length > 1 && (
                <div className="space-y-1.5">
                  <span className="text-[13px] font-medium text-[hsl(var(--foreground-muted))]">Cinsiyet</span>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip label="Hepsi" active={gender === ''} onClick={() => setGender('')} />
                    {filters.genders.map((g) => (
                      <FilterChip key={g.value} label={g.label} count={g.count} active={gender === g.value} onClick={() => setGender((v) => v === g.value ? '' : g.value)} />
                    ))}
                  </div>
                </div>
              )}

              {filters.ageGroups.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[13px] font-medium text-[hsl(var(--foreground-muted))]">Yaş grubu</span>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip label="Tüm yaşlar" active={ageGroupKey === null} onClick={() => setAgeGroupKey(null)} />
                    {filters.ageGroups.map((a) => {
                      const key = `${a.ageMin}-${a.ageMax}`
                      return <FilterChip key={key} label={a.label} count={a.count} active={ageGroupKey === key} onClick={() => setAgeGroupKey((v) => v === key ? null : key)} />
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {!childFilterActive && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="flex w-full items-center justify-between rounded-2xl bg-primary-soft px-4 py-3 text-left transition-colors" style={{ border: '1px solid hsl(var(--primary) / 0.12)' }}>
              <span className="flex items-center gap-2.5">
                <UsersIcon className="h-[18px] w-[18px] text-[hsl(var(--primary))]" />
                <span className="text-sm font-medium text-[hsl(var(--foreground-default))]">
                  {showAll ? 'Tüm gruplar gösteriliyor' : <>Yaşınıza uygun <span className="font-bold text-[hsl(var(--foreground-strong))]">{eligibleCount} grup</span> gösteriliyor</>}
                </span>
              </span>
              <span className="flex flex-shrink-0 items-center gap-0.5 text-sm font-semibold text-[hsl(var(--primary))]">
                {showAll ? 'Uygunları Gör' : <>Tümünü Gör ({totalCount})</>} <ChevronRightIcon className="h-4 w-4" />
              </span>
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {OCCUPANCY_LEGEND.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-[hsl(var(--foreground-default))] shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
                {item.variant === 'pie' ? (
                  <span className="h-3 w-3 rounded-full" style={{ background: `conic-gradient(${item.color} 0 65%, ${item.color}33 65% 100%)` }} />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                )}
                {item.label}
              </span>
            ))}
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-[hsl(var(--foreground-subtle))]">Yükleniyor…</p>
          ) : visibleGroups.length === 0 ? (
            <p className="py-10 text-center text-sm text-[hsl(var(--foreground-subtle))]">
              {childFilterActive ? 'Seçili çocuğunuza uygun grup bulunamadı.' : 'Bu kriterlere uygun grup bulunamadı.'}
            </p>
          ) : (
            groupedByFacility.map(([facilityName, facilityGroups]) => {
              const serviceFacilityName = facilityGroups[0]?.serviceFacilityName
              const showComplex = serviceFacilityName && serviceFacilityName !== facilityName
              return (
              <div key={facilityName} className="space-y-3">
                <div className="flex items-center gap-3 pt-1">
                  <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-primary-soft">
                    <MapPinIcon className="h-5 w-5 text-[hsl(var(--primary))]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="truncate text-[17px] font-bold leading-tight text-[hsl(var(--foreground-strong))]">{facilityName}</p>
                      {facilityGroups[0]?.hasParking && (
                        <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-600">
                          <CarIcon className="h-3 w-3" />
                          Otopark{facilityGroups[0]?.parkingCapacity ? ` · ${facilityGroups[0].parkingCapacity}` : ''}
                        </span>
                      )}
                    </div>
                    {showComplex && (
                      <p className="truncate text-[12px] text-[hsl(var(--foreground-subtle))]">{serviceFacilityName}</p>
                    )}
                  </div>
                </div>
                {facilityGroups.map((g) => {
                  const isFull = g.capacity > 0 && g.registeredCount >= g.capacity
                  const visual = visualForBranch(g.branchName)
                  const audience = facilityAudienceIcon(g)
                  return (
                    <div key={g.id} onClick={() => navigate(`/hizmetler?m=sports&g=${g.id}`)} className="cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                      <div className="flex items-stretch">
                        <div className="flex-shrink-0 p-3">
                          <div className="grid h-[76px] w-[76px] place-items-center rounded-2xl text-violet-700" style={{ background: visual.thumbBg }}><Icon2D kind={visual.icon} className="h-9 w-9" /></div>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-center py-3 pr-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[17px] font-bold leading-tight text-[hsl(var(--foreground-strong))]">{g.branchName}</p>
                            <span className="flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-sm" style={{ background: isFull ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' : 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)' }}>
                              {isFull ? 'Kontenjan Dolu' : 'Kayıt Açık'}
                            </span>
                          </div>
                          <span
                            className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold"
                            style={{ background: `${audience.color}15`, color: audience.color }}
                          >
                            <audience.Icon className="h-4 w-4" />
                            {ageGroupLabel(g)}
                          </span>
                          <div className="mt-2 space-y-1">
                            <p className="flex items-center gap-1.5 text-[12px] text-[hsl(var(--foreground-subtle))]"><CalendarIcon className="h-3.5 w-3.5" /> {g.scheduleSummary}</p>
                          </div>
                        </div>
                      </div>
                      <div className="px-3 pb-3">
                        <CapacityRow data={g} />
                      </div>
                    </div>
                  )
                })}
              </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
