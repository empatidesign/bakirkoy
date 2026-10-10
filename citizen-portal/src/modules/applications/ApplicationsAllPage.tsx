import { useEffect, useMemo, useState } from 'react'
import {
  ClipboardListIcon, CalendarDaysIcon, BusIcon, Building2Icon,
  BookOpenIcon, UserIcon, CheckCircle2Icon, ClockIcon, XIcon, AlertCircleIcon,
  SearchIcon, ChevronRightIcon, MapPinIcon,
} from 'lucide-react'
import { ModuleHeader, SkeletonRows, Button } from '@/design-system'
import { formatDate, isPastDay } from '@/lib/utils'
import eventService from '@/services/event.service'
import travelService from '@/services/travel.service'
import facilityService from '@/services/facility.service'
import libraryService from '@/services/library.service'
import { ApplicationsTab } from '@/modules/events/ApplicationsTab'
import { EventDetailModal } from '@/modules/events/EventDetailModal'
import { TravelDetailModal } from '@/modules/travels/TravelDetailModal'
import { FacilityDetailModal } from '@/modules/facilities/FacilityDetailModal'
import { LibraryDetailModal } from '@/modules/library/LibraryDetailModal'
import { TravelApplicationsTab } from '@/modules/travels/TravelApplicationsTab'
import { FacilityApplicationsTab } from '@/modules/facilities/FacilityApplicationsTab'
import { LibraryReservationsTab } from '@/modules/library/LibraryReservationsTab'
import type { CitizenApplication } from '@/types/event.types'
import type { CitizenTravelApplication } from '@/types/travel.types'
import type { CitizenFacilityApplication } from '@/types/facility.types'
import type { CitizenLibraryReservation } from '@/types/library.types'
import { combineApplicationResults } from './combineApplicationResults'
import { fetchAllPages } from './fetchAllPages'
import { statusMeta, type ApplicationStatusTone } from '@/types/applicationStatus'

const TONE_HEX: Record<ApplicationStatusTone, string> = {
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  neutral: '#64748b',
}

type AppTab = 'all' | 'event' | 'travel' | 'facility' | 'library'

interface CombinedItem {
  id: string
  type: Exclude<AppTab, 'all'>
  title: string
  subtitle?: string
  personName: string
  isSelf: boolean
  status: string
  dateForSort: string
  /** Kartın altında gösterilen yer/tesis bilgisi. */
  place?: string
  /** Detay modalını açmak için gereken referans. */
  ref: DetailRef
}

type DetailRef =
  | { kind: 'event'; eventId: string; sessionId?: string | null }
  | { kind: 'travel'; travelId: string }
  | { kind: 'facility'; module: string; groupId: string }
  | { kind: 'library'; libraryId: string }
  /** Detayı açılamayan kayıt (ör. grubu silinmiş başvuru). */
  | { kind: 'none' }

const isPast = isPastDay

function fromEvents(apps: CitizenApplication[]): CombinedItem[] {
  return apps
    .filter((a) => !a.eventDeleted && !isPast(a.eventDate))
    .map((a) => ({
      id: a.id, type: 'event' as const,
      title: a.eventName,
      subtitle: a.sessionLabel ?? formatDate(a.eventDate),
      personName: a.personName, isSelf: a.isSelf,
      status: a.status,
      dateForSort: a.eventDate,
      place: [a.facilityName ?? a.venueName, a.seatNumber ? `Koltuk ${a.seatNumber}` : null].filter(Boolean).join(' · '),
      ref: { kind: 'event', eventId: a.eventId, sessionId: a.sessionId },
    }))
}

function fromTravels(apps: CitizenTravelApplication[]): CombinedItem[] {
  return apps
    .filter((a) => !a.travelDeleted && !isPast(a.departureDate))
    .map((a) => ({
      id: a.id, type: 'travel' as const,
      title: a.travelName,
      subtitle: `${a.destination} · ${formatDate(a.departureDate)}`,
      personName: a.personName, isSelf: a.isSelf,
      status: a.status,
      dateForSort: a.departureDate,
      place: a.venueName,
      ref: { kind: 'travel', travelId: a.travelId },
    }))
}

// Kullanıcı isteği (2026-08-29): "herhangi bir etkinlik ve program kaydı citizen portalda
// nerde tutulacak listesini görmeli, bu da günü geçtiğinde program veya gezi vs bu kayıtlı
// alandan da kalkmalı" — Event ve Travel zaten süresi geçmişse (isPast) bu birleşik "Tümü"
// listesinden çıkarılıyordu, ama Program (Facility) başvuruları hiç filtrelenmiyordu; dönemi
// (periodEnd) yıllar önce bitmiş bir kurs/spor kaydı bile sonsuza kadar "aktif" listede
// görünmeye devam ediyordu. Akademi tipi (sürekli üyelik, periodEnd genelde null) gruplar
// etkilenmesin diye yalnızca periodEnd DOLU ve geçmişse filtreleniyor.
function fromFacilities(apps: CitizenFacilityApplication[]): CombinedItem[] {
  return apps
    .filter((a) => !(a.periodEnd && isPast(a.periodEnd)))
    .map((a) => ({
      id: a.id, type: 'facility' as const,
      title: a.groupName,
      subtitle: [`${a.moduleLabel} · ${a.branchName}`, a.scheduleSummary].filter(Boolean).join(' · '),
      personName: a.personName, isSelf: a.isSelf,
      status: a.status,
      dateForSort: a.periodStart ?? a.appliedAt,
      place: a.serviceFacilityName ?? a.facilityName,
      ref: a.groupId
        ? { kind: 'facility' as const, module: a.module, groupId: a.groupId }
        : { kind: 'none' as const },
    }))
}

function fromLibrary(reservations: CitizenLibraryReservation[]): CombinedItem[] {
  return reservations
    .filter((r) => r.status === 'held')
    .map((r) => ({
      id: r.id, type: 'library' as const,
      title: r.libraryName,
      subtitle: r.slotStart ? formatDate(r.slotStart) : undefined,
      personName: 'Ben', isSelf: true,
      status: r.status,
      dateForSort: r.slotStart ?? r.reservedAt,
      place: [r.floorName, r.sectionName, r.seatLabel ?? r.seat].filter(Boolean).join(' · ') || undefined,
      ref: { kind: 'library', libraryId: r.libraryId },
    }))
}


const TYPE_META: Record<Exclude<AppTab, 'all'>, {
  label: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
  grad: string
}> = {
  event:    { label: 'Etkinlik',   icon: CalendarDaysIcon, color: '#818cf8', grad: 'linear-gradient(135deg,#6366f1,#4f46e5)' },
  travel:   { label: 'Gezi',      icon: BusIcon,          color: '#34d399', grad: 'linear-gradient(135deg,#10b981,#059669)' },
  facility: { label: 'Program',   icon: Building2Icon,    color: '#fbbf24', grad: 'linear-gradient(135deg,#f59e0b,#d97706)' },
  library:  { label: 'Kütüphane', icon: BookOpenIcon,     color: '#94a3b8', grad: 'linear-gradient(135deg,#64748b,#475569)' },
}

function statusIcon(status: string): React.ComponentType<{ className?: string }> {
  switch (status) {
    case 'approved': case 'consumed': case 'held': return CheckCircle2Icon
    case 'pending': case 'reviewing': case 'waitlist': return ClockIcon
    case 'rejected': return XIcon
    case 'cancelled': case 'expired': return XIcon
    default: return AlertCircleIcon
  }
}

type StatusFilter = 'all' | 'approved' | 'pending' | 'other'

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',      label: 'Tümü' },
  { key: 'approved', label: 'Onaylananlar' },
  { key: 'pending',  label: 'Bekleyenler' },
  { key: 'other',    label: 'Diğer' },
]

function statusCategory(status: string): Exclude<StatusFilter, 'all'> {
  switch (status) {
    case 'approved': case 'consumed': case 'held': return 'approved'
    case 'pending': case 'reviewing': case 'waitlist': return 'pending'
    default: return 'other'
  }
}

const TABS: { key: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'all',      label: 'Tümü',      icon: ClipboardListIcon },
  { key: 'event',    label: 'Etkinlik',  icon: CalendarDaysIcon  },
  { key: 'travel',   label: 'Gezi',      icon: BusIcon           },
  { key: 'facility', label: 'Program',   icon: Building2Icon     },
  { key: 'library',  label: 'Kütüphane', icon: BookOpenIcon      },
]


const AllCombinedTab = () => {
  const [eventApps,    setEventApps]    = useState<CitizenApplication[] | null>(null)
  const [travelApps,   setTravelApps]   = useState<CitizenTravelApplication[] | null>(null)
  const [facilityApps, setFacilityApps] = useState<CitizenFacilityApplication[] | null>(null)
  const [libraryRes,   setLibraryRes]   = useState<CitizenLibraryReservation[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [partialError, setPartialError] = useState(false)
  const [incomplete, setIncomplete] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [detail, setDetail] = useState<DetailRef | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.allSettled([
      fetchAllPages((page) => eventService.applications({ scope: 'family', page, limit: 50 })),
      fetchAllPages((page) => travelService.applications({ scope: 'family', page, limit: 50 })),
      fetchAllPages((page) => facilityService.applications({ scope: 'family', page, limit: 50 })),
      fetchAllPages((page) => libraryService.reservations({ page, limit: 50 })),
    ]).then(([ev, tr, fa, li]) => {
      if (!active) return
      const combined = combineApplicationResults(ev, tr, fa, li)
      setEventApps(combined.eventApps)
      setTravelApps(combined.travelApps)
      setFacilityApps(combined.facilityApps)
      setLibraryRes(combined.libraryRes)
      setLoadError(combined.loadError)
      setPartialError([ev, tr, fa, li].some((r) => r.status === 'fulfilled' && r.value.error))
      setIncomplete([ev, tr, fa, li].some((r) => r.status === 'fulfilled' && !r.value.complete && !r.value.error))
      setLoading(false)
    })
    return () => { active = false }
  }, [refresh])

  const allItems = useMemo<CombinedItem[]>(() => {
    const all = [
      ...fromEvents(eventApps ?? []),
      ...fromTravels(travelApps ?? []),
      ...fromFacilities(facilityApps ?? []),
      ...fromLibrary(libraryRes ?? []),
    ]
    return all.sort((a, b) => a.dateForSort.localeCompare(b.dateForSort))
  }, [eventApps, travelApps, facilityApps, libraryRes])

  const statusCounts = useMemo(() => {
    const c = { all: allItems.length, approved: 0, pending: 0, other: 0 }
    for (const it of allItems) c[statusCategory(it.status)]++
    return c
  }, [allItems])

  const items = useMemo(() => {
    let list = allItems
    if (statusFilter !== 'all') list = list.filter((item) => statusCategory(item.status) === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((item) =>
        item.title.toLowerCase().includes(q) || (item.subtitle ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [allItems, search, statusFilter])

  if (loading) return <div className="p-5"><SkeletonRows rows={6} /></div>

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-4 pt-3 pb-3 bg-surface-0 border-b border-border">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Başvuru ara…"
            className="w-full pl-8 pr-8 py-2 text-[13px] rounded-lg bg-surface-2 border-0 outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-foreground-muted text-foreground-default"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground-default">
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-2.5 flex gap-2 overflow-x-auto">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key
            const count = statusCounts[f.key]
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
                style={active
                  ? { borderColor: '#6366f1', background: '#6366f1', color: '#fff' }
                  : { borderColor: 'hsl(var(--border))', background: 'transparent', color: 'hsl(var(--foreground-muted))' }}
              >
                {f.label}
                <span className="rounded-full px-1.5 text-[11px] font-bold"
                  style={active ? { background: 'rgba(255,255,255,0.25)' } : { background: 'hsl(var(--surface-2))' }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {(loadError || partialError) && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-lg bg-warning-soft px-3 py-2">
          <p className="text-[12px] text-warning">Bazı başvurularınız şu anda yüklenemedi. Yüklenen kayıtlar gösteriliyor; liste eksik olabilir.</p>
          <Button size="sm" variant="ghost" onClick={() => setRefresh((r) => r + 1)}>Tekrar Dene</Button>
        </div>
      )}

      {!loadError && !partialError && incomplete && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-lg bg-warning-soft px-3 py-2">
          <p className="text-[12px] text-warning">Çok sayıda başvurunuz var; liste tamamı yüklenemedi. Arama tüm kayıtlarda çalışmayabilir.</p>
          <Button size="sm" variant="ghost" onClick={() => setRefresh((r) => r + 1)}>Yenile</Button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <ClipboardListIcon className="h-8 w-8 text-foreground-subtle" />
          <p className="text-sm text-foreground-muted">
            {search ? 'Sonuç bulunamadı'
              : statusFilter === 'approved' ? 'Onaylanmış başvuru yok'
              : statusFilter === 'pending' ? 'Bekleyen başvuru yok'
              : statusFilter === 'other' ? 'Bu durumda başvuru yok'
              : 'Aktif başvuru yok'}
          </p>
          {(search || statusFilter !== 'all') && (
            <button type="button" onClick={() => { setSearch(''); setStatusFilter('all') }}
              className="text-xs text-indigo-400 font-medium">Filtreleri temizle</button>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {items.map((item) => {
            const meta = TYPE_META[item.type]
            const Icon = meta.icon
            const sm = statusMeta(item.status)
            const scColor = TONE_HEX[sm.tone]
            const StatusIcon = statusIcon(item.status)

            return (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                disabled={item.ref.kind === 'none'}
                onClick={() => item.ref.kind !== 'none' && setDetail(item.ref)}
                className="w-full text-left rounded-xl overflow-hidden bg-surface-0 transition-transform active:scale-[0.99] disabled:active:scale-100"
                style={{ border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
              >
                <div className="flex items-center gap-3 px-4 pt-3.5 pb-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md"
                    style={{ background: meta.grad, boxShadow: `0 4px 12px ${meta.color}40` }}
                  >
                    <Icon style={{ width: 18, height: 18, color: '#fff' }} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="text-[10px] font-bold rounded-full px-2 py-0.5"
                        style={{ background: `${meta.color}22`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {!item.isSelf && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-foreground-muted">
                          <UserIcon className="h-3 w-3" />{item.personName}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] font-bold text-foreground-strong leading-snug truncate">{item.title}</p>
                    {item.subtitle && (
                      <p className="text-[11.5px] text-foreground-muted leading-snug truncate mt-0.5">{item.subtitle}</p>
                    )}
                  </div>

                  <span
                    className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
                    style={{ background: `${scColor}20`, color: scColor, border: `1px solid ${scColor}35` }}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {sm.label}
                  </span>

                  {item.ref.kind !== 'none' && (
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground-subtle" />
                  )}
                </div>

                {item.place && (
                  <div className="flex items-center gap-1.5 px-4 py-2.5">
                    <MapPinIcon className="h-3 w-3 shrink-0 text-foreground-subtle" />
                    <p className="text-[11px] text-foreground-muted truncate">{item.place}</p>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {detail?.kind === 'event' && (
        <EventDetailModal
          eventId={detail.eventId}
          initialSessionId={detail.sessionId}
          onClose={() => setDetail(null)}
          onApplied={() => { setDetail(null); setRefresh((n) => n + 1) }}
        />
      )}
      {detail?.kind === 'travel' && (
        <TravelDetailModal
          travelId={detail.travelId}
          existingApplications={(travelApps ?? [])
            .filter((a) => a.travelId === detail.travelId)
            .map((a) => ({
              id: a.id, personName: a.personName, isSelf: a.isSelf, status: a.status,
              // Kullanıcı isteği (2026-08-29): tip hatası — CitizenTravelApplication'da canCancel
              // alanı hiç yok (backend hesaplamıyor); TravelApplicationsTab'daki aynı mantıkla
              // (durum rejected değil VE iptal son tarihi henüz geçmemiş) burada hesaplanıyor.
              canCancel: a.status !== 'rejected' && (
                a.cancellationDeadlineHours === 0
                  ? true
                  : new Date() < new Date(new Date(a.departureDate).getTime() - a.cancellationDeadlineHours * 3600000)
              ),
            }))}
          onClose={() => setDetail(null)}
          onApplied={() => { setDetail(null); setRefresh((n) => n + 1) }}
          onCancelled={() => { setDetail(null); setRefresh((n) => n + 1) }}
        />
      )}
      {detail?.kind === 'facility' && (
        <FacilityDetailModal
          module={detail.module}
          groupId={detail.groupId}
          existingApplications={(facilityApps ?? [])
            .filter((a) => a.groupId === detail.groupId)
            .map((a) => ({ personName: a.personName, status: a.status, isSelf: a.isSelf }))}
          onClose={() => setDetail(null)}
          onApplied={() => { setDetail(null); setRefresh((n) => n + 1) }}
        />
      )}
      {detail?.kind === 'library' && (
        <LibraryDetailModal
          libraryId={detail.libraryId}
          onClose={() => setDetail(null)}
          onReserved={() => { setDetail(null); setRefresh((n) => n + 1) }}
        />
      )}
    </div>
  )
}


export const ApplicationsAllPage = () => {
  const [tab, setTab] = useState<AppTab>('all')

  return (
    <div className="flex h-full flex-col bg-surface-1">

      <ModuleHeader
        icon={ClipboardListIcon}
        title="Başvurularım"
        subtitle="Aktif başvurularınız"
        gradient="linear-gradient(160deg,#312e81 0%,#4f46e5 55%,#6366f1 100%)"
        tabs={TABS}
        value={tab}
        onValueChange={(key) => setTab(key as AppTab)}
      />

      <div className="flex-1 overflow-y-auto">
        {tab === 'all'      && <AllCombinedTab />}
        {tab === 'event'    && <ApplicationsTab />}
        {tab === 'travel'   && <TravelApplicationsTab />}
        {tab === 'facility' && <FacilityApplicationsTab />}
        {tab === 'library'  && <LibraryReservationsTab />}
      </div>
    </div>
  )
}
