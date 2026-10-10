import { useEffect, useMemo, useState } from 'react'
import { Icon2D } from '@/components/Icon2D'
import { toast } from 'sonner'
import { createPortal } from 'react-dom'
import DOMPurify from 'dompurify'
import {
  MapPinIcon, CalendarDaysIcon, UsersIcon, BusIcon, ArmchairIcon,
  UserPlusIcon, Loader2Icon, UserIcon, ClockIcon, XIcon, CheckIcon,
  ChevronRightIcon, XCircleIcon, CheckCircle2Icon, AlertCircleIcon, BabyIcon,
} from 'lucide-react'
import {
  Badge, SkeletonRows, Banner, Field, ReadonlyField,
  TcknInput, isValidTckn, PhoneInput, EmailInput, isValidEmail, DatePicker, ConfirmModal, Checkbox,
  Modal, Button, EmptyState,
} from '@/design-system'
import { formatDate, todayIso as localTodayIso } from '@/lib/utils'
import { DistanceBadge } from '@/components/specialized/DistanceBadge'
import type { CitizenTravelApplication, CitizenTravelDetail, CitizenReservationPassenger, CitizenTravelGuest } from '@/types/travel.types'
import type { CitizenFamilyNviPreview } from '@/types/family.types'
import familyService from '@/services/family.service'
import { TRAVEL_SEAT_TAKEN, emptyTravelGuest } from '@/types/travel.types'
import { GENDER_LABEL } from '@/types/facility.types'
import { statusTone, statusLabel } from '@/types/applicationStatus'
import travelService from '@/services/travel.service'
import { TravelSeatPicker } from './TravelSeatPicker'
import { getBusTemplate, getAdjacentLabels } from './busSeatModel'
import { TravelSuccessModal } from './TravelSuccessModal'

interface Props {
  travelId: string | null
  onClose: () => void
  onApplied: () => void
  activeApplications?: CitizenTravelApplication[]
  /** "Başvurularım" listesinden açıldığında: bu geziye ait mevcut başvurular (durum + iptal bilgisi). */
  existingApplications?: Array<{ id: string; personName: string; isSelf: boolean; status: string; canCancel: boolean }>
  onCancelled?: () => void
}

interface GuestIdentity {
  fullName: string
  gender: 'male' | 'female'
}

const GUEST_KEY = '__guest__'
const GENDER_COLOR: Record<'male' | 'female', string> = { male: '#3b82f6', female: '#ec4899' }
const normalizeGender = (g: unknown): 'male' | 'female' => (String(g).toLowerCase().startsWith('f') ? 'female' : 'male')
const todayIso = (): string => localTodayIso()
const freeSeatCount = (seats: { status: string }[]): number => seats.filter((s) => !TRAVEL_SEAT_TAKEN.has(s.status)).length
const guestContactValid = (g: CitizenTravelGuest): boolean => g.phone.replace(/\D/g, '').length >= 10 && isValidEmail(g.email)

export const TravelDetailModal = ({ travelId, onClose, onApplied, activeApplications, existingApplications, onCancelled }: Props) => {
  const [detail, setDetail] = useState<CitizenTravelDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [guest, setGuest] = useState<CitizenTravelGuest>(emptyTravelGuest())
  const [guestIdentity, setGuestIdentity] = useState<GuestIdentity | null>(null)
  const [guestLookingUp, setGuestLookingUp] = useState(false)
  const [guestError, setGuestError] = useState<string | null>(null)
  const [busId, setBusId] = useState<string | null>(null)
  const [seats, setSeats] = useState<Record<string, string>>({})
  const [seatPickerFor, setSeatPickerFor] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [reloadSignal, setReloadSignal] = useState(0)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<Parameters<typeof TravelSuccessModal>[0]['data']>(null)
  const [cancelTarget, setCancelTarget] = useState<{ id: string; title: string } | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [guestFormOpen, setGuestFormOpen] = useState(false)
  const [companionCount, setCompanionCount] = useState(0)
  // Kullanıcı isteği (2026-08-04): refakatçi artık isimsiz bir sayı olamaz — koltuklu gezide
  // yan koltuğa oturan kişinin kimliği (ad-soyad + cinsiyet) koltuk haritasında görünmeli.
  const [companionName, setCompanionName] = useState('')
  const [companionGender, setCompanionGender] = useState<'male' | 'female' | ''>('')

  // Kullanıcı isteği (2026-08-07, senaryo 4): otobüslü gezilerde çocuk getirme ayrı bir admin
  // ayarıdır (detail.allowChildren) — açıksa ve kullanıcının hesabında hiç çocuk kaydı yoksa,
  // NVI kütüğünden çocuklarını çekip bu geziye ekleyebilmesi için modal içinden kısayol sunulur.
  const [nviChildrenOpen, setNviChildrenOpen] = useState(false)
  const [nviChildrenLoading, setNviChildrenLoading] = useState(false)
  const [nviChildrenPreview, setNviChildrenPreview] = useState<CitizenFamilyNviPreview | null>(null)
  const [nviCheckedTckns, setNviCheckedTckns] = useState<Set<string>>(new Set())
  const [nviConfirming, setNviConfirming] = useState(false)

  useEffect(() => {
    if (!travelId) {
      setDetail(null); setSelectedIds(new Set()); setBusId(null); setSeats({})
      setGuest(emptyTravelGuest()); setGuestIdentity(null); setGuestError(null)
      setGuestFormOpen(false)
      setCompanionCount(0)
      setCompanionName(''); setCompanionGender('')
      return
    }
    let active = true
    setLoading(true)
    setSelectedIds(new Set()); setBusId(null); setSeats({})
    setGuest(emptyTravelGuest()); setGuestIdentity(null); setGuestError(null)
    setGuestFormOpen(false)
    setCompanionCount(0)
    setCompanionName(''); setCompanionGender('')
    travelService.detail(travelId)
      .then((d) => { if (active) { setDetail(d); if (d.buses.length === 1) setBusId(d.buses[0].busId) } })
      .catch(() => { if (active) { setDetail(null); setLoadFailed(true) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [travelId, reloadSignal])

  useEffect(() => { setSeats({}) }, [busId])

  const guestTcknValid = isValidTckn(guest.tckn)
  useEffect(() => {
    setGuestIdentity(null); setGuestError(null)
    if (!guestTcknValid || !guest.birthDate) return
    let active = true
    setGuestLookingUp(true)
    travelService.guestLookup(guest.tckn, guest.birthDate)
      .then((r) => { if (active) setGuestIdentity({ fullName: r.fullName, gender: normalizeGender(r.gender) }) })
      .catch((err) => {
        if (!active) return
        const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        setGuestError(message || 'Kimlik bilgileri doğrulanamadı. T.C. ve doğum tarihini kontrol edin.')
      })
      .finally(() => { if (active) setGuestLookingUp(false) })
    return () => { active = false }
  }, [guestTcknValid, guest.tckn, guest.birthDate])

  const requiresSeat = !!detail?.requiresSeat
  const selectedBus = detail?.buses.find((b) => b.busId === busId) ?? null
  const hasVehicles = !!detail && detail.buses.length > 0
  const selected = useMemo(() => detail?.applicants.filter((a) => selectedIds.has(a.participantId)) ?? [], [detail, selectedIds])

  const guestActive = !!guestIdentity && guestContactValid(guest)
  const patchGuest = (p: Partial<CitizenTravelGuest>) => setGuest((g) => ({ ...g, ...p }))
  const maxGroupSize = detail?.maxGroupSize ?? 5

  // Kullanıcı isteği (2026-08-07, senaryo 4): bu geziye çocuk katılımı açık mı ve hesapta
  // hiç çocuk kaydı yok mu — ikisi de doğruysa "NVI'den çocuklarını getir" kısayolu gösterilir.
  const childrenAllowed = !!detail?.allowChildren
  const hasNoChildrenOnAccount = !!detail && detail.applicants.every((a) => a.isSelf)
  const childAgeLabel = detail ? `${detail.childMinAge ?? 0}-${detail.childMaxAge ?? 17} yaş` : ''
  const childGenderLabel = detail?.childGenderMode === 'male' ? ', erkek çocuk'
    : detail?.childGenderMode === 'female' ? ', kız çocuk' : ''

  const openNviChildrenModal = async () => {
    setNviChildrenOpen(true)
    setNviChildrenLoading(true)
    setNviChildrenPreview(null)
    setNviCheckedTckns(new Set())
    try {
      const preview = await familyService.previewFromNvi()
      setNviChildrenPreview(preview)
      setNviCheckedTckns(new Set(preview.children.filter((c) => !c.alreadyAdded).map((c) => c.tckn)))
    } catch {
      toast.error('Nüfus kayıtlarından aile üyeleri alınamadı.')
      setNviChildrenOpen(false)
    } finally {
      setNviChildrenLoading(false)
    }
  }

  const toggleNviChild = (tckn: string) => {
    setNviCheckedTckns((prev) => {
      const next = new Set(prev)
      if (next.has(tckn)) next.delete(tckn)
      else next.add(tckn)
      return next
    })
  }

  const confirmNviChildren = async () => {
    if (nviCheckedTckns.size === 0) { toast.error('En az bir çocuk seçmelisiniz.'); return }
    setNviConfirming(true)
    try {
      const result = await familyService.confirmFromNvi([...nviCheckedTckns])
      toast.success(result.newlyAdded > 0 ? `${result.newlyAdded} çocuk eklendi.` : 'Seçilen çocuklar zaten kayıtlı.')
      setNviChildrenOpen(false)
      setReloadSignal((n) => n + 1)
    } catch {
      toast.error('Çocuklar eklenirken bir hata oluştu.')
    } finally {
      setNviConfirming(false)
    }
  }

  const alreadyHasApplication = !!existingApplications && existingApplications.length > 0
  // Kullanıcı isteği (2026-08-04): backend'deki GUARDIAN_CONSENT_REQUIRED kuralı yalnızca GİRİŞ
  // YAPAN kişinin kendisi (isSelf) reşit değilse ve kendi adına başvuruyorsa tetiklenir
  // (ParticipantTravelService.EnforceTravelRestrictions → isSelfApplicant). Veli kendi hesabından
  // çocuğunu seçtiğinde bu kural HİÇ devreye girmiyor (canlı testle doğrulandı: veli+çocuk
  // rezervasyonu refakatçi alanı olmadan, ikisi de gerçek kayıtla başarıyla oluşuyor). Önceden
  // burada "listede reşit olmayan biri var mı" bakılıyordu — bu, veli zaten kendi gerçek
  // katılımcı kaydıyla ("Ben") listede seçiliyken bile anlamsız bir "refakatçi sayısı" alanı
  // zorunlu kılıyordu; oysa aile kütüğünden gelen gerçek kişi zaten kayıtlı, isimsiz bir sayaca
  // gerek yok. Alan artık yalnızca çocuk kendi hesabıyla giriş yapıp kendi adına (isSelf) tek
  // başına başvurduğunda gösteriliyor.
  // Kullanıcı bulgusu (2026-08-09): alan yalnızca `isSelf` (çocuk kendi hesabından girmiş)
  // durumunda gösteriliyordu; veli kendi hesabından çocuğunu seçtiğinde refakatçi bloğu HİÇ
  // render edilmiyor, "18 yaş altı için aktif ama ekleme yapılamıyor" semptomu buradan geliyordu.
  // Artık seçili herhangi bir 18 yaş altı yolcu refakatçi alanını açar.
  const selectedMinor = selected.find((a) => a.age < 18) ?? null
  // Reşit bir yolcu (çoğunlukla velinin kendisi) zaten rezervasyondaysa refakatçi ZORUNLU değil,
  // opsiyoneldir; kimse eşlik etmiyorsa (çocuk tek başına) zorunlu kalır.
  const adultPresent = selected.some((a) => a.age >= 18)
  const companionRequired = !!selectedMinor && !adultPresent
  const hasCompanion = !!selectedMinor && companionCount > 0
  const conflictingApplications = useMemo(() => {
    if (!detail || selected.length === 0) return [] as CitizenTravelApplication[]
    const sameDepartureDay = (value: string) => value.slice(0, 10) === detail.departureDate.slice(0, 10)
    const selectedParticipantIds = new Set(selected.map((a) => a.participantId))
    return (activeApplications ?? []).filter((a) =>
      selectedParticipantIds.has(a.personId) &&
      a.travelId !== detail.id &&
      sameDepartureDay(a.departureDate),
    )
  }, [activeApplications, detail, selected])

  const toggle = (id: string) => {
    const applicant = detail?.applicants.find((a) => a.participantId === id)
    const selfApplicant = detail?.applicants.find((a) => a.isSelf)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const dropSeat = (pid: string) => setSeats((s) => { const c = { ...s }; delete c[pid]; return c })
      if (next.has(id)) {
        next.delete(id)
        dropSeat(id)
        if (applicant?.isSelf) {
          detail?.applicants.forEach((a) => {
            if (a.requiresGuardian && next.has(a.participantId)) { next.delete(a.participantId); dropSeat(a.participantId) }
          })
        }
      } else {
        const selfPresent = !!selfApplicant && (next.has(selfApplicant.participantId) || selfApplicant.alreadyApplied)
        if (applicant?.requiresGuardian && !selfPresent) {
          toast.warning('Çocuğunuz yalnızca sizinle (uygun ebeveyn) birlikte katılabilir. Önce kendinizi seçin veya bu geziye kendiniz başvurun.')
          return prev
        }
        const currentTotal = next.size + (guestActive ? 1 : 0)
        if (currentTotal >= maxGroupSize) {
          toast.warning(`Bu geziye tek rezervasyonda en fazla ${maxGroupSize} kişi ekleyebilirsiniz.`)
          return prev
        }
        next.add(id)
      }
      return next
    })
  }

  const runCancel = async () => {
    if (!cancelTarget) return
    setCanceling(true)
    try {
      await travelService.cancel(cancelTarget.id)
      toast.success('Kayıt iptal edildi.')
      setCancelTarget(null)
      onCancelled?.()
    } catch {
      toast.error('İptal işlemi başarısız oldu.')
    } finally {
      setCanceling(false)
    }
  }

  const scopeFull = !!detail && detail.capacity > 0 && detail.registeredCount >= detail.capacity
  const waitRoom = (detail?.reserveCapacity ?? 0) - (detail?.waitlistCount ?? 0)
  const goesToWaitlist = scopeFull && waitRoom > 0
  const scopeClosed = scopeFull && waitRoom <= 0
  const effectiveRequiresSeat = requiresSeat && !goesToWaitlist && (!selectedBus || selectedBus.vehicleType !== 'capacity')
  const effectiveRequiresVehicle = hasVehicles && !goesToWaitlist

  // Kullanıcı isteği (2026-08-04): koltuklu (otobüslü) gezilerde refakatçi sayısı sabit 1'dir
  // (yalnızca yan koltuğa oturabilir, backend zaten bunu zorunlu kılıyor). Bu yüzden reşit
  // olmayan katılımcı seçiliyken alanı elle girdirmek yerine otomatik 1'e sabitliyoruz.
  useEffect(() => {
    if (companionRequired && effectiveRequiresSeat && companionCount !== 1) setCompanionCount(1)
  }, [companionRequired, effectiveRequiresSeat, companionCount])

  const hasConflict = conflictingApplications.length > 0
  const passengerCount = selected.length + (guestActive ? 1 : 0)
  const allSeated = !effectiveRequiresSeat || (
    !!busId &&
    selected.every((a) => seats[a.participantId]) &&
    (!guestActive || !!seats[GUEST_KEY])
  )
  // Kullanıcı isteği (2026-08-04): koltuklu (otobüslü) gezide refakatçinin ad-soyadı zorunlu —
  // isimsiz "sadece sayı" ile ilerlenemez (backend de bunu COMPANION_NAME_REQUIRED ile reddeder).
  const companionNameMissing = hasCompanion && effectiveRequiresSeat && !companionName.trim()
  const canApply = passengerCount > 0 && allSeated && (!effectiveRequiresVehicle || !!busId) && !scopeClosed && !hasConflict
    && (!companionRequired || companionCount > 0) && !companionNameMissing

  const apply = async () => {
    if (!detail) return
    if (applying) return
    const hasConflict = conflictingApplications.length > 0
    if (hasConflict) {
      toast.error('Seçili kişi aynı tarihte başka bir geziye başvurmuş. Mevcut başvuruyu iptal ettikten sonra yeniden deneyin.', { duration: 5000 })
      return
    }
    if (passengerCount === 0) { toast.warning('En az bir kişi seçin.'); return }
    if (companionRequired && companionCount <= 0) { toast.warning('18 yaş altı başvuru için refakatçi sayısını girin.'); return }
    if (companionNameMissing) { toast.warning('Refakatçinin ad-soyadını girin.'); return }
    if (scopeClosed) { toast.warning('Gezi kontenjanı ve yedek listesi dolu.'); return }
    if (effectiveRequiresVehicle && !busId) { toast.warning('Lütfen bir araç seçin.'); return }
    if (effectiveRequiresSeat && (!selected.every((a) => seats[a.participantId]) || (guestActive && !seats[GUEST_KEY]))) {
      toast.warning('Her kişi için koltuk seçin.'); return
    }
    const sendBusId = goesToWaitlist ? null : busId
    const passengers: CitizenReservationPassenger[] = selected.map((a) => ({
      participantId: a.participantId,
      seatNumber: goesToWaitlist ? null : (seats[a.participantId] ?? null),
    }))
    if (guestActive) passengers.push({ guest, seatNumber: goesToWaitlist ? null : (seats[GUEST_KEY] ?? null) })
    setApplying(true)
    try {
      await travelService.reserve(detail.id, {
        busId: sendBusId, passengers, hasCompanion, companionCount: hasCompanion ? companionCount : 0,
        companionName: hasCompanion ? companionName.trim() || null : null,
        companionGender: hasCompanion ? (companionGender || null) : null,
      })
      const passengerResults = [
        ...selected.map((a) => ({
          name: a.fullName,
          isSelf: a.isSelf,
          seatNumber: seats[a.participantId] ?? null,
          busName: selectedBus?.name ?? null,
          plateNumber: selectedBus?.plateNumber ?? null,
        })),
        ...(guestActive && guestIdentity ? [{
          name: guestIdentity.fullName,
          isSelf: false,
          seatNumber: seats[GUEST_KEY] ?? null,
          busName: selectedBus?.name ?? null,
          plateNumber: selectedBus?.plateNumber ?? null,
        }] : []),
      ]
      setSuccessData({
        travelName: detail.name,
        categoryName: detail.categoryName,
        categoryColor: detail.categoryColor,
        destination: detail.destination,
        departureDate: detail.departureDate,
        guideName: detail.guideName,
        cancellationDeadlineHours: detail.cancellationDeadlineHours ?? 0,
        passengers: passengerResults,
      })
    } catch {
      setSeats({})
      setReloadSignal((n) => n + 1)
    } finally { setApplying(false) }
  }

  const seatRow = (key: string) => (
    <button
      type="button"
      onClick={() => setSeatPickerFor(key)}
      className="ml-12 flex items-center justify-between rounded-lg px-3 py-2 transition-colors w-[calc(100%-3rem)]"
      style={{ background: seats[key] ? '#10b98110' : '#f9fafb', border: `1px solid ${seats[key] ? '#10b98130' : '#e5e7eb'}` }}
    >
      <span className="flex items-center gap-2 text-[13px] font-medium" style={{ color: seats[key] ? '#10b981' : '#9ca3af' }}>
        <ArmchairIcon className="h-3.5 w-3.5 flex-shrink-0" />
        {seats[key] ? `Koltuk ${seats[key]} seçildi` : 'Koltuk seçilmedi'}
      </span>
      <span className="text-[12px] font-bold" style={{ color: seats[key] ? '#10b981' : '#f97316' }}>
        {seats[key] ? 'Değiştir' : 'Seç →'}
      </span>
    </button>
  )

  if (!travelId) return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/55" style={{ backdropFilter: 'blur(6px)' }} />

        <div
          className="relative z-10 flex flex-col bg-white overflow-hidden"
          style={{
            width: '100%',
            maxWidth: 480,
            maxHeight: '90vh',
            borderRadius: 8,
            boxShadow: '0 24px 64px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {loading || !detail ? (
            <div className="flex-shrink-0 h-16 bg-gray-100 flex items-center justify-between px-5">
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
              <button type="button" onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 text-gray-400">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ) : detail.photos && detail.photos.length > 0 ? (
            <div className="flex-shrink-0 relative h-40 overflow-hidden">
              <img src={detail.photos[0]} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <button type="button" onClick={onClose}
                className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg bg-black/30 text-white hover:bg-black/50 transition-colors">
                <XIcon className="h-4 w-4" />
              </button>
              <div className="absolute bottom-4 left-5 right-14">
                <span className="text-[11px] font-bold text-white/60 uppercase tracking-widest">{detail.categoryName}</span>
                <p className="text-[18px] font-extrabold text-white leading-tight mt-0.5">{detail.name}</p>
              </div>
            </div>
          ) : (
            <div
              className="flex-shrink-0 flex items-center justify-between px-5 py-4"
              style={{
                background: `linear-gradient(135deg, ${detail.categoryColor}dd 0%, ${detail.categoryColor} 100%)`,
              }}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/20">
                  <BusIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-white/65 uppercase tracking-widest">{detail.categoryName}</p>
                  <p className="text-[16px] font-extrabold text-white leading-tight">{detail.name}</p>
                </div>
              </div>
              <button type="button" onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="p-5"><SkeletonRows rows={5} /></div>
            ) : !detail ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <AlertCircleIcon className="h-8 w-8 text-gray-300" />
                <p className="text-sm font-semibold text-gray-700">
                  {loadFailed ? 'Gezi bilgisi yüklenemedi' : 'Gezi bulunamadı'}
                </p>
                <p className="text-[12px] text-gray-500">Bu gezi kaldırılmış veya artık erişilebilir değil olabilir.</p>
              </div>
            ) : (
              <div className="p-5 space-y-5">

                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] text-[14px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                      <MapPinIcon className="h-3.5 w-3.5 text-teal-500" />
                      {detail.destination}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                      <CalendarDaysIcon className="h-3.5 w-3.5 text-blue-500" />
                      {formatDate(detail.departureDate)}
                      {!detail.isSingleDay && <span className="text-slate-400">– {formatDate(detail.returnDate)}</span>}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 shadow-sm ring-1 ring-emerald-100 text-emerald-800">
                      <UsersIcon className="h-4 w-4" />
                      <span className="text-sm font-semibold">{detail.registeredCount.toLocaleString('tr-TR')} / {detail.capacity.toLocaleString('tr-TR')} kişi</span>
                    </div>
                    {goesToWaitlist && (
                      <div className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 ring-1 ring-amber-100">
                        <UsersIcon className="h-4 w-4" />
                        Kontenjan dolu · {waitRoom} yedek yeri
                      </div>
                    )}
                    {detail.guideName && (
                      <div className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
                        <UserIcon className="h-4 w-4" />
                        {detail.guideName}
                      </div>
                    )}
                  </div>
                  <DistanceBadge
                    className="col-span-full"
                    target={detail.latitude != null && detail.longitude != null ? { latitude: detail.latitude, longitude: detail.longitude } : null}
                  />
                </div>

                {existingApplications && existingApplications.length > 0 && (
                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
                      <p className="text-[14px] font-bold text-gray-500 uppercase tracking-wide">Başvuru Durumunuz</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {existingApplications.map((a) => {
                        const tone = statusTone(a.status)
                        const toneColor = tone === 'success' ? '#16a34a' : tone === 'warning' ? '#d97706' : tone === 'danger' ? '#dc2626' : tone === 'info' ? '#2563eb' : '#6b7280'
                        const toneBg = tone === 'success' ? '#f0fdf4' : tone === 'warning' ? '#fffbeb' : tone === 'danger' ? '#fef2f2' : tone === 'info' ? '#eff6ff' : '#f9fafb'
                        const StatusIcon = tone === 'success' ? CheckCircle2Icon : tone === 'danger' ? XIcon : AlertCircleIcon
                        return (
                          <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[14px] font-semibold" style={{ color: '#2563eb' }}>{a.isSelf ? 'Ben' : a.personName}</p>
                              <span className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[13px] font-semibold" style={{ background: toneBg, color: toneColor }}>
                                <StatusIcon className="h-3.5 w-3.5" />{statusLabel(a.status)}
                              </span>
                            </div>
                            {a.canCancel && (
                              <button
                                type="button"
                                onClick={() => setCancelTarget({ id: a.id, title: `${a.isSelf ? 'Ben' : a.personName} · ${detail.name}` })}
                                className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[14px] font-bold text-red-600 hover:bg-red-100 transition-colors"
                              >
                                <XCircleIcon className="h-4 w-4" /> İptal Et
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Kullanıcı bulgusu (2026-08-09, canlı testte kanıtlandı — "açıklamalar
                    yatay/kalın/altı çizili gibi şeyleri desteklemiyor"): bu alan bir <p>
                    içine dangerouslySetInnerHTML ile basılıyordu. RichTextEditor'ün ürettiği
                    HTML (ör. "Ortala" komutu <div style="text-align:center"> ile sarmalıyor)
                    blok seviyeli <div> içerebiliyor — <p> yalnızca satır-içi (phrasing)
                    içerik kabul eder, tarayıcı geçersiz <p><div>...</div></p> yapısını
                    otomatik olarak <p></p><div>...</div> şeklinde ikiye bölerek "onarıyor".
                    Bu, hizalama/biçimlendirme stilinin beklenmeyen bir DOM yapısına
                    düşmesine ve görsel olarak uygulanmamış gibi görünmesine yol açıyordu.
                    <p> yerine <div> kullanmak, RichTextEditor'ün ürettiği her türlü blok
                    içeriği (hizalama, liste, vb.) geçerli/tutarlı şekilde barındırır. */}
                {detail.descriptionHtml && (
                  <div className="text-[14px] text-gray-600 leading-relaxed border-t border-gray-100 pt-4"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detail.descriptionHtml) }} />
                )}

                {/* SORUN 7 düzeltmesi (2026-08-07, kullanıcı bulgusu — canlı testte kanıtlandı):
                    Admin panelde "Koşullar / Program" alanı (conditionsHtml) API'den her zaman
                    doğru geliyordu ama burada hiç render edilmiyordu — admin bu alana ne kadar
                    biçimlendirilmiş içerik girerse girsin vatandaşa asla gösterilmiyordu. */}
                {detail.conditionsHtml && (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">Koşullar ve Program</p>
                    {/* Yukarıdaki descriptionHtml ile aynı neden: <p> yerine <div> — blok
                        seviyeli biçimlendirme (hizalama/liste) içeren HTML'i geçerli barındırır. */}
                    <div className="text-[14px] text-gray-600 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detail.conditionsHtml) }} />
                  </div>
                )}

                {/* Hata bulgusu (2026-08-16): koşul `detail.photos.length > 1` idi — admin panelde
                    "Fotoğraf Galerisi"ne tek bir görsel eklendiğinde bu şerit hiç render edilmiyordu
                    (üstteki kapak fotoğrafı `photos[0]`'ı zaten kullanıyor ama galeri şeridi ayrı bir
                    alandır ve tek foto olsa bile kullanıcıya galeri olarak gösterilmelidir). `> 0`
                    ile düzeltildi — tek fotoğraf da dahil her durumda galeri şeridi görünür. */}
                {detail.photos && detail.photos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-0.5">
                    {detail.photos.map((url, i) => (
                      <button key={i} type="button" onClick={() => setLightboxUrl(url)}
                        className="flex-shrink-0 rounded-lg overflow-hidden ring-1 ring-black/5">
                        <img src={url} alt="" className="h-16 w-24 object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {!detail.applicationOpen && (
                  <Banner tone="warning" variant="soft" icon={ClockIcon}>
                    {new Date() < new Date(detail.registrationStartDate)
                      ? `Başvurular ${formatDate(detail.registrationStartDate)} tarihinde açılacak.`
                      : `Başvuru süresi ${formatDate(detail.registrationEndDate)} tarihinde sona erdi.`}
                  </Banner>
                )}

                {detail.applicationOpen && effectiveRequiresVehicle && detail.buses.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">
                      {requiresSeat ? 'Otobüs Seçin' : 'Sefer / Araç Seçin'}
                    </p>
                    {detail.buses.map((b) => {
                      const isCapacity = b.vehicleType === 'capacity'
                      const remaining = isCapacity ? Math.max(0, b.capacity - b.occupiedCount) : freeSeatCount(b.seats)
                      const busDisabled = remaining === 0
                      const isSelectedBus = busId === b.busId
                      return (
                        <button key={b.busId} type="button" onClick={() => !busDisabled && setBusId(b.busId)}
                          disabled={busDisabled}
                          className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-all"
                          style={isSelectedBus
                            ? { background: `${detail.categoryColor}0f`, border: `1.5px solid ${detail.categoryColor}` }
                            : busDisabled
                              ? { background: '#f3f4f6', border: '1.5px solid #d1d5db', cursor: 'not-allowed', color: '#9ca3af' }
                              : { background: '#ffffff', border: '1.5px solid #d1d5db' }
                          }
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: isSelectedBus ? detail.categoryColor : '#f3f4f6' }}>
                            <BusIcon className="h-4 w-4" style={{ color: isSelectedBus ? '#fff' : '#6b7280' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold" style={{ color: busDisabled ? '#9ca3af' : '#111827' }}>{b.name}{b.plateNumber ? ` · ${b.plateNumber}` : ''}</p>
                            <p className="text-[12px]" style={{ color: busDisabled ? '#9ca3af' : '#6b7280' }}>{isCapacity ? `${remaining} kişilik kontenjan kaldı` : `${remaining} boş koltuk`}</p>
                          </div>
                          {isSelectedBus && <CheckIcon className="h-4 w-4 flex-shrink-0" style={{ color: detail.categoryColor }} />}
                        </button>
                      )
                    })}
                  </div>
                )}

                {detail.applicationOpen && (
                  <div className="space-y-2">
                    {hasConflict && (
                      <Banner tone="danger" variant="soft" icon={AlertCircleIcon}>
                        <div className="text-[11px] leading-4 font-semibold">
                          Seçili kişi aynı tarihte başka bir geziye başvurmuş.
                          <span className="block text-[10px] font-normal mt-0.5">
                            Mevcut başvuruyu iptal ettikten sonra bu geziye başvurabilirsiniz.
                          </span>
                        </div>
                      </Banner>
                    )}
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Kimler için başvuruyorsunuz?</p>
                    <p className="text-[12px] text-amber-600">
                      {alreadyHasApplication
                        ? 'Grubunuza yeni bir kişi eklemek için aşağıdan seçim yapabilirsiniz.'
                        : 'Başvuru için aşağıdaki kişileri seçmeniz gerekir.'}
                    </p>
                    {childrenAllowed && hasNoChildrenOnAccount && (
                      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                        <BabyIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-blue-800">Bu geziye çocuğunuzu da ekleyebilirsiniz</p>
                          <p className="mt-0.5 text-[12px] leading-4 text-blue-700">
                            En fazla {detail.maxChildren ?? 1} çocuk · {childAgeLabel}{childGenderLabel}
                          </p>
                          <button
                            type="button"
                            onClick={openNviChildrenModal}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-blue-700 transition-colors"
                          >
                            <UserPlusIcon className="h-3.5 w-3.5" /> Çocuklarımı NVI'den Getir
                          </button>
                        </div>
                      </div>
                    )}
                    {detail.applicants.map((a) => {
                      const disabled = a.alreadyApplied || (!a.eligible && !a.requiresGuardian)
                      const isSel = selectedIds.has(a.participantId)
                      const subtext = a.alreadyApplied
                        ? 'Bu geziye başvuruldu'
                        : !a.eligible ? (a.ineligibleReason ?? 'Uygun değil')
                          : `${a.age} yaş · ${GENDER_LABEL[a.gender] ?? a.gender}`
                      const cardStyle = isSel
                        ? { background: '#ECFDF5', border: '1.5px solid #10B981' }
                        : disabled
                          ? { background: '#f9fafb', border: '1.5px solid #e5e7eb', opacity: 0.5 }
                          : hasConflict
                            ? { background: '#FFFBEB', border: '1.5px solid #F59E0B' }
                            : { background: '#f9fafb', border: '1.5px solid #e5e7eb' }

                      return (
                        <div key={a.participantId} className="space-y-1.5">
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => toggle(a.participantId)}
                            className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-all"
                            style={cardStyle}
                          >
                            <div
                              className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-[14px] font-bold"
                              style={isSel
                                ? { background: '#10B981', color: '#fff' }
                                : { background: '#e5e7eb', color: '#6b7280' }
                              }
                            >
                              {a.fullName[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[14.5px] font-semibold" style={{ color: isSel ? '#065F46' : '#111827' }}>
                                {a.isSelf ? `${a.fullName} (Ben)` : a.fullName}
                              </p>
                              <p className="text-[13px]" style={{ color: isSel ? '#059669' : '#6b7280' }}>{subtext}</p>
                            </div>
                            {a.alreadyApplied ? (
                              <span className="flex-shrink-0 text-[11px] font-bold rounded-md px-2 py-0.5 bg-emerald-50 text-emerald-600 inline-flex items-center gap-1"><Icon2D kind="check" className="h-3 w-3" />Başvuruldu</span>
                            ) : !disabled && (
                              <span
                                className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold transition-all"
                                style={isSel
                                  ? { background: '#10B981', color: '#fff', boxShadow: '0 3px 10px rgba(16,185,129,0.35)' }
                                  : { background: '#fff', color: '#374151', border: '1.5px solid #d1d5db' }
                                }
                              >
                                {isSel
                                  ? (<><CheckIcon className="h-3.5 w-3.5" /> Seçildi</>)
                                  : 'Seç'}
                              </span>
                            )}
                          </button>
                          {isSel && effectiveRequiresSeat && busId && seatRow(a.participantId)}
                        </div>
                      )
                    })}
                    {selectedMinor && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                        <div className="flex items-start gap-3">
                          <AlertCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                          <div className="min-w-0 flex-1 space-y-3">
                            <div>
                              <p className="text-[14px] font-semibold text-amber-800">{selectedMinor.fullName} 18 yaşından küçük</p>
                              <p className="mt-0.5 text-[12px] leading-4 text-amber-700">
                                {effectiveRequiresSeat
                                  ? (companionRequired
                                    ? 'Bu başvuruya refakatçi eklenmelidir. Koltuklu araçlarda refakatçi yalnızca çocuğun koltuğunun yanına oturabildiği için 1 refakatçi eklenebilir; yan koltuk sistem tarafından otomatik ayrılır.'
                                    : 'Dilerseniz çocuğunuzun yanına ayrıca bir refakatçi ekleyebilirsiniz. Yan koltuk sistem tarafından otomatik ayrılır.')
                                  : (companionRequired
                                    ? 'Bu başvuruda veli/refakatçi sayısını belirtin.'
                                    : 'Dilerseniz ayrıca veli/refakatçi ekleyebilirsiniz.')}
                              </p>
                            </div>
                            {effectiveRequiresSeat ? (
                              !companionRequired && (
                                <label className="flex items-center gap-2.5 text-[13px] font-semibold text-amber-800">
                                  <input
                                    type="checkbox"
                                    checked={companionCount > 0}
                                    onChange={(e) => setCompanionCount(e.target.checked ? 1 : 0)}
                                    className="h-4 w-4 rounded border-amber-300 accent-amber-600"
                                  />
                                  Refakatçi eklemek istiyorum
                                </label>
                              )
                            ) : (
                              <Field label="Refakatçi sayısı" required={companionRequired}>
                                <input
                                  type="number"
                                  min={companionRequired ? 1 : 0}
                                  max={Math.max(1, maxGroupSize - 1)}
                                  value={companionCount || ''}
                                  onChange={(e) => {
                                    const next = Number(e.target.value)
                                    const cap = Math.max(1, maxGroupSize - 1)
                                    setCompanionCount(Number.isFinite(next) ? Math.max(0, Math.min(cap, next)) : 0)
                                  }}
                                  className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-[14px] font-semibold text-gray-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200/70"
                                  placeholder={companionRequired ? '1' : '0'}
                                />
                              </Field>
                            )}
                            {effectiveRequiresSeat && (
                              <div className="grid grid-cols-[1fr_auto] gap-2">
                                <Field label="Refakatçi ad-soyad" required>
                                  <input
                                    type="text"
                                    value={companionName}
                                    onChange={(e) => setCompanionName(e.target.value)}
                                    className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-[14px] font-semibold text-gray-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200/70"
                                    placeholder="Ad Soyad"
                                  />
                                </Field>
                                <Field label="Cinsiyet">
                                  <select
                                    value={companionGender}
                                    onChange={(e) => setCompanionGender(e.target.value as 'male' | 'female' | '')}
                                    className="h-10 rounded-lg border border-amber-200 bg-white px-2 text-[13px] font-semibold text-gray-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200/70"
                                  >
                                    <option value="">—</option>
                                    <option value="male">Erkek</option>
                                    <option value="female">Kadın</option>
                                  </select>
                                </Field>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {detail.applicationOpen && (
                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                    <div className="flex items-start gap-3 bg-gray-50 px-4 py-3">
                      <UserPlusIcon className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-gray-800">Yanınızda misafir (opsiyonel)</p>
                        <p className="text-[12px] text-gray-400 mt-0.5">Aile dışından bir kişiyi ekleyin. Kimlik bilgileri NVI'den doğrulanır; ad soyad otomatik gelir. Rezervasyon başına 1 misafir.</p>
                      </div>
                      {!guestFormOpen && (
                        <button
                          type="button"
                          onClick={() => setGuestFormOpen(true)}
                          className="flex-shrink-0 text-[12px] font-bold text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          + Ekle
                        </button>
                      )}
                    </div>
                    {guestFormOpen && (
                    <div className="p-4 space-y-3 border-t border-gray-100">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="T.C. Kimlik No">
                          <TcknInput value={guest.tckn} onChange={(v) => patchGuest({ tckn: v })} />
                        </Field>
                        <Field label="Doğum Tarihi">
                          <DatePicker value={guest.birthDate} onChange={(v) => patchGuest({ birthDate: v })} max={todayIso()} />
                        </Field>
                      </div>
                      {guestLookingUp && (
                        <p className="flex items-center gap-1.5 text-[13px] text-gray-400">
                          <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> Kimlik doğrulanıyor…
                        </p>
                      )}
                      {guestError && <p className="text-[13px] text-red-500">{guestError}</p>}
                      {guestIdentity && (
                        <>
                          <Field label="Ad Soyad">
                            <ReadonlyField>
                              <span className="inline-flex items-center gap-2">
                                {guestIdentity.fullName}
                                <Badge color={GENDER_COLOR[guestIdentity.gender]}>
                                  {guestIdentity.gender === 'female' ? 'Kadın' : 'Erkek'}
                                </Badge>
                              </span>
                            </ReadonlyField>
                          </Field>
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Telefon" required>
                              <PhoneInput value={guest.phone} onChange={(v) => patchGuest({ phone: v })} />
                            </Field>
                            <Field label="E-posta" required>
                              <EmailInput value={guest.email} onChange={(e) => patchGuest({ email: e.target.value })} />
                            </Field>
                          </div>
                          {effectiveRequiresSeat && busId && guestContactValid(guest) && seatRow(GUEST_KEY)}
                        </>
                      )}
                    </div>
                    )}
                  </div>
                )}

                {detail.applicationOpen && (
                  <div className="flex items-start gap-2.5 rounded-lg bg-blue-50 px-4 py-3">
                    <UserPlusIcon className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[13px] text-blue-700 leading-relaxed">
                      Bir rezervasyondaki tüm kişiler tek seferde kaydedilir — biri için sorun olursa hiçbiri kaydedilmez.
                      Aynı rezervasyondaki kişiler farklı cinsiyette olsa da yan yana oturabilir.
                    </p>
                  </div>
                )}

                {effectiveRequiresVehicle && !busId && detail.buses.length > 1 && detail.applicationOpen && (
                  <p className="flex items-center gap-1.5 text-[13px] text-gray-400">
                    <BusIcon className="h-3.5 w-3.5" /> {requiresSeat ? 'Koltuk seçmek için önce araç seçin.' : 'Devam etmek için önce bir sefer/araç seçin.'}
                  </p>
                )}


              </div>
            )}
          </div>

          {!loading && detail?.applicationOpen && (
            <div className="flex-shrink-0 px-5 py-4 bg-white border-t border-gray-100">
              <button
                type="button"
                disabled={!canApply || applying}
                onClick={apply}
                className="w-full flex items-center justify-center gap-2 rounded-lg py-3.5 text-[14px] font-bold transition-all"
                style={{
                  background: canApply
                    ? `linear-gradient(135deg, ${detail.categoryColor} 0%, ${detail.categoryColor}cc 100%)`
                    : '#f3f4f6',
                  color: canApply ? '#fff' : '#9ca3af',
                  boxShadow: canApply ? `0 4px 14px ${detail.categoryColor}50` : 'none',
                }}
              >
                {applying ? (
                  <><Loader2Icon className="h-4 w-4 animate-spin" /> Rezervasyon yapılıyor…</>
                ) : goesToWaitlist ? (
                  <>{passengerCount > 0 ? `${passengerCount} Kişi için ` : ''}Yedek Listeye Başvur <ChevronRightIcon className="h-4 w-4" /></>
                ) : passengerCount > 0 ? (
                  <>{passengerCount} Kişi için Rezervasyonu Tamamla <ChevronRightIcon className="h-4 w-4" /></>
                ) : (
                  'Rezervasyonu Tamamla'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {lightboxUrl && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
          onClick={() => setLightboxUrl(null)}>
          <button type="button" onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <XIcon className="h-5 w-5" />
          </button>
          <img src={lightboxUrl} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()} />
        </div>,
        document.body,
      )}

      {seatPickerFor && selectedBus && (() => {
        const applicant = seatPickerFor === GUEST_KEY ? null : detail?.applicants.find((a) => a.participantId === seatPickerFor)
        const pickerGender = seatPickerFor === GUEST_KEY ? guestIdentity?.gender : (applicant ? normalizeGender(applicant.gender) : undefined)
        const pickerName = seatPickerFor === GUEST_KEY ? (guestIdentity?.fullName ?? 'Misafir') : applicant?.fullName
        // Kullanıcı isteği (2026-08-07, senaryo 2): misafir yalnızca rezervasyondaki (kendisi
        // hariç) yolcuların hemen yanındaki boş koltuklardan birini seçebilir.
        const guestAllowedLabels = seatPickerFor === GUEST_KEY
          ? new Set(
              selected
                .map((a) => seats[a.participantId])
                .filter((label): label is string => !!label)
                .flatMap((label) => getAdjacentLabels(getBusTemplate(selectedBus.templateId), label)),
            )
          : undefined
        return (
          <TravelSeatPicker
            open={!!seatPickerFor}
            onClose={() => setSeatPickerFor(null)}
            busName={selectedBus.name}
            templateId={selectedBus.templateId}
            seatStates={selectedBus.seatStates}
            occupants={selectedBus.occupants}
            taken={Object.entries(seats).filter(([k]) => k !== seatPickerFor).map(([, label]) => label)}
            value={seats[seatPickerFor] ?? null}
            personGender={pickerGender}
            personLabel={pickerName}
            driverName={detail?.driverName}
            guideName={detail?.guideName}
            allowedLabels={guestAllowedLabels}
            onSelect={(label) => { setSeats((s) => ({ ...s, [seatPickerFor]: label })); setSeatPickerFor(null) }}
          />
        )
      })()}

      <TravelSuccessModal
        data={successData}
        onClose={() => { setSuccessData(null); onApplied() }}
      />

      <ConfirmModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={runCancel}
        title="Kaydı iptal et"
        description={`${cancelTarget?.title ?? ''} için başvuru iptal edilecek. Emin misiniz?`}
        confirmLabel="İptal Et"
        tone="danger"
        loading={canceling}
      />

      <Modal
        open={nviChildrenOpen}
        onClose={() => setNviChildrenOpen(false)}
        title="Nüfus Kayıtlarından Çocuk Ekle"
        subtitle={nviChildrenPreview ? nviChildrenPreview.fullName : undefined}
        width={440}
        bodyClassName="p-5"
        footer={
          nviChildrenPreview && nviChildrenPreview.children.length > 0 ? (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setNviChildrenOpen(false)}>Vazgeç</Button>
              <Button
                variant="primary"
                className="flex-1"
                isLoading={nviConfirming}
                disabled={nviCheckedTckns.size === 0}
                onClick={() => void confirmNviChildren()}
              >
                Seçilenleri Ekle ({nviCheckedTckns.size})
              </Button>
            </div>
          ) : undefined
        }
      >
        {nviChildrenLoading ? (
          <SkeletonRows rows={3} />
        ) : !nviChildrenPreview || nviChildrenPreview.children.length === 0 ? (
          <EmptyState icon={UsersIcon} title="Kayıt bulunamadı" description="Nüfus kayıtlarınıza bağlı çocuk bulunamadı." />
        ) : (
          <div className="space-y-3">
            {nviChildrenPreview.children.map((child) => (
              <label
                key={child.tckn}
                className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"
                style={child.alreadyAdded ? { opacity: 0.55 } : undefined}
              >
                <Checkbox
                  checked={nviCheckedTckns.has(child.tckn)}
                  disabled={child.alreadyAdded}
                  onCheckedChange={() => toggleNviChild(child.tckn)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[14px] font-semibold text-gray-900 truncate">{child.fullName}</p>
                    {child.alreadyAdded && (
                      <Badge tone="success">
                        <CheckIcon className="mr-0.5 inline h-3 w-3" /> Kayıtlı
                      </Badge>
                    )}
                  </div>
                </div>
              </label>
            ))}
            <p className="text-[12px] text-gray-400 pt-1">
              Zaten eklenmiş çocuklar otomatik işaretli değildir. Eklendikten sonra listede seçim yapabilirsiniz.
            </p>
          </div>
        )}
      </Modal>
    </>,
    document.body,
  )
}
