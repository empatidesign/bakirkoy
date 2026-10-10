import { useEffect, useMemo, useState } from 'react'
import { Icon2D } from '@/components/Icon2D'
import {
  BusIcon, MapPinIcon, CalendarDaysIcon, UserIcon,
  ClockIcon, SearchIcon, XIcon, CheckIcon, SlidersHorizontalIcon,
} from 'lucide-react'
import { SkeletonRows } from '@/design-system'
import { formatDate } from '@/lib/utils'
import { DistanceBadge } from '@/components/specialized/DistanceBadge'
import type { CitizenTravel, CitizenTravelApplication } from '@/types/travel.types'
import travelService from '@/services/travel.service'
import familyService from '@/services/family.service'
import type { CitizenChild } from '@/types/family.types'
import { CapacityRow } from '@/framework/ui/CapacityRow'
import { TravelDetailModal } from './TravelDetailModal'

const ACTIVE_STATUSES = new Set(['pending', 'reviewing', 'approved', 'waitlist'])
type SortMode = 'date' | 'capacity' | 'name'
const SORT_LABELS: Record<SortMode, string> = { date: 'Tarihe göre', capacity: 'Boş kontenjana göre', name: 'Ada göre' }

function childMatchesTravel(child: CitizenChild, t: Pick<CitizenTravel, 'gender' | 'minAge' | 'maxAge'>): boolean {
  if (t.gender === 'male' || t.gender === 'female') {
    const childGender = child.gender === 'Male' ? 'male' : 'female'
    if (t.gender !== childGender) return false
  }
  if (t.minAge > 0 && child.age < t.minAge) return false
  if (t.maxAge > 0 && child.age > t.maxAge) return false
  return true
}

export const TravelDiscoverTab = () => {
  const [travels, setTravels] = useState<CitizenTravel[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [activeApplications, setActiveApplications] = useState<CitizenTravelApplication[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showOnlyOpen, setShowOnlyOpen] = useState(false)
  const [locationFilter, setLocationFilter] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('date')
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [onlyEligibleForSelf, setOnlyEligibleForSelf] = useState(true)
  const [children, setChildren] = useState<CitizenChild[]>([])
  const [selectedChildIds, setSelectedChildIds] = useState<Set<string>>(new Set())

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

  const [categorySeed, setCategorySeed] = useState<CitizenTravel[] | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadFailed(false)
    const handle = setTimeout(() => {
      Promise.all([
        travelService.discover({ page: 1, limit: 50, search: search.trim() || undefined }),
        travelService.applications({ scope: 'family', page: 1, limit: 100 }),
      ])
        .then(([disc, appsResult]) => {
          if (!active) return
          setTravels(disc.items)
          if (!search.trim()) setCategorySeed(disc.items)
          setActiveApplications(appsResult.items.filter(a => ACTIVE_STATUSES.has(a.status)))
        })
        .catch(() => { if (active) { setTravels([]); setLoadFailed(true) } })
        .finally(() => { if (active) setLoading(false) })
    }, search ? 300 : 0)
    return () => { active = false; clearTimeout(handle) }
  }, [refresh, search])

  const categories = useMemo(() => {
    const source = categorySeed ?? travels
    if (!source) return []
    const seen = new Set<string>()
    const cats: { name: string; color: string }[] = []
    for (const t of source) {
      if (!seen.has(t.categoryName)) { seen.add(t.categoryName); cats.push({ name: t.categoryName, color: t.categoryColor }) }
    }
    return cats
  }, [categorySeed, travels])

  const locations = useMemo(() => {
    const source = categorySeed ?? travels
    if (!source) return [] as string[]
    const set = new Set<string>()
    for (const t of source) if (t.destination) set.add(t.destination)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }, [categorySeed, travels])

  const filtered = useMemo(() => {
    if (!travels) return []
    let list = travels.filter(t => {
      if (activeCategory && t.categoryName !== activeCategory) return false
      if (showOnlyOpen && !t.applicationOpen) return false
      if (locationFilter && t.destination !== locationFilter) return false
      if (dateFrom && t.departureDate.slice(0, 10) < dateFrom) return false
      if (dateTo && t.departureDate.slice(0, 10) > dateTo) return false
      const selectedChildren = children.filter((c) => selectedChildIds.has(c.id))
      if (onlyEligibleForSelf || selectedChildren.length > 0) {
        const passesSelf = onlyEligibleForSelf && t.eligible
        const passesChildren = selectedChildren.some((c) => childMatchesTravel(c, t))
        if (!(passesSelf || passesChildren || t.alreadyApplied)) return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      if (sortMode === 'date') return a.departureDate.localeCompare(b.departureDate)
      if (sortMode === 'capacity') return (a.capacity - a.registeredCount) - (b.capacity - b.registeredCount)
      return a.name.localeCompare(b.name, 'tr')
    })
    return list
  }, [travels, activeCategory, showOnlyOpen, locationFilter, dateFrom, dateTo, sortMode, onlyEligibleForSelf, children, selectedChildIds])

  const activeFilterCount = (activeCategory ? 1 : 0) + (showOnlyOpen ? 1 : 0) + (locationFilter ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0) + (sortMode !== 'date' ? 1 : 0) + (onlyEligibleForSelf ? 1 : 0)

  const clearAllFilters = () => {
    setActiveCategory(null); setShowOnlyOpen(false); setLocationFilter(null)
    setDateFrom(''); setDateTo(''); setSortMode('date')
    setOnlyEligibleForSelf(false); setSelectedChildIds(new Set())
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      <div className="sticky top-0 z-10 bg-white" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Gezi veya destinasyon ara…"
              className="h-9 w-full rounded-lg border-0 bg-gray-100 pl-8 pr-8 text-[13px] outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-slate-500/20"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setFilterSheetOpen(true)}
            className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-all"
            style={activeFilterCount > 0
              ? { background: '#334155', color: '#fff' }
              : { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }
            }
          >
            <SlidersHorizontalIcon className="h-3 w-3" />
            Filtrele
            {activeFilterCount > 0 && (
              <span className="ml-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-white/25 px-1 text-[10px] font-bold">{activeFilterCount}</span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4 pb-3">
            <button
              type="button"
              aria-pressed={onlyEligibleForSelf}
              onClick={() => setOnlyEligibleForSelf((v) => !v)}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200"
              style={onlyEligibleForSelf
                ? { background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1.5px solid rgba(16,185,129,0.35)' }
                : { background: '#f3f4f6', color: '#6B7280', border: '1.5px solid #e5e7eb' }}
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
                    : { background: '#f3f4f6', color: '#6B7280', border: '1.5px solid #e5e7eb' }}
                >
                  {isSelected && <CheckIcon className="h-3.5 w-3.5" />}
                  {firstName}'e uygun · {child.age} yaş
                </button>
              )
            })}
        </div>
      </div>

      <div className="p-4 pb-8 space-y-3">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-24 text-center">
            <BusIcon className="h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-400">
              {loadFailed
                ? 'Geziler yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.'
                : (onlyEligibleForSelf || selectedChildIds.size > 0)
                ? 'Yaş/cinsiyet olarak size veya seçili çocuklarınıza uygun aktif gezi yok. Filtreyi kaldırarak tümünü görebilirsiniz.'
                : 'Gezi bulunamadı'}
            </p>
            {(activeFilterCount > 0 || onlyEligibleForSelf || selectedChildIds.size > 0) && (
              <button type="button" onClick={clearAllFilters} className="mt-1 text-[13px] font-semibold text-slate-600 hover:underline">
                Filtreleri temizle
              </button>
            )}
          </div>
        ) : (
          filtered.map((t) => {
            return (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className="w-full text-left bg-white rounded-lg overflow-hidden transition-all hover:shadow-md active:scale-[0.99]"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' }}
              >
                {t.imageUrl ? (
                  <div className="relative h-36 w-full overflow-hidden">
                    <img src={t.imageUrl} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                      {!t.applicationOpen && (
                        <span className="flex items-center gap-1 bg-black/50 rounded-md px-2 py-1 text-[10px] font-bold text-white">
                          <ClockIcon className="h-3 w-3" /> Kapalı
                        </span>
                      )}
                      {t.alreadyApplied && (
                        <span className="flex items-center gap-1 bg-emerald-500 rounded-md px-2 py-1 text-[10px] font-bold text-white">
                          <CheckIcon className="h-3 w-3" /> Başvuruldu
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-8">
                      <span className="text-[10px] font-bold text-white/70 uppercase tracking-wide">{t.categoryName}</span>
                      <p className="text-[16px] font-bold text-white leading-snug mt-0.5">{t.name}</p>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 pt-3 pb-2.5 flex items-center justify-between gap-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100">
                        <BusIcon className="h-5 w-5 text-gray-500" />
                      </div>
                      <div>
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${t.categoryColor}15`, color: t.categoryColor }}>
                          {t.categoryName}
                        </span>
                        <p className="text-[14px] font-bold text-gray-900 leading-snug mt-0.5">{t.name}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {!t.applicationOpen && (
                        <span className="text-[10px] font-semibold rounded-md px-2 py-0.5 bg-gray-100 text-gray-500">Kapalı</span>
                      )}
                      {t.alreadyApplied && (
                        <span className="text-[10px] font-semibold rounded-md px-2 py-0.5 bg-emerald-50 text-emerald-600 inline-flex items-center gap-1"><Icon2D kind="check" className="h-3 w-3" />Başvuruldu</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="px-4 py-3">
                  {t.imageUrl && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[11px] font-semibold rounded-md px-2 py-0.5"
                        style={{ background: `${t.categoryColor}18`, color: t.categoryColor }}>
                        {t.categoryName}
                      </span>
                      {!t.applicationOpen && !t.alreadyApplied && (
                        <span className="text-[11px] font-semibold rounded-md px-2 py-0.5 bg-amber-50 text-amber-600 flex items-center gap-1">
                          <ClockIcon className="h-3 w-3" /> Başvurular Kapalı
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <span className="flex items-center gap-1.5 text-[12px] text-gray-600">
                      <MapPinIcon className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                      <span className="font-semibold">{t.destination}</span>
                    </span>
                    <DistanceBadge
                      distanceOnly
                      className="text-[12px]"
                      target={t.latitude != null && t.longitude != null ? { latitude: t.latitude, longitude: t.longitude } : null}
                    />
                    <span className="flex items-center gap-1.5 text-[12px] text-gray-600">
                      <CalendarDaysIcon className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      {formatDate(t.departureDate)}
                      {!t.isSingleDay && <span className="text-gray-400">– {formatDate(t.returnDate)}</span>}
                    </span>
                    {t.guideName && (
                      <span className="flex items-center gap-1.5 text-[12px] text-gray-600">
                        <UserIcon className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                        {t.guideName}
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    <CapacityRow data={t} />
                  </div>

                  {t.descriptionPreview && (
                    <p className="mt-2.5 text-[12px] text-gray-500 line-clamp-2 leading-relaxed">{t.descriptionPreview}</p>
                  )}
                </div>
              </button>
            )
          })
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
              <div>
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-gray-500">Tarih Aralığı</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-gray-400">Gidiş (başlangıç)</span>
                    <input
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-slate-400 focus:bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-gray-400">Gidiş (bitiş)</span>
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-slate-400 focus:bg-white"
                    />
                  </label>
                </div>
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => { setDateFrom(''); setDateTo('') }}
                    className="mt-1.5 text-[12px] font-semibold text-slate-600 hover:text-slate-700"
                  >
                    Tarih filtresini temizle
                  </button>
                )}
              </div>

              {locations.length > 0 && (
                <div>
                  <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-gray-500">Lokasyon / Destinasyon</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLocationFilter(null)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200"
                      style={locationFilter === null
                        ? { background: '#334155', color: '#fff' }
                        : { background: '#F9FAFB', color: '#6B7280', border: '1.5px solid #E5E7EB' }
                      }
                    >
                      Tüm lokasyonlar
                    </button>
                    {locations.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setLocationFilter(locationFilter === loc ? null : loc)}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200"
                        style={locationFilter === loc
                          ? { background: '#334155', color: '#fff' }
                          : { background: '#F9FAFB', color: '#6B7280', border: '1.5px solid #E5E7EB' }
                        }
                      >
                        {locationFilter === loc && <CheckIcon className="h-3 w-3" />}
                        <MapPinIcon className="h-3 w-3" />
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {categories.length > 0 && (
                <div>
                  <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-gray-500">Kategori</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveCategory(null)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200"
                      style={activeCategory === null
                        ? { background: '#111827', color: '#fff' }
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
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-gray-500">Sıralama</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {(Object.entries(SORT_LABELS) as [SortMode, string][]).map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSortMode(k)}
                      className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm transition-colors ${sortMode === k ? 'bg-slate-100 font-semibold text-slate-700' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                    >
                      <span className="flex items-center gap-2"><ClockIcon className="h-4 w-4" />{l}</span>
                      {sortMode === k && <CheckIcon className="h-4 w-4 text-slate-600" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-gray-500">Seçenekler</p>
                <button
                  type="button"
                  onClick={() => setShowOnlyOpen(v => !v)}
                  className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <span className="flex items-center gap-2"><CheckIcon className="h-4 w-4" />Sadece başvurusu açık olanlar</span>
                  <span className="h-5 w-9 rounded-full transition-colors" style={{ background: showOnlyOpen ? '#334155' : '#E5E7EB' }}>
                    <span className="block h-4 w-4 rounded-full bg-white transition-transform mt-0.5" style={{ transform: showOnlyOpen ? 'translateX(18px)' : 'translateX(2px)' }} />
                  </span>
                </button>
              </div>
            </div>

            <div className="flex gap-2 border-t border-gray-100 px-5 py-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Sıfırla
              </button>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="flex-1 rounded-lg py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: '#334155' }}
              >
                {filtered.length} gezi göster
              </button>
            </div>
          </div>
        </div>
      )}

      <TravelDetailModal
        travelId={selectedId}
        activeApplications={activeApplications}
        onClose={() => setSelectedId(null)}
        onApplied={() => { setSelectedId(null); setRefresh(n => n + 1) }}
      />
    </div>
  )
}
