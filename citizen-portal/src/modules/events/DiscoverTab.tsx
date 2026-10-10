import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarDaysIcon, MapPinIcon, SearchIcon, Building2Icon, UsersIcon,
  LayoutGridIcon, ListIcon, CheckIcon, SlidersHorizontalIcon,
  ClockIcon, CalendarClockIcon, ChevronDownIcon, CalendarSearchIcon, XIcon,
  BabyIcon, UserRoundIcon, UsersRoundIcon, ImageOffIcon,
} from 'lucide-react'
import { SkeletonRows } from '@/design-system'
import { DistanceBadge } from '@/components/specialized/DistanceBadge'
import type { CitizenEvent } from '@/types/event.types'
import { pickEventImage } from '@/types/event.types'
import type { CitizenChild } from '@/types/family.types'
import eventService from '@/services/event.service'
import familyService from '@/services/family.service'
import { CapacityRow } from '@/framework/ui/CapacityRow'
import { localDayIso } from '@/lib/utils'
import { EventDetailModal } from './EventDetailModal'

type ViewMode = 'grid' | 'list'
type SortMode = 'date' | 'capacity' | 'name'

function getSeatInfo(registered: number, capacity: number, reserveCapacity: number, waitlistCount: number) {
  const free = Math.max(0, capacity - registered)
  const waitRoom = Math.max(0, reserveCapacity - waitlistCount)
  const pct = capacity > 0 ? Math.min(100, Math.round((registered / capacity) * 100)) : 100
  if (free > 0)
    return { pct, color: free <= 5 ? '#F59E0B' : '#10B981', label: free <= 5 ? `Son ${free} yer` : `${free} boş yer` }
  if (waitRoom > 0)
    return { pct: 100, color: '#F59E0B', label: `Yedek: ${waitRoom}` }
  return { pct: 100, color: '#EF4444', label: 'Dolu' }
}

function audienceIcon(ev: Pick<CitizenEvent, 'gender' | 'maxAge' | 'minAge'>) {
  const isChildOnly = ev.maxAge > 0 && ev.maxAge < 12
  const isFemale = ev.gender === 'female'
  const isMale = ev.gender === 'male'
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

function childMatchesEvent(child: CitizenChild, ev: Pick<CitizenEvent, 'gender' | 'minAge' | 'maxAge'>): boolean {
  if (ev.gender === 'male' || ev.gender === 'female') {
    const childGender = child.gender === 'Male' ? 'male' : 'female'
    if (ev.gender !== childGender) return false
  }
  if (ev.minAge > 0 && child.age < ev.minAge) return false
  if (ev.maxAge > 0 && child.age > ev.maxAge) return false
  return true
}

function groupByMonth(events: CitizenEvent[]): Array<{ label: string; items: CitizenEvent[] }> {
  const labelMap: Record<string, string> = {}
  const map = new Map<string, CitizenEvent[]>()
  for (const ev of events) {
    const d = new Date(ev.startDate)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(ev)
    labelMap[key] = label
  }
  return [...map.entries()].map(([key, items]) => ({ label: labelMap[key] ?? key, items }))
}

function groupByDay(events: CitizenEvent[]): Array<{ key: string; date: Date; items: CitizenEvent[] }> {
  const map = new Map<string, CitizenEvent[]>()
  for (const ev of events) {
    const d = new Date(ev.startDate)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(ev)
  }
  return [...map.entries()].map(([key, items]) => ({ key, date: new Date(items[0].startDate), items }))
}

const isToday = (d: Date) => {
  const n = new Date()
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
}

export const DiscoverTab = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [events, setEvents] = useState<CitizenEvent[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  const openEvent = (ev: CitizenEvent) => {
    setSelectedId(ev.id)
    setSelectedSessionId(ev.sessionId ?? null)
  }

  // Kullanıcı isteği (2026-08-02): Etkinlik Takvimi public API'sini kullanan dış siteler
  // (sultangazi.bel.tr vb.) "Başvur" tıklandığında vatandaşı doğrudan ilgili etkinliğin
  // detayına yönlendirebilmeli — genel listeye değil. /etkinlikler?eventId=<id> URL'i
  // açıldığında ilgili etkinlik detay modalı otomatik açılır.
  useEffect(() => {
    const deepLinkId = searchParams.get('eventId')
    if (deepLinkId) {
      setSelectedId(deepLinkId)
      setSelectedSessionId(searchParams.get('sessionId'))
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('eventId')
        next.delete('sessionId')
        return next
      }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showOnlyOpen, setShowOnlyOpen] = useState(false)
  const [onlyEligibleForSelf, setOnlyEligibleForSelf] = useState(true)
  const [children, setChildren] = useState<CitizenChild[]>([])
  const [selectedChildIds, setSelectedChildIds] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortMode, setSortMode] = useState<SortMode>('date')
  const [groupByDate, setGroupByDate] = useState(true)
  const [facilityFilter, setFacilityFilter] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [facilitySheetOpen, setFacilitySheetOpen] = useState(false)
  const [facilitySearch, setFacilitySearch] = useState('')
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const toggleChild = (id: string) => {
    setSelectedChildIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    let active = true
    familyService.getChildren()
      .then((list) => { if (active) setChildren(list) })
      .catch(() => { if (active) setChildren([]) })
    return () => { active = false }
  }, [])

  const [categorySeed, setCategorySeed] = useState<CitizenEvent[] | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadFailed(false)
    const handle = setTimeout(() => {
      eventService.discover({ page: 1, limit: 50, search: search.trim() || undefined })
        .then((r) => {
          if (!active) return
          setEvents(r.items)
          if (!search.trim()) setCategorySeed(r.items)
        })
        .catch(() => { if (active) { setEvents([]); setLoadFailed(true) } })
        .finally(() => { if (active) setLoading(false) })
    }, search ? 300 : 0)
    return () => { active = false; clearTimeout(handle) }
  }, [refresh, search])

  const categories = useMemo(() => {
    const source = categorySeed ?? events
    if (!source) return []
    const seen = new Set<string>()
    const cats: Array<{ name: string; color: string }> = []
    for (const ev of source) {
      if (!seen.has(ev.categoryName)) {
        seen.add(ev.categoryName)
        cats.push({ name: ev.categoryName, color: ev.categoryColor })
      }
    }
    return cats
  }, [categorySeed, events])

  const facilities = useMemo(() => {
    const source = categorySeed ?? events
    if (!source) return [] as string[]
    const set = new Set<string>()
    for (const ev of source) {
      const f = ev.facilityName || (ev.venueName && ev.venueName !== '—' ? ev.venueName : null)
      if (f) set.add(f)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }, [categorySeed, events])

  const filtered = useMemo(() => {
    if (!events) return []
    let list = events.filter(ev => {
      if (activeCategory && ev.categoryName !== activeCategory) return false
      if (facilityFilter) {
        const f = ev.facilityName || (ev.venueName && ev.venueName !== '—' ? ev.venueName : null)
        if (f !== facilityFilter) return false
      }
      if (showOnlyOpen && ev.registeredCount >= ev.capacity) return false
      if (dateFrom && localDayIso(ev.startDate) < dateFrom) return false
      if (dateTo && localDayIso(ev.startDate) > dateTo) return false
      const selectedChildren = children.filter((c) => selectedChildIds.has(c.id))
      if (onlyEligibleForSelf || selectedChildren.length > 0) {
        const passesSelf = onlyEligibleForSelf && ev.eligibleForSelf
        const passesChildren = selectedChildren.some((c) => childMatchesEvent(c, ev))
        if (!(passesSelf || passesChildren || ev.alreadyApplied)) return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      if (sortMode === 'date') return a.startDate.localeCompare(b.startDate)
      if (sortMode === 'capacity') return (a.capacity - a.registeredCount) - (b.capacity - b.registeredCount)
      return a.name.localeCompare(b.name)
    })
    return list
  }, [events, activeCategory, facilityFilter, showOnlyOpen, onlyEligibleForSelf, children, selectedChildIds, sortMode, dateFrom, dateTo])

  const groups = useMemo(
    () => groupByDate ? groupByMonth(filtered) : [{ label: '', items: filtered }],
    [filtered, groupByDate],
  )

  const SORT_LABELS: Record<SortMode, string> = { date: 'Tarihe göre', capacity: 'Boş yere göre', name: 'Ada göre' }
  const activeFilterCount = (showOnlyOpen ? 1 : 0) + (facilityFilter ? 1 : 0) + (sortMode !== 'date' ? 1 : 0) + (!groupByDate ? 1 : 0) + (activeCategory ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0)

  const renderListCard = (ev: CitizenEvent) => {
    const isFull = ev.capacity > 0 && ev.registeredCount >= ev.capacity
    const waitRoom = Math.max(0, ev.reserveCapacity - ev.waitlistCount)
    const isWaitlist = isFull && waitRoom > 0
    const isClosed = isFull && waitRoom <= 0
    const d = new Date(ev.startDate)
    const dateLabel = d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
    const hasAgeRange = ev.minAge > 0 && ev.maxAge > 0
    const ageLabel = hasAgeRange ? `${ev.minAge}–${ev.maxAge} yaş` : 'Tüm yaşlar'
    const genderLabel = ev.gender === 'female' ? 'Kadın' : ev.gender === 'male' ? 'Erkek' : 'Karma'
    const audience = audienceIcon(ev)
    const cc = ev.categoryColor
    const listImg = pickEventImage(ev.images, ['4:3', '16:9', '1:1', '9:16'], ev.imageUrl)

    const statusChip = ev.alreadyApplied
      ? { label: 'Başvuruldu', className: 'bg-emerald-50 border-emerald-100 text-emerald-700' }
      : ev.applicationOpen === false
        ? { label: 'Başvuru kapalı', className: 'bg-gray-50 border-gray-200 text-gray-500' }
        : isClosed
          ? { label: 'Kontenjan dolu', className: 'bg-red-50 border-red-100 text-red-600' }
          : isWaitlist
            ? { label: 'Yedek açık', className: 'bg-amber-50 border-amber-100 text-amber-700' }
            : { label: 'Kayıt açık', className: 'bg-emerald-50 border-emerald-100 text-emerald-700' }

    return (
      <button
        key={`${ev.id}-${ev.sessionId ?? 'single'}`}
        onClick={() => openEvent(ev)}
        className="w-full text-left rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden md:flex md:items-stretch"
      >
        {listImg ? (
          <div className="hidden md:block md:w-56 md:flex-shrink-0 md:self-stretch relative overflow-hidden">
            <img src={listImg} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ aspectRatio: '4 / 3' }} />
          </div>
        ) : (
          <div
            className="hidden md:flex md:w-56 md:flex-shrink-0 md:self-stretch items-center justify-center"
            style={{ aspectRatio: '4 / 3', background: `linear-gradient(160deg, ${cc}f0, ${cc}80)` }}
          >
            <ImageOffIcon className="h-8 w-8 text-white/70" />
          </div>
        )}

        <div className="flex items-stretch gap-3 p-3 md:flex-1 md:min-w-0">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${cc}15`, color: cc }}>
                {ev.categoryName}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusChip.className}`}>
                <CheckIcon className="h-3 w-3" /> {statusChip.label}
              </span>
            </div>

            <p className="text-[15px] font-bold leading-snug text-gray-900">{ev.name}</p>

            {(() => {
              const venue = ev.facilityName
                ? (ev.venueName && ev.venueName !== '—' && ev.venueName !== ev.facilityName ? `${ev.facilityName} · ${ev.venueName}` : ev.facilityName)
                : (ev.venueName && ev.venueName !== '—' ? ev.venueName : null)
              return venue ? (
                <p className="flex items-center gap-1 text-[12px] font-medium text-gray-500 min-w-0">
                  <Building2Icon className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  <span className="truncate">{venue}</span>
                  <DistanceBadge
                    distanceOnly
                    className="flex-shrink-0"
                    target={ev.latitude != null && ev.longitude != null ? { latitude: ev.latitude, longitude: ev.longitude } : null}
                  />
                </p>
              ) : null
            })()}

            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-[16px] font-semibold"
                style={{ background: `${audience.color}15`, color: audience.color }}
              >
                <audience.Icon className="h-5 w-5" />
                {genderLabel}
              </span>
              <span className="inline-flex items-center rounded-lg px-3 py-1 text-[16px] font-medium" style={{ background: `${cc}12`, color: cc }}>
                {ageLabel}
              </span>
              {(ev.sessionStartTime || ev.hasSessions) && (
                <span className="inline-flex items-center gap-1 text-[12px] text-gray-500 tabular-nums">
                  <ClockIcon className="h-3 w-3 text-gray-400" />
                  {ev.sessionStartTime ? `${ev.sessionStartTime}${ev.sessionEndTime ? `–${ev.sessionEndTime}` : ''}` : 'Oturumlu'}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] font-medium text-gray-500">
              <span className="flex items-center gap-1"><CalendarDaysIcon className="h-3.5 w-3.5 flex-shrink-0" />{dateLabel}</span>
            </div>

            <div className="pt-1">
              <CapacityRow data={ev} size="lg" />
            </div>
          </div>
        </div>
      </button>
    )
  }

  const renderGridCard = (ev: CitizenEvent) => {
    const { pct, color, label: seatLabel } = getSeatInfo(ev.registeredCount, ev.capacity, ev.reserveCapacity, ev.waitlistCount)
    const d = new Date(ev.startDate)
    const dayNum = d.toLocaleDateString('tr-TR', { day: '2-digit' })
    const monthShort = d.toLocaleDateString('tr-TR', { month: 'short' })
    const isFull = ev.registeredCount >= ev.capacity
    const gridImg = pickEventImage(ev.images, ['4:3', '16:9', '1:1', '9:16'], ev.imageUrl)
    const hasAgeRange = ev.minAge > 0 && ev.maxAge > 0
    const ageLabel = hasAgeRange ? `${ev.minAge}–${ev.maxAge} yaş` : 'Tüm yaşlar'
    const audience = audienceIcon(ev)

    return (
      <button
        key={`${ev.id}-${ev.sessionId ?? 'single'}`}
        onClick={() => openEvent(ev)}
        className="w-full text-left overflow-hidden rounded-lg flex flex-col hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 active:scale-[0.98] group"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.95)',
          boxShadow: '0 4px 20px rgba(99,102,241,0.08), 0 1px 4px rgba(0,0,0,0.05)',
        }}
      >
        {gridImg ? (
          <div className="relative w-full overflow-hidden flex-shrink-0" style={{ aspectRatio: '2.05 / 1' }}>
            <img
              src={gridImg}
              alt=""
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
            <div className="absolute bottom-2.5 left-3 text-white">
              <p className="text-2xl font-black leading-none drop-shadow">{dayNum}</p>
              <p className="text-[11px] font-bold uppercase text-white/90 tracking-wide drop-shadow">{monthShort}</p>
            </div>
            {ev.alreadyApplied && (
              <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shadow">
                <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
              </span>
            )}
          </div>
        ) : (
          <div
            className="relative w-full flex flex-col items-center justify-center gap-1 overflow-hidden flex-shrink-0"
            style={{ aspectRatio: '2.05 / 1', background: `linear-gradient(160deg, ${ev.categoryColor}f0, ${ev.categoryColor}80)` }}
          >
            <p className="relative text-3xl font-black text-white leading-none drop-shadow-sm">{dayNum}</p>
            <p className="relative text-[12px] font-bold uppercase text-white/90 tracking-wider">{monthShort}</p>
            {ev.alreadyApplied && (
              <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow">
                <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
              </span>
            )}
          </div>
        )}

        <div
          className="h-1.5 w-full flex-shrink-0"
          style={{ background: `linear-gradient(90deg, ${ev.categoryColor}, ${ev.categoryColor}80)` }}
        />

        <div className="flex flex-1 gap-0">
          <div className="flex min-w-0 flex-1 flex-col p-3.5">
            <div className="flex items-start justify-between gap-1.5 mb-1.5">
              <span
                className="rounded-lg px-1.5 py-0.5 text-[10px] font-bold flex-shrink-0"
                style={{ background: `${ev.categoryColor}18`, color: ev.categoryColor }}
              >
                {ev.categoryName}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-bold flex-shrink-0"
                style={{ background: `${audience.color}15`, color: audience.color }}
              >
                <audience.Icon className="h-3.5 w-3.5" />
                {ageLabel}
              </span>
            </div>

            <p className="text-[15px] font-bold text-gray-900 leading-snug line-clamp-2 flex-1">{ev.name}</p>

            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1 text-[12px] text-gray-500">
                <MapPinIcon className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                <span className="truncate">
                  {ev.facilityName
                    ? (ev.venueName && ev.venueName !== '—' && ev.venueName !== ev.facilityName ? `${ev.facilityName} · ${ev.venueName}` : ev.facilityName)
                    : ev.venueName}
                </span>
                <DistanceBadge
                  distanceOnly
                  className="flex-shrink-0"
                  target={ev.latitude != null && ev.longitude != null ? { latitude: ev.latitude, longitude: ev.longitude } : null}
                />
              </div>
              {ev.sessionStartTime ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-violet-500">
                  <ClockIcon className="h-3.5 w-3.5" /> {ev.sessionStartTime}{ev.sessionEndTime ? `–${ev.sessionEndTime}` : ''}
                </span>
              ) : ev.hasSessions && (
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-violet-500">
                  <ClockIcon className="h-3.5 w-3.5" /> Oturumlu
                </span>
              )}
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-bold" style={{ color }}>{seatLabel}</span>
                <span className="text-[12px] text-gray-500 font-semibold tabular-nums">{ev.registeredCount.toLocaleString('tr-TR')}/{ev.capacity.toLocaleString('tr-TR')}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'rgba(0,0,0,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: isFull
                      ? '#EF4444'
                      : `linear-gradient(90deg, ${color}cc, ${color})`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ background: 'linear-gradient(160deg, #f0f0ff 0%, #f5f3ff 30%, #faf5ff 60%, #f0f9ff 100%)' }}
    >
      <div
        className="sticky top-0 z-10 px-4 pt-4 pb-3 space-y-3"
        style={{
          background: 'rgba(248,248,255,0.88)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(99,102,241,0.1)',
        }}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-300" />
            <input
              type="text"
              placeholder="Etkinlik veya mekan ara…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg pl-10 pr-9 py-2.5 text-sm text-gray-700 placeholder:text-gray-300 outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.8)',
                border: '1.5px solid rgba(99,102,241,0.15)',
                boxShadow: '0 2px 8px rgba(99,102,241,0.06)',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.15)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.06)'
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <XIcon className="h-3 w-3 text-gray-400" />
              </button>
            )}
          </div>

          <div
            className="flex rounded-lg overflow-hidden flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.8)', border: '1.5px solid rgba(99,102,241,0.15)' }}
          >
            <button
              onClick={() => setViewMode('grid')}
              className="flex items-center justify-center w-10 h-10 transition-all"
              style={viewMode === 'grid'
                ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff' }
                : { color: '#a5b4fc' }
              }
            >
              <LayoutGridIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="flex items-center justify-center w-10 h-10 transition-all"
              style={viewMode === 'list'
                ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff' }
                : { color: '#a5b4fc' }
              }
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <button
            onClick={() => setFilterSheetOpen(true)}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200"
            style={activeFilterCount > 0
              ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }
              : { background: 'rgba(255,255,255,0.8)', color: '#6366F1', border: '1.5px solid rgba(99,102,241,0.2)' }}
          >
            <SlidersHorizontalIcon className="h-3.5 w-3.5" />
            Filtrele
            {activeFilterCount > 0 && (
              <span className="ml-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-white/25 px-1 text-[10px] font-bold">{activeFilterCount}</span>
            )}
          </button>

          <button
            type="button"
            aria-pressed={onlyEligibleForSelf}
            onClick={() => setOnlyEligibleForSelf(v => !v)}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200"
            style={onlyEligibleForSelf
              ? { background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1.5px solid rgba(16,185,129,0.35)' }
              : { background: 'rgba(255,255,255,0.8)', color: '#6B7280', border: '1.5px solid rgba(99,102,241,0.15)' }}
          >
            {onlyEligibleForSelf && <CheckIcon className="h-3.5 w-3.5" />}
            Bana uygun
          </button>

          {children.map((child) => {
            const isSelected = selectedChildIds.has(child.id)
            const firstName = child.fullName.trim().split(/\s+/)[0] ?? child.fullName
            return (
              <button
                key={child.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleChild(child.id)}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200"
                style={isSelected
                  ? { background: 'rgba(219,39,119,0.1)', color: '#DB2777', border: '1.5px solid rgba(219,39,119,0.3)' }
                  : { background: 'rgba(255,255,255,0.8)', color: '#6B7280', border: '1.5px solid rgba(99,102,241,0.15)' }}
              >
                {isSelected && <CheckIcon className="h-3.5 w-3.5" />}
                {firstName}'e uygun · {child.age} yaş
              </button>
            )
          })}

          {activeCategory && (
            <button
              onClick={() => setActiveCategory(null)}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200"
              style={{ background: (categories.find(c => c.name === activeCategory)?.color ?? '#6366F1'), color: '#fff' }}
            >
              {activeCategory}
              <XIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className={`p-4 space-y-6 pb-8 transition-opacity duration-150 ${loading && events !== null ? 'opacity-60' : 'opacity-100'}`}>
        {events === null ? (
          <SkeletonRows rows={5} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-lg"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.12)' }}
            >
              <CalendarSearchIcon className="h-9 w-9 text-indigo-300" />
            </div>
            <div>
              <p className="font-bold text-gray-700">{loadFailed ? 'Etkinlikler yüklenemedi' : 'Etkinlik bulunamadı'}</p>
              <p className="mt-1 text-sm text-gray-400">
                {loadFailed
                  ? 'Bağlantınızı kontrol edip tekrar deneyin.'
                  : (onlyEligibleForSelf || selectedChildIds.size > 0)
                  ? 'Yaş/cinsiyet olarak size veya seçili çocuklarınıza uygun aktif etkinlik yok. Filtreyi kaldırarak tümünü görebilirsiniz.'
                  : 'Filtre veya arama kriterlerini değiştirin.'}
              </p>
            </div>
            {(search || activeCategory || showOnlyOpen || facilityFilter || onlyEligibleForSelf || selectedChildIds.size > 0 || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setActiveCategory(null); setShowOnlyOpen(false); setFacilityFilter(null); setOnlyEligibleForSelf(false); setSelectedChildIds(new Set()); setDateFrom(''); setDateTo('') }}
                className="rounded-full px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                Filtreleri Temizle
              </button>
            )}
          </div>
        ) : (
          groups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)' }}
                  >
                    <CalendarDaysIcon className="h-3.5 w-3.5 text-indigo-600" />
                    <h3 className="text-sm font-bold text-indigo-700 capitalize">{group.label}</h3>
                  </div>
                  <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.2), transparent)' }} />
                  <span
                    className="text-[11px] font-semibold rounded-full px-2.5 py-0.5"
                    style={{ background: 'rgba(99,102,241,0.08)', color: '#818CF8' }}
                  >
                    {group.items.length} etkinlik
                  </span>
                </div>
              )}

              {group.label ? (
                groupByDay(group.items).map(day => (
                  <div key={day.key} className="mb-5 last:mb-0">
                    <div className="flex items-center gap-2 mb-2.5 px-0.5">
                      <span
                        className="flex-shrink-0 inline-flex items-center justify-center rounded-lg text-[12px] font-black tabular-nums w-6 h-6 text-white"
                        style={{ background: isToday(day.date) ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                      >
                        {day.date.toLocaleDateString('tr-TR', { day: '2-digit' })}
                      </span>
                      <span className="text-[12px] font-bold capitalize" style={{ color: isToday(day.date) ? '#059669' : '#4338CA' }}>
                        {isToday(day.date) ? 'Bugün' : day.date.toLocaleDateString('tr-TR', { weekday: 'long' })}
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium capitalize">· {day.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</span>
                      <div className="flex-1 h-px ml-1" style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.16), transparent)' }} />
                    </div>
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {day.items.map(ev => renderGridCard(ev))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {day.items.map(ev => renderListCard(ev))}
                      </div>
                    )}
                  </div>
                ))
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {group.items.map(ev => renderGridCard(ev))}
                </div>
              ) : (
                <div className="space-y-2">
                  {group.items.map(ev => renderListCard(ev))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {filterSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setFilterSheetOpen(false)}>
          <div className="max-h-[85vh] rounded-t-lg bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
              <p className="text-base font-bold text-gray-900">Filtrele ve sırala</p>
              <button type="button" onClick={() => setFilterSheetOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 hover:bg-gray-200">
                <XIcon className="h-4 w-4 text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {categories.length > 0 && (
                <div>
                  <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-gray-500">Kategori</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveCategory(null)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200"
                      style={activeCategory === null
                        ? { background: 'linear-gradient(135deg, #1e3a5f, #0c2942)', color: '#fff' }
                        : { background: '#F9FAFB', color: '#6B7280', border: '1.5px solid #E5E7EB' }
                      }
                    >
                      Tümü
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200"
                        style={activeCategory === cat.name
                          ? { background: cat.color, color: '#fff', boxShadow: `0 4px 12px ${cat.color}50` }
                          : { background: '#F9FAFB', color: '#6B7280', border: '1.5px solid #E5E7EB' }
                        }
                      >
                        {activeCategory === cat.name && <CheckIcon className="h-3 w-3" />}
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-gray-500">Tarih Aralığı</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-gray-400">Başlangıç</span>
                    <input
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-indigo-300 focus:bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-gray-400">Bitiş</span>
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-indigo-300 focus:bg-white"
                    />
                  </label>
                </div>
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => { setDateFrom(''); setDateTo('') }}
                    className="mt-1.5 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Tarih filtresini temizle
                  </button>
                )}
              </div>

              <div>
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-gray-500">Sıralama</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {(Object.entries(SORT_LABELS) as [SortMode, string][]).map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSortMode(k)}
                      className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm transition-colors ${sortMode === k ? 'bg-indigo-50 font-semibold text-indigo-700' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                    >
                      <span className="flex items-center gap-2"><ClockIcon className="h-4 w-4" />{l}</span>
                      {sortMode === k && <CheckIcon className="h-4 w-4 text-indigo-600" />}
                    </button>
                  ))}
                </div>
              </div>

              {facilities.length > 0 && (
                <div>
                  <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-gray-500">Tesis</p>
                  <button
                    type="button"
                    onClick={() => { setFacilitySearch(''); setFacilitySheetOpen(true) }}
                    className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Building2Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{facilityFilter ?? 'Tüm tesisler'}</span>
                    </span>
                    <ChevronDownIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  </button>
                </div>
              )}

              <div>
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-gray-500">Seçenekler</p>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setShowOnlyOpen(v => !v)}
                    className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <span className="flex items-center gap-2"><UsersIcon className="h-4 w-4" />Sadece boş yer olanlar</span>
                    <span className="h-5 w-9 rounded-full transition-colors" style={{ background: showOnlyOpen ? '#6366F1' : '#E5E7EB' }}>
                      <span className="block h-4 w-4 rounded-full bg-white transition-transform mt-0.5" style={{ transform: showOnlyOpen ? 'translateX(18px)' : 'translateX(2px)' }} />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupByDate(v => !v)}
                    className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <span className="flex items-center gap-2"><CalendarClockIcon className="h-4 w-4" />Aya göre grupla</span>
                    <span className="h-5 w-9 rounded-full transition-colors" style={{ background: groupByDate ? '#6366F1' : '#E5E7EB' }}>
                      <span className="block h-4 w-4 rounded-full bg-white transition-transform mt-0.5" style={{ transform: groupByDate ? 'translateX(18px)' : 'translateX(2px)' }} />
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-gray-100 px-5 py-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              <button
                type="button"
                onClick={() => { setSortMode('date'); setFacilityFilter(null); setShowOnlyOpen(false); setGroupByDate(true); setActiveCategory(null); setDateFrom(''); setDateTo('') }}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Sıfırla
              </button>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="flex-1 rounded-lg py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
              >
                {filtered.length} etkinliği göster
              </button>
            </div>
          </div>
        </div>
      )}

      {facilitySheetOpen && (
        <div className="fixed inset-0 z-[55] flex flex-col justify-end bg-black/40" onClick={() => setFacilitySheetOpen(false)}>
          <div className="max-h-[75vh] rounded-t-lg bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
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
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-300 focus:bg-white"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-6">
              <button
                type="button"
                onClick={() => { setFacilityFilter(null); setFacilitySheetOpen(false) }}
                className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm transition-colors ${facilityFilter === null ? 'bg-indigo-50 font-semibold text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Tüm tesisler
                {facilityFilter === null && <CheckIcon className="h-4 w-4 text-indigo-600" />}
              </button>
              {facilities
                .filter((f) => f.toLocaleLowerCase('tr').includes(facilitySearch.toLocaleLowerCase('tr')))
                .map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { setFacilityFilter(f); setFacilitySheetOpen(false) }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-4 py-3 text-left text-sm transition-colors ${facilityFilter === f ? 'bg-indigo-50 font-semibold text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
                  >
                    <span className="min-w-0 flex-1">{f}</span>
                    {facilityFilter === f && <CheckIcon className="h-4 w-4 flex-shrink-0 text-indigo-600" />}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      <EventDetailModal
        eventId={selectedId}
        initialSessionId={selectedSessionId}
        onClose={() => { setSelectedId(null); setSelectedSessionId(null) }}
        onApplied={() => { setSelectedId(null); setSelectedSessionId(null); setRefresh((n) => n + 1) }}
      />
    </div>
  )
}
