import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ClipboardListIcon, MapPinIcon, ArmchairIcon, BusIcon,
  XCircleIcon, ClockIcon, UserIcon, XIcon, CheckCircle2Icon, UsersIcon, AlertCircleIcon, CalendarDaysIcon,
} from 'lucide-react'
import { SkeletonRows, ConfirmModal, Banner } from '@/design-system'
import { formatDate, formatDateTime, isPastDay } from '@/lib/utils'
import type { CitizenTravelApplication } from '@/types/travel.types'
import { statusTone, statusLabel } from '@/types/applicationStatus'
import travelService from '@/services/travel.service'
import { TravelDetailModal } from './TravelDetailModal'

const LIMIT = 20
const isPastDate = isPastDay
const getDaysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)

const PERIOD_OPTIONS = [
  { value: '', label: 'Tümü' },
  { value: 'today', label: 'Bugün' },
  { value: 'week', label: 'Bu Hafta' },
  { value: 'month', label: 'Bu Ay' },
  { value: 'year', label: 'Bu Yıl' },
]

interface AppGroup {
  key: string; travelName: string; categoryName: string; categoryColor: string
  destination: string; departureDate: string; returnDate: string; guideName?: string | null
  isPast: boolean; isDeleted: boolean; items: CitizenTravelApplication[]
}
interface CancelTarget { ids: string[]; title: string }

const isCancelable = (a: CitizenTravelApplication) => a.status !== 'rejected'
const canCancelNow = (dep: string, hrs: number) => {
  if (hrs === 0) return true
  return new Date() < new Date(new Date(dep).getTime() - hrs * 3600000)
}
const deadlineOf = (dep: string, hrs: number): Date | null =>
  hrs === 0 ? null : new Date(new Date(dep).getTime() - hrs * 3600000)

function statusCfg(tone: string): { color: string; bg: string; Icon: React.ComponentType<{ className?: string }> } {
  if (tone === 'success') return { color: '#16a34a', bg: '#f0fdf4', Icon: CheckCircle2Icon }
  if (tone === 'warning') return { color: '#d97706', bg: '#fffbeb', Icon: ClockIcon }
  if (tone === 'danger')  return { color: '#dc2626', bg: '#fef2f2', Icon: XIcon }
  if (tone === 'info')    return { color: '#2563eb', bg: '#eff6ff', Icon: UsersIcon }
  return { color: '#94a3b8', bg: '#f1f5f9', Icon: AlertCircleIcon }
}

export const TravelApplicationsTab = () => {
  const [apps, setApps] = useState<CitizenTravelApplication[]>([])
  const [loadFailed, setLoadFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [detailTravelId, setDetailTravelId] = useState<string | null>(null)

  useEffect(() => {
    let active = true; setLoading(true); setApps([]); setPage(1)
    travelService.applications({ scope: 'family', page: 1, limit: LIMIT, period: period || undefined })
      .then((r) => { if (!active) return; setApps(r.items); setHasMore(r.items.length === LIMIT && r.total > LIMIT); setPage(2) })
      .catch(() => { if (active) { setApps([]); setLoadFailed(true) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [period, refresh])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const r = await travelService.applications({ scope: 'family', page, limit: LIMIT, period: period || undefined })
      setApps((p) => [...p, ...r.items])
      setHasMore(r.items.length === LIMIT && apps.length + r.items.length < r.total)
      setPage((p) => p + 1)
    } catch { void 0 } finally { setLoadingMore(false) }
  }

  const groups = useMemo<AppGroup[]>(() => {
    const map = new Map<string, AppGroup>()
    for (const a of apps) {
      const ex = map.get(a.travelId)
      if (ex) { ex.items.push(a) }
      else map.set(a.travelId, {
        key: a.travelId, travelName: a.travelName,
        categoryName: a.categoryName, categoryColor: a.categoryColor,
        destination: a.destination, departureDate: a.departureDate, returnDate: a.returnDate, guideName: a.guideName,
        isPast: isPastDate(a.departureDate), isDeleted: a.travelDeleted ?? false, items: [a],
      })
    }
    return [...map.values()]
  }, [apps])

  const detailGroup = detailTravelId ? groups.find((g) => g.key === detailTravelId) ?? null : null
  const detailExistingApplications = useMemo(() => {
    if (!detailGroup) return undefined
    const deadlineHours = detailGroup.items[0]?.cancellationDeadlineHours ?? 0
    return detailGroup.items.map((a) => ({
      id: a.id,
      personName: a.personName,
      isSelf: a.isSelf,
      status: a.status,
      canCancel: !detailGroup.isPast && isCancelable(a) && canCancelNow(detailGroup.departureDate, deadlineHours),
    }))
  }, [detailGroup])

  const runCancel = async () => {
    if (!cancelTarget) return
    if (canceling) return
    setCanceling(true)
    let ok = 0
    let failed = 0
    for (const id of cancelTarget.ids) {
      try { await travelService.cancel(id); ok++ } catch { failed++ }
    }
    if (ok > 0) toast.success(ok === 1 ? 'Kayıt iptal edildi.' : `${ok} kayıt iptal edildi.`)
    if (failed > 0)
      toast.error(ok === 0
        ? (failed === 1 ? 'Kayıt iptal edilemedi. İptal süresi dolmuş olabilir.' : 'Kayıtlar iptal edilemedi. İptal süresi dolmuş olabilir.')
        : `${failed} kayıt iptal edilemedi. Listeyi kontrol edin.`)
    setCanceling(false); setCancelTarget(null); setRefresh((n) => n + 1)
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="sticky top-0 z-10 bg-white px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar"
        style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        {PERIOD_OPTIONS.map((opt) => (
          <button key={opt.value} type="button" onClick={() => setPeriod(opt.value)}
            className="flex-shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all"
            style={period === opt.value
              ? { background: '#111827', color: '#fff' }
              : { background: 'transparent', color: '#9ca3af' }
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-4"><SkeletonRows rows={4} /></div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-24 text-center">
          <ClipboardListIcon className="h-8 w-8 text-gray-200" />
          <p className="text-sm text-gray-400">{loadFailed ? 'Başvurularınız yüklenemedi' : 'Başvuru bulunamadı'}</p>
        </div>
      ) : (
        <div className="p-4 space-y-3 pb-8">
          {groups.map((g) => {
            if (g.isDeleted) return null
            const deadlineHours = g.items[0]?.cancellationDeadlineHours ?? 0
            const cancelable = g.isPast ? [] : g.items.filter(isCancelable)
            const withinDeadline = canCancelNow(g.departureDate, deadlineHours)
            const cancelableNow = cancelable.filter(() => withinDeadline)
            const dl = deadlineOf(g.departureDate, deadlineHours)
            const daysUntil = getDaysUntil(g.departureDate)

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
                      {new Date(g.departureDate).toLocaleDateString('tr-TR', { day: '2-digit' })}
                    </p>
                    <p className="text-[9px] font-semibold uppercase mt-0.5 text-white/80">
                      {new Date(g.departureDate).toLocaleDateString('tr-TR', { month: 'short' })}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    {g.categoryName && (
                      <span
                        className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1"
                        style={{ background: `${g.categoryColor}20`, color: g.categoryColor }}
                      >
                        {g.categoryName}
                      </span>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[14px] font-bold text-gray-900 leading-snug">{g.travelName || 'Gezi'}</p>
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
                  onClick={() => !g.isPast && setDetailTravelId(g.key)}
                  style={{ cursor: g.isPast ? 'default' : 'pointer' }}
                >
                  <span className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
                    <MapPinIcon className="h-3 w-3" />{g.destination}
                  </span>
                  {/* Kullanıcı isteği (2026-08-05): aynı geziye (rota) ait farklı tarihli seferleri
                      birbirinden ayırt edebilmek için gidiş–dönüş tarih aralığı burada da gösterilir. */}
                  <span className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
                    <CalendarDaysIcon className="h-3 w-3" />
                    {formatDate(g.departureDate)}
                    {new Date(g.returnDate).toDateString() !== new Date(g.departureDate).toDateString() && (
                      <span> – {formatDate(g.returnDate)}</span>
                    )}
                  </span>
                  {g.guideName && (
                    <span className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
                      <UserIcon className="h-3 w-3" />{g.guideName}
                    </span>
                  )}
                  {cancelable.length > 0 && !g.isPast && dl && (
                    <span className={`flex items-center gap-1 text-[11px] rounded-full px-2.5 py-1 ${withinDeadline ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-500 font-medium'}`}>
                      <ClockIcon className="h-3 w-3" />
                      {withinDeadline ? `İptal: ${formatDateTime(dl)}` : 'İptal süresi doldu'}
                    </span>
                  )}
                </button>

                {g.items.length > 0 && (
                  <div className="mx-4 mb-3 rounded-lg overflow-hidden bg-gray-50">
                    {g.items.map((a, i) => {
                      const canCancel = isCancelable(a)
                      const allowed = canCancelNow(g.departureDate, a.cancellationDeadlineHours)
                      const sc = statusCfg(statusTone(a.status))
                      const StatusIcon = sc.Icon
                      return (
                        <div key={a.id} className="flex items-center gap-2.5 px-3 py-2.5"
                          style={i > 0 ? { borderTop: '1px solid rgba(0,0,0,0.04)' } : {}}>
                          <div
                            className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ background: a.isSelf ? '#0d9488' : '#3b82f6' }}
                          >
                            {a.isSelf ? 'B' : (a.personName?.[0] ?? '?')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">{a.isSelf ? 'Ben' : a.personName}</p>
                            {(a.seatNumber || a.busName || (a.hasCompanion && a.companionCount)) && (
                              <p className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                                {a.seatNumber && <span className="flex items-center gap-0.5"><ArmchairIcon className="h-3 w-3" /> Koltuk {a.seatNumber}</span>}
                                {a.busName && <span className="flex items-center gap-0.5"><BusIcon className="h-3 w-3" /> {a.busName}{a.plateNumber ? ` (${a.plateNumber})` : ''}</span>}
                                {a.hasCompanion && !!a.companionCount && (
                                  <span className="flex items-center gap-0.5"><UsersIcon className="h-3 w-3" /> {a.companionCount} refakatçi</span>
                                )}
                              </p>
                            )}
                            {a.status === 'rejected' && a.rejectionReason && (
                              <Banner variant="soft" tone="danger" className="mt-1.5">
                                {a.rejectionReason}
                              </Banner>
                            )}
                          </div>
                          <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium"
                            style={{ background: sc.bg, color: sc.color }}>
                            <StatusIcon className="h-3 w-3" />{statusLabel(a.status)}
                          </span>
                          {canCancel && !g.isPast && (
                            <button type="button" disabled={!allowed} title={allowed ? undefined : 'İptal süresi doldu'}
                              className="flex-shrink-0 text-gray-300 hover:text-red-400 disabled:opacity-30 transition-colors"
                              onClick={() => setCancelTarget({ ids: [a.id], title: `${a.isSelf ? 'Ben' : a.personName} · ${g.travelName}` })}>
                              <XIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {cancelableNow.length >= 2 && (
                  <div className="px-4 pb-3 flex justify-end">
                    <button type="button"
                      className="flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors"
                      onClick={() => setCancelTarget({ ids: cancelableNow.map((a) => a.id), title: `${g.travelName} · ${cancelableNow.length} kişi` })}>
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
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' }}>
              {loadingMore ? 'Yükleniyor…' : 'Daha fazla göster'}
            </button>
          )}
        </div>
      )}

      <ConfirmModal open={!!cancelTarget} onClose={() => setCancelTarget(null)} onConfirm={runCancel}
        title="Kaydı iptal et"
        description={`${cancelTarget?.title ?? ''} için başvuru iptal edilecek. Emin misiniz?`}
        confirmLabel="İptal Et" tone="danger" loading={canceling} />
      <TravelDetailModal travelId={detailTravelId} onClose={() => setDetailTravelId(null)}
        onApplied={() => { setDetailTravelId(null); setRefresh((n) => n + 1) }}
        existingApplications={detailExistingApplications}
        onCancelled={() => { setDetailTravelId(null); setRefresh((n) => n + 1) }} />
    </div>
  )
}
