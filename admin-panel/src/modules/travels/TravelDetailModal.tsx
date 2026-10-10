import { useEffect, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import {
  TagIcon, CalendarIcon, MapPinIcon, Users2Icon, BusIcon, ShieldCheckIcon,
  InfoIcon, StarIcon,
} from 'lucide-react'
import { Modal, Tabs, Badge, FormSection } from '@/design-system'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { FULL_RESIDENCY_MODE_LABEL, fullResidencyModeTone, residencyModeFromFlags } from '@/lib/residency'
import reviewService from '@/services/review.service'
import type { AdminReviewsDto } from '@/services/review.service'
import type { Travel } from '@/types/travel.types'

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const toneClass = {
  success: 'border-success/25 bg-success-soft text-success',
  warning: 'border-warning/25 bg-warning-soft text-warning',
  info: 'border-info/25 bg-info-soft text-info',
  primary: 'border-primary/25 bg-primary-soft text-primary',
} as const

const Metric = ({ value, label, tone }: { value: ReactNode; label: string; tone: keyof typeof toneClass }) => (
  <div className={`rounded-card border px-3 py-2 text-center shadow-sm ${toneClass[tone]}`}>
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

const DetailsTab = ({ travel }: { travel: Travel }) => {
  const available = Math.max(0, travel.capacity - travel.registeredCount)
  const fill = travel.capacity > 0 ? Math.round((travel.registeredCount / travel.capacity) * 100) : 0
  const genderLabel = travel.gender === 'female' ? 'Kadın' : travel.gender === 'male' ? 'Erkek' : 'Karma'

  return (
    <div className="space-y-[15px]">
      <div className="rounded-card border border-border bg-surface-0 p-4 shadow-card" style={{ borderColor: `${travel.categoryColor}20` }}>
        <div className="flex flex-wrap items-start justify-between gap-[15px]">
          <div>
            <p className="type-caption">Doluluk</p>
            <p className="mt-1 text-xl font-semibold text-foreground-strong tabular-nums">{fill}%</p>
            <p className="mt-1 text-[10px] font-medium text-foreground-muted">{travel.registeredCount.toLocaleString('tr-TR')} / {travel.capacity.toLocaleString('tr-TR')} kayıtlı</p>
          </div>
          <div className="grid min-w-[18rem] flex-1 grid-cols-2 gap-[15px] sm:grid-cols-4">
            <Metric value={travel.registeredCount} label="Kayıtlı" tone="success" />
            <Metric value={travel.reserveCount} label="Yedek" tone="warning" />
            <Metric value={available} label="Müsait" tone="info" />
            <Metric value={`${fill}%`} label="Doluluk" tone="primary" />
          </div>
        </div>
        <div className="mt-[15px] flex h-2.5 overflow-hidden rounded-card bg-surface-2 ring-1 ring-border">
          <div className="h-full bg-success" style={{ width: `${Math.min(100, fill)}%` }} />
          <div className="h-full bg-info" style={{ width: `${Math.max(0, 100 - fill)}%` }} />
        </div>
      </div>

      <div className="grid gap-[15px] md:grid-cols-[1.15fr_0.85fr]">
        <FormSection variant="card" title="Gezi Bilgileri" subtitle="Rota, tarih ve katılım kapsamı">
          <div className="grid gap-[15px] sm:grid-cols-2">
            <InfoItem icon={TagIcon} label="Kategori" color={travel.categoryColor}><Badge color={travel.categoryColor}>{travel.categoryName}</Badge></InfoItem>
            <InfoItem icon={MapPinIcon} label="Hedef" color="#059669">{travel.destination || '—'}</InfoItem>
            <InfoItem icon={CalendarIcon} label="Tarih" color="#2563eb">{fmtDate(travel.startDate)}{travel.endDate && travel.endDate !== travel.startDate ? ` – ${fmtDate(travel.endDate)}` : ''}</InfoItem>
            <InfoItem icon={CalendarIcon} label="Kayıt Aralığı" color="#7c3aed">{fmtDate(travel.registrationStartDate)} – {fmtDate(travel.registrationEndDate)}</InfoItem>
            <InfoItem icon={Users2Icon} label="Yaş / Cinsiyet" color="#d97706">{travel.minAge}–{travel.maxAge} · {genderLabel}</InfoItem>
            <InfoItem icon={BusIcon} label="Otobüs Sayısı" color="#0ea5e9">{travel.busCount}</InfoItem>
          </div>
        </FormSection>

        <FormSection variant="card" title="Kapasite Bilgileri" subtitle="Başvuru ve araç kapasitesi">
          <div className="space-y-[15px]">
            <SummaryRow label="Toplam Kontenjan" tone="primary">{travel.capacity.toLocaleString('tr-TR')} Kişi</SummaryRow>
            <SummaryRow label="Kayıtlı" tone="success"><span className="text-success">{travel.registeredCount.toLocaleString('tr-TR')} Kişi</span></SummaryRow>
            <SummaryRow label="Yedek Liste" tone="warning"><span className="text-warning">{travel.reserveCount.toLocaleString('tr-TR')} Kişi</span></SummaryRow>
            <SummaryRow label="Müsait" tone="info"><span className="text-info">{available.toLocaleString('tr-TR')} Kişi</span></SummaryRow>
          </div>
        </FormSection>
      </div>

      {travel.description && (
        <FormSection variant="card" title="Açıklama">
          <div className="type-body text-foreground-default" dangerouslySetInnerHTML={{ __html: sanitizeHtml(travel.description) }} />
        </FormSection>
      )}
      {travel.conditions && (
        <FormSection variant="card" title="Koşullar / Program">
          <div className="type-body text-foreground-default" dangerouslySetInnerHTML={{ __html: sanitizeHtml(travel.conditions) }} />
        </FormSection>
      )}

      <FormSection variant="card" title="Katılım Koşulları">
        <div className="flex flex-wrap gap-2">
          {(() => {
            const mode = travel.restrictions.residencyMode ?? residencyModeFromFlags(travel.restrictions.sultangaziResidentOnly, travel.restrictions.allowOutsideSultangazi)
            return <Badge tone={fullResidencyModeTone(mode)}>{FULL_RESIDENCY_MODE_LABEL[mode]}</Badge>
          })()}
          {travel.restrictions.requiresGuardianConsent && <Badge tone="warning"><ShieldCheckIcon className="h-3 w-3" /> Veli onayı</Badge>}
          {travel.restrictions.documentRequired && <Badge tone="warning">Evrak gerekli</Badge>}
          {travel.restrictions.maxCompanions > 0 && <Badge tone="neutral">Maks. {travel.restrictions.maxCompanions} misafir</Badge>}
        </div>
      </FormSection>
    </div>
  )
}

const ReviewsTab = ({ travelId }: { travelId: string }) => {
  const [data, setData] = useState<AdminReviewsDto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    reviewService.getTravelReviews(travelId)
      .then((d) => { if (active) setData(d) })
      .catch(() => { if (active) setData({ reviews: [], averageRating: null, reviewCount: 0 }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [travelId])

  if (loading) return <p className="py-12 text-center type-muted">Yükleniyor…</p>
  if (!data) return null

  return (
    <div className="space-y-4">
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

export const TravelDetailModal = ({ travel, onClose }: { travel: Travel | null; onClose: () => void }) => {
  const [tab, setTab] = useState('details')
  useEffect(() => { if (travel) setTab('details') }, [travel])
  if (!travel) return null

  return (
    <Modal open onClose={onClose} width={920} className="max-w-[96vw] overflow-hidden">
      <div className="relative overflow-hidden ds-hero">
        <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
        <div className="absolute -bottom-6 right-24 h-32 w-32 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
        <div className="absolute left-0 bottom-0 h-24 w-24 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
        <div className="relative px-8 py-7">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <span className="flex h-20 w-20 items-center justify-center rounded-lg shadow-xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.15))', border: '3px solid rgba(255,255,255,0.35)' }}>
                <MapPinIcon className="h-9 w-9 text-white" />
              </span>
              <span className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: travel.isActive ? '#22c55e' : '#94a3b8' }} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{travel.name}</h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-white/20 text-white">{travel.isActive ? 'Aktif' : 'Pasif'}</span>
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-white/20 text-white">{travel.categoryName}</span>
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-white/20 text-white tabular-nums">#{travel.code}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                <span className="flex items-center gap-1.5 text-[13px] text-white/70">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/15">
                    <MapPinIcon className="h-3 w-3 text-white" />
                  </div>
                  {travel.destination || 'Hedef belirtilmemiş'} · {fmtDate(travel.startDate)}{travel.endDate && travel.endDate !== travel.startDate ? ` – ${fmtDate(travel.endDate)}` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-px border-t border-white/20">
          <div className="bg-black/20 px-6 py-3 text-center">
            <p className="text-lg font-bold text-white tabular-nums">{travel.registeredCount}</p>
            <p className="text-[11px] text-white/60">Kayıtlı</p>
          </div>
          <div className="bg-black/20 px-6 py-3 text-center">
            <p className="text-lg font-bold text-white tabular-nums">{Math.max(0, travel.capacity - travel.registeredCount)}</p>
            <p className="text-[11px] text-white/60">Müsait</p>
          </div>
          <div className="bg-black/20 px-6 py-3 text-center">
            <p className="text-lg font-bold text-white tabular-nums">{travel.capacity > 0 ? Math.round((travel.registeredCount / travel.capacity) * 100) : 0}%</p>
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
            { key: 'reviews', label: 'Değerlendirmeler', icon: StarIcon },
          ]}
        />
      </div>
      <div className="max-h-[70vh] overflow-auto bg-surface-2 p-5">
        {tab === 'details' && <DetailsTab travel={travel} />}
        {tab === 'reviews' && <ReviewsTab travelId={travel.id} />}
      </div>
    </Modal>
  )
}
