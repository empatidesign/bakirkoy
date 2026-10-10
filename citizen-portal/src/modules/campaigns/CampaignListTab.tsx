import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TagIcon, SearchIcon, SlidersHorizontalIcon, XIcon,
  ClockIcon, CheckCircle2Icon, ZapIcon, BookmarkIcon, BadgePlusIcon, NavigationIcon, Loader2Icon,
} from 'lucide-react'
import { SkeletonRows, Avatar, Checkbox, Button, Select } from '@/design-system'
import { formatDate } from '@/lib/utils'
import type { CitizenCampaign } from '@/types/campaign.types'
import type { ServiceCategoryRef } from '@/types/serviceCategory.types'
import campaignService from '@/services/campaign.service'
import { CAMPAIGN_CATEGORY_LABELS } from '@/types/companyCampaign.types'
import type { CampaignCategory } from '@/types/companyCampaign.types'
import { getCurrentPosition, type GeoPosition } from '@/lib/geolocation'
import { formatDistanceKm } from '@/lib/distance'
import { CampaignDetailModal } from './CampaignDetailModal'

const PAGE_SIZE = 20

const isPercentType = (type: string): boolean => {
  const t = type.toLowerCase()
  return t === 'percent' || t === 'percentage'
}

const formatDiscount = (type: string, value: number): string =>
  isPercentType(type) ? `%${value}` : `${value.toLocaleString('tr-TR')}₺`

const getDaysLeft = (endDate: string): number => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const end = new Date(endDate); end.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

type DateStatus = '' | 'active' | 'upcoming' | 'lastdays'

const DATE_STATUS_OPTIONS: { value: DateStatus; label: string }[] = [
  { value: '', label: 'Tümü' },
  { value: 'active', label: 'Şu an aktif' },
  { value: 'upcoming', label: 'Yakında' },
  { value: 'lastdays', label: 'Son günler' },
]

type SortBy = '' | 'newest' | 'distance'

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: '', label: 'Önerilen Sıralama' },
  { value: 'newest', label: 'En Yeniler Önce' },
  { value: 'distance', label: 'Yakınlığa Göre (En Yakın Önce)' },
]

export const CampaignListTab = ({ companyId, initialOnlySaved = false }: { companyId?: string; initialOnlySaved?: boolean } = {}) => {
  const [items, setItems] = useState<CitizenCampaign[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [categories, setCategories] = useState<ServiceCategoryRef[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [dateStatus, setDateStatus] = useState<DateStatus>('')
  const [onlySaved, setOnlySaved] = useState(initialOnlySaved)
  const [onlyNew, setOnlyNew] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [thresholdDays, setThresholdDays] = useState(1)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [userLocation, setUserLocation] = useState<GeoPosition | null>(null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)

  const activeFilterCount = selectedCategories.length + (dateStatus ? 1 : 0) + (onlySaved ? 1 : 0)
    + (onlyNew ? 1 : 0) + (sortBy ? 1 : 0)

  useEffect(() => {
    let active = true
    campaignService.categories().then((c) => { if (active) setCategories(c) }).catch(() => {})
    campaignService.settings().then((s) => { if (active) setThresholdDays(s.lastDayThresholdDays) }).catch(() => {})
    return () => { active = false }
  }, [])

  const fetchPage = useCallback((p: number, q: string, catIds: string[], ds: DateStatus, saved: boolean, isNew: boolean, sort: SortBy, replace: boolean, loc: GeoPosition | null) => {
    const params: Record<string, unknown> = { page: p, limit: PAGE_SIZE }
    if (q.trim()) params.search = q.trim()
    if (catIds.length > 0) params.categoryIds = catIds
    if (ds) params.dateStatus = ds
    if (saved) params.onlySaved = true
    if (isNew) params.onlyNew = true
    if (sort) params.sortBy = sort
    if (loc) { params.lat = loc.latitude; params.lng = loc.longitude }
    if (companyId) params.companyId = companyId
    if (replace) setLoading(true); else setLoadingMore(true)
    campaignService.list(params)
      .then((r) => { setItems((prev) => replace ? r.items : [...prev, ...r.items]); setTotal(r.total); setPage(p) })
      .catch(() => { if (replace) setItems([]) })
      .finally(() => { if (replace) setLoading(false); else setLoadingMore(false) })
  }, [companyId])

  useEffect(() => { fetchPage(1, search, selectedCategories, dateStatus, onlySaved, onlyNew, sortBy, true, userLocation) }, [selectedCategories, dateStatus, onlySaved, onlyNew, sortBy, userLocation]) // eslint-disable-line

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchPage(1, value, selectedCategories, dateStatus, onlySaved, onlyNew, sortBy, true, userLocation), 400)
  }

  const toggleDistanceSort = async () => {
    if (sortBy === 'distance') {
      setSortBy('')
      setUserLocation(null)
      return
    }
    setLocating(true)
    setLocateError(null)
    try {
      const res = await getCurrentPosition()
      if (!res.ok) {
        setLocateError(
          res.reason === 'denied' ? 'Konum izni verilmedi.'
            : res.reason === 'unsupported' ? 'Cihazınız konum servisini desteklemiyor.'
              : 'Konum alınamadı, lütfen tekrar deneyin.',
        )
        return
      }
      setUserLocation(res.position)
      setSortBy('distance')
    } finally {
      setLocating(false)
    }
  }

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const clearFilters = () => {
    setSelectedCategories([])
    setDateStatus('')
    setOnlySaved(false)
    setOnlyNew(false)
    setSortBy('')
    setUserLocation(null)
  }

  const toggleBookmark = async (e: React.MouseEvent, c: CitizenCampaign) => {
    e.stopPropagation()
    const next = !c.isSaved
    setItems((prev) => prev.map((x) => x.id === c.id ? { ...x, isSaved: next } : x))
    try {
      await campaignService.setBookmark(c.id, next)
      if (!next && onlySaved) setItems((prev) => prev.filter((x) => x.id !== c.id))
    } catch {
      setItems((prev) => prev.map((x) => x.id === c.id ? { ...x, isSaved: !next } : x))
    }
  }

  const hasMore = items.length < total

  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      {!companyId && (
      <div className="sticky top-0 z-10 bg-white px-4 py-3 flex gap-2"
        style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text" value={search} onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Kampanya veya firma ara…"
            className="w-full pl-8 pr-8 py-2 text-[13px] rounded-lg bg-gray-100 border-0 outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400"
          />
          {search && (
            <button type="button" onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button type="button" onClick={() => setFilterOpen(true)}
          className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all"
          style={activeFilterCount > 0
            ? { background: '#4f46e5', color: '#fff' }
            : { background: '#f3f4f6', color: '#6b7280' }
          }
        >
          <SlidersHorizontalIcon className="h-3.5 w-3.5" />
          Filtrele
          {activeFilterCount > 0 && (
            <span className="bg-white/30 rounded-md px-1.5 text-[11px] font-bold">{activeFilterCount}</span>
          )}
        </button>
      </div>
      )}

      {!companyId && (
        <div className="bg-white px-4 pb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void toggleDistanceSort()}
            disabled={locating}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all disabled:opacity-60"
            style={sortBy === 'distance'
              ? { background: '#4f46e5', color: '#fff' }
              : { background: '#f3f4f6', color: '#6b7280' }
            }
          >
            {locating ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <NavigationIcon className="h-3.5 w-3.5" />}
            Yakınlığa göre sırala
          </button>
          {locateError && (
            <span className="text-[12px] text-red-500">{locateError}</span>
          )}
        </div>
      )}

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-white px-4 pb-3">
          {dateStatus && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[12px] font-medium text-indigo-600">
              {DATE_STATUS_OPTIONS.find((o) => o.value === dateStatus)?.label}
              <button type="button" onClick={() => setDateStatus('')}><XIcon className="h-3 w-3" /></button>
            </span>
          )}
          {onlyNew && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[12px] font-medium text-indigo-600">
              Yeni Eklenenler
              <button type="button" onClick={() => setOnlyNew(false)}><XIcon className="h-3 w-3" /></button>
            </span>
          )}
          {sortBy && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[12px] font-medium text-indigo-600">
              {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
              <button type="button" onClick={() => setSortBy('')}><XIcon className="h-3 w-3" /></button>
            </span>
          )}
          {onlySaved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[12px] font-medium text-indigo-600">
              Kaydedilenler
              <button type="button" onClick={() => setOnlySaved(false)}><XIcon className="h-3 w-3" /></button>
            </span>
          )}
          {selectedCategories.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[12px] font-medium text-indigo-600">
              {selectedCategories.length} kategori
              <button type="button" onClick={() => setSelectedCategories([])}><XIcon className="h-3 w-3" /></button>
            </span>
          )}
          <button type="button" onClick={clearFilters} className="text-[12px] font-medium text-gray-400 underline">Temizle</button>
        </div>
      )}

      {loading ? (
        <div className="p-4"><SkeletonRows rows={4} /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-24 text-center px-6">
          <TagIcon className="h-8 w-8 text-gray-200" />
          <p className="text-sm text-gray-400">Kampanya bulunamadı</p>
          <p className="text-xs text-gray-300">Aktif kampanyalar burada görünecek.</p>
        </div>
      ) : (
        <div className="p-4 pb-8 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => {
            const fullyUsed = c.perUserLimit > 0 && c.myUsageCount >= c.perUserLimit
            const daysLeft = getDaysLeft(c.endDate)
            const showUrgency = !c.isExhausted && !fullyUsed && daysLeft >= 0 && daysLeft <= thresholdDays
            const isGray = c.isExhausted || fullyUsed
            const urgencyColor = daysLeft <= 1 ? '#ef4444' : daysLeft <= 2 ? '#f97316' : '#f59e0b'
            const categoryLabel = CAMPAIGN_CATEGORY_LABELS[c.category as CampaignCategory] ?? 'Diğer'

            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(c.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedId(c.id) }}
                className="flex min-h-[156px] cursor-pointer overflow-hidden rounded-lg bg-white text-left transition-all hover:shadow-lg active:scale-[0.99]"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' }}
              >
                <div className={`flex w-[112px] flex-shrink-0 items-center justify-center border-r border-gray-100 p-4 sm:w-[128px] ${isGray ? 'bg-gray-100' : 'bg-slate-50'}`}>
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
                    {c.companyLogo ? (
                      <img src={c.companyLogo} alt={`${c.companyName} logosu`} className={`h-full w-full object-contain ${isGray ? 'grayscale' : ''}`} />
                    ) : (
                      <Avatar name={c.companyName} size="lg" className="h-16 w-16 rounded-lg bg-indigo-50 text-indigo-600" />
                    )}
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-indigo-50 px-2 py-1 text-[16px] font-black leading-none text-indigo-700">
                          {formatDiscount(c.discountType, c.discountValue)}
                        </span>
                        <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600">{categoryLabel}</span>
                        {c.isNew && !isGray && (
                          <span className="flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[10px] font-bold text-white">
                            <BadgePlusIcon className="h-3 w-3" /> Yeni
                          </span>
                        )}
                        {isGray ? (
                          <span className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600">
                            <CheckCircle2Icon className="h-3 w-3" /> {fullyUsed ? 'Kullandınız' : 'Tükendi'}
                          </span>
                        ) : showUrgency ? (
                          <span className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-white" style={{ background: urgencyColor }}>
                            <ZapIcon className="h-3 w-3" /> {daysLeft === 0 ? 'Son gün!' : `${daysLeft}g kaldı`}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 line-clamp-2 text-[15px] font-bold leading-snug text-gray-900">{c.name}</p>
                      <p className="mt-1 truncate text-[12px] font-medium text-gray-500">{c.companyName}</p>
                    </div>
                    <button type="button" onClick={(e) => toggleBookmark(e, c)} aria-label={c.isSaved ? 'Kaydı kaldır' : 'Kaydet'}
                      className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-gray-100 transition-colors hover:bg-indigo-50">
                      <BookmarkIcon className="h-4 w-4 text-indigo-600" fill={c.isSaved ? '#4f46e5' : 'none'} />
                    </button>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    {c.serviceCategory ? (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                        style={{
                          background: c.serviceCategory.color ? `${c.serviceCategory.color}18` : '#f3f4f6',
                          color: c.serviceCategory.color ?? '#6b7280',
                        }}
                      >
                        {c.serviceCategory.name}
                      </span>
                    ) : <span />}
                    <div className="flex items-center gap-2">
                      {typeof c.distanceKm === 'number' && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600">
                          <NavigationIcon className="h-3 w-3" /> {formatDistanceKm(c.distanceKm)}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-gray-400">
                        <ClockIcon className="h-3 w-3" />
                        Son: {formatDate(c.endDate)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {hasMore && (
            <div className="col-span-full">
              <Button variant="outline" className="w-full" isLoading={loadingMore}
                onClick={() => fetchPage(page + 1, search, selectedCategories, dateStatus, onlySaved, onlyNew, sortBy, false, userLocation)}>
                Daha fazla yükle ({items.length}/{total})
              </Button>
            </div>
          )}
        </div>
      )}

      <CampaignDetailModal campaignId={selectedId} onClose={() => setSelectedId(null)} thresholdDays={thresholdDays} />

      {filterOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFilterOpen(false)} />
          <div className="relative flex max-h-[72vh] flex-col rounded-t-2xl bg-white">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-[15px] font-bold text-gray-900">Filtreler</span>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button type="button" onClick={clearFilters}
                    className="text-[12px] font-medium text-red-500">Temizle</button>
                )}
                <button type="button" onClick={() => setFilterOpen(false)}>
                  <XIcon className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="mb-4">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Sıralama</p>
                <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                  {SORT_OPTIONS.map((o) => <option key={o.value || 'default'} value={o.value}>{o.label}</option>)}
                </Select>
              </div>

              <div className="mb-4">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Tarih durumu</p>
                <div className="flex flex-wrap gap-2">
                  {DATE_STATUS_OPTIONS.map((o) => (
                    <button
                      key={o.value || 'all'}
                      type="button"
                      onClick={() => setDateStatus(o.value)}
                      className="rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors"
                      style={dateStatus === o.value
                        ? { borderColor: '#4f46e5', background: '#4f46e5', color: '#fff' }
                        : { borderColor: '#e5e7eb', background: '#fff', color: '#6b7280' }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                role="button" tabIndex={0}
                onClick={() => setOnlyNew((v) => !v)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOnlyNew((v) => !v) }}
                className="mb-4 flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 px-3 py-3"
              >
                <div className="flex items-center gap-2">
                  <BadgePlusIcon className="h-4 w-4 text-emerald-500" />
                  <span className="text-[13px] font-medium text-gray-800">Yalnızca yeni eklenen kampanyalar</span>
                </div>
                <Checkbox checked={onlyNew} onCheckedChange={() => setOnlyNew((v) => !v)} />
              </div>

              <div
                role="button" tabIndex={0}
                onClick={() => setOnlySaved((v) => !v)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOnlySaved((v) => !v) }}
                className="mb-4 flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 px-3 py-3"
              >
                <div className="flex items-center gap-2">
                  <BookmarkIcon className="h-4 w-4 text-indigo-500" fill={onlySaved ? '#4f46e5' : 'none'} />
                  <span className="text-[13px] font-medium text-gray-800">Yalnızca kaydettiklerim</span>
                </div>
                <Checkbox checked={onlySaved} onCheckedChange={() => setOnlySaved((v) => !v)} />
              </div>

              {categories.length > 0 && (
                <div>
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Kategoriler</p>
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      role="button" tabIndex={0}
                      onClick={() => toggleCategory(cat.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleCategory(cat.id) }}
                      className="flex w-full cursor-pointer items-center justify-between border-b border-gray-100 py-3 last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        {cat.color && <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />}
                        <span className="text-[13px] text-gray-800">{cat.name}</span>
                      </div>
                      <Checkbox checked={selectedCategories.includes(cat.id)} onCheckedChange={() => toggleCategory(cat.id)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-shrink-0 border-t border-gray-100 p-4 pb-8">
              <Button variant="primary" className="w-full" onClick={() => setFilterOpen(false)}>
                {activeFilterCount > 0 ? `Uygula (${activeFilterCount} filtre)` : 'Uygula'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
