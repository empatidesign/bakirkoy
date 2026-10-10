import { useEffect, useMemo, useState } from 'react'
import {
  ArmchairIcon, CalendarCheckIcon, CalendarDaysIcon, Clock3Icon,
  MapPinIcon, NavigationIcon, UsersIcon,
} from 'lucide-react'
import { Badge, EmptyState, ModuleHeader, SkeletonRows } from '@/design-system'
import { formatDate, todayIso } from '@/lib/utils'
import { DistanceBadge } from '@/components/specialized/DistanceBadge'
import { directionsUrl } from '@/lib/distance'
import type { CitizenApplication, CitizenApplicationStatus } from '@/types/event.types'
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_TONE } from '@/types/event.types'
import eventService from '@/services/event.service'
import planService from '@/services/plan.service'
import type { UpcomingFacilityPlan } from '@/services/plan.service'

interface PlanParticipant {
  displayName: string
  seat: string | null
  statusLabel: string
  statusTone: string
}

interface PlanCard {
  type: 'event' | 'facility'
  key: string
  title: string
  date: string
  timeInfo: string | null
  venueLine: string | null
  mapsQuery: string | null
  latitude?: number | null
  longitude?: number | null
  categoryName?: string
  categoryColor?: string
  participants: PlanParticipant[]
}

interface DateGroup {
  date: string
  label: string
  isToday: boolean
  isTomorrow: boolean
  items: PlanCard[]
}

const PLAN_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#9277f0', '#ec4899', '#3b82f6']

const getPlanColor = (card: PlanCard, index: number): string =>
  card.categoryColor || (card.type === 'facility' ? '#10b981' : PLAN_COLORS[index % PLAN_COLORS.length])

const parseSeatLabel = (raw: string | null): string | null => {
  if (!raw) return null
  const parts = raw.split(':')
  if (parts.length !== 3) return raw
  const rowIdx = parseInt(parts[1], 10)
  const seatNo = parts[2]
  const rowLetter = isNaN(rowIdx) ? parts[1] : String.fromCharCode(65 + rowIdx)
  return `${rowLetter}-${seatNo}`
}

const tomorrowIso = (): string => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const openMaps = (query: string) =>
  window.open(`https://maps.google.com/?q=${encodeURIComponent(query)}`, '_blank')

const extractTime = (timeInfo: string | null): string =>
  timeInfo?.match(/\d{1,2}[:.]\d{2}/)?.[0]?.replace('.', ':') ?? ''

type PlanTab = 'all' | 'event' | 'facility'

export const PlansPage = () => {
  const [eventApps, setEventApps] = useState<CitizenApplication[] | null>(null)
  const [facilityPlans, setFacilityPlans] = useState<UpcomingFacilityPlan[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<PlanTab>('all')

  useEffect(() => {
    let active = true
    const fetchAll = async () => {
      try {
        const [evRes, facRes] = await Promise.all([
          eventService.applications({ scope: 'family', page: 1, limit: 100 }),
          planService.upcomingFacilityPlans(),
        ])
        if (active) { setEventApps(evRes.items); setFacilityPlans(facRes) }
      } catch {
        if (active) { setEventApps([]); setFacilityPlans([]) }
      } finally {
        if (active) setLoading(false)
      }
    }
    void fetchAll()
    return () => { active = false }
  }, [])

  const eventCards = useMemo<PlanCard[]>(() => {
    if (!eventApps) return []
    const today = todayIso()
    const map = new Map<string, PlanCard>()
    for (const a of eventApps) {
      if (a.status === 'rejected' || a.eventDate.slice(0, 10) < today) continue
      const key = `${a.eventId}::${a.sessionId ?? ''}`
      const venueLine = a.facilityName && a.facilityName !== a.venueName ? a.facilityName : a.venueName
      const mapsQuery = [a.venueName, a.facilityName].filter(Boolean).join(' ')
      const participant: PlanParticipant = {
        displayName: a.isSelf ? 'Ben' : a.personName,
        seat: parseSeatLabel(a.seatNumber ?? null),
        statusLabel: APPLICATION_STATUS_LABELS[a.status as CitizenApplicationStatus],
        statusTone: APPLICATION_STATUS_TONE[a.status as CitizenApplicationStatus],
      }
      const existing = map.get(key)
      if (existing) {
        existing.participants.push(participant)
      } else {
        map.set(key, {
          type: 'event', key,
          title: a.eventName || 'Etkinlik',
          date: a.eventDate.slice(0, 10),
          timeInfo: a.sessionLabel ?? null,
          venueLine, mapsQuery,
          latitude: a.latitude, longitude: a.longitude,
          categoryName: a.categoryName,
          categoryColor: a.categoryColor,
          participants: [participant],
        })
      }
    }
    return [...map.values()]
  }, [eventApps])

  const facilityCards = useMemo<PlanCard[]>(() => {
    if (!facilityPlans) return []
    return facilityPlans.map((fp, i) => ({
      type: 'facility' as const,
      key: `fac::${i}::${fp.date}::${fp.title}`,
      title: fp.title,
      date: fp.date.slice(0, 10),
      timeInfo: fp.timeRange,
      venueLine: fp.venueName,
      mapsQuery: fp.venueName,
      latitude: fp.latitude, longitude: fp.longitude,
      participants: fp.participants.map((p) => ({
        displayName: p.isSelf ? 'Ben' : (p.personName ?? ''),
        seat: null,
        statusLabel: 'Aktif Kayıt',
        statusTone: 'success',
      })),
    }))
  }, [facilityPlans])

  const dateGroups = useMemo<DateGroup[]>(() => {
    const combined = [...eventCards, ...facilityCards]
    const all = tab === 'all' ? combined : combined.filter((c) => c.type === tab)
    all.sort((a, b) => a.date.localeCompare(b.date))
    const today = todayIso()
    const tomorrow = tomorrowIso()
    const map = new Map<string, PlanCard[]>()
    for (const item of all) {
      const list = map.get(item.date) ?? []
      list.push(item)
      map.set(item.date, list)
    }
    return [...map.entries()].map(([date, items]) => ({
      date, items,
      isToday: date === today,
      isTomorrow: date === tomorrow,
      label: date === today
        ? 'Bugün'
        : date === tomorrow
        ? 'Yarın'
        : formatDate(date, { weekday: 'long', day: '2-digit', month: 'long' }),
    }))
  }, [eventCards, facilityCards, tab])

  const total = dateGroups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <ModuleHeader
        icon={CalendarCheckIcon}
        title="Planlarım"
        subtitle="Etkinlik ve program takviminiz"
        gradient="linear-gradient(160deg,#0f172a 0%,#1e1b4b 50%,#312e81 100%)"
        tabs={[
          { key: 'all', label: 'Tümü', icon: CalendarCheckIcon },
          { key: 'event', label: 'Etkinlikler', icon: CalendarDaysIcon },
          { key: 'facility', label: 'Programlar', icon: UsersIcon },
        ]}
        value={tab}
        onValueChange={(k) => setTab(k as PlanTab)}
      />

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="px-4 pt-5 space-y-6">
          {loading ? (
            <SkeletonRows rows={4} />
          ) : total === 0 ? (
            <EmptyState
              icon={CalendarCheckIcon}
              title="Yaklaşan plan yok"
              description="Onaylanan etkinlik, program veya rezervasyon bulunduğunda burada görünür."
            />
          ) : (
            dateGroups.map((g) => (
              <section key={g.date}>

                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="flex items-center gap-2 rounded-xl px-3 py-1.5"
                    style={{
                      background: g.isToday
                        ? 'linear-gradient(135deg, #6366f1, #818cf8)'
                        : g.isTomorrow
                        ? '#fff7ed'
                        : '#f0f2ff',
                    }}
                  >
                    {g.isToday && <CalendarCheckIcon className="h-3.5 w-3.5 text-white" />}
                    <span
                      className="text-sm font-bold capitalize"
                      style={{ color: g.isToday ? 'white' : g.isTomorrow ? '#c2410c' : '#4338ca' }}
                    >
                      {g.label}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-surface-2" />
                  <span className="text-xs font-semibold text-foreground-subtle">
                    {g.items.length} plan
                  </span>
                </div>

                <div className="space-y-3">
                  {g.items.map((card, index) => {
                    const color = getPlanColor(card, index)
                    const time = extractTime(card.timeInfo)
                    return (
                      <article
                        key={card.key}
                        className="overflow-hidden rounded-2xl bg-card shadow-sm"
                        style={{ border: '1px solid rgba(0,0,0,0.06)' }}
                      >
                        <div
                          className="flex items-center justify-between px-4 py-2.5"
                          style={{ background: `${color}12`, borderBottom: `1px solid ${color}20` }}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-7 w-7 items-center justify-center rounded-lg"
                              style={{ background: color }}
                            >
                              {card.type === 'facility'
                                ? <UsersIcon className="h-3.5 w-3.5 text-white" />
                                : <CalendarDaysIcon className="h-3.5 w-3.5 text-white" />}
                            </div>
                            <span
                              className="text-xs font-semibold"
                              style={{ color }}
                            >
                              {card.type === 'facility' ? 'Program' : (card.categoryName ?? 'Etkinlik')}
                            </span>
                          </div>
                          {time && (
                            <div className="flex items-center gap-1.5">
                              <Clock3Icon className="h-3.5 w-3.5" style={{ color }} />
                              <span className="text-sm font-bold tabular-nums" style={{ color }}>
                                {time}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="px-4 py-3">
                          <h3 className="text-[15px] font-bold text-foreground-strong leading-snug">{card.title}</h3>

                          {card.venueLine && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (card.latitude != null && card.longitude != null) {
                                    window.open(directionsUrl({ latitude: card.latitude, longitude: card.longitude }), '_blank')
                                    return
                                  }
                                  openMaps(card.mapsQuery ?? card.venueLine!)
                                }}
                                className="flex items-center gap-1.5 text-left min-w-0"
                              >
                                <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-foreground-subtle" />
                                <span className="text-xs text-foreground-muted truncate">{card.venueLine}</span>
                                <NavigationIcon className="h-3 w-3 shrink-0" style={{ color }} />
                              </button>
                              <DistanceBadge
                                distanceOnly
                                className="text-xs"
                                target={card.latitude != null && card.longitude != null ? { latitude: card.latitude, longitude: card.longitude } : null}
                              />
                            </div>
                          )}

                          {card.timeInfo && card.timeInfo !== time && (
                            <p className="mt-1 text-xs text-foreground-subtle">{card.timeInfo}</p>
                          )}
                        </div>

                        <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                          {card.participants.map((p, pi) => (
                            <div
                              key={pi}
                              className="flex items-center justify-between gap-3 px-4 py-2.5"
                              style={pi < card.participants.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.04)' } : undefined}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <div
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                  style={{ background: color }}
                                >
                                  {p.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground-strong truncate">{p.displayName}</p>
                                  {p.seat && (
                                    <p className="flex items-center gap-1 text-xs text-foreground-subtle">
                                      <ArmchairIcon className="h-3 w-3" />
                                      Koltuk {p.seat}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Badge tone={p.statusTone as 'success' | 'warning' | 'danger' | 'info' | 'neutral'}>
                                {p.statusLabel}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
