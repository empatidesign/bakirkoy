import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ClipboardListIcon, CalendarDaysIcon, MapPinIcon, ArmchairIcon,
  XCircleIcon, CheckCircle2Icon, ClockIcon, XIcon,
  SearchIcon, SlidersHorizontalIcon, ChevronDownIcon,
} from 'lucide-react'
import { SkeletonRows, ConfirmModal, Banner } from '@/design-system'
import { formatDateTime, isPastDay, todayIso, localDayIso } from '@/lib/utils'
import type { CitizenApplication } from '@/types/event.types'
import { statusMeta, statusLabel } from '@/types/applicationStatus'
import eventService from '@/services/event.service'
import { EventDetailModal } from './EventDetailModal'

interface AppGroup {
  key: string; eventId: string; eventName: string
  categoryName: string; categoryColor: string
  venueName: string; facilityName?: string | null
  sessionLabel?: string | null; eventDate: string
  items: CitizenApplication[]; isPast: boolean; isDeleted: boolean
}
interface CancelTarget { ids: string[]; title: string }
type Period = '' | 'today' | 'week' | 'month' | 'year' | 'custom'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '', label: 'Tümü' },
  { value: 'today', label: 'Bugün' },
  { value: 'week', label: 'Bu Hafta' },
  { value: 'month', label: 'Bu Ay' },
  { value: 'year', label: 'Bu Yıl' },
  { value: 'custom', label: 'Özel' },
]

const parseSeatLabel = (raw: string | null | undefined): string | null => {
  if (!raw) return null
  const parts = raw.split(':')
  if (parts.length !== 3) return raw
  const rowIdx = parseInt(parts[1], 10)
  const rowLetter = isNaN(rowIdx) ? parts[1] : String.fromCharCode(65 + rowIdx)
  return `${rowLetter}-${parts[2]}`
}

const isPastDate = isPastDay
const getDaysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
const canCancelNow = (d: string, hrs: number) =>
  hrs <= 0 ? new Date() < new Date(d) : new Date() < new Date(new Date(d).getTime() - hrs * 3600000)
const deadlineOf = (d: string, hrs: number): Date =>
  hrs <= 0 ? new Date(d) : new Date(new Date(d).getTime() - hrs * 3600000)
const todayStr = () => todayIso()

function statusCfg(status: string): { color: string; bg: string; Icon: React.ComponentType<{ className?: string }> } {
  switch (statusMeta(status).tone) {
    case 'success': return { color: '#16a34a', bg: '#f0fdf4', Icon: CheckCircle2Icon }
    case 'danger':  return { color: '#dc2626', bg: '#fef2f2', Icon: XIcon }
    case 'neutral': return { color: '#94a3b8', bg: '#f1f5f9', Icon: XIcon }
    case 'info':    return { color: '#2563eb', bg: '#eff6ff', Icon: ClockIcon }
    default:        return { color: '#d97706', bg: '#fffbeb', Icon: ClockIcon }
  }
}

export const ApplicationsTab = () => {
  const [apps, setApps] = useState<CitizenApplication[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [period, setPeriod] = useState<Period>('')
  const [customFrom, setCustomFrom] = useState(todayStr())
  const [customTo, setCustomTo] = useState(todayStr())
  const [showCustom, setShowCustom] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [detailEventId, setDetailEventId] = useState<string | null>(null)
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const LIMIT = 20

  const apiPeriod = period === 'custom' ? '' : period

  useEffect(() => {
    let active = true
    setLoading(true); setApps(null); setPage(1); setLoadFailed(false)
    const params: Record<string, unknown> = { scope: 'family', page: 1, limit: LIMIT }
    if (apiPeriod) params.period = apiPeriod
    eventService.applications(params)
      .then((r) => { if (!active) return; setApps(r.items); setHasMore(r.items.length < r.total) })
      .catch(() => { if (active) { setApps([]); setLoadFailed(true) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refresh, apiPeriod])

  const loadMore = async () => {
    const nextPage = page + 1; setLoadingMore(true)
    try {
      const params: Record<string, unknown> = { scope: 'family', page: nextPage, limit: LIMIT }
      if (apiPeriod) params.period = apiPeriod
      const r = await eventService.applications(params)
      setApps((prev) => [...(prev ?? []), ...r.items])
      setPage(nextPage)
      setHasMore((apps?.length ?? 0) + r.items.length < r.total)
    } finally { setLoadingMore(false) }
  }

  const allGroups = useMemo<AppGroup[]>(() => {
    if (!apps) return []
    const map = new Map<string, AppGroup>()
    for (const a of apps) {
      const key = `${a.eventId}::${a.sessionId ?? ''}`
      const ex = map.get(key)
      if (ex) { ex.items.push(a) }
      else map.set(key, {
        key, eventId: a.eventId, eventName: a.eventName,
        categoryName: a.categoryName, categoryColor: a.categoryColor,
        venueName: a.venueName, facilityName: a.facilityName,
        sessionLabel: a.sessionLabel, eventDate: a.eventDate,
        items: [a], isPast: isPastDate(a.eventDate), isDeleted: a.eventDeleted ?? false,
      })
    }
    return [...map.values()]
  }, [apps])

  const categories = useMemo(() => {
    const seen = new Map<string, string>()
    for (const g of allGroups) {
      if (!seen.has(g.categoryName)) seen.set(g.categoryName, g.categoryColor)
    }
    return [...seen.entries()].map(([name, color]) => ({ name, color }))
  }, [allGroups])

  const groups = useMemo(() => {
    return allGroups.filter((g) => {
      if (g.isDeleted) return false
      if (search) {
        const q = search.toLowerCase()
        if (!g.eventName.toLowerCase().includes(q) &&
            !g.categoryName.toLowerCase().includes(q) &&
            !g.venueName?.toLowerCase().includes(q)) return false
      }
      if (categoryFilter && g.categoryName !== categoryFilter) return false
      if (period === 'custom') {
        const d = localDayIso(g.eventDate)
        if (d < customFrom || d > customTo) return false
      }
      return true
    })
  }, [allGroups, search, categoryFilter, period, customFrom, customTo])

  const activeFilterCount = (search ? 1 : 0) + (categoryFilter ? 1 : 0) + (period === 'custom' ? 1 : 0)

  const runCancel = async () => {
    if (!cancelTarget) return
    if (canceling) return
    setCanceling(true)
    let ok = 0
    let failed = 0
    for (const id of cancelTarget.ids) {
      try { await eventService.cancel(id); ok++ } catch { failed++ }
    }
    if (ok > 0) toast.success(ok === 1 ? 'Kayıt iptal edildi.' : `${ok} kayıt iptal edildi.`)
    if (failed > 0)
      toast.error(ok === 0
        ? (failed === 1 ? 'Kayıt iptal edilemedi. İptal süresi dolmuş olabilir.' : 'Kayıtlar iptal edilemedi. İptal süresi dolmuş olabilir.')
        : `${failed} kayıt iptal edilemedi. İptal süresi dolmuş olabilir.`)
    setCanceling(false); setCancelTarget(null); setRefresh((n) => n + 1)
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      <div className="sticky top-0 z-10 bg-white" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>

        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1">
            {PERIOD_OPTIONS.map((o) => (
              <button key={o.value} type="button"
                onClick={() => {
                  setPeriod(o.value)
                  if (o.value === 'custom') setShowCustom(true)
                  else setShowCustom(false)
                }}
                className="flex-shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all"
                style={period === o.value
                  ? { background: '#111827', color: '#fff' }
                  : { background: '#f3f4f6', color: '#6b7280' }
                }
              >
                {o.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="flex-shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all relative"
            style={showFilters || activeFilterCount > 0
              ? { background: '#111827', color: '#fff' }
              : { background: '#f3f4f6', color: '#6b7280' }
            }
          >
            <SlidersHorizontalIcon className="h-3.5 w-3.5" />
            Filtrele
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="px-4 pb-3 space-y-2.5 border-t border-gray-100 pt-2.5">

            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Etkinlik adı, kategori veya mekan ara…"
                className="w-full pl-8 pr-8 py-2 text-[13px] rounded-lg bg-gray-100 border-0 outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {categories.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                <button type="button"
                  onClick={() => setCategoryFilter('')}
                  className="flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-all"
                  style={categoryFilter === ''
                    ? { background: '#111827', color: '#fff' }
                    : { background: '#f3f4f6', color: '#6b7280' }
                  }
                >
                  Tüm kategoriler
                </button>
                {categories.map((c) => (
                  <button key={c.name} type="button"
                    onClick={() => setCategoryFilter(categoryFilter === c.name ? '' : c.name)}
                    className="flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-all"
                    style={categoryFilter === c.name
                      ? { background: c.color, color: '#fff' }
                      : { background: `${c.color}15`, color: c.color }
                    }
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {(period === 'custom' || showCustom) && (
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <CalendarDaysIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input type="date" value={customFrom}
                    onChange={(e) => { setCustomFrom(e.target.value); setPeriod('custom') }}
                    className="w-full pl-8 pr-2 py-2 text-[12px] rounded-lg bg-gray-100 border-0 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <ChevronDownIcon className="h-3 w-3 text-gray-400 rotate-[-90deg]" />
                <div className="flex-1 relative">
                  <CalendarDaysIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input type="date" value={customTo}
                    onChange={(e) => { setCustomTo(e.target.value); setPeriod('custom') }}
                    className="w-full pl-8 pr-2 py-2 text-[12px] rounded-lg bg-gray-100 border-0 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            )}

            {activeFilterCount > 0 && (
              <button type="button"
                onClick={() => { setSearch(''); setCategoryFilter(''); setPeriod(''); setShowCustom(false) }}
                className="text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
              >
                <XIcon className="h-3 w-3" /> Filtreleri temizle
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-4"><SkeletonRows rows={4} /></div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-24 text-center px-6">
          <ClipboardListIcon className="h-8 w-8 text-gray-200" />
          {loadFailed ? (
            <>
              <p className="text-sm font-semibold text-gray-600">Başvurularınız yüklenemedi.</p>
              <p className="text-[12px] text-gray-400">Bağlantınızı kontrol edip tekrar deneyin.</p>
              <button type="button" onClick={() => setRefresh((n) => n + 1)}
                className="text-xs text-indigo-500 font-medium mt-1">
                Tekrar dene
              </button>
            </>
          ) : (
          <p className="text-sm text-gray-400">
            {search || categoryFilter || period ? 'Filtreye uyan başvuru bulunamadı' : 'Başvuru bulunamadı'}
          </p>
          )}
          {(search || categoryFilter) && (
            <button type="button" onClick={() => { setSearch(''); setCategoryFilter('') }}
              className="text-xs text-indigo-500 font-medium mt-1">
              Filtreleri temizle
            </button>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-3 pb-8">
          {groups.map((g) => {
            const deadlineHours = g.items[0]?.cancellationDeadlineHours ?? 0
            const withinDeadline = canCancelNow(g.eventDate, deadlineHours)
            const cancelable = g.isPast || !withinDeadline ? [] : g.items.filter((a) => a.status !== 'rejected')
            const daysUntil = getDaysUntil(g.eventDate)

            return (
              <div
                key={g.key}
                className="bg-white rounded-lg overflow-hidden"
                style={{
                  opacity: g.isPast ? 0.6 : 1,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)',
                }}
              >
                <div
                  className="px-4 pt-3 pb-2.5 flex items-center gap-3"
                  style={{ background: `${g.categoryColor}10`, borderBottom: `1px solid ${g.categoryColor}18` }}
                >
                  <div
                    className="flex-shrink-0 rounded-lg w-12 h-12 flex flex-col items-center justify-center shadow-sm"
                    style={{ background: g.categoryColor }}
                  >
                    <p className="text-[15px] font-bold leading-none text-white">
                      {new Date(g.eventDate).toLocaleDateString('tr-TR', { day: '2-digit' })}
                    </p>
                    <p className="text-[9px] font-semibold uppercase mt-0.5 text-white/80">
                      {new Date(g.eventDate).toLocaleDateString('tr-TR', { month: 'short' })}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span
                      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1"
                      style={{ background: `${g.categoryColor}20`, color: g.categoryColor }}
                    >
                      {g.categoryName}
                    </span>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[14px] font-bold text-gray-900 leading-snug">{g.eventName}</p>
                      {!g.isPast && daysUntil >= 0 && daysUntil <= 7 && (
                        <span className="flex-shrink-0 text-[10px] font-bold rounded-full px-2 py-0.5 bg-amber-500 text-white">
                          {daysUntil === 0 ? 'Bugün' : `${daysUntil}g`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="w-full text-left px-4 pt-2 pb-3 flex flex-wrap items-center gap-2 hover:bg-gray-50/60 transition-colors"
                  onClick={() => { if (!g.isPast) { setDetailEventId(g.eventId); setDetailSessionId(g.items[0]?.sessionId ?? null) } }}
                  style={{ cursor: g.isPast ? 'default' : 'pointer' }}
                >
                  {g.venueName && (
                    <span className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
                      <MapPinIcon className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate max-w-[130px]">
                        {g.facilityName && g.facilityName !== g.venueName
                          ? `${g.venueName} · ${g.facilityName}` : g.venueName}
                      </span>
                    </span>
                  )}
                  {g.sessionLabel && (
                    <span
                      className="flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1"
                      style={{ background: `${g.categoryColor}15`, color: g.categoryColor }}
                    >
                      <CalendarDaysIcon className="h-3 w-3" />{g.sessionLabel}
                    </span>
                  )}
                  {deadlineHours > 0 && !g.isPast && (
                    <span className={`flex items-center gap-1 text-[11px] rounded-full px-2.5 py-1 ${withinDeadline ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-500 font-medium'}`}>
                      <ClockIcon className="h-3 w-3" />
                      {withinDeadline ? `İptal: ${formatDateTime(deadlineOf(g.eventDate, deadlineHours))}` : 'İptal süresi doldu'}
                    </span>
                  )}
                </button>

                {g.items.length > 0 && (
                  <div className="mx-4 mb-3 rounded-lg overflow-hidden bg-gray-50">
                    {g.items.map((a, i) => {
                      const seatLabel = parseSeatLabel(a.seatNumber)
                      const canCancel = !g.isPast && withinDeadline && a.status !== 'rejected'
                      const sc = statusCfg(a.status)
                      const StatusIcon = sc.Icon
                      return (
                        <div key={a.id} style={i > 0 ? { borderTop: '1px solid rgba(0,0,0,0.04)' } : {}}>
                        <div className="flex items-center gap-2.5 px-3 py-2.5">
                          <div
                            className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ background: a.isSelf ? g.categoryColor : '#ec4899' }}
                          >
                            {a.isSelf ? 'B' : (a.personName?.[0] ?? '?')}
                          </div>
                          <p className="flex-1 text-xs font-medium text-gray-700 truncate">
                            {a.isSelf ? 'Ben' : a.personName}
                            {seatLabel && (
                              <span className="ml-2 text-[10px] text-gray-400 font-normal inline-flex items-center gap-0.5">
                                <ArmchairIcon className="h-2.5 w-2.5" /> {seatLabel}
                              </span>
                            )}
                          </p>
                          <span
                            className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium"
                            style={{ background: sc.bg, color: sc.color }}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusLabel(a.status)}
                          </span>
                          {canCancel && (
                            <button type="button"
                              className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors"
                              onClick={() => setCancelTarget({ ids: [a.id], title: `${a.isSelf ? 'Ben' : a.personName} · ${g.eventName}` })}
                            >
                              <XIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {a.status === 'rejected' && a.rejectionReason && (
                          <Banner variant="soft" tone="danger" className="mx-3 mb-2.5">
                            {a.rejectionReason}
                          </Banner>
                        )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {cancelable.length >= 2 && (
                  <div className="px-4 pb-3 flex justify-end">
                    <button type="button"
                      className="flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors"
                      onClick={() => setCancelTarget({ ids: cancelable.map((a) => a.id), title: `${g.eventName} · ${cancelable.length} kişi` })}
                    >
                      <XCircleIcon className="h-3.5 w-3.5" /> Tümünü iptal et
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {hasMore && (
            <button type="button" onClick={loadMore} disabled={loadingMore}
              className="w-full py-2.5 text-[13px] font-medium text-gray-400 hover:text-gray-600 bg-white rounded-lg transition-colors"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' }}
            >
              {loadingMore ? 'Yükleniyor…' : 'Daha fazla göster'}
            </button>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!cancelTarget} onClose={() => setCancelTarget(null)}
        onConfirm={runCancel} title="Kaydı iptal et"
        description={`${cancelTarget?.title ?? ''} için başvuru iptal edilecek. Emin misiniz?`}
        confirmLabel="İptal Et" tone="danger" loading={canceling}
      />
      <EventDetailModal
        eventId={detailEventId} initialSessionId={detailSessionId}
        onClose={() => { setDetailEventId(null); setDetailSessionId(null) }}
        onApplied={() => { setDetailEventId(null); setDetailSessionId(null); setRefresh((n) => n + 1) }}
      />
    </div>
  )
}
