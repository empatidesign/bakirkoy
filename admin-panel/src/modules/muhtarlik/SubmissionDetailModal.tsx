import { useState } from 'react'
import {
  MegaphoneIcon, MapPinIcon, PhoneIcon, UserIcon, CalendarIcon,
  SmartphoneIcon, ImageIcon, SendIcon, CheckCircle2Icon, ClockIcon, XCircleIcon,
  Building2Icon, FlameIcon, FingerprintIcon, Navigation2Icon, AlertCircleIcon, ShieldIcon, VideoIcon,
} from 'lucide-react'
import { Modal, ConfirmModal, Button, Banner, FormSection, ToggleRow, DetailRow, Field, Textarea } from '@/design-system'
import { maskTC } from '@/lib/utils'
import { useAuth } from '@/framework/auth/AuthContext'
import { fmtDateTime } from './muhtarlikHelpers'
import {
  SUBMISSION_TYPE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  categoryUlakbelUnit, complaintReasonLabel, channelLabel,
} from '@/types/muhtarlik.types'
import type { CitizenSubmission, SubmissionStatus } from '@/types/muhtarlik.types'

interface SubmissionDetailModalProps {
  open: boolean
  submission: CitizenSubmission | null
  busy?: boolean
  onClose: () => void
  onForward: () => void
  onResetForwardState: (reason: string) => void
  onUpdateStatus: (status: SubmissionStatus) => void
  onToggleNotify: () => void
}

export const SubmissionDetailModal = ({
  open, submission, busy, onClose, onForward, onResetForwardState, onUpdateStatus, onToggleNotify,
}: SubmissionDetailModalProps) => {
  const [confirmReject, setConfirmReject] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetReason, setResetReason] = useState('')
  const { getFacilityScope } = useAuth()
  const isMuhtarScoped = getFacilityScope('muhtarlik') !== null

  if (!submission) return null
  const s = submission
  const ulakbelUnit = s.ulakbelUnit ?? categoryUlakbelUnit(s.categoryId)
  const reason = complaintReasonLabel(s.complaintReason)
  const isTerminal = s.status === 'resolved' || s.status === 'rejected'
  const isForwarded = s.status === 'forwarded' || !!s.ulakbelTrackingNo
  const isPendingForward = (s.ulakbelForwardState === 'unknown' || s.ulakbelForwardState === 'sending') && !isForwarded
  const hasCoords = typeof s.latitude === 'number' && typeof s.longitude === 'number'
  const mediaUrls = s.mediaUrls ?? []
  const isVideoUrl = (url: string) => /\.(mp4|mov|webm|3gp|mkv)(\?|$)/i.test(url)

  const header = (
    <div className="relative overflow-hidden -mx-6 -mt-5 mb-0 ds-hero">
      <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
      <div className="absolute -bottom-6 right-24 h-32 w-32 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
      <div className="absolute left-0 bottom-0 h-24 w-24 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
      <div className="relative px-8 py-7">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <span className="flex h-20 w-20 items-center justify-center rounded-lg shadow-xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.15))', border: '3px solid rgba(255,255,255,0.35)' }}>
              <MegaphoneIcon className="h-9 w-9 text-white" />
            </span>
            <span className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: s.status === 'resolved' ? '#22c55e' : s.status === 'rejected' ? '#ef4444' : '#60a5fa' }} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{s.title}</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-white/20 text-white">{STATUS_LABELS[s.status]}</span>
              <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-white/20 text-white">{SUBMISSION_TYPE_LABELS[s.submissionType]}</span>
              {s.priority !== 'normal' && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-white/20 text-white">
                  {s.priority === 'urgent' && <FlameIcon className="h-3 w-3" />}
                  {PRIORITY_LABELS[s.priority]}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5 text-[13px] text-white/70">
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/15">
                  <Building2Icon className="h-3 w-3 text-white" />
                </div>
                {s.neighborhood} · Kayıt {s.trackingNo ?? `#${s.id}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const actions: React.ReactNode[] = []
  if (s.status === 'new') {
    actions.push(
      <Button key="review" variant="outline" size="sm" disabled={busy} onClick={() => onUpdateStatus('in_review')}>
        <ClockIcon className="h-4 w-4" /> İncelemeye Al
      </Button>,
    )
  }
  if (!isTerminal && !isForwarded && !isPendingForward) {
    actions.push(
      <Button key="forward" variant="primary" size="sm" isLoading={busy} disabled={busy} onClick={onForward}>
        <SendIcon className="h-4 w-4" /> Belediyeye İlet{ulakbelUnit ? ` · ${ulakbelUnit}` : ''}
      </Button>,
    )
  }
  if (isPendingForward) {
    actions.push(
      <Button key="reset-forward" variant="outline" size="sm" disabled={busy} onClick={() => { setResetReason(''); setConfirmReset(true) }}>
        <SendIcon className="h-4 w-4" /> İletim Durumunu Sıfırla
      </Button>,
    )
  }
  if (isForwarded && !isTerminal) {
    actions.push(
      <Button key="resolve" variant="primary" size="sm" isLoading={busy} disabled={busy} onClick={() => onUpdateStatus('resolved')}>
        <CheckCircle2Icon className="h-4 w-4" /> Çözüldü Olarak İşaretle
      </Button>,
    )
  }
  if (!isTerminal) {
    actions.push(
      <Button key="reject" variant="danger" size="sm" disabled={busy} onClick={() => setConfirmReject(true)}>
        <XCircleIcon className="h-4 w-4" /> Reddet
      </Button>,
    )
  }

  const footer = actions.length > 0 ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : undefined

  return (
    <>
      <Modal open={open} onClose={onClose} header={header} footer={footer} width={760} className="max-w-[96vw]">
        <div className="space-y-4 p-6">
          <ToggleRow
            label="Muhtarın Haberdar Olması Gereken"
            description={s.notifyMuhtar
              ? `${s.muhtarName ?? 'Mahalle muhtarı'} bu kayıt için bilgilendirilecek.`
              : 'Bu kayıt için muhtara bildirim gönderilmez.'}
            checked={s.notifyMuhtar}
            onChange={() => onToggleNotify()}
            disabled={busy || isMuhtarScoped}
          />

          <FormSection variant="card" title="Açıklama">
            <p className="type-body whitespace-pre-line text-foreground-default">{s.description}</p>
          </FormSection>

          {s.submissionType === 'complaint' && reason && (
            <Banner tone="danger" variant="soft" icon={AlertCircleIcon}>
              Şikayet sebebi: <strong>{reason}</strong>
            </Banner>
          )}

          {s.photoCount > 0 && mediaUrls.length === 0 && (
            <Banner tone="info" variant="soft" icon={ImageIcon}>
              Vatandaş {s.photoCount} fotoğraf ekledi (mobil uygulamada görüntülenir).
            </Banner>
          )}

          {mediaUrls.length > 0 && (
            <FormSection variant="card" icon={ImageIcon} title={`Ekler (${mediaUrls.length})`}>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {mediaUrls.map((url) => (
                  isVideoUrl(url) ? (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-border bg-surface-2 text-foreground-subtle hover:border-primary">
                      <VideoIcon className="h-5 w-5" />
                      <span className="text-[10px]">Video</span>
                    </a>
                  ) : (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg border border-border hover:border-primary">
                      <img src={url} alt="Ek" className="h-full w-full object-cover" />
                    </a>
                  )
                ))}
              </div>
            </FormSection>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <FormSection variant="card" icon={UserIcon} title="Vatandaş">
              {s.isIdentityHidden ? (
                <Banner tone="neutral" variant="soft" icon={ShieldIcon}>
                  Başvuru sahibinin kimliği gizli tutulmaktadır. Bu, şikayet ve hassas konularda vatandaşı korumak için standart bir uygulamadır.
                </Banner>
              ) : (
                <>
                  <DetailRow icon={UserIcon} label="Ad Soyad" layout="inline">{s.citizenName}</DetailRow>
                  <DetailRow icon={PhoneIcon} label="Telefon" layout="inline">{s.citizenPhone}</DetailRow>
                  <DetailRow icon={FingerprintIcon} label="T.C. Kimlik" layout="inline"><span className="tabular-nums">{maskTC(s.citizenTc)}</span></DetailRow>
                  {s.citizenBirthDate && (
                    <DetailRow icon={CalendarIcon} label="Doğum Tarihi" layout="inline">
                      {new Date(s.citizenBirthDate).toLocaleDateString('tr-TR')}
                    </DetailRow>
                  )}
                </>
              )}
            </FormSection>
            <FormSection variant="card" icon={Building2Icon} title="Mahalle Muhtarı">
              {s.muhtarName ? (
                <>
                  <DetailRow icon={UserIcon} label="Ad Soyad" layout="inline">{s.muhtarName}</DetailRow>
                  {s.muhtarPhone && <DetailRow icon={PhoneIcon} label="Telefon" layout="inline">{s.muhtarPhone}</DetailRow>}
                </>
              ) : (
                <p className="type-muted italic">Bu mahalleye muhtar atanmamış.</p>
              )}
            </FormSection>
          </div>

          <FormSection variant="card" icon={MapPinIcon} title="Konum & Başvuru">
            <DetailRow icon={MapPinIcon} label="Adres" layout="inline">{s.address}</DetailRow>
            {hasCoords && (
              <DetailRow icon={Navigation2Icon} label="Koordinat" layout="inline">
                <span className="tabular-nums">{s.latitude!.toFixed(5)}, {s.longitude!.toFixed(5)}</span>
              </DetailRow>
            )}
            <DetailRow icon={CalendarIcon} label="Başvuru Tarihi" layout="inline">{fmtDateTime(s.submittedAt)}</DetailRow>
            <DetailRow icon={SmartphoneIcon} label="Kanal" layout="inline">{channelLabel(s.submittedVia)}</DetailRow>
          </FormSection>

          {isForwarded && s.ulakbelTrackingNo && (
            <Banner tone="primary" variant="soft" icon={CheckCircle2Icon}>
              Belediyeye İletildi{ulakbelUnit ? ` · ${ulakbelUnit}` : ''} · Takip No: <span className="tabular-nums">{s.ulakbelTrackingNo}</span>
            </Banner>
          )}

          {isPendingForward && (
            <Banner tone="warning" variant="soft" icon={AlertCircleIcon}>
              {s.ulakbelForwardState === 'sending'
                ? 'Bu başvuru için bir iletim denemesi başladı ancak doğrulanabilir bir sonuçla tamamlanmadı (iletim sürüyor olabilir veya yarıda kesildi). Başvuru Ulakbell\'de oluşmuş olabilir.'
                : 'Önceki iletimin sonucu belirsiz kaldı; başvuru Ulakbell\'de oluşmuş olabilir.'}
              {' '}Tekrar göndermeden önce Ulakbell tarafında kaydın oluşup oluşmadığını doğrulayın. Kayıt oluşmadıysa
              "İletim Durumunu Sıfırla" ile yeniden göndermeye izin verebilirsiniz; iletim hâlâ sürüyorsa sıfırlama reddedilir.
            </Banner>
          )}

          {s.status === 'resolved' && s.resolvedAt && (
            <Banner tone="success" variant="soft" icon={CheckCircle2Icon}>
              Çözüldü · {fmtDateTime(s.resolvedAt)}
            </Banner>
          )}

          {s.status === 'rejected' && (
            <Banner tone="danger" variant="soft" icon={XCircleIcon}>
              Bu kayıt reddedildi.
            </Banner>
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={confirmReject}
        onClose={() => setConfirmReject(false)}
        onConfirm={() => { setConfirmReject(false); onUpdateStatus('rejected') }}
        title="Kaydı Reddet"
        description="Bu başvuru reddedilecek. Bu işlem kaydı kapatır ve listede 'Reddedildi' olarak görünür."
        confirmLabel="Reddet"
        tone="danger"
        icon={XCircleIcon}
        loading={busy}
      />

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="İletim Durumunu Sıfırla"
        width={520}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmReset(false)}>Vazgeç</Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={busy}
              disabled={busy || resetReason.trim().length === 0}
              onClick={() => { setConfirmReset(false); onResetForwardState(resetReason.trim()) }}
            >
              Sıfırla ve Yeniden Göndermeye İzin Ver
            </Button>
          </div>
        )}
      >
        <div className="space-y-4 p-6">
          <Banner tone="warning" variant="soft" icon={AlertCircleIcon}>
            Sıfırlama, bu başvuruyu tekrar göndermeye izin verir. Önceki denemede Ulakbell'de kayıt oluştuysa
            tekrar göndermek çift kayıt üretir. Yalnızca Ulakbell tarafında kaydın oluşmadığını doğruladıysanız sıfırlayın.
          </Banner>
          <Field label="Doğrulama açıklaması" hint="Ör. Ulakbell panelinde bu başvuru için kayıt bulunamadı." required>
            <Textarea
              value={resetReason}
              onChange={(e) => setResetReason(e.target.value)}
              rows={3}
              placeholder="Ulakbell'de kaydın oluşmadığını nasıl doğruladığınızı yazın."
            />
          </Field>
        </div>
      </Modal>
    </>
  )
}
