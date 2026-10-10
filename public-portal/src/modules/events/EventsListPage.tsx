import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarDaysIcon, SearchIcon, MapPinIcon, ClockIcon,
  ImageOffIcon, CheckIcon, XIcon, SlidersHorizontalIcon,
} from 'lucide-react'
import type { PublicEvent, PublicEventCategory } from '@/types/public.types'
import { GENDER_LABELS } from '@/types/public.types'
import publicService from '@/services/public.service'
import { formatDateRange } from '@/lib/utils'
import { EventDetailModal } from './EventDetailModal'

function groupByMonth(events: PublicEvent[]) {
  const labelMap: Record<string, string> = {}
  const map = new Map<string, PublicEvent[]>()
  for (const ev of events) {
    const d = new Date(ev.startDate)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    labelMap[key] = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(ev)
  }
  return [...map.entries()].map(([key, items]) => ({ label: labelMap[key] ?? key, items }))
}

const EventCard = ({ ev, onClick }: { ev: PublicEvent; onClick: () => void }) => {
  const isFull = ev.capacity > 0 && ev.registeredCount >= ev.capacity
  const hasAgeRange = ev.minAge > 0 && ev.maxAge > 0
  const ageLabel = hasAgeRange ? `${ev.minAge}–${ev.maxAge} yaş` : 'Tüm yaşlar'
  const cc = ev.categoryColor ?? '#6366F1'
  const d = new Date(ev.startDate)
  const dayNum = d.toLocaleDateString('tr-TR', { day: '2-digit' })
  const monthShort = d.toLocaleDateString('tr-TR', { month: 'short' })
  const venue = ev.facilityName ?? ev.location?.name ?? null

  return (
    <button
      onClick={onClick}
      className="w-full overflow-hidden rounded-lg border border-border bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {ev.primaryImageUrl ? (
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '2 / 1' }}>
          <img src={ev.primaryImageUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
          <div className="absolute bottom-2.5 left-3 text-white">
            <p className="text-2xl font-black leading-none drop-shadow">{dayNum}</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/90 drop-shadow">{monthShort}</p>
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-col items-center justify-center gap-1" style={{ aspectRatio: '2 / 1', background: `linear-gradient(160deg, ${cc}f0, ${cc}80)` }}>
          <p className="text-3xl font-black text-white leading-none drop-shadow-sm">{dayNum}</p>
          <p className="text-[12px] font-bold uppercase tracking-wider text-white/90">{monthShort}</p>
        </div>
      )}

      <div className="space-y-2 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-lg px-2 py-0.5 text-[11px] font-bold" style={{ background: `${cc}18`, color: cc }}>
            {ev.categoryName}
          </span>
          {isFull ? (
            <span className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">Kontenjan dolu</span>
          ) : (
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Kayıt açık</span>
          )}
        </div>

        <p className="text-[15px] font-bold leading-snug text-foreground line-clamp-2">{ev.name}</p>

        {venue && (
          <p className="flex items-center gap-1 text-[12px] text-foreground/55">
            <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{venue}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
          <span className="rounded-lg px-2 py-1 font-semibold" style={{ background: `${cc}12`, color: cc }}>
            {GENDER_LABELS[ev.gender] ?? ev.gender} · {ageLabel}
          </span>
          {(ev.startTime || ev.sessionCount > 1) && (
            <span className="inline-flex items-center gap-1 text-foreground/50">
              <ClockIcon className="h-3.5 w-3.5" />
              {ev.startTime ? `${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''}` : `${ev.sessionCount} oturum`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[12px] font-medium text-foreground/45">
          <CalendarDaysIcon className="h-3.5 w-3.5" />
          {formatDateRange(ev.startDate, ev.endDate, ev.isSingleDay)}
        </div>
      </div>
    </button>
  )
}

export const EventsListPage = () => {
  const [searchParams] = useSearchParams()
  const [events, setEvents] = useState<PublicEvent[] | null>(null)
  const [categories, setCategories] = useState<PublicEventCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => {
    const deepLinkId = searchParams.get('eventId')
    if (deepLinkId) setSelectedEventId(deepLinkId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadFailed(false)
    const handle = setTimeout(() => {
      publicService.getEvents({ page: 1, limit: 60, search: search.trim() || undefined })
        .then((list) => { if (active) setEvents(list) })
        .catch(() => { if (active) { setEvents([]); setLoadFailed(true) } })
        .finally(() => { if (active) setLoading(false) })
    }, search ? 300 : 0)
    return () => { active = false; clearTimeout(handle) }
  }, [search])

  useEffect(() => {
    publicService.getEventCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  const filtered = useMemo(() => {
    if (!events) return []
    return events
      .filter((ev) => !activeCategory || ev.categoryName === activeCategory)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  }, [events, activeCategory])

  const groups = useMemo(() => groupByMonth(filtered), [filtered])

  return (
    <div>
      <div className="border-b border-border bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="font-display text-2xl font-black text-foreground">Belediye Etkinlikleri</h1>
          <p className="mt-1 text-[13.5px] text-foreground/55">
            Yaklaşan tüm etkinlikleri görüntüleyin. Başvurmak için Vatandaş Portalı üzerinden giriş yapmanız gerekir.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/30" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Etkinlik veya mekan ara…"
                className="w-full rounded-lg border border-border bg-surface-1 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:bg-white"
              />
            </div>
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold transition-colors ${
                activeCategory ? 'bg-primary text-primary-foreground' : 'border border-border bg-white text-foreground/60 hover:bg-surface-1'
              }`}
            >
              <SlidersHorizontalIcon className="h-4 w-4" />
              Kategori
            </button>
          </div>

          {filterOpen && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                onClick={() => { setActiveCategory(null); setFilterOpen(false) }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  !activeCategory ? 'bg-foreground text-white' : 'border border-border bg-white text-foreground/60'
                }`}
              >
                Tümü
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(activeCategory === cat.name ? null : cat.name); setFilterOpen(false) }}
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={
                    activeCategory === cat.name
                      ? { background: cat.color ?? '#6366F1', color: '#fff' }
                      : { background: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB' }
                  }
                >
                  {activeCategory === cat.name && <CheckIcon className="h-3 w-3" />}
                  {cat.name} ({cat.eventCount})
                </button>
              ))}
            </div>
          )}

          {activeCategory && !filterOpen && (
            <button
              onClick={() => setActiveCategory(null)}
              className="mt-3 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              {activeCategory}
              <XIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {loading && events === null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary-soft">
              <ImageOffIcon className="h-8 w-8 text-primary/60" />
            </div>
            <p className="font-bold text-foreground/70">{loadFailed ? 'Etkinlikler yüklenemedi' : 'Etkinlik bulunamadı'}</p>
            <p className="text-sm text-foreground/40">
              {loadFailed ? 'Bağlantınızı kontrol edip tekrar deneyin.' : 'Farklı bir kategori veya arama deneyin.'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group, gi) => (
              <div key={gi}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-lg bg-primary-soft px-3 py-1.5">
                    <CalendarDaysIcon className="h-3.5 w-3.5 text-primary" />
                    <h3 className="text-sm font-bold capitalize text-primary">{group.label}</h3>
                  </div>
                  <div className="h-px flex-1 bg-border" />
                  <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-foreground/50">
                    {group.items.length} etkinlik
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((ev) => (
                    <EventCard key={ev.id} ev={ev} onClick={() => setSelectedEventId(ev.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EventDetailModal eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
    </div>
  )
}
