import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Modal, Button, Field, Select, ToggleRow, Textarea } from '@/design-system'
import sedaService from '@/services/seda.service'
import { useSmsVerification } from '@/hooks/useSmsVerification'
import { SmsVerificationPanel } from '@/components/specialized/SmsVerificationPanel'
import { SEDA_APPLICATION_STATUS_OPTIONS } from '@/types/seda.types'
import type { SedaApplicationStatus, SedaNotificationEvent, SedaNotificationTemplate } from '@/types/seda.types'
import { SEDA_NOTIFICATION_META, mergeSedaNotificationTemplates } from './sedaNotificationDefaults'

interface Props {
  open: boolean
  schoolName?: string | null
  onClose: () => void
}

const EVENT_ORDER: SedaNotificationEvent[] = ['application_received', 'approved', 'rejected', 'cancelled', 'postponed', 'emergency', 'manual']

export const SedaSendMessageModal = ({ open, schoolName, onClose }: Props) => {
  const [templates, setTemplates] = useState<SedaNotificationTemplate[]>([])
  const [templateEvent, setTemplateEvent] = useState<SedaNotificationEvent>('manual')
  const [status, setStatus] = useState<SedaApplicationStatus | ''>('')
  const [useCustomText, setUseCustomText] = useState(false)
  const [customText, setCustomText] = useState('')
  const [sms, setSms] = useState(true)
  const [notify, setNotify] = useState(true)
  const [sending, setSending] = useState(false)
  const verification = useSmsVerification()

  useEffect(() => {
    if (!open) return
    sedaService.getSettings()
      .then((s) => setTemplates(mergeSedaNotificationTemplates(s.notificationTemplates)))
      .catch(() => setTemplates(mergeSedaNotificationTemplates(null)))
    setTemplateEvent('manual')
    setStatus('')
    setUseCustomText(false)
    setCustomText('')
    setSms(true)
    setNotify(true)
    verification.reset()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- verification her render'da yeni obje döndürür, bağımlılığa eklemek sonsuz döngü oluşturur
  }, [open])

  const selectedTemplate = templates.find((t) => t.event === templateEvent)
  const meta = SEDA_NOTIFICATION_META[templateEvent]

  const send = async () => {
    if (!sms && !notify) { toast.warning('En az bir kanal seçin (SMS veya bildirim).'); return }
    if (useCustomText && !customText.trim()) { toast.warning('Lütfen gönderilecek özel metni yazın.'); return }
    if (sms && !verification.isReady) { toast.warning('SMS göndermek için doğrulama kodu isteyin ve girin.'); return }
    setSending(true)
    try {
      const r = await sedaService.sendManualMessage({
        templateEvent,
        customText: useCustomText ? customText.trim() : null,
        sms,
        notify,
        statusFilter: status ? [status] : null,
        schoolName: schoolName ?? null,
        ...verification.payload(),
      })
      toast.success(`${r.recipients} başvuruya gönderildi (SMS: ${r.smsSent}, bildirim: ${r.notificationsCreated}).`)
      onClose()
    } catch (err) {
      if (verification.handleSendError(err)) return
      throw err
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!sending) onClose() }}
      title="SEDA Başvurularına Mesaj Gönder"
      subtitle={schoolName ? `${schoolName} filtresi uygulanacak` : 'Şablon veya özel metinle toplu mesaj gönderin'}
      width={520}
      footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={sending}>İptal</Button><Button variant="primary" onClick={send} isLoading={sending} disabled={sms && !verification.isReady}>Gönder</Button></div>}
    >
      <div className="space-y-4">
        <Field label="Şablon">
          <Select value={templateEvent} onChange={(e) => setTemplateEvent(e.target.value as SedaNotificationEvent)}>
            {EVENT_ORDER.map((event) => <option key={event} value={event}>{SEDA_NOTIFICATION_META[event].label}</option>)}
          </Select>
        </Field>
        <Field label="Durum Filtresi" hint="Boş bırakılırsa tüm başvurulara gönderilir">
          <Select value={status} onChange={(e) => setStatus(e.target.value as SedaApplicationStatus | '')}>
            <option value="">Tüm Durumlar</option>
            {SEDA_APPLICATION_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <ToggleRow label="SMS" checked={sms} onChange={setSms} />
          <ToggleRow label="Bildirim" checked={notify} onChange={setNotify} />
        </div>
        <SmsVerificationPanel state={verification} visible={sms} />
        <ToggleRow label="Özel metin kullan" description="Şablon metni yerine aşağıdaki metni gönderir" checked={useCustomText} onChange={setUseCustomText} />
        <Field label={useCustomText ? 'Özel Metin' : 'Seçili Şablon'} hint={`Değişkenler: ${meta.vars.join(' ')}`}>
          <Textarea
            rows={5}
            value={useCustomText ? customText : (selectedTemplate?.smsBody || selectedTemplate?.notifyBody || '')}
            onChange={(e) => setCustomText(e.target.value)}
            disabled={!useCustomText}
            maxLength={500}
          />
        </Field>
      </div>
    </Modal>
  )
}
