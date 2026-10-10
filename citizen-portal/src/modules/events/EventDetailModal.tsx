import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import DOMPurify from 'dompurify'
import {
  CalendarDaysIcon, MapPinIcon, NavigationIcon, UsersIcon, ArmchairIcon,
  QrCodeIcon, ChevronDownIcon,
  ClockIcon, TicketIcon, CheckCircle2Icon, AlertCircleIcon, InfoIcon,
  BabyIcon, UserRoundIcon,
} from 'lucide-react'
import { Modal, Button, SkeletonRows, Banner } from '@/design-system'
import { formatDate, todayIso, localDayIso } from '@/lib/utils'
import { DistanceBadge } from '@/components/specialized/DistanceBadge'
import { directionsUrl } from '@/lib/distance'
import type { CitizenEventDetail, CitizenEventSession } from '@/types/event.types'
import { pickEventImage } from '@/types/event.types'
import eventService from '@/services/event.service'
import { toastSuppression } from '@/services/toastSuppression'
import { resolveEventDetailScope } from './eventDetailScope'
import { SeatPickerModal } from './seating/SeatPickerModal'
import { EventCheckInModal } from './EventCheckInModal'

interface Props {
  eventId: string | null
  initialSessionId?: string | null
  onClose: () => void
  onApplied: () => void
}

function CapacityBar({ registered, capacity, reserveCapacity = 0, waitlistCount = 0 }: { registered: number; capacity: number; reserveCapacity?: number; waitlistCount?: number }) {
  const free = Math.max(0, capacity - registered)
  const waitRoom = Math.max(0, reserveCapacity - waitlistCount)
  const pct = capacity > 0 ? Math.min(100, Math.round((registered / capacity) * 100)) : 100
  const color = free > 0 ? (free <= 5 ? '#F59E0B' : '#10B981') : waitRoom > 0 ? '#F59E0B' : '#EF4444'
  const label = free > 0 ? (free <= 5 ? `Son ${free} yer` : `${free} boş yer`) : waitRoom > 0 ? `Yedek: ${waitRoom}` : 'Kontenjan Dolu'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color }}>{label}</span>
        <span className="text-[11px] text-gray-400 font-medium">{registered.toLocaleString('tr-TR')} / {capacity.toLocaleString('tr-TR')} kayıtlı</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}bb, ${color})` }}
        />
      </div>
    </div>
  )
}

function applicantAvatar(a: { isSelf: boolean; age: number; gender: string }) {
  if (a.isSelf) {
    return { Icon: UserRoundIcon, bg: 'linear-gradient(135deg, #6366F1, #8B5CF6)', fg: '#fff' }
  }
  const isChild = a.age > 0 && a.age < 12
  const isFemale = a.gender === 'female'
  const isMale = a.gender === 'male'
  if (isChild) {
    return isFemale
      ? { Icon: BabyIcon, bg: 'linear-gradient(135deg, #FBCFE8, #F9A8D4)', fg: '#9D174D' }
      : isMale
        ? { Icon: BabyIcon, bg: 'linear-gradient(135deg, #BFDBFE, #93C5FD)', fg: '#1E40AF' }
        : { Icon: BabyIcon, bg: 'linear-gradient(135deg, #DDD6FE, #C4B5FD)', fg: '#5B21B6' }
  }
  return isFemale
    ? { Icon: UserRoundIcon, bg: 'linear-gradient(135deg, #EC4899, #F472B6)', fg: '#fff' }
    : isMale
      ? { Icon: UserRoundIcon, bg: 'linear-gradient(135deg, #6366F1, #818CF8)', fg: '#fff' }
      : { Icon: UserRoundIcon, bg: 'linear-gradient(135deg, #A78BFA, #C4B5FD)', fg: '#fff' }
}

export const EventDetailModal = ({ eventId, initialSessionId, onClose, onApplied }: Props) => {
  const [detail, setDetail] = useState<CitizenEventDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [seats, setSeats] = useState<Record<string, { seat: string; label: string }>>({})
  const [seatPickerFor, setSeatPickerFor] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadSignal, setReloadSignal] = useState(0)

  useEffect(() => {
    if (!eventId) { setDetail(null); setSessionId(null); setSelectedIds(new Set()); setSeats({}); setStep(1); setLoadFailed(false); return }
    let active = true
    setLoading(true)
    setLoadFailed(false)
    setSelectedIds(new Set())
    setSeats({})
    setSessionId(null)
    eventService.detail(eventId)
      .then((d) => {
        if (!active) return
        setDetail(d)
        if (initialSessionId && d.sessions.some((s) => s.id === initialSessionId))
          setSessionId(initialSessionId)
      })
      .catch(() => { if (active) { setDetail(null); setLoadFailed(true) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [eventId, initialSessionId, reloadSignal])

  useEffect(() => {
    setSeats({})
    if (detail?.hasSessions && sessionId) {
      const appliedHere = new Set(
        detail.applicants.filter((a) => a.appliedSessionIds.includes(sessionId)).map((a) => a.participantId),
      )
      setSelectedIds((prev) => new Set([...prev].filter((id) => !appliedHere.has(id))))
    }
  }, [sessionId, detail])

  const requiresSeat = !!detail?.requiresSeat
  const seatMode: 'seat' | 'row' = detail?.reservationType === 'row' ? 'row' : 'seat'

  const applicationOpen = detail?.applicationOpen ?? true
  const applicationNotYetOpen = !applicationOpen && !!detail?.applicationStartDate && new Date() < new Date(detail.applicationStartDate)

  const directApproval = detail?.registrationMode !== 'required'
  const selectedSession = detail?.sessions.find((s) => s.id === sessionId) ?? null
  const scopeCapacity = detail?.hasSessions ? (selectedSession?.capacity ?? 0) : (detail?.capacity ?? 0)
  const scopeRegistered = detail?.hasSessions ? (selectedSession?.registeredCount ?? 0) : (detail?.registeredCount ?? 0)
  const scopeWaitRoom = detail?.hasSessions
    ? ((selectedSession?.reserveCapacity ?? 0) - (selectedSession?.waitlistCount ?? 0))
    : ((detail?.reserveCapacity ?? 0) - (detail?.waitlistCount ?? 0))
  const scopeFull = scopeCapacity > 0 && scopeRegistered >= scopeCapacity
  const goesToWaitlist = directApproval && scopeFull && scopeWaitRoom > 0
  const scopeClosed = directApproval && scopeFull && scopeWaitRoom <= 0
  const scopeApplicationClosed = detail?.hasSessions
    ? (selectedSession?.applicationClosed ?? false)
    : (detail?.applicationClosed ?? false)
  const effectiveRequiresSeat = requiresSeat && !goesToWaitlist

  const firstUpcomingSession = detail?.sessions?.find((s) => localDayIso(s.date) >= todayIso()) ?? null
  const scope = detail ? resolveEventDetailScope(detail, sessionId, firstUpcomingSession) : null
  const barSession = scope?.session ?? null
  const barCapacity = scope?.capacity ?? 0
  const barRegistered = scope?.registered ?? 0
  const barReserve = scope?.reserve ?? 0
  const barWaitlist = scope?.waitlist ?? 0
  const sessionApplied = scope?.applied ?? false

  const selected = useMemo(
    () => detail?.applicants.filter((a) => selectedIds.has(a.participantId)) ?? [],
    [detail, selectedIds],
  )
  const takenSeats = useMemo(() => Object.values(seats).map((s) => s.seat), [seats])

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        setSeats((s) => { const copy = { ...s }; delete copy[id]; return copy })
      } else {
        next.add(id)
      }
      return next
    })
  }

  const canApply =
    applicationOpen &&
    selected.length > 0 &&
    (!detail?.hasSessions || !!sessionId) &&
    !scopeClosed &&
    !scopeApplicationClosed &&
    (!effectiveRequiresSeat || selected.every((a) => seats[a.participantId]))

  const apply = async () => {
    if (!detail) return
    if (applying) return
    if (!applicationOpen) {
      toast.warning(applicationNotYetOpen ? 'Başvurular henüz açılmadı.' : 'Başvuru süresi sona erdi.')
      return
    }
    if (detail.hasSessions && !sessionId) { toast.warning('Lütfen bir seans seçin.'); return }
    if (selected.length === 0) { toast.warning('En az bir kişi seçin.'); return }
    if (scopeClosed || scopeApplicationClosed) { toast.warning('Kontenjan ve yedek listesi dolu.'); return }
    if (effectiveRequiresSeat && !selected.every((a) => seats[a.participantId])) { toast.warning('Her kişi için koltuk seçin.'); return }

    toastSuppression.suppress('event', detail.id)

    setApplying(true)
    const results: Array<{ status: string }> = []
    let failedCount = 0
    for (const a of selected) {
      try {
        const res = await eventService.apply(detail.id, {
          sessionId,
          participantId: a.participantId,
          seatNumber: seats[a.participantId]?.seat ?? null,
        })
        results.push({ status: res.status })
      } catch {
        failedCount++
      }
    }
    setApplying(false)

    if (results.length === 0) {
      toast.error(selected.length === 1
        ? 'Başvurunuz alınamadı. Lütfen daha sonra tekrar deneyin.'
        : `${selected.length} kişi için başvuru alınamadı. Lütfen daha sonra tekrar deneyin.`)
      return
    }

    if (failedCount > 0)
      toast.warning(`${failedCount} kişi için başvuru gönderilemedi. Bu kişiler için tekrar deneyin.`)

    {
      // basvuruhitetmeyenkurallar.md (B-kovası, Etkinlik #14c) canlı testte kanıtlandı: API
      // kontenjan+yedek liste dolu olduğunda hata döndürmüyor, 200 + status:"rejected" içeren
      // bir kayıt oluşturuyor (kasıtlı — grup başvurularında kısmi başarı senaryosunu desteklemek
      // için). Ama bu mesaj mantığı "rejected" durumunu HİÇ kontrol etmiyordu — allWaitlist/allPending
      // ikisi de false olduğunda direkt "Başvurunuz onaylandı" diyordu. Sonuç: kontenjan dolduğunda
      // vatandaşa YANLIŞ ONAY MESAJI gösteriliyordu (aslında reddedilmişti). Düzeltme: rejected
      // durumu da ayrıca kontrol ediliyor, karışık sonuçlarda (bazısı onay bazısı red) da doğru
      // özet mesaj gösteriliyor.
      const allRejected = results.every((r) => r.status === 'rejected')
      const allWaitlist = results.every((r) => r.status === 'waitlist')
      const allPending = results.every((r) => r.status === 'pending' || r.status === 'reviewing')
      const anyRejected = results.some((r) => r.status === 'rejected')
      const approvedCount = results.filter((r) => r.status === 'approved').length
      const rejectedCount = results.filter((r) => r.status === 'rejected').length

      if (allRejected) {
        const message = results.length === 1
          ? 'Başvurunuz alınamadı: kontenjan ve yedek listesi dolu.'
          : `${results.length} kişi için başvuru alınamadı: kontenjan ve yedek listesi dolu.`
        toast.error(message)
      } else if (anyRejected) {
        toast.warning(`${approvedCount} kişi için başvuru alındı, ${rejectedCount} kişi için kontenjan dolu olduğundan alınamadı.`)
      } else {
        const message = results.length === 1
          ? (allWaitlist ? 'Yedek listeye alındınız.' : allPending ? 'Başvurunuz alındı, onay bekliyor.' : 'Başvurunuz onaylandı.')
          : (allWaitlist ? `${results.length} kişi yedek listeye alındı.` : allPending ? `${results.length} kişi için başvuru alındı, onay bekliyor.` : `${results.length} kişi için başvuru onaylandı.`)
        toast.success(message)
      }
      setSelectedIds(new Set())
      setSeats({})
      onApplied()
    }
  }

  return (
    <>
      <Modal open={!!eventId} onClose={onClose} title="Etkinlik Detayı" width={480} bodyClassName="p-0">
        {loadFailed && !loading ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <AlertCircleIcon className="h-9 w-9 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700">Etkinlik bilgileri yüklenemedi.</p>
            <p className="text-[12px] text-gray-500">Bağlantınızı kontrol edip tekrar deneyebilirsiniz.</p>
            <Button variant="primary" size="sm" onClick={() => setReloadSignal((n) => n + 1)}>Tekrar dene</Button>
          </div>
        ) : loading || !detail ? (
          <div className="p-5"><SkeletonRows rows={5} /></div>
        ) : (
          <div className="flex flex-col max-h-[80vh]">
            <div className="flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 px-5 pt-4 pb-3">
              {([{ n: 1, label: 'Detaylar' }, { n: 2, label: 'Başvuru' }] as const).map((s, i) => (
                <div key={s.n} className="flex items-center gap-2">
                  {i > 0 && <div className="h-px w-6 bg-gray-200" />}
                  <button
                    type="button"
                    onClick={() => setStep(s.n)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-all"
                    style={step === s.n
                      ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }
                      : { background: '#F3F4F6', color: '#6B7280' }}
                  >
                    <span
                      className="grid h-4 w-4 place-items-center rounded-full text-[10px]"
                      style={step === s.n ? { background: 'rgba(255,255,255,0.25)' } : { background: '#E5E7EB' }}
                    >
                      {s.n}
                    </span>
                    {s.label}
                  </button>
                </div>
              ))}
            </div>
            {(() => {
              const cover = pickEventImage(detail.images, ['4:3', '16:9', '1:1'], null) ?? detail.photos?.[0] ?? null
              return cover ? (
                <div className="relative flex-shrink-0 overflow-hidden" style={{ aspectRatio: '4 / 3' }}>
                  <img src={cover} alt={detail.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  {sessionApplied && (
                    <div
                      className="absolute top-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{ background: 'rgba(220,252,231,0.95)', color: '#15803D' }}
                    >
                      <CheckCircle2Icon className="h-3 w-3" /> Başvuruldu
                    </div>
                  )}
                  <div className="absolute bottom-4 left-5 right-5">
                    <span
                      className="inline-block rounded-full px-3 py-1 text-[11px] font-bold mb-2 shadow-lg"
                      style={{ background: detail.categoryColor, color: '#fff' }}
                    >
                      {detail.categoryName}
                    </span>
                    <h2 className="text-[20px] font-black text-white leading-tight drop-shadow-md">{detail.name}</h2>
                  </div>
                </div>
              ) : (
                <div
                  className="px-5 pt-5 pb-4"
                  style={{ background: `linear-gradient(135deg, ${detail.categoryColor}20 0%, ${detail.categoryColor}08 100%)` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold mb-2"
                        style={{ background: `${detail.categoryColor}18`, color: detail.categoryColor }}
                      >
                        {detail.categoryName}
                      </span>
                      <h2 className="text-base font-black text-gray-900 leading-snug">{detail.name}</h2>
                    </div>
                    {sessionApplied && (
                      <div
                        className="flex-shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                        style={{ background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}
                      >
                        <CheckCircle2Icon className="h-3 w-3" />
                        Başvuruldu
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {step === 1 && (
            <div className="px-5 pt-4">
              <div className="grid grid-cols-2 gap-2.5">
                <div
                  className="flex items-center gap-3 rounded-lg bg-white px-3.5 py-3"
                  style={{ border: '1px solid #E8EAF0', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}
                >
                  <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg" style={{ background: 'rgba(99,102,241,0.1)' }}>
                    <CalendarDaysIcon className="h-[18px] w-[18px] text-indigo-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tarih</p>
                    <p className="text-[13.5px] font-bold text-gray-900">{formatDate(detail.hasSessions ? (barSession?.date ?? detail.startDate) : detail.startDate)}</p>
                    {!detail.isSingleDay && !detail.hasSessions && (
                      <p className="text-[11px] text-gray-500">{formatDate(detail.endDate)}</p>
                    )}
                    {detail.hasSessions && barSession && (
                      <p className="text-[11px] text-gray-500">{barSession.startTime}{barSession.endTime ? `–${barSession.endTime}` : ''}</p>
                    )}
                  </div>
                </div>

                <div
                  className="flex items-center gap-3 rounded-lg bg-white px-3.5 py-3"
                  style={{ border: '1px solid #E8EAF0', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}
                >
                  <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg" style={{ background: 'rgba(139,92,246,0.1)' }}>
                    <TicketIcon className="h-[18px] w-[18px] text-violet-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Kontenjan</p>
                    <p className="text-[13.5px] font-bold text-gray-900">
                      {barRegistered.toLocaleString('tr-TR')} <span className="text-gray-400 font-semibold">/ {barCapacity.toLocaleString('tr-TR')}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="mt-2.5 rounded-lg bg-white px-3.5 py-3"
                style={{ border: '1px solid #E8EAF0', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}
              >
                <CapacityBar registered={barRegistered} capacity={barCapacity} reserveCapacity={barReserve} waitlistCount={barWaitlist} />
              </div>

              {(detail.venueName || detail.facilityName) && (
                <button
                  type="button"
                  onClick={() => {
                    if (detail.latitude != null && detail.longitude != null) {
                      window.open(directionsUrl({ latitude: detail.latitude, longitude: detail.longitude }), '_blank')
                      return
                    }
                    const q = [detail.venueName, detail.facilityName].filter(Boolean).join(' ')
                    window.open(`https://maps.google.com/?q=${encodeURIComponent(q)}`, '_blank')
                  }}
                  className="mt-2.5 flex w-full items-center gap-3 rounded-lg bg-white px-3.5 py-3 text-left hover:bg-gray-50 transition-colors"
                  style={{ border: '1px solid #E8EAF0', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}
                >
                  <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg" style={{ background: 'rgba(244,63,94,0.1)' }}>
                    <MapPinIcon className="h-[18px] w-[18px] text-rose-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Konum</p>
                    {detail.facilityName && detail.facilityName !== detail.venueName ? (
                      <>
                        <p className="text-[13.5px] font-bold text-gray-900">{detail.facilityName}</p>
                        <p className="text-[11px] text-gray-500">{detail.venueName}</p>
                      </>
                    ) : (
                      <p className="text-[13.5px] font-bold text-gray-900">{detail.venueName}</p>
                    )}
                    <DistanceBadge
                      distanceOnly
                      className="mt-0.5"
                      target={detail.latitude != null && detail.longitude != null ? { latitude: detail.latitude, longitude: detail.longitude } : null}
                    />
                  </div>
                  <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-indigo-600 flex-shrink-0" style={{ background: 'rgba(99,102,241,0.08)' }}>
                    <NavigationIcon className="h-3 w-3" /> Yol Tarifi
                  </span>
                </button>
              )}

              {!applicationOpen && (
                <div className="mt-2.5">
                  <Banner tone="warning" variant="soft" icon={ClockIcon}>
                    {applicationNotYetOpen
                      ? `Başvurular ${formatDate(detail.applicationStartDate!)} tarihinde açılacak.`
                      : detail.applicationEndDate
                        ? `Başvuru süresi ${formatDate(detail.applicationEndDate)} tarihinde sona erdi.`
                        : 'Başvuru süresi sona erdi.'}
                  </Banner>
                </div>
              )}

              {(detail.cancellationDeadlineHours ?? 0) > 0 && (
                <div className="mt-2.5 flex items-start gap-2.5 rounded-lg px-3.5 py-3"
                  style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <ClockIcon className="h-4 w-4 flex-shrink-0 text-amber-500 mt-0.5" />
                  <p className="text-[12px] leading-relaxed text-amber-800">
                    Başvurunuzu en geç etkinlik başlangıcından <span className="font-bold">{detail.cancellationDeadlineHours} saat</span> önce iptal edebilirsiniz.
                  </p>
                </div>
              )}
            </div>
            )}

            <div className="px-5 py-4 space-y-5">
              {step === 1 && (<>
              {detail.descriptionHtml && (
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold text-gray-800 flex items-center gap-1.5">
                    <InfoIcon className="h-3.5 w-3.5" />
                    Etkinlik Hakkında
                  </p>
                  <div
                    className="text-[13.5px] text-gray-600 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detail.descriptionHtml) }}
                  />
                </div>
              )}

              {detail.hasSessions && selectedSession && (
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold text-gray-800 flex items-center gap-1.5">
                    <ClockIcon className="h-3.5 w-3.5" />
                    Seans
                  </p>
                  <div
                    className="rounded-lg px-4 py-3"
                    style={{
                      background: `linear-gradient(135deg, ${detail.categoryColor}14, ${detail.categoryColor}06)`,
                      border: `1.5px solid ${detail.categoryColor}40`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {formatDate(selectedSession.date)} · {selectedSession.startTime}–{selectedSession.endTime}
                        </p>
                        {selectedSession.hallName && (
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedSession.hallName}</p>
                        )}
                      </div>
                      <span
                        className="text-[11px] font-bold rounded-full px-2 py-0.5 flex-shrink-0"
                        style={{
                          background: goesToWaitlist ? '#FEF3C7' : scopeFull ? '#FEE2E2' : '#DCFCE7',
                          color: goesToWaitlist ? '#B45309' : scopeFull ? '#B91C1C' : '#15803D',
                        }}
                      >
                        {goesToWaitlist ? `Yedek: ${scopeWaitRoom}` : scopeFull ? 'Dolu' : `${Math.max(0, scopeCapacity - scopeRegistered)} yer`}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              </>)}

              {step === 2 && (<>
              <div className="space-y-2">
                <p className="text-[13px] font-semibold text-gray-800 flex items-center gap-1.5">
                  <UsersIcon className="h-3.5 w-3.5" />
                  Kimler için başvuruyorsunuz?
                </p>
                <div className="space-y-2">
                        {detail.applicants.map((a) => {
                          const appliedHere = detail.hasSessions
                            ? (!!sessionId && a.appliedSessionIds.includes(sessionId))
                            : a.alreadyApplied
                          const limitBlocked = a.limitReached && !appliedHere
                          const disabled = appliedHere || limitBlocked || !a.eligible
                          const isSel = selectedIds.has(a.participantId)

                          const desc = appliedHere
                            ? (detail.hasSessions ? 'Bu seansa başvurdu' : 'Bu etkinliğe başvurdu')
                            : limitBlocked
                              ? 'Bu etkinliğe bu dönemde zaten başvurdu (katılım sınırı)'
                              : !a.eligible
                                ? (a.ineligibleReason ?? 'Bu etkinliğe uygun değil')
                                : `${a.age} yaş · ${a.gender === 'male' ? 'Erkek' : a.gender === 'female' ? 'Kadın' : 'Belirtilmemiş'}`
                          const avatar = applicantAvatar(a)

                          return (
                            <button
                              key={a.participantId}
                              type="button"
                              disabled={disabled}
                              onClick={() => !disabled && toggle(a.participantId)}
                              className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-all"
                              style={{
                                background: isSel
                                  ? 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))'
                                  : '#fff',
                                border: isSel ? '1.5px solid rgba(99,102,241,0.5)' : '1.5px solid rgba(0,0,0,0.08)',
                                opacity: disabled ? 0.55 : 1,
                              }}
                            >
                              <div
                                className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: isSel ? '#6366F1' : 'transparent',
                                  border: isSel ? 'none' : '2px solid #D1D5DB',
                                }}
                              >
                                {isSel && <CheckCircle2Icon className="h-3.5 w-3.5 text-white" />}
                              </div>
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ background: avatar.bg }}
                              >
                                <avatar.Icon className="h-4 w-4" style={{ color: avatar.fg }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-gray-800 truncate">
                                  {a.isSelf ? `${a.fullName} (Ben)` : a.fullName}
                                </p>
                                <p className="text-[11px] text-gray-500 truncate">{desc}</p>
                              </div>
                              {appliedHere && <CheckCircle2Icon className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                              {!a.eligible && !appliedHere && <AlertCircleIcon className="h-4 w-4 text-amber-400 flex-shrink-0" />}
                            </button>
                          )
                        })}
                </div>

                {effectiveRequiresSeat && selected.map((a) => (
                  <div
                    key={a.participantId}
                    className="flex items-center justify-between gap-2 rounded-lg px-4 py-2.5"
                    style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
                  >
                    <span className="text-xs font-medium text-gray-600 inline-flex items-center gap-1.5 min-w-0">
                      <ArmchairIcon className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                      <span className="truncate">
                        <span className="font-semibold text-gray-700">{a.isSelf ? 'Ben' : a.fullName}:</span>{' '}
                        {seats[a.participantId]
                          ? <span className="font-bold text-indigo-700">{seats[a.participantId].label}</span>
                          : <span className="text-gray-400">{seatMode === 'row' ? 'Sıra seçilmedi' : 'Koltuk seçilmedi'}</span>
                        }
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant={seats[a.participantId] ? 'outline' : 'primary'}
                      onClick={() => setSeatPickerFor(a.participantId)}
                    >
                      {seats[a.participantId] ? 'Değiştir' : (seatMode === 'row' ? 'Sıra Seç' : 'Koltuk Seç')}
                    </Button>
                  </div>
                ))}
              </div>
              </>)}

              {step === 1 && detail.attendanceEnabled && sessionApplied && (
                <button
                  type="button"
                  onClick={() => setCheckInOpen(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-3.5 font-semibold text-sm transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'rgba(99,102,241,0.08)',
                    border: '1.5px solid rgba(99,102,241,0.25)',
                    color: '#6366F1',
                    boxShadow: '0 2px 8px rgba(99,102,241,0.08)',
                  }}
                >
                  <QrCodeIcon className="h-4 w-4" />
                  {detail.entryMethod === 'checkin-checkout' ? 'Giriş / Çıkış' : 'Giriş Yap'}
                </button>
              )}

            </div>
            </div>

            <div className="flex-shrink-0 border-t border-gray-100 bg-white px-5 py-4">
              {step === 1 ? (
                applicationOpen ? (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-4 font-bold text-sm text-white transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                    boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
                  }}
                >
                  Başvuruya Devam Et
                  <ChevronDownIcon className="h-4 w-4 -rotate-90" />
                </button>
                ) : (
                <button
                  type="button"
                  disabled
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-4 font-bold text-sm cursor-not-allowed"
                  style={{ background: 'rgba(0,0,0,0.08)', color: '#9CA3AF' }}
                >
                  {applicationNotYetOpen ? 'Başvurular Henüz Açılmadı' : 'Başvuru Süresi Sona Erdi'}
                </button>
                )
              ) : (
              <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-lg border border-gray-200 py-4 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Geri
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={!canApply || applying}
                className="flex-[2] flex items-center justify-center gap-2 rounded-lg py-4 font-bold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: canApply
                    ? `linear-gradient(135deg, #6366F1, #8B5CF6)`
                    : 'rgba(0,0,0,0.12)',
                  boxShadow: canApply ? '0 8px 24px rgba(99,102,241,0.35)' : 'none',
                  color: canApply ? '#fff' : '#9CA3AF',
                }}
              >
                {applying ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Başvuruluyor…
                  </span>
                ) : goesToWaitlist
                  ? (selected.length > 1 ? `${selected.length} Kişi İçin Yedek Listeye Başvur` : 'Yedek Listeye Başvur')
                  : selected.length > 1
                    ? `${selected.length} Kişi İçin Başvur`
                    : 'Başvur'
                }
              </button>
              </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {seatPickerFor && detail && (
        <SeatPickerModal
          open={!!seatPickerFor}
          onClose={() => setSeatPickerFor(null)}
          eventId={detail.id}
          sessionId={sessionId}
          mode={seatMode}
          value={seats[seatPickerFor]?.seat ?? null}
          taken={takenSeats.filter((t) => t !== (seats[seatPickerFor]?.seat ?? ''))}
          onSelect={(seat, label) => setSeats((s) => ({ ...s, [seatPickerFor]: { seat, label } }))}
        />
      )}

      {checkInOpen && detail && (
        <EventCheckInModal
          open={checkInOpen}
          onClose={() => setCheckInOpen(false)}
          detail={detail}
          activeSession={sessionId ? (detail.sessions.find((s) => s.id === sessionId) as CitizenEventSession ?? null) : null}
        />
      )}
    </>
  )
}
