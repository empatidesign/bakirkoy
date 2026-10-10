import { useEffect, useMemo, useRef, useState } from 'react'
import { BellRingIcon, MessageSquareIcon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Button, Field, Select, ToggleRow, Textarea, Banner } from '@/design-system'
import { useSmsVerification } from '@/hooks/useSmsVerification'
import { SmsVerificationPanel } from '@/components/specialized/SmsVerificationPanel'
import type { FacilityModuleService } from './types'
import type { ApplicationStatus, NotificationEvent, NotificationTemplate } from '@/types/facility.types'

interface Props {
  open: boolean
  module: string
  target: 'group' | 'application' | 'registration' | 'instructor' | 'facility'
  ids: string[]
  service: FacilityModuleService
  onClose: () => void
  onSent?: () => void
}

const EVENT_ORDER: NotificationEvent[] = [
  'manual', 'application_approved', 'application_pending', 'application_waitlisted', 'application_rejected',
  'application_documents_required', 'session_reminder', 'waitlist_promoted', 'absence_warning',
  'absence_limit_reached', 'attendance_absent', 'registration_cancelled', 'postponed', 'emergency',
]

const EVENT_LABELS: Record<NotificationEvent, { label: string; vars: string[] }> = {
  manual: { label: 'Manuel Bilgilendirme', vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{tesis}}', '{{seans_tarihi}}', '{{seans_saati}}'] },
  application_approved: { label: 'Başvuru Onaylandı', vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{tesis}}', '{{seans_tarihi}}', '{{seans_saati}}'] },
  application_rejected: { label: 'Başvuru Reddedildi', vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{red_nedeni}}'] },
  application_pending: { label: 'Başvuru Alındı (Beklemede)', vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{tesis}}'] },
  application_waitlisted: { label: 'Yedek Listeye Alındı', vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{sira}}'] },
  application_documents_required: { label: 'Evrak Yükleme Gerekli', vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{evrak_listesi}}'] },
  attendance_absent: { label: 'Devamsızlık Kaydedildi', vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{seans_tarihi}}', '{{devamsizlik_sayisi}}'] },
  absence_warning: { label: 'Devamsızlık Uyarısı', vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{kalan_hak}}', '{{limit}}'] },
  absence_limit_reached: { label: 'Devamsızlık Limiti Aşıldı', vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{limit}}'] },
  session_reminder: { label: 'Seans Hatırlatması', vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{seans_saati}}', '{{tesis}}'] },
  waitlist_promoted: { label: 'Yedekten Asile Yükseltildi', vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{tesis}}', '{{onay_suresi}}', '{{seans_tarihi}}', '{{seans_saati}}'] },
  registration_cancelled: { label: 'Kayıt İptal Edildi', vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{iptal_nedeni}}'] },
  postponed: { label: 'Program Ertelendi', vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{tesis}}', '{{seans_tarihi}}'] },
  emergency: { label: 'Acil Durum Duyurusu', vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{tesis}}'] },
}

const STATUS_OPTIONS: Array<{ value: ApplicationStatus; label: string }> = [
  { value: 'pending', label: 'Beklemede' },
  { value: 'approved', label: 'Onaylı' },
  { value: 'waitlist', label: 'Yedek' },
  { value: 'rejected', label: 'Reddedildi' },
  { value: 'expired', label: 'Süresi Doldu' },
]

const targetLabel = (target: Props['target']) => target === 'group' ? 'grup' : target === 'application' ? 'başvuru' : target === 'registration' ? 'kayıt' : target === 'facility' ? 'tesis' : 'eğitmen'

export const FacilitySendMessageModal = ({ open, module, target, ids, service, onClose, onSent }: Props) => {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [templateEvent, setTemplateEvent] = useState<NotificationEvent>('manual')
  const [status, setStatus] = useState<ApplicationStatus | ''>('')
  const [useCustomText, setUseCustomText] = useState(false)
  const [customText, setCustomText] = useState('')
  const [sms, setSms] = useState(true)
  const [notify, setNotify] = useState(true)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const verification = useSmsVerification()
  const customTextRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setTemplateEvent('manual')
    setStatus('')
    setUseCustomText(false)
    setCustomText('')
    setSms(true)
    // Kullanıcı isteği (2026-08-11): Eğitmenler modalında hedef seçilen kayıtlar Participant
    // değil (ayrı FacilityInstructor kaydı) — in-app uygulama bildirimi (ParticipantId gerekir)
    // bu hedefte hiç gönderilemez, backend zaten sessizce atlıyor. Kafa karıştırmamak için
    // bu hedefte varsayılan kapalı başlar ve toggle devre dışı bırakılır.
    setNotify(target !== 'instructor')
    verification.reset()
    service.settings.getGeneral()
      .then((settings) => setTemplates(settings.notificationTemplates ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- verification her render'da yeni obje döndürür, bağımlılığa eklemek sonsuz döngü oluşturur
  }, [open, service, target])

  const selectedTemplate = templates.find((template) => template.event === templateEvent)
  // Kullanıcı isteği (2026-08-11): Eğitmen hedefinde {{grup}}/{{tesis}}/{{seans_tarihi}} vb.
  // değişkenler hiç doldurulmaz (FacilityNotificationVars boş geçiliyor) — kafa karıştırmamak
  // için sadece {{ad}}/{{soyad}} gösterilir.
  const meta = target === 'instructor' ? { label: EVENT_LABELS[templateEvent].label, vars: ['{{ad}}', '{{soyad}}'] } : EVENT_LABELS[templateEvent]
  const templateText = (template?: NotificationTemplate) => template?.smsBody || ''

  const changeTemplate = (event: NotificationEvent) => {
    setTemplateEvent(event)
    if (useCustomText) setCustomText(templateText(templates.find((template) => template.event === event)))
  }

  const toggleCustomText = (enabled: boolean) => {
    setUseCustomText(enabled)
    if (enabled && !customText.trim()) setCustomText(templateText(selectedTemplate))
  }

  const insertVariable = (variable: string) => {
    const base = useCustomText ? customText : templateText(selectedTemplate)
    const textarea = customTextRef.current
    const start = textarea?.selectionStart ?? base.length
    const end = textarea?.selectionEnd ?? start
    const needsSpace = start > 0 && base[start - 1] !== ' '
    const insertion = `${needsSpace ? ' ' : ''}${variable}`
    const next = `${base.slice(0, start)}${insertion}${base.slice(end)}`
    const cursor = start + insertion.length
    setUseCustomText(true)
    setCustomText(next)
    requestAnimationFrame(() => {
      customTextRef.current?.focus()
      customTextRef.current?.setSelectionRange(cursor, cursor)
    })
  }

  const channelSummary = useMemo(() => {
    if (useCustomText) return 'Özel metin seçilen kanallarda aynı içerikle gönderilir.'
    return selectedTemplate?.smsEnabled ? 'Şablonda SMS kanalı aktif.' : 'Bu şablonun SMS kanalı ayarlarda kapalı.'
  }, [selectedTemplate, useCustomText])

  const send = async () => {
    if (!sms && !notify) { toast.warning('En az bir kanal seçin.'); return }
    if (useCustomText && !customText.trim()) { toast.warning('Özel mesaj metnini yazın.'); return }
    if (ids.length === 0) { toast.warning('Mesaj gönderilecek seçim bulunamadı.'); return }
    if (sms && !verification.isReady) { toast.warning('SMS göndermek için doğrulama kodu isteyin ve girin.'); return }
    setSending(true)
    try {
      const result = await service.applications.sendManualMessage({
        module,
        target,
        ids,
        templateEvent,
        customText: useCustomText ? customText.trim() : null,
        sms,
        notify,
        statusFilter: status ? [status] : undefined,
        ...verification.payload(),
      })
      toast.success(`${result.recipients} alıcı işlendi (SMS: ${result.smsSent}, bildirim: ${result.notificationsCreated}).`)
      onSent?.()
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
      title="Şablonlu Mesaj Gönder"
      subtitle={`${ids.length} seçili ${targetLabel(target)} · şablon veya özel metin kullanın`}
      width={620}
      footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={sending}>İptal</Button><Button variant="primary" onClick={send} isLoading={sending} disabled={loading || (sms && !verification.isReady)}>Gönder</Button></div>}
    >
      <div className="space-y-4 p-5">
        <Banner tone="info" variant="soft" icon={SparklesIcon}>
          Şablon değişkenleri her alıcı için otomatik doldurulur. Şablonları Ayarlar → Bildirim Şablonları bölümünden değiştirebilirsiniz.
        </Banner>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mesaj Şablonu">
            <Select value={templateEvent} onChange={(event) => changeTemplate(event.target.value as NotificationEvent)} disabled={loading}>
              {EVENT_ORDER.map((event) => <option key={event} value={event}>{EVENT_LABELS[event].label}</option>)}
            </Select>
          </Field>
          {target !== 'instructor' && target !== 'facility' && (
            <Field label="Durum" hint="Boş bırakılırsa tüm seçilenler">
              <Select value={status} onChange={(event) => setStatus(event.target.value as ApplicationStatus | '')}>
                <option value="">Tüm durumlar</option>
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </Field>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow label="SMS gönder" description="Telefonu kayıtlı alıcılara gider" checked={sms} onChange={setSms} />
          <ToggleRow
            label="Uygulama bildirimi"
            description={target === 'instructor' ? 'Eğitmenler için bu kanal desteklenmiyor (Participant bağlantısı yok)' : 'Vatandaş portalında görünür'}
            checked={notify}
            onChange={setNotify}
            disabled={target === 'instructor'}
          />
        </div>
        <SmsVerificationPanel state={verification} visible={sms} />
        <ToggleRow label="Özel mesaj kullan" description="Seçili şablon yerine aşağıdaki metni gönderir" checked={useCustomText} onChange={toggleCustomText} />
        <div className="rounded-card border border-border bg-surface-1 p-3">
          <p className="type-caption font-semibold text-foreground-default">Kullanılabilir değişkenler</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {meta.vars.map((variable) => (
              <Button key={variable} type="button" variant="outline" size="sm" onClick={() => insertVariable(variable)}>
                <span className="font-mono">{variable}</span>
              </Button>
            ))}
          </div>
          <p className="mt-2 type-caption text-foreground-muted">Bir değişkene tıklayın; özel mesaj alanında imlecin bulunduğu yere eklensin.</p>
        </div>
        {useCustomText ? (
          <Field label="Özel Mesaj" hint={`${customText.length}/500 · Değişkenleri metin içinde kullanabilirsiniz`}>
            <Textarea ref={customTextRef} value={customText} onChange={(event) => setCustomText(event.target.value)} rows={5} maxLength={500} placeholder="Örn: Sayın {{ad}} {{soyad}}, {{grup}} programınız hakkında bilgilendirme." />
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-card border border-success bg-success-soft p-3">
              <p className="mb-2 inline-flex items-center gap-1.5 type-caption font-bold text-success"><MessageSquareIcon className="h-3.5 w-3.5" /> SMS Şablonu</p>
              <p className="whitespace-pre-wrap type-caption text-foreground-default">{selectedTemplate?.smsBody || 'SMS metni tanımlanmamış.'}</p>
            </div>
            <div className="rounded-card border border-info bg-info-soft p-3">
              <p className="mb-2 inline-flex items-center gap-1.5 type-caption font-bold text-info"><BellRingIcon className="h-3.5 w-3.5" /> Bildirim Önizleme</p>
              <p className="whitespace-pre-wrap type-caption text-foreground-default">{selectedTemplate?.notifyBody || selectedTemplate?.smsBody || 'Bildirim metni tanımlanmamış.'}</p>
            </div>
          </div>
        )}
        <p className="type-caption text-foreground-muted">{channelSummary}</p>
      </div>
    </Modal>
  )
}
