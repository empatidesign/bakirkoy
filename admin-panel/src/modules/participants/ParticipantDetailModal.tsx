import { useState, useEffect, useCallback } from 'react'
import {
  PhoneIcon, MailIcon, FingerprintIcon, CalendarDaysIcon, CheckCircle2Icon,
  ClockIcon, PercentIcon, ClipboardListIcon, UsersIcon, ActivityIcon, FileTextIcon,
  ShieldOffIcon, BarChart3Icon, AwardIcon, Users2Icon, MapPinIcon,
  ShieldCheckIcon, CalendarIcon, TrendingUpIcon, StarIcon,
  ZapIcon, HeartIcon, PowerIcon, PowerOffIcon, BanIcon, Trash2Icon, SchoolIcon,
  XIcon, ExternalLinkIcon, Loader2Icon, SaveIcon, PencilIcon, BellIcon, KeyRoundIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { openCitizenPortalAs } from '@/lib/citizenBypass'
import {
  Modal, ConfirmModal, Badge, Button, StatCard, Card, EmptyState,
  SkeletonRows, Textarea,
} from '@/design-system'
import { formatDate, maskTC } from '@/lib/utils'
import { formatAddressLine, isBakirkoyResident } from '@/lib/residency'
import { useAuth } from '@/framework/auth/AuthContext'
import participantService from '@/services/participant.service'
import type { ParticipantDetail, ParticipantStatus } from '@/types/participant.types'
import {
  PARTICIPANT_STATUS_LABELS, PARTICIPANT_STATUS_TONE, GENDER_LABELS,
  ATTENDANCE_LABELS, ATTENDANCE_TONE,
} from '@/types/participant.types'
import { ParticipantEventsView } from './ParticipantEventsView'
import { ParticipantBlockModal } from './ParticipantBlockModal'
import { ParticipantEducationView } from './ParticipantEducationView'
import { ParticipantServiceUsageView } from './ParticipantServiceUsageView'
import { ParticipantActivityTimelineView } from './ParticipantActivityTimelineView'
import { ParticipantSurveysView } from './ParticipantSurveysView'
import { ParticipantNotificationsView } from './ParticipantNotificationsView'
import { ParticipantAppointmentKeyView } from './ParticipantAppointmentKeyView'

interface PendingAction {
  title: string
  description: string
  tone: 'danger' | 'primary'
  confirmLabel: string
  run: () => void
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  Active: { color: '#16a34a', bg: '#dcfce7' },
  Passive: { color: '#64748b', bg: '#f1f5f9' },
  Blocked: { color: '#dc2626', bg: '#fee2e2' },
  Deleted: { color: '#94a3b8', bg: '#f1f5f9' },
}

const initials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()

export const ParticipantDetailModal = ({
  id, open, onClose, onMutated, initialTab,
}: { id: string; open: boolean; onClose: () => void; onMutated?: () => void; initialTab?: string }) => {
  const { can } = useAuth()
  const [detail, setDetail] = useState<ParticipantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(initialTab ?? 'overview')
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [blockOpen, setBlockOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [bypassing, setBypassing] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)

  const openBypass = async () => {
    if (!can('participants.impersonate')) return
    setBypassing(true)
    try { await openCitizenPortalAs(id) } finally { setBypassing(false) }
  }

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try { setDetail(await participantService.getById(id)); setEditingNotes(false) } catch { setDetail(null) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { if (open) { setTab(initialTab ?? 'overview'); fetchDetail() } }, [open, fetchDetail, initialTab])

  const changeStatus = async (status: ParticipantStatus, msg: string, reason?: string) => {
    setWorking(true)
    try { await participantService.setStatus(id, status, reason); toast.success(msg); await fetchDetail(); onMutated?.() }
    finally { setWorking(false); setPending(null) }
  }
  const removeParticipant = async () => {
    setWorking(true)
    try { await participantService.delete(id); toast.success('Katılımcı silindi.'); onMutated?.(); onClose() }
    finally { setWorking(false); setPending(null) }
  }

  const statusActions = (d: ParticipantDetail) => {
    if (d.status === 'Deleted') return null
    return (
      <div className="flex flex-wrap gap-2">
        {d.status === 'Passive' && (
          <Button
            variant="outline"
            size="sm"
            className="border-white/30 bg-white/15 text-white hover:bg-white/25"
            iconLeft={<PowerIcon className="h-3.5 w-3.5" />}
            isLoading={working}
            onClick={() => changeStatus('Active', 'Katılımcı aktif edildi.')}
          >
            Aktif Et
          </Button>
        )}
        {d.status === 'Active' && (
          <Button
            variant="outline"
            size="sm"
            className="border-white/30 bg-white/15 text-white hover:bg-white/25"
            iconLeft={<PowerOffIcon className="h-3.5 w-3.5" />}
            onClick={() => setPending({ title: 'Pasife Al', description: `"${d.fullName}" pasife alınacak; girişi kısıtlanır.`, tone: 'primary', confirmLabel: 'Onayla', run: () => changeStatus('Passive', 'Katılımcı pasife alındı.') })}
          >
            Pasife Al
          </Button>
        )}
        {d.status === 'Blocked'
          ? (
            <Button
              variant="outline"
              size="sm"
              className="border-white/30 bg-white/15 text-white hover:bg-white/25"
              iconLeft={<ShieldCheckIcon className="h-3.5 w-3.5" />}
              isLoading={working}
              onClick={() => changeStatus('Active', 'Engel kaldırıldı.')}
            >
              Engeli Kaldır
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="border-danger/30 bg-card text-danger hover:bg-danger-soft"
              iconLeft={<BanIcon className="h-3.5 w-3.5" />}
              onClick={() => setBlockOpen(true)}
            >
              Engelle
            </Button>
          )}
        <Button
          variant="danger"
          size="sm"
          iconLeft={<Trash2Icon className="h-3.5 w-3.5" />}
          onClick={() => setPending({ title: 'Katılımcıyı Sil', description: `"${d.fullName}" silinecek (silinmiş olarak işaretlenecek). Devam edilsin mi?`, tone: 'danger', confirmLabel: 'Evet, Sil', run: removeParticipant })}
        >
          Sil
        </Button>
      </div>
    )
  }

  const tabs = [
    { key: 'overview', label: 'Genel Bakış', icon: ActivityIcon },
    { key: 'family', label: 'Aile Bilgisi', icon: Users2Icon },
    { key: 'events', label: 'Etkinlikler', icon: CalendarDaysIcon },
    { key: 'reports', label: 'Zaman Çizelgesi', icon: BarChart3Icon },
    { key: 'surveys', label: 'Anketler', icon: ClipboardListIcon },
    { key: 'notifications', label: 'Bildirimler', icon: BellIcon },
    { key: 'programs', label: 'Hizmet Kayıtları', icon: AwardIcon },
    { key: 'education', label: 'Eğitim', icon: SchoolIcon },
    { key: 'notes', label: 'Admin Notları', icon: FileTextIcon },
    { key: 'appointmentKey', label: 'Randevu Key', icon: KeyRoundIcon },
    { key: 'profile', label: 'Profil', icon: FingerprintIcon },
  ]

  const statusStyle = detail ? (STATUS_COLORS[detail.status] ?? STATUS_COLORS.Active) : STATUS_COLORS.Active
  const addressLine = detail ? formatAddressLine({ fullAddress: detail.address, city: detail.city, district: detail.district, neighborhood: detail.neighborhood, districtCode: detail.districtCode }) : ''

  return (
    <Modal open={open} onClose={onClose} width={1320} className="max-w-[96vw] overflow-hidden rounded-xl" hideCloseButton>
      {loading || !detail ? (
        <div className="p-6"><SkeletonRows rows={8} /></div>
      ) : (
        <div className="max-h-[92vh] overflow-y-auto bg-surface-2">
          <div className="relative overflow-hidden border-b border-white/10 ds-hero">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
              title="Kapat"
            >
              <XIcon className="h-5 w-5" />
            </button>
            <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
            <div className="absolute -bottom-6 right-24 h-32 w-32 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
            <div className="absolute left-0 bottom-0 h-24 w-24 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />

            <div className="relative px-6 py-6 pr-16 lg:px-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative shrink-0">
                    {detail.photoUrl
                      ? <img src={detail.photoUrl} alt="" className="h-[72px] w-[72px] rounded-xl object-cover shadow-xl" style={{ border: '3px solid rgba(255,255,255,0.25)' }} />
                      : (
                        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-xl text-xl font-bold text-white shadow-xl" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                          {initials(detail.fullName)}
                        </span>
                      )
                    }
                    <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-md" style={{ backgroundColor: statusStyle.color }} />
                    {detail.isMinor && (
                      <span className="absolute -top-1.5 -left-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-amber-500 shadow-md">
                        <span className="text-[8px] font-bold text-white">18-</span>
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-xl font-bold tracking-tight text-white">{detail.fullName}</h3>
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: statusStyle.color, backgroundColor: 'rgba(255,255,255,0.88)' }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusStyle.color }} />
                        {PARTICIPANT_STATUS_LABELS[detail.status]}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        <ShieldCheckIcon className="h-3 w-3" />
                        {detail.isVerified ? 'Doğrulandı' : 'Bekliyor'}
                      </span>
                      {(detail.sedaEducations ?? []).slice(0, 2).map((e) => (
                        <span key={e.academicYear} className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                          <SchoolIcon className="h-3 w-3" />
                          SEDA {e.academicYear}
                        </span>
                      ))}
                      {(detail.sedaEducations?.length ?? 0) > 2 && (
                        <span className="inline-flex items-center rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                          +{(detail.sedaEducations?.length ?? 0) - 2}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="flex items-center gap-1.5 text-[12px] text-white/75">
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/15">
                          <FingerprintIcon className="h-3 w-3 text-white" />
                        </div>
                        T.C. {maskTC(detail.tckn)}
                      </span>
                      <span className="flex items-center gap-1.5 text-[12px] text-white/75">
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/15">
                          <CalendarDaysIcon className="h-3 w-3 text-white" />
                        </div>
                        {detail.age} yaş
                      </span>
                      {detail.phone && (
                        <span className="flex max-w-[420px] items-center gap-1.5 text-[12px] text-white/75">
                          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/15">
                            <PhoneIcon className="h-3 w-3 text-white" />
                          </div>
                          {detail.phone}
                        </span>
                      )}
                      {addressLine && (
                        <span className="flex items-center gap-1.5 text-[12px] text-white/75">
                          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/15">
                            <MapPinIcon className="h-3 w-3 text-white" />
                          </div>
                          <span className="truncate">{addressLine}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-[12px] text-white/75">
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/15">
                          <CalendarIcon className="h-3 w-3 text-white" />
                        </div>
                        Kayıt: {detail.registeredAt ? formatDate(detail.registeredAt) : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-2 xl:items-end">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-200">Hızlı İşlemler</p>
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/10 p-2 backdrop-blur-sm xl:justify-end">
                    {can('participants.impersonate') && (
                      <button
                        type="button"
                        onClick={openBypass}
                        disabled={bypassing}
                        className="flex h-9 items-center gap-1.5 rounded-lg bg-card px-3 text-xs font-bold text-foreground-strong shadow-sm transition-colors hover:bg-primary-soft disabled:opacity-60"
                        title="Vatandaş portalını bu kişi olarak görüntüle"
                      >
                        {bypassing ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <ExternalLinkIcon className="h-3.5 w-3.5 text-blue-600" />}
                        Portalı Görüntüle
                      </button>
                    )}
                    {statusActions(detail)}
                  </div>
                </div>
              </div>

              {detail.status === 'Blocked' && detail.blockReason && (
                <div className="mt-[15px] flex items-start gap-2 rounded-lg border border-white/30 bg-white/15 px-4 py-3">
                  <ShieldOffIcon className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  <p className="text-[12px]"><span className="font-semibold text-white">Engel sebebi: </span><span className="text-white/80">{detail.blockReason}</span></p>
                </div>
              )}
            </div>
          </div>

          <div className="sticky top-0 z-30 flex items-stretch gap-1 overflow-x-auto border-b border-border bg-card/95 px-3 shadow-sm backdrop-blur scrollbar-thin lg:px-5">
            {tabs.map(({ key, label, icon: Icon }) => {
              const active = tab === key
              return (
                <button
                  key={key}
                  type="button"
                  className={[
                    'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-3 text-[13px] transition-colors duration-150',
                    active ? 'font-semibold text-primary' : 'font-medium text-foreground-muted hover:text-foreground-strong',
                  ].join(' ')}
                  onClick={() => setTab(key)}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary' : 'text-foreground-subtle'}`} />
                  <span>{label}</span>
                  {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />}
                </button>
              )
            })}
          </div>

          <div className="space-y-4 bg-surface-2 p-5 pb-6 lg:p-6">
            {tab === 'overview' && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <StatCard label="Toplam Etkinlik" value={detail.stats.totalEvents} icon={CalendarDaysIcon} accent="blue" size="compact" className="rounded-lg border-border shadow-none" />
                <StatCard label="Tamamlanan" value={detail.stats.completedEvents} icon={CheckCircle2Icon} accent="green" size="compact" className="rounded-lg border-border shadow-none" />
                <StatCard label="Devam Eden" value={detail.stats.ongoingEvents} icon={ClockIcon} accent="orange" size="compact" className="rounded-lg border-border shadow-none" />
                <StatCard label="Katılım Oranı" value={`%${detail.stats.attendanceRate}`} icon={PercentIcon} accent="violet" size="compact" className="rounded-lg border-border shadow-none" />
                <StatCard label="Anket Katılım" value={detail.stats.surveyParticipation} icon={ClipboardListIcon} accent="primary" size="compact" className="rounded-lg border-border shadow-none" />
              </div>
            )}
            {tab === 'overview' && (
              <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
                <Card padded className="min-h-[420px] shadow-sm">
                  <div className="mb-4 flex items-center gap-3 border-b border-border/70 pb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #2563eb20, #2563eb10)' }}>
                      <CalendarDaysIcon className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground-strong">Son Etkinlikler</h4>
                  </div>
                  {detail.recentEvents.length ? (
                    <div className="space-y-0">
                      {detail.recentEvents.map((ev, i) => (
                        <div key={ev.id} className="flex items-center justify-between gap-3 py-3 last:pb-0" style={{ borderBottom: i < detail.recentEvents.length - 1 ? '1px solid #f1f5f9' : undefined }}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <CalendarIcon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="type-body-strong truncate">{ev.eventName}</p>
                              <p className="type-caption">{formatDate(ev.date)}{ev.time ? ` · ${ev.time}` : ''} · {ev.venue}</p>
                            </div>
                          </div>
                          <Badge tone={ATTENDANCE_TONE[ev.attendance]}>{ATTENDANCE_LABELS[ev.attendance]}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={CalendarDaysIcon} title="Etkinlik yok" description="Henüz katılım kaydı bulunmuyor." />
                  )}
                </Card>

                <div className="space-y-4">
                  <Card padded className="shadow-sm">
                    <div className="mb-4 flex items-center gap-3 border-b border-border/70 pb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #16a34a20, #16a34a10)' }}>
                        <MailIcon className="h-4 w-4 text-success" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground-strong">İletişim</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: 'linear-gradient(135deg, #f0fdf4, #f8fffe)' }}>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-success-soft">
                          <PhoneIcon className="h-3.5 w-3.5 text-success" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">Telefon</p>
                          <p className="text-[12px] font-semibold text-foreground-default">{detail.phone ?? '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: 'linear-gradient(135deg, #eff6ff, #f5f8ff)' }}>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-info-soft">
                          <MailIcon className="h-3.5 w-3.5 text-info" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">E-posta</p>
                          <p className="truncate text-[12px] font-semibold text-foreground-default">{detail.email ?? '—'}</p>
                        </div>
                      </div>
                      {detail.isMinor && (
                        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warning-soft">
                            <PhoneIcon className="h-3.5 w-3.5 text-warning" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-medium text-warning uppercase tracking-wide">Veli Telefonu</p>
                            <p className="text-[12px] font-semibold text-foreground-default">{detail.guardianPhone ?? '—'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card padded className="shadow-sm overflow-hidden">
                    <div className="mb-4 flex items-center gap-3 border-b border-border/70 pb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #0f4c8120, #0f4c8110)' }}>
                        <TrendingUpIcon className="h-4 w-4 text-[#0f4c81]" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground-strong">Bu Ay</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Etkinlik', value: detail.monthly.events, color: '#2563eb', bg: '#eff6ff', icon: CalendarDaysIcon },
                        { label: 'Saat', value: detail.monthly.hours, color: '#7c3aed', bg: '#f5f3ff', icon: ClockIcon },
                        { label: 'Puan', value: `+${detail.monthly.points}`, color: '#16a34a', bg: '#f0fdf4', icon: StarIcon },
                        { label: 'Katılım', value: `%${detail.monthly.attendanceRate}`, color: '#d97706', bg: '#fffbeb', icon: ZapIcon },
                      ].map(({ label, value, color, bg, icon: Icon }) => (
                        <div key={label} className="rounded-lg px-3 py-3 text-center" style={{ backgroundColor: bg }}>
                          <Icon className="h-3.5 w-3.5 mx-auto mb-1 opacity-50" style={{ color }} />
                          <p className="text-lg font-bold" style={{ color }}>{value}</p>
                          <p className="text-[10px] font-medium text-foreground-muted">{label}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {tab === 'family' && (
              <div className="grid gap-[15px] lg:grid-cols-2">
                <Card padded className="shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Users2Icon className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground-strong">Çocuklar</h4>
                    {detail.children.length > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">{detail.children.length}</span>
                    )}
                  </div>
                  {detail.children.length ? (
                    <div className="space-y-2">
                      {detail.children.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3" style={{ background: 'linear-gradient(135deg, #faf5ff, #f5f3ff)' }}>
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #a78bfa)' }}>
                            {initials(c.fullName)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-semibold text-foreground-strong">{c.fullName}</p>
                            <p className="text-[11px] text-foreground-muted">{c.age} yaş · {GENDER_LABELS[c.gender]} · TC {maskTC(c.tckn)}</p>
                          </div>
                          <Badge tone={PARTICIPANT_STATUS_TONE[c.status]}>{PARTICIPANT_STATUS_LABELS[c.status]}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState icon={Users2Icon} title="Çocuk kaydı yok" description="Bu kullanıcıya bağlı çocuk bulunmuyor." />}
                </Card>

                <Card padded className="shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
                      <HeartIcon className="h-4 w-4 text-success" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground-strong">Veliler</h4>
                  </div>
                  {detail.guardians.length ? (
                    <div className="space-y-2">
                      {detail.guardians.map((g) => (
                        <div key={g.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3" style={{ background: 'linear-gradient(135deg, #f0fdf4, #f8fffe)' }}>
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
                            style={{ background: 'linear-gradient(135deg, #059669, #34d399)' }}>
                            {initials(g.fullName)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-foreground-strong">{g.fullName}</p>
                            {g.relation && <p className="text-[11px] text-foreground-muted">{g.relation}</p>}
                          </div>
                          {g.phone && (
                            <span className="flex items-center gap-1 text-[11px] text-foreground-muted">
                              <PhoneIcon className="h-3 w-3" />{g.phone}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState icon={UsersIcon} title="Veli kaydı yok" description="Bağlı veli bulunmuyor." />}
                </Card>
              </div>
            )}

            {tab === 'events' && <ParticipantEventsView participant={detail} />}
            {tab === 'education' && <ParticipantEducationView participant={detail} />}

            {tab === 'notes' && (
              <Card padded className="shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
                    <FileTextIcon className="h-4 w-4 text-foreground-muted" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground-strong">Admin Notları</h4>
                  <div className="ml-auto flex items-center gap-2">
                    {!editingNotes ? (
                      <Button
                        size="sm"
                        variant="outline"
                        iconLeft={<PencilIcon className="h-3.5 w-3.5" />}
                        onClick={() => { setNotesValue(detail.adminNotes ?? ''); setEditingNotes(true) }}
                      >
                        {detail.adminNotes ? 'Düzenle' : 'Not Ekle'}
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingNotes(false)}
                        >
                          İptal
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          iconLeft={notesSaving ? undefined : <SaveIcon className="h-3.5 w-3.5" />}
                          isLoading={notesSaving}
                          onClick={async () => {
                            setNotesSaving(true)
                            try {
                              await participantService.updateAdminNotes(id, notesValue.trim() || null)
                              toast.success('Not kaydedildi.')
                              await fetchDetail()
                            } finally {
                              setNotesSaving(false)
                            }
                          }}
                        >
                          Kaydet
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {editingNotes ? (
                  <Textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    placeholder="Bu katılımcıya ait admin notunu buraya yazın..."
                    rows={6}
                    maxLength={2000}
                  />
                ) : detail.adminNotes ? (
                  <p className="type-body whitespace-pre-wrap rounded-lg bg-surface-1 p-4 border border-border/40">{detail.adminNotes}</p>
                ) : (
                  <p className="type-muted">Bu katılımcı için not eklenmemiş.</p>
                )}
              </Card>
            )}

            {tab === 'profile' && (
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
                  <Card padded className="shadow-sm">
                    <div className="mb-4 flex items-center gap-3 border-b border-border/70 pb-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <FingerprintIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground-strong">Kişisel Bilgiler</h4>
                        <p className="text-xs text-foreground-muted">Katılımcının kayıtlı kimlik detayları</p>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ['Ad Soyad', detail.fullName],
                        ['T.C. Kimlik Numarası', maskTC(detail.tckn)],
                        ['Doğum Tarihi', detail.birthDate ? formatDate(detail.birthDate) : '—'],
                        ['Yaş', `${detail.age} yaş`],
                        ['Cinsiyet', GENDER_LABELS[detail.gender]],
                        ['Kayıt Tarihi', detail.registeredAt ? formatDate(detail.registeredAt) : '—'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-border/70 bg-surface-1 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">{label}</p>
                          <p className="mt-1 text-sm font-semibold text-foreground-strong">{value}</p>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <div className="space-y-4">
                    <Card padded className="shadow-sm">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-soft">
                          <MapPinIcon className="h-4 w-4 text-success" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-foreground-strong">Adres Bilgisi</h4>
                          <p className="text-xs text-foreground-muted">İkamet ve bölge durumu</p>
                        </div>
                      </div>
                      <div className="rounded-lg border border-success/20 bg-success-soft/50 p-4">
                        <p className="text-sm font-semibold leading-6 text-foreground-strong">{addressLine || 'Adres bilgisi bulunmuyor.'}</p>
                        <span className="mt-3 inline-flex rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
                          {isBakirkoyResident({
                            fullAddress: detail.address,
                            city: detail.city,
                            district: detail.district,
                            neighborhood: detail.neighborhood,
                            districtCode: detail.districtCode,
                          }) ? 'Bakırköy sakini' : 'Bakırköy dışı'}
                        </span>
                      </div>
                    </Card>

                    <Card padded className="shadow-sm">
                      <h4 className="mb-3 text-sm font-bold text-foreground-strong">Hesap Durumu</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5">
                          <span className="text-sm text-foreground-muted">Katılımcı durumu</span>
                          <Badge tone={PARTICIPANT_STATUS_TONE[detail.status]}>{PARTICIPANT_STATUS_LABELS[detail.status]}</Badge>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5">
                          <span className="text-sm text-foreground-muted">Kimlik doğrulama</span>
                          <Badge tone={detail.isVerified ? 'info' : 'neutral'}>{detail.isVerified ? 'Doğrulandı' : 'Bekliyor'}</Badge>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {tab === 'programs' && <ParticipantServiceUsageView participantId={id} />}

            {tab === 'reports' && <ParticipantActivityTimelineView participant={detail} />}

            {tab === 'surveys' && <ParticipantSurveysView participant={detail} />}

            {tab === 'notifications' && <ParticipantNotificationsView participant={detail} />}

            {tab === 'appointmentKey' && <ParticipantAppointmentKeyView participantId={id} />}
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={() => pending?.run()}
        icon={pending?.tone === 'danger' ? ShieldOffIcon : undefined}
        tone={pending?.tone ?? 'danger'}
        title={pending?.title ?? ''}
        description={pending?.description}
        confirmLabel={pending?.confirmLabel}
        loading={working}
      />

      <ParticipantBlockModal
        open={blockOpen}
        participantName={detail?.fullName ?? ''}
        loading={working}
        onClose={() => setBlockOpen(false)}
        onConfirm={async (reason) => { await changeStatus('Blocked', 'Katılımcı engellendi.', reason); setBlockOpen(false) }}
      />
    </Modal>
  )
}
