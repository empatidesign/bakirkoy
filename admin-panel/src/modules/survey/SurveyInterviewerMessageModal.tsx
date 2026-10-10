import { useState } from 'react'
import { AlertTriangleIcon, BellIcon, MessageSquareIcon, SmartphoneIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Checkbox, Field, Input, Modal, Textarea } from '@/design-system'
import surveyPlatformService from '@/services/surveyPlatform.service'

// Kullanıcı isteği (2026-09-01): "anketörlere / saha görevlilerine toplu mesaj
// gönderilebiliriz, SMS de gönderebiliriz, ayrıca uygulama içinde göreve anlık
// açılan popup olabilir ... eklenen popup okudum tamam demeden kapatamaz."
type Props = {
  open: boolean
  onClose: () => void
  /** Doğrudan seçilen anketörler; boşsa surveyId üzerinden hedeflenir. */
  interviewerIds?: string[]
  /** Ankete atanmış tüm anketörleri hedeflemek için. */
  surveyId?: string
  /** Başlıkta gösterilecek hedef açıklaması. */
  targetLabel?: string
}

export const SurveyInterviewerMessageModal = ({ open, onClose, interviewerIds, surveyId, targetLabel }: Props) => {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [notify, setNotify] = useState(true)
  const [sms, setSms] = useState(false)
  const [requiresAck, setRequiresAck] = useState(false)
  const [sending, setSending] = useState(false)

  const reset = () => {
    setTitle(''); setBody(''); setNotify(true); setSms(false); setRequiresAck(false)
  }

  const close = () => { reset(); onClose() }

  const canSend = title.trim().length > 0 && body.trim().length > 0 && (notify || sms) && !sending

  const send = async () => {
    if (!canSend) return
    setSending(true)
    try {
      const result = await surveyPlatformService.sendInterviewerMessage({
        title: title.trim(),
        body: body.trim(),
        interviewerIds: interviewerIds?.length ? interviewerIds : undefined,
        surveyId: interviewerIds?.length ? undefined : surveyId,
        notify,
        sms,
        requiresAck,
      })

      if (result.recipients === 0) {
        toast.warning('Hedeflenen anketör bulunamadı.')
        return
      }

      const parts = [`${result.recipients} anketör`]
      if (result.notificationsCreated > 0) parts.push(`${result.notificationsCreated} bildirim`)
      if (result.smsSent > 0) parts.push(`${result.smsSent} SMS`)
      if (result.smsFailed > 0) parts.push(`${result.smsFailed} SMS başarısız`)
      toast.success(parts.join(' · ') + (result.smsMockMode ? ' (SMS test modu)' : ''))
      close()
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message ?? 'Mesaj gönderilemedi.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Anketörlere Mesaj / Duyuru"
      subtitle={targetLabel ?? (interviewerIds?.length ? `${interviewerIds.length} anketör seçili` : 'Ankete atanmış tüm anketörler')}
      width={620}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close} disabled={sending}>Vazgeç</Button>
          <Button onClick={send} disabled={!canSend} isLoading={sending}>
            <MessageSquareIcon className="mr-1.5 h-4 w-4" /> Gönder
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Başlık" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Örn. Yarınki saha planı"
          />
        </Field>

        <Field label="Mesaj" required hint={`${body.length}/2000 karakter`}>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="Anketörlere iletilecek mesaj…"
          />
        </Field>

        <Field label="Gönderim Kanalları">
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox
                checked={notify}
                onCheckedChange={(v) => {
                  const on = v === true
                  setNotify(on)
                  // Onay istenen duyuru yalnızca uygulama içi popup ile alınabilir.
                  if (!on) setRequiresAck(false)
                }}
              />
              <span className="inline-flex items-center gap-1.5 text-sm">
                <BellIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                Uygulama bildirimi (sağ üst bildirim alanına düşer)
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox checked={sms} onCheckedChange={(v) => setSms(v === true)} />
              <span className="inline-flex items-center gap-1.5 text-sm">
                <SmartphoneIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                SMS gönder
              </span>
            </label>
          </div>
        </Field>

        <div className="rounded-card border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 p-3">
          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={requiresAck}
              disabled={!notify}
              onCheckedChange={(v) => setRequiresAck(v === true)}
            />
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <AlertTriangleIcon className="h-4 w-4 text-[hsl(var(--warning))]" />
              Okundu onayı zorunlu olsun
            </span>
          </label>
          <p className="mt-1.5 pl-6 type-caption">
            Duyuru anketörün ekranında kapatılamayan bir pencere olarak açılır; “Okudum, anladım”
            denmeden kapanmaz ve onaylanmazsa her açılışta yeniden gösterilir.
            {!notify && ' Bunun için uygulama bildirimi kanalı açık olmalıdır.'}
          </p>
        </div>
      </div>
    </Modal>
  )
}
