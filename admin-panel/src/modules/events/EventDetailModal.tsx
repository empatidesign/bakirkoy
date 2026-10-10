import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import {
  InfoIcon, ActivityIcon, StarIcon, TagIcon, CalendarIcon, Users2Icon, ChevronLeftIcon, ChevronRightIcon,
  LogInIcon, LogOutIcon, Building2Icon, ArmchairIcon, MapPinIcon, HashIcon, ClockIcon,
} from 'lucide-react'
import excelIcon from '@/assets/icons/excel.png'
import { Modal, Tabs, Badge, DatePicker, IconButton, Button, DetailRow, FormSection, SegmentedControl } from '@/design-system'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import attendanceService from '@/services/attendance.service'
import reviewService from '@/services/review.service'
import type { AdminReviewsDto } from '@/services/review.service'
import type { Event } from '@/types/event.types'
import type { ActivityEntry, ActivitySummary } from '@/types/attendance.types'
import {
  ACTIVITY_KIND_LABELS, ACTION_FILTER_OPTIONS, METHOD_TONE, METHOD_LABELS,
} from '@/types/attendance.types'

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
const todayIso = () => new Date().toISOString().slice(0, 10)
const shiftIso = (iso: string, delta: number) => { const d = new Date(iso); d.setDate(d.getDate() + delta); return d.toISOString().slice(0, 10) }
const fmtDateLong = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
const maskTc = (tc: string) => (tc && tc.length >= 5 ? `${tc.slice(0, 3)}*****${tc.slice(-2)}` : tc)

const toneClass = {
  success: 'border-success/25 bg-success-soft text-success',
  warning: 'border-warning/25 bg-warning-soft text-warning',
  info: 'border-info/25 bg-info-soft text-info',
  primary: 'border-primary/25 bg-primary-soft text-primary',
  neutral: 'border-border bg-surface-1 text-foreground-muted',
} as const

const Metric = ({ value, label, tone }: { value: string | number; label: string; tone: keyof typeof toneClass }) => (
  <div className={`rounded-card border px-3 py-2 shadow-sm ${toneClass[tone]}`}>
    <p className="text-lg font-semibold leading-none tabular-nums">{typeof value === 'number' ? value.toLocaleString('tr-TR') : value}</p>
    <p className="mt-1 text-[10px] font-medium text-foreground-muted">{label}</p>
  </div>
)

const InfoItem = ({
  icon: Icon,
  label,
  color,
  children,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  color?: string
  children: ReactNode
}) => (
  <div
    className="flex gap-3 rounded-card border px-3 py-2.5"
    style={{
      borderColor: color ? `${color}26` : 'hsl(var(--border))',
      background: color ? `${color}0f` : 'hsl(var(--surface-1))',
    }}
  >
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field ring-1"
      style={{
        color: color ?? 'hsl(var(--foreground-muted))',
        background: color ? `${color}16` : 'hsl(var(--surface-0))',
        boxShadow: `0 0 0 1px ${color ? `${color}20` : 'hsl(var(--border))'}`,
      }}
    >
      <Icon className="h-4 w-4" />
    </span>
    <div className="min-w-0">
      <p className="type-caption">{label}</p>
      <div className="type-body-strong mt-0.5 break-words">{children}</div>
    </div>
  </div>
)

const SummaryRow = ({ label, children, tone }: { label: string; children: ReactNode; tone: keyof typeof toneClass }) => (
  <div className={`flex items-center justify-between gap-[15px] rounded-card border px-3 py-2.5 ${toneClass[tone]}`}>
    <span className="type-muted">{label}</span>
    <span className="type-body-strong tabular-nums">{children}</span>
  </div>
)

const DetailsTab = ({ event }: { event: Event }) => {
  const available = Math.max(0, event.capacity - event.registeredCount)
  const fill = event.capacity > 0 ? Math.round((event.registeredCount / event.capacity) * 100) : 0
  const registeredPct = event.capacity > 0 ? Math.min(100, (event.registeredCount / event.capacity) * 100) : 0
  const reservePct = event.capacity > 0 ? Math.min(100 - registeredPct, (event.reserveCount / event.capacity) * 100) : 0
  const availablePct = Math.max(0, 100 - registeredPct - reservePct)
  const coverUrl = event.images?.ratios?.['16:9']?.url || event.images?.ratios?.['4:3']?.url || event.images?.ratios?.['1:1']?.url || event.images?.ratios?.['9:16']?.url || event.images?.web?.cover?.url || event.images?.web?.card?.url || event.images?.mobile?.cover?.url || event.images?.mobile?.card?.url
  const galleryPhotos = (event.images?.photos ?? []).map((p) => p.url).filter(Boolean) as string[]
  return (
    <div className="space-y-[15px]">
      {coverUrl && (
        <div className="overflow-hidden rounded-card border border-border shadow-card">
          <img src={coverUrl} alt={event.name} className="h-44 w-full object-cover" />
        </div>
      )}
      {galleryPhotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {galleryPhotos.map((url, i) => (
            <img key={i} src={url} alt="" className="h-24 w-full rounded-card border border-border object-cover" />
          ))}
        </div>
      )}
      <div
        className="rounded-card border border-border bg-surface-0 p-4 shadow-card"
        style={{
          borderColor: `${event.categoryColor}20`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-[15px]">
          <div>
            <p className="type-caption">Doluluk</p>
            <p className="mt-1 text-xl font-semibold text-foreground-strong tabular-nums">{fill}%</p>
            <p className="mt-1 text-[10px] font-medium text-foreground-muted">{event.registeredCount.toLocaleString('tr-TR')} / {event.capacity.toLocaleString('tr-TR')} kayıtlı</p>
          </div>
          <div className="grid min-w-[18rem] flex-1 grid-cols-2 gap-[15px] sm:grid-cols-4">
            <Metric value={event.registeredCount} label="Kayıtlı" tone="success" />
            <Metric value={event.reserveCount} label="Yedek" tone="warning" />
            <Metric value={available} label="Müsait" tone="info" />
            <Metric value={event.capacity} label="Kontenjan" tone="primary" />
          </div>
        </div>
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-card bg-surface-2 ring-1 ring-border">
          <div className="h-full bg-success" style={{ width: `${registeredPct}%` }} />
          <div className="h-full bg-warning" style={{ width: `${reservePct}%` }} />
          <div className="h-full bg-info" style={{ width: `${availablePct}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-medium text-foreground-subtle">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-success" /> Kayıtlı</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-warning" /> Yedek</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-info" /> Müsait</span>
          </div>
          <span>{event.capacity.toLocaleString('tr-TR')} kişi</span>
        </div>
      </div>

      <div className="grid gap-[15px] md:grid-cols-[1.15fr_0.85fr]">
        <FormSection variant="card" title="Etkinlik Bilgileri" subtitle="Temel kayıt ve konum bilgileri">
          <div className="grid gap-[15px] sm:grid-cols-2">
            <InfoItem icon={TagIcon} label="Kategori" color={event.categoryColor}><Badge color={event.categoryColor}>{event.categoryName}</Badge></InfoItem>
            <InfoItem icon={CalendarIcon} label="Tarih" color="#2563eb">{fmtDate(event.startDate)}{event.endDate && event.endDate !== event.startDate ? ` – ${fmtDate(event.endDate)}` : ''}</InfoItem>
            <InfoItem icon={Building2Icon} label="Hizmet Tesisi" color="#7c3aed">{event.facilityName ?? '—'}</InfoItem>
            <InfoItem icon={ArmchairIcon} label="Salon" color="#0ea5e9">{event.hallName ?? '—'}</InfoItem>
            <InfoItem icon={Users2Icon} label="Yaş Grubu" color="#059669">{event.minAge}–{event.maxAge}</InfoItem>
            <InfoItem icon={MapPinIcon} label="Mekan" color="#d97706">{event.hallName || event.facilityName || '—'}</InfoItem>
            <InfoItem icon={ClockIcon} label="İptal Süresi" color="#ef4444">
              {(event.access?.cancellationDeadlineHours ?? 0) > 0 ? `Başlangıçtan en geç ${event.access?.cancellationDeadlineHours} saat önce` : 'Etkinlik başlayana kadar'}
            </InfoItem>
          </div>
        </FormSection>

        <FormSection variant="card" title="Kayıt Özeti" subtitle="Başvuru ve kapasite durumu">
          <div className="space-y-[15px]">
            <SummaryRow label="Toplam Kontenjan" tone="primary">{event.capacity.toLocaleString('tr-TR')} Kişi</SummaryRow>
            <SummaryRow label="Kayıtlı" tone="success"><span className="text-success">{event.registeredCount.toLocaleString('tr-TR')} Kişi</span></SummaryRow>
            <SummaryRow label="Yedek Liste" tone="warning"><span className="text-warning">{event.reserveCount.toLocaleString('tr-TR')} Kişi</span></SummaryRow>
            <SummaryRow label="Müsait" tone="info"><span className="text-info">{available.toLocaleString('tr-TR')} Kişi</span></SummaryRow>
          </div>
        </FormSection>
      </div>

      <FormSection variant="card" title="Sistem Bilgileri">
        <div className="grid gap-[15px] sm:grid-cols-2">
          <DetailRow icon={HashIcon} label="Etkinlik ID"><span className="tabular-nums">#{event.code}</span></DetailRow>
          <DetailRow icon={InfoIcon} label="Durum"><Badge tone={event.isActive ? 'success' : 'neutral'}>{event.isActive ? 'Aktif' : 'Pasif'}</Badge></DetailRow>
          <DetailRow icon={CalendarIcon} label="Oluşturma Tarihi">{fmtDate(event.createdAt)}</DetailRow>
          <DetailRow icon={Users2Icon} label="Seans Sayısı">{event.sessionCount}</DetailRow>
        </div>
      </FormSection>

      {event.description && (
        <FormSection variant="card" title="Açıklama">
          <div className="type-body text-foreground-default" dangerouslySetInnerHTML={{ __html: sanitizeHtml(event.description) }} />
        </FormSection>
      )}
    </div>
  )
}

const ActivityTab = ({ eventId }: { eventId: string }) => {
  const [date, setDate] = useState(todayIso())
  const [action, setAction] = useState('')
  const [rows, setRows] = useState<ActivityEntry[]>([])
  const [summary, setSummary] = useState<ActivitySummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const { blob, fileName } = await attendanceService.exportActivity({ eventId })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const load = useCallback(() => {
    setLoading(true)
    const params: Record<string, unknown> = { eventId, date, page: 1, limit: 100 }
    if (action) params.action = action
    Promise.all([
      attendanceService.getActivity(params),
      attendanceService.getActivitySummary({ eventId, date }),
    ])
      .then(([list, sum]) => { setRows(list.items); setSummary(sum) })
      .catch(() => { setRows([]); setSummary(null) })
      .finally(() => setLoading(false))
  }, [eventId, date, action])
  useEffect(() => { load() }, [load])

  const tiles = useMemo(() => ([
    { label: 'GİRİŞ', value: summary?.checkIn ?? 0, tone: 'success' },
    { label: 'ÇIKIŞ', value: summary?.checkOut ?? 0, tone: 'info' },
    { label: 'KİOSK', value: summary?.kiosk ?? 0, tone: 'primary' },
    { label: 'BAŞVURUSUZ', value: summary?.walkIn ?? 0, tone: 'warning' },
  ]), [summary])

  return (
    <div className="space-y-[15px]">
      <div className="flex flex-wrap items-center justify-between gap-[15px] rounded-card border border-border bg-surface-1 p-3">
        <div className="flex items-center gap-1.5">
          <IconButton tone="default" title="Önceki gün" onClick={() => setDate((d) => shiftIso(d, -1))}><ChevronLeftIcon className="h-4 w-4" /></IconButton>
          <div className="w-40"><DatePicker value={date} onChange={(v) => setDate(v || todayIso())} /></div>
          <IconButton tone="default" title="Sonraki gün" onClick={() => setDate((d) => shiftIso(d, 1))}><ChevronRightIcon className="h-4 w-4" /></IconButton>
          <Button variant="outline" size="sm" onClick={() => setDate(todayIso())}>Bugün</Button>
          <span className="ml-1 type-caption">{fmtDateLong(date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl
            value={action}
            onChange={setAction}
            columns={3}
            className="w-auto"
            options={ACTION_FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <IconButton onClick={handleExport} disabled={exporting} title="Excel İndir">
            <img src={excelIcon} alt="Excel" className="h-6 w-6" />
          </IconButton>
        </div>
      </div>

      <div className="min-h-[220px] rounded-card border border-border">
        {loading ? (
          <p className="py-16 text-center type-muted">Yükleniyor...</p>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center type-muted">Seçili tarih için giriş/çıkış kaydı bulunamadı.</p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <Badge tone={r.kind === 'check_in' ? 'success' : 'info'}>
                    {r.kind === 'check_in' ? <LogInIcon className="mr-1 h-3 w-3" /> : <LogOutIcon className="mr-1 h-3 w-3" />}
                    {ACTIVITY_KIND_LABELS[r.kind]}
                  </Badge>
                  <div className="leading-tight">
                    <span className="type-body-strong">{r.participantName}</span>
                    <span className="block tabular-nums type-caption">{maskTc(r.tckn)}{r.sessionLabel ? ` · ${r.sessionLabel}` : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.walkIn && <Badge tone="warning">Başvurusuz</Badge>}
                  <Badge tone={METHOD_TONE[r.method]}>{METHOD_LABELS[r.method]}</Badge>
                  <span className="tabular-nums type-muted">{fmtTime(r.at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-[15px] sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-card border border-border bg-surface-0 p-3 text-center">
            <p className="type-caption">{t.label}</p>
            <p className="text-xl font-semibold tabular-nums" style={{ color: `hsl(var(--${t.tone}))` }}>{t.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const StarDisplay = ({ value }: { value: number }) => (
  <span className="inline-flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <StarIcon
        key={i}
        className={`h-3.5 w-3.5 ${i <= value ? 'fill-[hsl(var(--warning))] text-[hsl(var(--warning))]' : 'fill-transparent text-[hsl(var(--border))]'}`}
      />
    ))}
  </span>
)

const ReviewsTab = ({ eventId }: { eventId: string }) => {
  const [data, setData] = useState<AdminReviewsDto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    reviewService.getEventReviews(eventId)
      .then((d) => { if (active) setData(d) })
      .catch(() => { if (active) setData({ reviews: [], averageRating: null, reviewCount: 0 }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [eventId])

  if (loading) return <p className="py-12 text-center type-muted">Yükleniyor…</p>
  if (!data) return null

  return (
    <div className="space-y-[15px]">
      {data.reviewCount > 0 && (
        <div className="flex items-center gap-3 rounded-card border border-border bg-surface-1 px-4 py-3">
          <StarDisplay value={Math.round(data.averageRating ?? 0)} />
          <span className="type-body-strong">{data.averageRating?.toFixed(1) ?? '—'}</span>
          <span className="type-muted">({data.reviewCount} değerlendirme)</span>
        </div>
      )}

      {data.reviews.length === 0 ? (
        <p className="py-12 text-center type-muted">Henüz değerlendirme yok.</p>
      ) : (
        <div className="divide-y divide-border rounded-card border border-border">
          {data.reviews.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-[15px] px-4 py-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="type-body-strong">{r.participantName}</span>
                  <StarDisplay value={r.rating} />
                </div>
                {r.comment && <p className="type-body text-foreground-default">{r.comment}</p>}
              </div>
              <span className="type-muted flex-shrink-0 tabular-nums">{fmtDateTime(r.submittedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const EventDetailModal = ({ event, onClose }: { event: Event | null; onClose: () => void }) => {
  const [tab, setTab] = useState('details')
  useEffect(() => { if (event) setTab('details') }, [event])
  if (!event) return null
  const available = Math.max(0, event.capacity - event.registeredCount)
  const fill = event.capacity > 0 ? Math.round((event.registeredCount / event.capacity) * 100) : 0

  return (
    <Modal open onClose={onClose} width={960} className="max-w-[96vw] overflow-hidden">
      <div className="relative overflow-hidden ds-hero">
        <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
        <div className="absolute -bottom-6 right-24 h-32 w-32 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
        <div className="absolute left-0 bottom-0 h-24 w-24 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
        <div className="relative px-8 py-7">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <span className="flex h-20 w-20 items-center justify-center rounded-lg shadow-xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.15))', border: '3px solid rgba(255,255,255,0.35)' }}>
                <CalendarIcon className="h-9 w-9 text-white" />
              </span>
              <span className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: event.isActive ? '#22c55e' : '#94a3b8' }} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{event.name}</h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-white/20 text-white">{event.isActive ? 'Aktif' : 'Pasif'}</span>
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-white/20 text-white">{event.categoryName}</span>
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-white/20 text-white tabular-nums">#{event.code}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                <span className="flex items-center gap-1.5 text-[13px] text-white/70">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/15">
                    <CalendarIcon className="h-3 w-3 text-white" />
                  </div>
                  {fmtDate(event.startDate)}{event.endDate && event.endDate !== event.startDate ? ` – ${fmtDate(event.endDate)}` : ''}{event.facilityName ? ` · ${event.facilityName}` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-px border-t border-white/20">
          <div className="bg-black/20 px-6 py-3 text-center">
            <p className="text-lg font-bold text-white tabular-nums">{event.registeredCount}</p>
            <p className="text-[11px] text-white/60">Kayıtlı</p>
          </div>
          <div className="bg-black/20 px-6 py-3 text-center">
            <p className="text-lg font-bold text-white tabular-nums">{available}</p>
            <p className="text-[11px] text-white/60">Müsait</p>
          </div>
          <div className="bg-black/20 px-6 py-3 text-center">
            <p className="text-lg font-bold text-white tabular-nums">{fill}%</p>
            <p className="text-[11px] text-white/60">Doluluk</p>
          </div>
        </div>
      </div>
      <div className="border-b border-border bg-surface-0 px-4 pt-2">
        <Tabs
          value={tab}
          onValueChange={setTab}
          tabs={[
            { key: 'details', label: 'Detaylar', icon: InfoIcon },
            { key: 'activity', label: 'Canlı Aktivite', icon: ActivityIcon },
            { key: 'reviews', label: 'Değerlendirmeler', icon: StarIcon },
          ]}
        />
      </div>
      <div className="max-h-[70vh] overflow-auto bg-surface-2 p-5">
        {tab === 'details' && <DetailsTab event={event} />}
        {tab === 'activity' && <ActivityTab eventId={event.id} />}
        {tab === 'reviews' && <ReviewsTab eventId={event.id} />}
      </div>
    </Modal>
  )
}
