import { useEffect, useState } from 'react'
import {
  ClockIcon, SendIcon, MapPinIcon, CalendarIcon, TagIcon, VideoIcon,
  HomeIcon, MapPinnedIcon, InfoIcon, ImageOffIcon, TimerIcon, FlagIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Badge, SkeletonRows, Button, Field, Input, Textarea, Select } from '@/design-system'
import { formatDateTime } from '@/lib/utils'
import type { CitizenSubmission, UpdateSubmissionRequest } from '@/types/submission.types'
import {
  SUBMISSION_STATUS_LABELS, SUBMISSION_STATUS_TONE, SUBMISSION_TYPE_LABELS,
  ADDRESS_TYPE_LABELS, SCOPE_LABELS,
} from '@/types/submission.types'
import submissionService from '@/services/submission.service'

type Props = {
  submission: CitizenSubmission | null
  categoryLabel?: string
  onClose: () => void
  /** Düzenleme kaydedildiğinde listeyi tazelemek için. */
  onUpdated?: () => void
}

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.3gp', '.mkv']
const isVideoUrl = (url: string) => VIDEO_EXTENSIONS.some((ext) => url.toLowerCase().includes(ext))

const ACTOR_LABELS: Record<string, string> = {
  citizen: 'Siz',
  system: 'Sistem',
  municipality: 'Belediye',
  muhtar: 'Muhtar',
}

const formatDuration = (hours: number): string => {
  if (hours < 1) return `${Math.round(hours * 60)} dk`
  if (hours < 24) {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return m > 0 ? `${h} sa ${m} dk` : `${h} sa`
  }
  const d = Math.floor(hours / 24)
  const h = Math.round(hours % 24)
  return h > 0 ? `${d} gün ${h} sa` : `${d} gün`
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2.5">
    <h3 className="type-caption font-medium uppercase tracking-wide text-foreground-subtle">{title}</h3>
    {children}
  </section>
)

const InfoRow = ({ icon: Icon, label, value }: { icon: typeof MapPinIcon; label: string; value: React.ReactNode }) => (
  <div className="flex items-start gap-3 py-2.5">
    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground-subtle" />
    <div className="min-w-0 flex-1">
      <p className="type-caption text-foreground-subtle">{label}</p>
      <div className="type-body text-foreground-default">{value}</div>
    </div>
  </div>
)

const MediaTile = ({ url }: { url: string }) => {
  const [broken, setBroken] = useState(false)

  if (isVideoUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-border bg-surface-1 text-foreground-subtle transition-colors hover:bg-surface-2">
        <VideoIcon className="h-6 w-6" />
        <span className="type-caption">Video</span>
      </a>
    )
  }

  if (broken) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-border bg-surface-1 p-2 text-center text-foreground-subtle transition-colors hover:bg-surface-2">
        <ImageOffIcon className="h-6 w-6" />
        <span className="type-caption">Önizlenemiyor</span>
      </a>
    )
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg border border-border">
      <img src={url} alt="Ek" className="h-full w-full object-cover" onError={() => setBroken(true)} />
    </a>
  )
}

const ProcessTimeline = ({ s }: { s: CitizenSubmission }) => {
  if (!s.timeline || s.timeline.length === 0) {
    return <p className="type-caption text-foreground-subtle">Süreç bilgisi henüz oluşmadı.</p>
  }

  return (
    <ol className="space-y-0">
      {s.timeline.map((item, i) => {
        const isLast = i === s.timeline.length - 1
        return (
          <li key={`${item.eventType}-${item.occurredAt}-${i}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
                style={{ background: isLast ? 'hsl(var(--primary))' : 'hsl(var(--success))' }}
              />
              {!isLast && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
              <p className="type-body-strong">{item.title}</p>
              <p className="type-caption text-foreground-subtle">
                {formatDateTime(item.occurredAt)} · {ACTOR_LABELS[item.actorType] ?? item.actorType}
                {item.hoursSincePrevious != null && ` · önceki adımdan ${formatDuration(item.hoursSincePrevious)} sonra`}
              </p>
              {item.note && <p className="type-caption mt-1 text-foreground-muted">{item.note}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export const SubmissionDetailSheet = ({ submission, categoryLabel, onClose, onUpdated }: Props) => {
  const [detail, setDetail] = useState<CitizenSubmission | null>(submission)
  const [loading, setLoading] = useState(false)
  // Hata raporu (docs/hata.md #4.4): düzenleme hiç mümkün değildi.
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<UpdateSubmissionRequest | null>(null)

  useEffect(() => {
    setDetail(submission)
    setEditing(false)
    if (!submission) return
    setLoading(true)
    submissionService.getById(submission.id)
      .then(setDetail)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [submission])

  const s = detail
  if (!s) return null

  const startEdit = () => {
    setForm({
      title: s.title,
      description: s.description,
      submissionType: s.submissionType,
      priority: s.priority,
    })
    setEditing(true)
  }

  const saveEdit = () => {
    if (!form) return
    setSaving(true)
    submissionService.update(s.id, form)
      .then((updated) => {
        setDetail(updated)
        setEditing(false)
        toast.success('Başvurunuz güncellendi.')
        onUpdated?.()
      })
      .catch((err: unknown) => {
        const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        toast.error(message?.trim() || 'Başvuru güncellenemedi. Lütfen tekrar deneyin.')
      })
      .finally(() => setSaving(false))
  }

  return (
    <Modal open={!!s} onClose={onClose} title={s.title} subtitle={s.trackingNo ? `Takip No: ${s.trackingNo}` : undefined} width={520}>
      <div className="space-y-5 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={SUBMISSION_STATUS_TONE[s.status] ?? 'neutral'}>
            {s.statusLabel ?? SUBMISSION_STATUS_LABELS[s.status] ?? s.status}
          </Badge>
          {/* Hata raporu (docs/hata.md #4.1): tür İngilizce görünüyordu. Artık sunucunun
              döndürdüğü Türkçe metin esas; yerel sözlük yalnızca eski yanıtlar için yedek. */}
          <Badge tone="neutral">{s.submissionTypeLabel || SUBMISSION_TYPE_LABELS[s.submissionType] || s.submissionType}</Badge>
          <Badge tone="neutral">{SCOPE_LABELS[s.scope] ?? s.scope}</Badge>
        </div>

        {s.elapsedHours != null && (
          <div className="flex items-center gap-2.5 rounded-card border border-border bg-surface-1 px-3.5 py-3">
            <TimerIcon className="h-4 w-4 flex-shrink-0 text-foreground-subtle" />
            <p className="type-caption text-foreground-subtle">Başvurunuzun üzerinden geçen süre</p>
            <p className="type-body-strong ml-auto">{formatDuration(s.elapsedHours)}</p>
          </div>
        )}

        {s.resolutionNote && (
          <div className="flex items-start gap-2.5 rounded-card border border-info/20 bg-info/5 p-3.5">
            <InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-info" />
            <div className="min-w-0">
              <p className="type-caption text-foreground-subtle">Belediyeden gelen bilgi</p>
              <p className="type-body">{s.resolutionNote}</p>
            </div>
          </div>
        )}

        <Section title="Başvuru Süreci">
          <div className="rounded-card border border-border bg-surface-1 p-4">
            {loading && (!s.timeline || s.timeline.length === 0)
              ? <SkeletonRows rows={3} />
              : <ProcessTimeline s={s} />}
          </div>
        </Section>

        <Section title="Açıklama">
          <p className="type-body whitespace-pre-wrap text-foreground-default">{s.description}</p>
        </Section>

        {/* Hata raporu (docs/hata.md #4.4): başvuru düzenlenemiyordu. Düzenleme izninin
            olup olmadığını sunucu söyler (canEdit); işleme alınmış kayıtlarda buton hiç
            görünmez ve kullanıcı boşuna denemez. */}
        {s.canEdit && !editing && (
          <Button variant="outline" className="w-full" onClick={startEdit}>Başvuruyu Düzenle</Button>
        )}

        {editing && form && (
          <Section title="Başvuruyu Düzenle">
            <div className="space-y-3">
              <Field label="Başvuru Türü">
                <Select
                  value={form.submissionType}
                  onChange={(e) => setForm({ ...form, submissionType: e.target.value })}
                >
                  {Object.entries(SUBMISSION_TYPE_LABELS)
                    .filter(([value]) => value !== 'emergency')
                    .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </Field>
              <Field label="Öncelik">
                <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Düşük</option>
                  <option value="normal">Normal</option>
                  <option value="high">Yüksek</option>
                  <option value="urgent">Acil</option>
                </Select>
              </Field>
              <Field label="Başlık">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              <Field label="Açıklama">
                <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(false)} disabled={saving}>Vazgeç</Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={saveEdit}
                  isLoading={saving}
                  disabled={saving || form.title.trim().length === 0 || form.description.trim().length === 0}
                >
                  Kaydet
                </Button>
              </div>
            </div>
          </Section>
        )}

        {s.mediaUrls && s.mediaUrls.length > 0 && (
          <Section title="Ekler">
            <div className="grid grid-cols-3 gap-2">
              {s.mediaUrls.map((url) => <MediaTile key={url} url={url} />)}
            </div>
          </Section>
        )}

        <Section title="Başvuru Bilgileri">
          <div className="divide-y divide-border rounded-card border border-border bg-surface-1 px-3.5">
            <InfoRow
              icon={MapPinIcon}
              label="Konum"
              value={<><span className="font-medium">{s.neighborhood}</span><span className="block type-caption text-foreground-muted">{s.address}</span></>}
            />
            <InfoRow
              icon={s.addressType === 'residence' ? HomeIcon : MapPinnedIcon}
              label="Adres türü"
              value={ADDRESS_TYPE_LABELS[s.addressType] ?? s.addressType}
            />
            <InfoRow icon={TagIcon} label="Kategori" value={s.categoryLabel ?? categoryLabel ?? s.categoryId} />
            {/* Hata raporu (docs/hata.md #4.2): seçilen öncelik detayda hiç gösterilmiyordu,
                bu yüzden "hep Normal kaydediliyor" gibi görünüyordu. Artık kaydedilen değer
                sunucunun ürettiği etiketle birlikte açıkça görünür. */}
            <InfoRow icon={FlagIcon} label="Öncelik" value={s.priorityLabel || s.priority} />
            <InfoRow icon={CalendarIcon} label="Başvuru Tarihi" value={formatDateTime(s.submittedAt)} />
            {s.forwardedAt && <InfoRow icon={SendIcon} label="İletilme Tarihi" value={formatDateTime(s.forwardedAt)} />}
            {s.resolvedAt && <InfoRow icon={ClockIcon} label="Sonuçlanma Tarihi" value={formatDateTime(s.resolvedAt)} />}
          </div>
        </Section>
      </div>
    </Modal>
  )
}
