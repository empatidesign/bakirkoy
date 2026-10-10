import { useCallback, useEffect, useRef, useState } from 'react'
import { svgMarkup } from '@/components/Icon2D'
import { useNavigate } from 'react-router-dom'
import {
  Building2Icon, SearchIcon, SlidersHorizontalIcon, XIcon,
  MapPinIcon, TagIcon, ListIcon, MapIcon, GlobeIcon, NavigationIcon, Loader2Icon,
} from 'lucide-react'
import { SkeletonRows, Avatar, Checkbox } from '@/design-system'
import type { CitizenDirectoryCompany } from '@/types/campaign.types'
import type { ServiceCategoryRef } from '@/types/serviceCategory.types'
import campaignService from '@/services/campaign.service'
import { useGoogleMaps } from '@/hooks/useGoogleMaps'
import { dotPinIcon } from '@/lib/mapPins'
import { getCurrentPosition, type GeoPosition } from '@/lib/geolocation'
import { formatDistanceKm, directionsUrl } from '@/lib/distance'
import { escapeHtml as esc } from '@/lib/escapeHtml'

const PAGE_SIZE = 30

type ViewMode = 'list' | 'map'

export const MemberBusinessesTab = () => {
  const navigate = useNavigate()
  const [items, setItems] = useState<CitizenDirectoryCompany[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [categories, setCategories] = useState<ServiceCategoryRef[]>([])
  const [districts, setDistricts] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [district, setDistrict] = useState('')
  const [onlyWithCampaigns, setOnlyWithCampaigns] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<ViewMode>('list')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [sortByDistance, setSortByDistance] = useState(false)
  const [userLocation, setUserLocation] = useState<GeoPosition | null>(null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)

  const activeFilterCount = selectedCategories.length + (district ? 1 : 0) + (onlyWithCampaigns ? 1 : 0)

  useEffect(() => {
    let active = true
    campaignService.categories().then((c) => { if (active) setCategories(c) }).catch(() => {})
    campaignService.directoryDistricts().then((d) => { if (active) setDistricts(d) }).catch(() => {})
    return () => { active = false }
  }, [])

  const fetchPage = useCallback((p: number, q: string, catIds: string[], dist: string, campaigns: boolean, replace: boolean, loc: GeoPosition | null) => {
    const params: Record<string, unknown> = { page: p, limit: PAGE_SIZE }
    if (q.trim()) params.search = q.trim()
    if (catIds.length > 0) params.categoryIds = catIds
    if (dist) params.district = dist
    if (campaigns) params.onlyWithCampaigns = true
    if (loc) { params.lat = loc.latitude; params.lng = loc.longitude; params.sort = 'distance' }
    if (replace) setLoading(true); else setLoadingMore(true)
    campaignService.directory(params)
      .then((r) => { setItems((prev) => replace ? r.items : [...prev, ...r.items]); setTotal(r.total); setPage(p) })
      .catch(() => { if (replace) setItems([]) })
      .finally(() => { if (replace) setLoading(false); else setLoadingMore(false) })
  }, [])

  useEffect(() => { fetchPage(1, search, selectedCategories, district, onlyWithCampaigns, true, userLocation) }, [selectedCategories, district, onlyWithCampaigns, userLocation]) // eslint-disable-line

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchPage(1, value, selectedCategories, district, onlyWithCampaigns, true, userLocation), 400)
  }

  const toggleDistanceSort = async () => {
    if (sortByDistance) {
      setSortByDistance(false)
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
      setSortByDistance(true)
    } finally {
      setLocating(false)
    }
  }

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const clearFilters = () => {
    setSelectedCategories([])
    setDistrict('')
    setOnlyWithCampaigns(false)
  }

  const hasMore = items.length < total

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="sticky top-0 z-10 bg-white px-4 py-3 flex gap-2"
        style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text" value={search} onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Firma veya mahalle ara…"
            className="w-full pl-8 pr-8 py-2 text-[13px] rounded-lg bg-gray-100 border-0 outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400"
          />
          {search && (
            <button type="button" onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center rounded-lg bg-gray-100 p-0.5">
          <button type="button" onClick={() => setView('list')}
            className="grid h-8 w-8 place-items-center rounded-md transition-colors"
            style={view === 'list' ? { background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' } : {}}>
            <ListIcon className="h-4 w-4" style={{ color: view === 'list' ? '#4f46e5' : '#9ca3af' }} />
          </button>
          <button type="button" onClick={() => setView('map')}
            className="grid h-8 w-8 place-items-center rounded-md transition-colors"
            style={view === 'map' ? { background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' } : {}}>
            <MapIcon className="h-4 w-4" style={{ color: view === 'map' ? '#4f46e5' : '#9ca3af' }} />
          </button>
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

      <div className="bg-white px-4 pb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void toggleDistanceSort()}
          disabled={locating}
          className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all disabled:opacity-60"
          style={sortByDistance
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

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-white px-4 pb-3">
          {district && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[12px] font-medium text-indigo-600">
              {district}
              <button type="button" onClick={() => setDistrict('')}><XIcon className="h-3 w-3" /></button>
            </span>
          )}
          {onlyWithCampaigns && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[12px] font-medium text-indigo-600">
              Aktif kampanyalı
              <button type="button" onClick={() => setOnlyWithCampaigns(false)}><XIcon className="h-3 w-3" /></button>
            </span>
          )}
          {selectedCategories.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[12px] font-medium text-indigo-600">
              {selectedCategories.length} sektör
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
          <Building2Icon className="h-8 w-8 text-gray-200" />
          <p className="text-sm text-gray-400">Üye iş yeri bulunamadı</p>
          <p className="text-xs text-gray-300">Arama veya filtreleri değiştirin.</p>
        </div>
      ) : view === 'map' ? (
        <DirectoryMap items={items} onSelect={(id) => navigate(`/kampanyalar/firma/${id}`)} />
      ) : (
        <div className="p-4 pb-8 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(`/kampanyalar/firma/${c.id}`)}
              className="text-left bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-all active:scale-[0.99]"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' }}
            >
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 7' }}>
                {(c.bannerImageMobile ?? c.bannerImage) ? (
                  <img src={c.bannerImageMobile ?? c.bannerImage!} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 100%)' }}>
                    <Building2Icon className="h-8 w-8 text-white/30" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
                <div className="absolute left-3 bottom-2.5 flex items-center gap-2">
                  <div className="grid h-9 w-9 flex-shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-white bg-white">
                    <Avatar name={c.name} src={c.logo ?? undefined} size="sm" />
                  </div>
                  <p className="text-[14px] font-bold text-white leading-tight line-clamp-1 drop-shadow">{c.name}</p>
                </div>
                {c.activeCampaignCount > 0 && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-black/45 backdrop-blur px-2 py-1 text-[10px] font-bold text-white">
                    <TagIcon className="h-3 w-3" /> {c.activeCampaignCount} kampanya
                  </span>
                )}
                {typeof c.distanceKm === 'number' && (
                  <span className="absolute left-3 top-3 flex items-center gap-1 rounded-lg bg-black/45 backdrop-blur px-2 py-1 text-[10px] font-bold text-white">
                    <NavigationIcon className="h-3 w-3" /> {formatDistanceKm(c.distanceKm)}
                  </span>
                )}
              </div>

              <div className="px-4 pt-3 pb-3">
                <div className="flex items-center justify-between gap-2">
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
                  {c.website && <GlobeIcon className="h-3.5 w-3.5 text-gray-300" />}
                </div>
                {(c.address || c.district) && (
                  <p className="mt-1.5 flex items-start gap-1 text-[11px] text-gray-500 line-clamp-2">
                    <MapPinIcon className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <span>{[c.district, c.address].filter(Boolean).join(' · ')}</span>
                  </p>
                )}
              </div>
            </button>
          ))}

          {hasMore && (
            <div className="col-span-full">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => fetchPage(page + 1, search, selectedCategories, district, onlyWithCampaigns, false, userLocation)}
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
              >
                {loadingMore ? 'Yükleniyor…' : `Daha fazla yükle (${items.length}/${total})`}
              </button>
            </div>
          )}
        </div>
      )}

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
              <div
                role="button" tabIndex={0}
                onClick={() => setOnlyWithCampaigns((v) => !v)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOnlyWithCampaigns((v) => !v) }}
                className="mb-4 flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 px-3 py-3"
              >
                <div className="flex items-center gap-2">
                  <TagIcon className="h-4 w-4 text-indigo-500" />
                  <span className="text-[13px] font-medium text-gray-800">Yalnızca aktif kampanyalı firmalar</span>
                </div>
                <Checkbox checked={onlyWithCampaigns} onCheckedChange={() => setOnlyWithCampaigns((v) => !v)} />
              </div>

              {districts.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Mahalle</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setDistrict('')}
                      className="rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors"
                      style={district === ''
                        ? { borderColor: '#4f46e5', background: '#4f46e5', color: '#fff' }
                        : { borderColor: '#e5e7eb', background: '#fff', color: '#6b7280' }}
                    >
                      Tümü
                    </button>
                    {districts.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDistrict(d)}
                        className="rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors"
                        style={district === d
                          ? { borderColor: '#4f46e5', background: '#4f46e5', color: '#fff' }
                          : { borderColor: '#e5e7eb', background: '#fff', color: '#6b7280' }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {categories.length > 0 && (
                <div>
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Sektörler</p>
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
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                {activeFilterCount > 0 ? `Uygula (${activeFilterCount} filtre)` : 'Uygula'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const BAKIRKOY_CENTER: google.maps.LatLngLiteral = { lat: 40.9833, lng: 28.8667 }
const SULTANGAZI_G = BAKIRKOY_CENTER

function popupHtml(c: CitizenDirectoryCompany): string {
  return `<div class="space-y-1.5">`
    + `<strong class="type-body-strong">${esc(c.name)}</strong>`
    + (c.address ? `<div class="type-caption">${esc(c.address)}</div>` : '')
    + (c.serviceCategory ? `<div class="type-caption">${esc(c.serviceCategory.name)}</div>` : '')
    + (typeof c.distanceKm === 'number' ? `<div class="type-caption">${svgMarkup('pin')} ${esc(formatDistanceKm(c.distanceKm))} uzaklıkta</div>` : '')
    + `<div class="flex items-center gap-3 pt-1">`
    + `<a href="${directionsUrl({ latitude: c.latitude!, longitude: c.longitude! }, c.googlePlaceId)}" target="_blank" rel="noopener noreferrer" class="type-link-sm">${svgMarkup('compass')} Yol Tarifi</a>`
    + `<button type="button" data-id="${esc(c.id)}" class="type-link-sm">Detaylar</button>`
    + `</div></div>`
}

const DirectoryMap = ({ items, onSelect }: { items: CitizenDirectoryCompany[]; onSelect: (id: string) => void }) => {
  const { status: gmapsStatus } = useGoogleMaps()

  const containerRef = useRef<HTMLDivElement>(null)
  const gMapRef = useRef<google.maps.Map | null>(null)
  const gMarkersRef = useRef<google.maps.Marker[]>([])
  const gInfoRef = useRef<google.maps.InfoWindow | null>(null)
  const itemByIdRef = useRef<Map<string, CitizenDirectoryCompany>>(new Map())
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (gmapsStatus !== 'ready' || !containerRef.current || gMapRef.current) return
    const map = new google.maps.Map(containerRef.current, {
      center: SULTANGAZI_G,
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
    gMapRef.current = map
  }, [gmapsStatus])

  useEffect(() => {
    if (gmapsStatus !== 'ready' || !gMapRef.current) return
    const map = gMapRef.current
    itemByIdRef.current = new Map(items.map((c) => [c.id, c]))

    gMarkersRef.current.forEach((m) => m.setMap(null))
    gMarkersRef.current = []
    gInfoRef.current?.close()

    const bounds = new google.maps.LatLngBounds()
    items
      .filter((c) => c.latitude != null && c.longitude != null)
      .forEach((c) => {
        const position = { lat: c.latitude!, lng: c.longitude! }
        const marker = new google.maps.Marker({
          position,
          map,
          title: c.name,
          icon: dotPinIcon({ colorVar: '--primary' }),
        })
        marker.addListener('click', () => {
          gInfoRef.current?.close()
          const el = document.createElement('div')
          el.innerHTML = popupHtml(c)
          el.querySelector<HTMLButtonElement>('button[data-id]')?.addEventListener('click', () => {
            onSelectRef.current(c.id)
            gInfoRef.current?.close()
          })
          const info = new google.maps.InfoWindow({ content: el, maxWidth: 260 })
          gInfoRef.current = info
          info.open({ map, anchor: marker })
        })
        gMarkersRef.current.push(marker)
        bounds.extend(position)
      })

    if (!bounds.isEmpty()) map.fitBounds(bounds, 40)
  }, [items, gmapsStatus])

  const withLocationCount = items.filter((c) => c.latitude != null && c.longitude != null).length

  if (withLocationCount === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-center px-6">
        <MapPinIcon className="h-8 w-8 text-gray-200" />
        <p className="text-sm text-gray-400">Haritada gösterilecek konumlu firma yok</p>
      </div>
    )
  }

  if (gmapsStatus === 'disabled') {
    return (
      <div className="flex h-[calc(100vh-13rem)] w-full items-center justify-center">
        <p className="text-sm text-gray-400">Harita şu anda kullanılamıyor.</p>
      </div>
    )
  }

  return <div ref={containerRef} className="h-[calc(100vh-13rem)] w-full" />
}
