import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { UsersIcon, ClockIcon, CalendarRangeIcon, FileTextIcon, Building2Icon, UserRoundIcon, UploadIcon, CheckCircle2Icon, Loader2Icon, NavigationIcon, ChevronDownIcon, InfoIcon, ListChecksIcon, BabyIcon, AlertCircleIcon, CarIcon, LockIcon, HelpCircleIcon } from 'lucide-react'
import { Modal, Badge, Button, SkeletonRows, Checkbox } from '@/design-system'
import { Icon2D } from '@/components/Icon2D'
import { formatDate } from '@/lib/utils'
import { DistanceBadge } from '@/components/specialized/DistanceBadge'
import { directionsUrl } from '@/lib/distance'
import type { CitizenFacilityGroupDetail, CitizenFacilityApplyDocument, CitizenFacilityDocumentType, CitizenFacilityApplicationDocument, CitizenFacilityStatus, CitizenFacilityApplicant, CitizenFacilityApplication } from '@/types/facility.types'
import { GENDER_LABEL, FACILITY_STATUS_LABELS, FACILITY_STATUS_TONE } from '@/types/facility.types'
import facilityService from '@/services/facility.service'
import { visualForBranch } from '@/modules/sports/sportsData'
import { ApplicationStatusStepper } from '@/components/ApplicationStatusStepper'
import { ApplicationStatusBadge } from '@/components/ApplicationStatusBadge'

const DAY_TR: Record<string, string> = {
  monday: 'Pazartesi', tuesday: 'Salı', wednesday: 'Çarşamba', thursday: 'Perşembe',
  friday: 'Cuma', saturday: 'Cumartesi', sunday: 'Pazar',
}
const DAY_ORDER: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7,
}
const DAY_CHIP: Record<string, string> = {
  monday: 'border-accent-blue/50 bg-accent-blue/10 text-accent-blue',
  tuesday: 'border-accent-green/50 bg-accent-green/10 text-accent-green',
  wednesday: 'border-accent-orange/50 bg-accent-orange/10 text-accent-orange',
  thursday: 'border-accent-violet/50 bg-accent-violet/10 text-accent-violet',
  friday: 'border-primary/50 bg-primary-soft text-primary',
  saturday: 'border-[hsl(var(--warning))]/50 bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]',
  sunday: 'border-[hsl(var(--danger))]/50 bg-[hsl(var(--danger))]/10 text-[hsl(var(--danger))]',
}

const SOFT_CARD = 'border-white/80 bg-white/80 shadow-sm shadow-primary/5'

const FORMAT_ACCEPT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
}

const getAccept = (formats?: string[]): string => {
  if (!formats || formats.length === 0) return 'image/*,application/pdf'
  return formats.map((f) => FORMAT_ACCEPT[f] ?? `image/${f}`).join(',')
}

const splitRules = (text?: string | null): string[] => {
  if (!text) return []
  return text
    .split(/\n|•|;/)
    .flatMap((line) => (line.includes('\n') ? line.split('\n') : [line]))
    .map((s) => s.trim().replace(/^[-*.\s]+/, '').trim())
    .filter((s) => s.length > 1)
}

const cleanGroupName = (name: string): string =>
  name.replace(/\[[^\]]*\]/g, '').replace(/\b\d+\s*g[üu]n\b/gi, '').replace(/\s{2,}/g, ' ').trim()

/**
 * Hata raporu (docs/hata.md #5/#7/#8): başvuru reddedildiğinde kullanıcı sebebi göremiyordu.
 * Backend engelin gerekçesini (çakışan gün/saat, hizmet türü, kaydın nerede görüneceği)
 * mesajda zaten anlatıyor — onu olduğu gibi gösteriyoruz, yoksa genel bir metne düşüyoruz.
 */
const applyErrorMessage = (err: unknown): string => {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message?.trim() || 'Başvuru alınamadı. Lütfen tekrar deneyin.'
}

function facilityApplicantAvatar(a: { isSelf: boolean; age: number; gender: string }) {
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

interface AppliedInfo {
  groupName: string
  branchName: string
  personName: string
  scheduleSummary: string
  periodStart?: string | null
  status: CitizenFacilityStatus
  isWaitlist: boolean
}

interface Props {
  module: string | null
  groupId: string | null
  onClose: () => void
  onApplied: () => void
  existingApplications?: Array<{ personName: string; status: CitizenFacilityStatus; isSelf: boolean }>
  uploadedDocuments?: CitizenFacilityApplicationDocument[]
}

interface CollapsibleProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

const Collapsible = ({ icon: Icon, title, defaultOpen = false, children }: CollapsibleProps) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-card border border-border/70 bg-white shadow-sm shadow-primary/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 bg-gradient-to-r from-primary-soft/70 to-white px-3 py-2.5 text-left transition-colors hover:from-primary-soft"
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-field bg-white text-primary shadow-sm">
          <Icon className="h-4 w-4" />
        </span>
        <span className="type-body-strong flex-1">{title}</span>
        <ChevronDownIcon className={`h-4 w-4 flex-shrink-0 text-foreground-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-border/60 px-3 py-3">{children}</div>}
    </div>
  )
}

export const FacilityDetailModal = ({ module, groupId, onClose, onApplied, existingApplications, uploadedDocuments }: Props) => {
  const [detail, setDetail] = useState<CitizenFacilityGroupDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [docsByType, setDocsByType] = useState<Record<string, CitizenFacilityApplyDocument>>({})
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  const [applied, setApplied] = useState<AppliedInfo | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  // Kullanıcı isteği (2026-10-04): grup bazında tanımlı özel evet/hayır soruları (örn. Havuz'da
  // "Yüzme biliyor musunuz?") — {questionId: "yes"|"no"}.
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const activeTypeRef = useRef<string | null>(null)

  const requiredDocuments = detail?.requiredDocuments ?? []
  const requiresDocs = requiredDocuments.length > 0

  useEffect(() => {
    if (!module || !groupId) { setDetail(null); setSelectedIds(new Set()); setDocsByType({}); setApplying(false); setApplied(null); setTermsAccepted(false); setCustomAnswers({}); return }
    let active = true
    setLoading(true)
    setLoadFailed(false)
    setApplying(false)
    setApplied(null)
    setSelectedIds(new Set())
    setDocsByType({})
    setTermsAccepted(false)
    setCustomAnswers({})
    facilityService.detail(module, groupId)
      .then((d) => {
        if (!active) return
        setDetail(d)
        const selectable = d.applicants.filter((a) => a.eligible && !a.alreadyApplied)
        const preferred = selectable.find((a) => a.isSelf) ?? selectable[0]
        if (preferred) setSelectedIds(new Set([preferred.participantId]))
      })
      .catch(() => { if (active) { setDetail(null); setLoadFailed(true) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [module, groupId])

  const selected = useMemo(
    () => detail?.applicants.filter((a) => selectedIds.has(a.participantId)) ?? [],
    [detail, selectedIds],
  )

  const scheduleGroups = useMemo(() => {
    const sessions = detail?.sessions ?? []
    const active = sessions.filter((s) => !s.isCancelled)
    if (active.length === 0) return null
    const seen = new Set<string>()
    const daySlots: Array<{ day: string; st: string; et: string }> = []
    for (const s of active) {
      const key = `${s.day}|${s.startTime}|${s.endTime}`
      if (!seen.has(key)) {
        seen.add(key)
        daySlots.push({ day: s.day, st: s.startTime, et: s.endTime })
      }
    }
    daySlots.sort((a, b) => {
      const d = (DAY_ORDER[a.day] ?? 8) - (DAY_ORDER[b.day] ?? 8)
      return d !== 0 ? d : a.st.localeCompare(b.st)
    })
    const cancelledCount = sessions.filter((s) => s.isCancelled).length
    return { daySlots, cancelledCount }
  }, [detail?.sessions])

  const rules = useMemo(() => splitRules(detail?.requirements ?? detail?.conditions), [detail?.requirements, detail?.conditions])

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      if (requiresDocs) return prev.has(id) ? new Set() : new Set([id])
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pickFile = (doc: CitizenFacilityDocumentType) => {
    activeTypeRef.current = doc.key
    if (fileRef.current) fileRef.current.accept = getAccept(doc.allowedFormats)
    fileRef.current?.click()
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const typeKey = activeTypeRef.current
    e.target.value = ''
    if (!file || !typeKey || !module) return
    const docDef = requiredDocuments.find((d) => d.key === typeKey)
    setUploadingType(typeKey)
    try {
      const uploaded = await facilityService.uploadDocument(module, file, groupId, typeKey)
      setDocsByType((prev) => ({ ...prev, [typeKey]: { ...uploaded, type: typeKey, label: docDef?.label } }))
    } catch {
      toast.error('Belge yüklenemedi. Lütfen tekrar deneyin.')
    } finally {
      setUploadingType(null)
    }
  }

  const isFull = !!detail && detail.capacity > 0 && detail.registeredCount >= detail.capacity
  const waitRoom = detail ? detail.reserveCapacity - detail.waitlistCount : 0
  const isWaitlist = isFull && waitRoom > 0
  const isClosed = isFull && waitRoom <= 0
  const free = detail ? Math.max(0, detail.capacity - detail.registeredCount) : 0

  // Başvuru tarih penceresi kapalıysa backend zaten 409 döndürüyor; pencere durumu
  // DTO'ya eklenene kadar UI bunu bilemediği için "Başvur" aktif görünüyor, kullanıcı
  // ancak tıkladıktan sonra hatayı öğreniyordu.
  const windowClosed = !!detail && detail.applicationOpen === false
  const missingRequired = requiredDocuments.filter((d) => d.required && !docsByType[d.key])
  const docsReady = missingRequired.length === 0
  // Kullanıcı isteği (2026-10-04): önkoşul kurs tamamlanmamışsa VEYA zorunlu özel sorular
  // yanıtlanmamışsa başvuru butonu kilitlenir — gerçek zorlama backend'de (ApplyAsync), bu
  // sadece kullanıcıyı tıklamadan önce bilgilendirir.
  const prerequisiteBlocked = detail?.prerequisiteGroupId != null && detail.prerequisiteMet === false
  const customQuestions = detail?.customQuestions ?? []
  const missingCustomAnswers = customQuestions.filter((q) => q.required && !customAnswers[q.id])
  const canApply = !isClosed && !windowClosed && !prerequisiteBlocked && selected.length > 0 && termsAccepted
    && missingCustomAnswers.length === 0 && (!requiresDocs || (selected.length === 1 && docsReady))

  const successFor = (person: CitizenFacilityApplicant, result: CitizenFacilityApplication): AppliedInfo => ({
    groupName: detail!.name,
    branchName: detail!.branchName,
    personName: person.isSelf ? 'Ben' : person.fullName,
    scheduleSummary: detail!.scheduleSummary,
    periodStart: detail!.periodStart,
    status: result.status,
    isWaitlist: result.status === 'waitlist',
  })

  const apply = async () => {
    if (!detail || !module) return
    if (selected.length === 0) { toast.warning('En az bir kişi seçin.'); return }

    if (requiresDocs) {
      if (!docsReady) {
        const names = missingRequired.map((d) => d.label).join(', ')
        toast.warning(missingRequired.length > 0 ? `Şu belgeler zorunludur: ${names}` : 'Lütfen zorunlu belgeleri yükleyin.')
        return
      }
      setApplying(true)
      try {
        const documents = Object.values(docsByType)
        const result = await facilityService.apply(module, detail.id, selected[0].participantId, documents, customAnswers)
        setApplying(false)
        setApplied(successFor(selected[0], result))
        return
      } catch (err) {
        setApplying(false)
        // Hata raporu (docs/hata.md #5/#7/#8): tek kişilik başvuruda hata TAMAMEN sessizce
        // yutuluyordu — kullanıcı sebebi hiç göremiyordu. Backend zaten neden engellendiğini
        // (hangi gün/saat, hangi hizmet türü, kaydın nerede görüneceği) anlatıyor; aynen göster.
        toast.error(applyErrorMessage(err))
        return
      }
    }

    setApplying(true)
    const done: CitizenFacilityApplicant[] = []
    const failed: string[] = []
    let failReason: string | null = null
    let lastResult: CitizenFacilityApplication | null = null
    for (const a of selected) {
      try {
        lastResult = await facilityService.apply(module, detail.id, a.participantId, undefined, customAnswers)
        done.push(a)
      } catch (err) {
        // Her kişi için ayrı istek atılıyor; hata yutulursa kısmi başarı
        // "hepsi başarılı" ekranı gibi görünüyordu. Kimlerin başvurusunun
        // alınamadığı isim isim bildirilmeli.
        failed.push(a.isSelf ? 'Ben' : a.fullName)
        if (!failReason) failReason = applyErrorMessage(err)
      }
    }
    setApplying(false)
    if (failed.length > 0) {
      const suffix = failReason ? ` ${failReason}` : ''
      toast.warning(
        done.length > 0
          ? `${failed.join(', ')} için başvuru alınamadı.${suffix} Diğer başvurular oluşturuldu.`
          : `${failed.join(', ')} için başvuru alınamadı.${suffix}`,
      )
    }
    if (done.length > 0 && lastResult) {
      setApplied(done.length === 1
        ? successFor(done[0], lastResult)
        : { ...successFor(done[0], lastResult), personName: `${done.length} kişi` })
    }
  }

  const closeSuccess = () => {
    setApplied(null)
    onApplied()
  }

  if (applied) {
    const isPendingApproval = applied.status === 'pending'
    return (
      <Modal open onClose={closeSuccess} width={400}>
        <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
          <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${applied.isWaitlist || isPendingApproval ? 'bg-warning-soft' : 'bg-success-soft'}`}>
            <CheckCircle2Icon className={`h-9 w-9 ${applied.isWaitlist || isPendingApproval ? 'text-warning' : 'text-success'}`} />
          </div>
          <h3 className="type-section">{applied.isWaitlist ? 'Yedek listesine alındınız' : 'Başvurunuz alındı'}</h3>
          <p className="type-caption mt-1 text-foreground-muted">
            {applied.isWaitlist
              ? 'Yer açıldığında sıraya göre değerlendirileceksiniz.'
              : isPendingApproval
                ? 'Başvurunuz alındı ve değerlendirme için beklemeye alınmıştır.'
                : 'Başvurunuz başarıyla oluşturuldu.'}
          </p>

          <div className="mt-5 w-full space-y-2.5 rounded-card border border-border bg-surface-1 p-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <span className="type-caption text-foreground-muted">Program</span>
              <span className="type-body-strong text-right">{applied.groupName} · {applied.branchName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="type-caption text-foreground-muted">Kimin için</span>
              <span className="type-body-strong text-right">{applied.personName}</span>
            </div>
            {applied.scheduleSummary && (
              <div className="flex items-center justify-between gap-3">
                <span className="type-caption text-foreground-muted">Program günü</span>
                <span className="type-body-strong text-right">{applied.scheduleSummary}</span>
              </div>
            )}
            {applied.periodStart && (
              <div className="flex items-center justify-between gap-3">
                <span className="type-caption text-foreground-muted">Başlangıç</span>
                <span className="type-body-strong text-right">{formatDate(applied.periodStart)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="type-caption text-foreground-muted">Durum</span>
              <Badge tone={FACILITY_STATUS_TONE[applied.status]}>{FACILITY_STATUS_LABELS[applied.status]}</Badge>
            </div>
          </div>

          <Button variant="primary" size="lg" className="mt-5 w-full" onClick={closeSuccess}>Tamam</Button>
        </div>
      </Modal>
    )
  }

  const noEligible = !!detail && detail.applicants.every((a) => !a.eligible || a.alreadyApplied)
  const footerLabel = windowClosed
    ? (detail?.applicationClosedReason ?? 'Başvurular kapalı')
    : isClosed
    ? 'Kontenjan Dolu'
    : noEligible
      ? 'Uygun kişi yok'
      : selected.length === 0
        ? 'Başvurmak için kişi seçin'
        : isWaitlist
          ? (selected.length > 1 ? `${selected.length} Kişi İçin Yedek Listeye Başvur` : 'Yedek Listeye Başvur')
          : (selected.length > 1 ? `${selected.length} Kişi İçin Başvur` : 'Başvur')

  const footer = detail ? (
    <Button variant="primary" size="lg" className="w-full" isLoading={applying} disabled={!canApply} onClick={apply}>
      {footerLabel}
    </Button>
  ) : undefined

  return (
    <Modal
      open={!!groupId}
      onClose={onClose}
      title="Program"
      width={520}
      className="max-w-[calc(100vw-1.5rem)]"
      bodyClassName="p-0"
      footer={footer}
    >
      {loading ? (
        <div className="p-5"><SkeletonRows rows={4} /></div>
      ) : !detail ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <AlertCircleIcon className="h-8 w-8 text-foreground-subtle" />
          <p className="text-sm font-medium text-foreground-default">
            {loadFailed ? 'Program bilgisi yüklenemedi' : 'Program bulunamadı'}
          </p>
          <p className="text-xs text-foreground-muted">
            Bu program kaldırılmış veya artık erişilebilir değil olabilir.
          </p>
        </div>
      ) : (
        <div className="bg-gradient-to-b from-primary-soft/60 via-surface-0 to-surface-0">
          <div className="space-y-4 px-4 pb-4 pt-4 sm:px-5">
            <div className="overflow-hidden rounded-card border border-primary/15 bg-gradient-to-br from-primary-soft via-white to-accent-green-soft/40 p-4 shadow-sm shadow-primary/10">
              <div className="flex items-start gap-3">
                {detail.module === 'sports' && (
                  <div
                    className="grid h-[64px] w-[64px] flex-shrink-0 place-items-center rounded-card shadow-sm"
                    style={{ background: visualForBranch(detail.branchName).thumbBg }}
                    aria-hidden
                  >
                    <Icon2D kind={visualForBranch(detail.branchName).icon} className="h-9 w-9" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone="info">{detail.moduleLabel}</Badge>
                    <Badge tone="neutral">{detail.branchName}</Badge>
                    {isWaitlist && <Badge tone="warning">Yedek liste</Badge>}
                    {isClosed && <Badge tone="danger">Dolu</Badge>}
                  </div>
                  <h2 className="text-lg font-black leading-snug text-foreground-strong sm:text-xl">{cleanGroupName(detail.name)}</h2>
                  {detail.facilityName && (
                    <p className="type-caption mt-1 inline-flex items-center gap-1 text-foreground-muted">
                      <Building2Icon className="h-3.5 w-3.5 flex-shrink-0" /> {detail.facilityName}
                    </p>
                  )}
                  {detail.instructorName && (
                    <p className="type-caption mt-1 inline-flex items-center gap-1 text-foreground-muted">
                      <UserRoundIcon className="h-3.5 w-3.5 flex-shrink-0" /> {detail.instructorName}
                    </p>
                  )}
                  <p className="type-caption mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-foreground-muted">
                    <span className="inline-flex items-center gap-1">
                      <UsersIcon className="h-3.5 w-3.5" /> {GENDER_LABEL[detail.gender] ?? detail.gender} · {detail.ageMin}-{detail.ageMax} yaş
                    </span>
                    {detail.participationLimitText && <span className="rounded-full bg-info-soft px-2 py-0.5 text-info">{detail.participationLimitText}</span>}
                  </p>
                </div>
                {detail.serviceFacilityAddress && (
                  <a
                    href={detail.serviceFacilityLatitude != null && detail.serviceFacilityLongitude != null
                      ? directionsUrl({ latitude: detail.serviceFacilityLatitude, longitude: detail.serviceFacilityLongitude })
                      : `https://maps.google.com/?q=${encodeURIComponent(detail.serviceFacilityAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-field bg-white text-primary shadow-sm transition-colors hover:bg-primary hover:text-white"
                    aria-label="Haritada aç"
                  >
                    <NavigationIcon className="h-5 w-5" />
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-card border border-border/70 bg-white p-2.5 shadow-sm shadow-primary/5">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-field bg-surface-1 px-2 py-3">
                  <p className="text-2xl font-black leading-tight text-foreground-strong tabular-nums">{detail.capacity.toLocaleString('tr-TR')}</p>
                  <p className="type-caption text-foreground-muted">Kontenjan</p>
                </div>
                <div className="rounded-field bg-primary-soft px-2 py-3">
                  <p className="text-2xl font-black leading-tight text-foreground-strong tabular-nums">{detail.registeredCount.toLocaleString('tr-TR')}</p>
                  <p className="type-caption text-foreground-muted">Kayıtlı</p>
                </div>
                <div className={`rounded-field px-2 py-3 ${free > 0 ? 'bg-success-soft' : 'bg-danger-soft'}`}>
                  <p className={`text-2xl font-black leading-tight tabular-nums ${free > 0 ? 'text-success' : 'text-danger'}`}>{free.toLocaleString('tr-TR')}</p>
                  <p className="type-caption text-foreground-muted">Boş</p>
                </div>
              </div>
              {detail.capacity > 0 && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-1">
                  <div
                    className={`h-full rounded-full transition-all ${free > 0 ? 'bg-success' : 'bg-danger'}`}
                    style={{ width: `${Math.min(100, Math.round((detail.registeredCount / detail.capacity) * 100))}%` }}
                  />
                </div>
              )}
            </div>

          {existingApplications && existingApplications.length > 0 && (
            <div className={`rounded-card border p-3 space-y-3 ${SOFT_CARD}`}>
              <p className="type-label text-foreground-muted">Başvuru Durumu</p>
              {(() => {
                const primary = existingApplications.find((a) => a.isSelf) ?? existingApplications[0]
                return <ApplicationStatusStepper status={primary.status} className="px-1" />
              })()}
              <div className="space-y-1.5 border-t border-border/60 pt-2">
                {existingApplications.map((a, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <p className="type-body-strong">{a.isSelf ? 'Ben' : a.personName}</p>
                    <ApplicationStatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {windowClosed && (
            <div className="rounded-card border border-danger/30 bg-danger-soft p-3">
              <p className="type-caption text-foreground">
                {detail.applicationClosedReason ?? 'Bu program için başvurular kapalıdır.'}
              </p>
              {detail.applicationStartDate && (
                <p className="type-caption mt-1 text-foreground-muted">
                  Başvuru başlangıcı: {formatDate(detail.applicationStartDate)}
                </p>
              )}
            </div>
          )}
          {!windowClosed && isWaitlist && (
            <div className="rounded-card border border-warning/30 bg-warning-soft p-3">
              <p className="type-caption text-foreground">
                Bu programın kontenjanı dolu. Başvurunuz <span className="font-semibold">yedek listesine</span> alınır; yer açıldığında sıraya göre değerlendirilir.
              </p>
            </div>
          )}
          {!windowClosed && isClosed && (
            <div className="rounded-card border border-danger/30 bg-danger-soft p-3">
              <p className="type-caption text-foreground">Bu programın kontenjanı ve yedek listesi dolu. Şu an başvuru alınamıyor.</p>
            </div>
          )}

          {(detail.serviceFacilityName || detail.facilityName) && (
            <div className={`rounded-card border p-3 ${SOFT_CARD}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-field bg-accent-blue-soft text-accent-blue">
                      <Building2Icon className="h-4 w-4" />
                    </span>
                    <p className="type-body-strong">{detail.facilityName || detail.serviceFacilityName}</p>
                    {detail.hasParking && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-semibold text-info">
                        <CarIcon className="h-3 w-3" />
                        Otopark{detail.parkingCapacity ? ` · ${detail.parkingCapacity} araçlık` : ''}
                      </span>
                    )}
                  </div>
                  {detail.serviceFacilityName && detail.serviceFacilityName !== detail.facilityName && (
                    <p className="type-caption mt-0.5 pl-10 text-foreground-muted">{detail.serviceFacilityName}</p>
                  )}
                  {detail.serviceFacilityAddress && (
                    <p className="type-caption mt-1 pl-10 text-foreground-muted">{detail.serviceFacilityAddress}</p>
                  )}
                  <div className="mt-1 pl-10">
                    <DistanceBadge
                      distanceOnly
                      target={detail.serviceFacilityLatitude != null && detail.serviceFacilityLongitude != null
                        ? { latitude: detail.serviceFacilityLatitude, longitude: detail.serviceFacilityLongitude }
                        : null}
                    />
                  </div>
                </div>
                {detail.serviceFacilityAddress && (
                  <a
                    href={detail.serviceFacilityLatitude != null && detail.serviceFacilityLongitude != null
                      ? directionsUrl({ latitude: detail.serviceFacilityLatitude, longitude: detail.serviceFacilityLongitude })
                      : `https://maps.google.com/?q=${encodeURIComponent(detail.serviceFacilityAddress)}`}
                    target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-field bg-primary-soft text-primary transition-colors hover:bg-primary hover:text-white" aria-label="Haritada aç"
                  >
                    <NavigationIcon className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          )}

          {scheduleGroups && (
            <div className="space-y-2">
              <p className="type-label">Program Takvimi</p>
              <div className="overflow-hidden rounded-card border border-border/70 bg-white shadow-sm shadow-primary/5">
                {(detail.periodStart || detail.periodEnd) && (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-accent-blue-soft to-white px-3 py-2.5 border-b border-border/60">
                    <CalendarRangeIcon className="h-4 w-4 flex-shrink-0 text-accent-blue" />
                    <span className="type-caption text-foreground-muted">
                      {detail.periodStart ? formatDate(detail.periodStart) : ''}
                      {detail.periodEnd ? ` — ${formatDate(detail.periodEnd)}` : ''}
                    </span>
                  </div>
                )}
                <div className="divide-y divide-border/60 bg-surface-0">
                  {scheduleGroups.daySlots.map((ds, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-3 px-3 py-3">
                      <span className={`rounded-pill border px-3 py-1 text-xs font-bold min-w-11 text-center flex-shrink-0 ${DAY_CHIP[ds.day] ?? 'border-border bg-surface-1 text-foreground'}`}>
                        {DAY_TR[ds.day] ?? ds.day}
                      </span>
                      <div className="ml-auto flex items-center gap-1 rounded-full bg-surface-1 px-2.5 py-1">
                        <ClockIcon className="h-3.5 w-3.5 text-foreground-muted" />
                        <span className="tabular-nums text-sm font-semibold text-foreground">{ds.st}–{ds.et}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {scheduleGroups.cancelledCount > 0 && (
                  <div className="border-t border-border bg-danger-soft px-3 py-2">
                    <p className="type-caption text-danger">{scheduleGroups.cancelledCount} seans iptal edildi</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {detail.descriptionHtml && (
            <Collapsible icon={InfoIcon} title="Açıklama" defaultOpen>
              <p className="type-caption whitespace-pre-line text-foreground">{detail.descriptionHtml}</p>
            </Collapsible>
          )}

          {rules.length > 0 && (
            <Collapsible icon={ListChecksIcon} title="Kurallar">
              <ul className="space-y-1.5">
                {rules.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" />
                    <span className="type-caption text-foreground">{r}</span>
                  </li>
                ))}
              </ul>
            </Collapsible>
          )}

          {detail.aboutHtml && (
            <Collapsible icon={InfoIcon} title="Etkinlik Hakkında">
              <p className="type-caption whitespace-pre-line text-foreground">{detail.aboutHtml}</p>
            </Collapsible>
          )}

          {detail.applicationConditions && (
            <Collapsible icon={FileTextIcon} title="Başvuru Koşulları">
              <p className="type-caption whitespace-pre-line text-foreground">{detail.applicationConditions}</p>
            </Collapsible>
          )}

          {prerequisiteBlocked && (
            <div className="flex items-start gap-2 rounded-card border border-danger/30 bg-danger-soft px-3 py-3 shadow-sm">
              <LockIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
              <p className="type-caption text-foreground">
                Bu programa başvurabilmek için önce <strong>{detail.prerequisiteGroupName ?? 'önkoşul programı'}</strong>'na kayıtlı olmanız/tamamlamış olmanız gerekir.
              </p>
            </div>
          )}

          {customQuestions.length > 0 && (
            <div className="space-y-3 rounded-card border border-border bg-white px-3 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <HelpCircleIcon className="h-4 w-4 flex-shrink-0 text-primary" />
                <p className="type-label">Başvuru Soruları</p>
              </div>
              {customQuestions.map((q) => (
                <div key={q.id} className="space-y-1.5">
                  <p className="type-caption text-foreground">
                    {q.question}{q.required && <span className="text-danger"> *</span>}
                  </p>
                  <div className="flex gap-2">
                    {(['yes', 'no'] as const).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCustomAnswers((prev) => ({ ...prev, [q.id]: val }))}
                        className="flex-1 rounded-field border px-3 py-2 text-sm font-medium transition-colors"
                        style={{
                          borderColor: customAnswers[q.id] === val ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                          background: customAnswers[q.id] === val ? 'hsl(var(--primary-soft))' : '#fff',
                          color: customAnswers[q.id] === val ? 'hsl(var(--primary))' : 'hsl(var(--foreground-muted))',
                        }}
                      >
                        {val === 'yes' ? 'Evet' : 'Hayır'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {requiresDocs && (
            <div className="space-y-2 rounded-card border border-warning/30 bg-warning-soft overflow-hidden shadow-sm">
              <div className="flex items-start gap-2 px-3 pt-3 pb-2">
                <FileTextIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                <p className="type-caption">{detail.documentsMessage ?? 'Bu programa başvuru için belge yüklenmesi gerekir. Her seferinde tek kişi başvurabilirsiniz.'}</p>
              </div>
              <div className="divide-y divide-warning/20 border-t border-warning/20">
                {requiredDocuments.map((d) => {
                  const uploaded = uploadedDocuments?.find((ud) => ud.type === d.key || ud.label === d.label)
                  return (
                    <div key={d.key} className="flex items-center gap-2 px-3 py-2">
                      <FileTextIcon className="h-3.5 w-3.5 flex-shrink-0 text-warning" />
                      <div className="min-w-0 flex-1">
                        <p className="type-caption">{d.label}</p>
                        {uploaded && <p className="type-caption text-foreground-muted truncate">{uploaded.fileName}</p>}
                      </div>
                      {uploaded
                        ? <span className="shrink-0 text-[10px] font-semibold text-success bg-success-soft rounded-full px-2 py-0.5">Yüklendi</span>
                        : d.required
                          ? <span className="shrink-0 text-[10px] font-semibold text-danger bg-danger-soft rounded-full px-2 py-0.5">Zorunlu</span>
                          : <span className="shrink-0 text-[10px] font-semibold text-foreground-muted bg-surface-1 rounded-full px-2 py-0.5">Opsiyonel</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {detail.applicants.length > 1 && (
          <div className="space-y-2">
            <div>
              <p className="type-label">{requiresDocs ? 'Kimin için başvuruyorsunuz?' : 'Kimler için başvuruyorsunuz?'}</p>
              <p className="type-caption mt-0.5 text-foreground-muted">
                {requiresDocs
                  ? 'Uygun kişi seçili geldi. Farklı biri için değiştirebilirsiniz.'
                  : 'Uygun kişi seçili geldi. Dokunarak kişi ekleyebilir veya çıkarabilirsiniz.'}
              </p>
            </div>
            {detail.applicants.map((a) => {
              const disabled = a.alreadyApplied || !a.eligible
              const desc = a.alreadyApplied
                ? 'Bu programa başvurdu'
                : !a.eligible
                  ? (a.ineligibleReason ?? 'Bu programa uygun değil')
                  : `${a.age} yaş · ${GENDER_LABEL[a.gender] ?? a.gender}`
              const avatar = facilityApplicantAvatar(a)
              const isSel = selectedIds.has(a.participantId)
              return (
                <button
                  key={a.participantId}
                  type="button"
                  disabled={disabled}
                  aria-pressed={isSel}
                  onClick={() => toggle(a.participantId)}
                  className="flex w-full items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors bg-white shadow-sm shadow-primary/5 disabled:cursor-not-allowed"
                  style={{
                    borderColor: isSel ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                    background: isSel ? 'hsl(var(--primary-soft))' : '#fff',
                    opacity: disabled ? 0.6 : 1,
                  }}
                >
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-field"
                    style={{ background: avatar.bg }}
                  >
                    <avatar.Icon className="h-[18px] w-[18px]" style={{ color: avatar.fg }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${isSel ? 'text-primary' : 'text-foreground-strong'}`}>
                      {a.isSelf ? `${a.fullName} (Ben)` : a.fullName}
                    </span>
                    <span className="mt-0.5 block type-caption">{desc}</span>
                  </span>
                  {a.alreadyApplied && <CheckCircle2Icon className="h-4 w-4 flex-shrink-0 text-success" />}
                  {!a.eligible && !a.alreadyApplied && <AlertCircleIcon className="h-4 w-4 flex-shrink-0 text-warning" />}
                </button>
              )
            })}
          </div>
          )}

          {requiresDocs && selected.length === 1 && (
            <div className="space-y-2">
              <p className="type-label">Belgeler</p>
              {requiredDocuments.map((d) => {
                const uploaded = docsByType[d.key]
                const isUploading = uploadingType === d.key
                return (
                  <div key={d.key} className="flex items-center justify-between gap-2 rounded-card border border-border px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="type-body truncate">{d.label}</span>
                        {d.required ? <Badge tone="danger">Zorunlu</Badge> : <Badge tone="neutral">Opsiyonel</Badge>}
                      </div>
                      {d.allowedFormats && d.allowedFormats.length > 0 && (
                        <p className="type-caption text-text-3">{d.allowedFormats.map((f) => f.toUpperCase()).join(', ')}</p>
                      )}
                      {uploaded && <p className="type-caption mt-0.5 inline-flex items-center gap-1 text-success"><CheckCircle2Icon className="h-3.5 w-3.5" /> {uploaded.fileName}</p>}
                    </div>
                    <Button
                      variant={uploaded ? 'ghost' : 'outline'}
                      size="sm"
                      disabled={isUploading}
                      iconLeft={isUploading ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <UploadIcon className="h-4 w-4" />}
                      onClick={() => pickFile(d)}
                    >
                      {uploaded ? 'Değiştir' : 'Yükle'}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          {!windowClosed && !isClosed && !noEligible && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-card border border-border bg-surface-1 p-3">
              <span className="mt-0.5">
                <Checkbox checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(v === true)} />
              </span>
              <span className="type-caption text-foreground">
                <span className="font-semibold text-foreground-strong">Başvuru şartlarını ve kuralları</span> okudum, kabul ediyorum. Program kurallarına uyacağımı taahhüt ederim.
              </span>
            </label>
          )}

          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFileChange} />
          </div>
        </div>
      )}
    </Modal>
  )
}
