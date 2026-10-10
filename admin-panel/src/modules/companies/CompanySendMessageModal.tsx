import { useEffect, useMemo, useRef, useState } from 'react'
import { BellRingIcon, MessageSquareIcon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Button, Field, Select, ToggleRow, Textarea, Banner } from '@/design-system'
import companyService from '@/services/company.service'
import { useSmsVerification } from '@/hooks/useSmsVerification'
import { SmsVerificationPanel } from '@/components/specialized/SmsVerificationPanel'
import { COMPANY_NOTIFICATION_META, mergeCompanyNotificationTemplates } from './companyNotificationDefaults'
import type { CompanyNotificationEvent, CompanyNotificationTemplate } from '@/types/company.types'

interface Props {
  open: boolean
  ids: string[]
  onClose: () => void
}

const EVENT_ORDER: CompanyNotificationEvent[] = ['manual', 'temporary_password', 'approved', 'password_reset']

export const CompanySendMessageModal = ({ open, ids, onClose }: Props) => {
  const selectedIds = useMemo(() => ids, [ids])
  const [templates, setTemplates] = useState<CompanyNotificationTemplate[]>([])
  const [templateEvent, setTemplateEvent] = useState<CompanyNotificationEvent>('manual')
  const [useCustomText, setUseCustomText] = useState(false)
  const [customText, setCustomText] = useState('')
  const [sms, setSms] = useState(true)
  const [notify, setNotify] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const verification = useSmsVerification()
  const customTextRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setTemplateEvent('manual')
    setUseCustomText(false)
    setCustomText('')
    setSms(true)
    setNotify(false)
    verification.reset()
    companyService.getSettings()
      .then((settings) => setTemplates(mergeCompanyNotificationTemplates(settings.notificationTemplates)))
      .catch(() => setTemplates(mergeCompanyNotificationTemplates(null)))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- verification her render'da yeni obje döndürür, bağımlılığa eklemek sonsuz döngü oluşturur
  }, [open])

  const selectedTemplate = templates.find((template) => template.event === templateEvent)
  const meta = COMPANY_NOTIFICATION_META[templateEvent]
  const templateText = (template?: CompanyNotificationTemplate) => template?.smsBody || ''

  const changeTemplate = (event: CompanyNotificationEvent) => {
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
    return selectedTemplate?.smsEnabled ? 'Şablonda SMS içeriği aktif. Bildirim seçilirse aynı metin bildirim olarak oluşturulur.' : 'Bu şablon ayarlarda kapalı.'
  }, [selectedTemplate, useCustomText])

  const send = async () => {
    if (!sms && !notify) { toast.warning('En az bir kanal seçin.'); return }
    if (useCustomText && !customText.trim()) { toast.warning('Özel mesaj metnini yazın.'); return }
    if (selectedIds.length === 0) { toast.warning('Mesaj gönderilecek firma seçin.'); return }
    if (sms && !verification.isReady) { toast.warning('SMS göndermek için doğrulama kodu isteyin ve girin.'); return }
    setSending(true)
    try {
      const result = await companyService.sendManualMessage({
        companyIds: selectedIds,
        templateEvent,
        customText: useCustomText ? customText.trim() : null,
        sms,
        notify,
        ...verification.payload(),
      })
      toast.success(`${result.recipients} alıcı işlendi (SMS: ${result.smsSent}, bildirim: ${result.notificationsCreated}).`)
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
      title="Firma Mesajı Gönder"
      subtitle={`${selectedIds.length} seçili firma · şablon veya özel metin kullanın`}
      width={620}
      footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={sending}>İptal</Button><Button variant="primary" onClick={send} isLoading={sending} disabled={loading || (sms && !verification.isReady)}>Gönder</Button></div>}
    >
      <div className="space-y-4 p-5">
        <Banner tone="info" variant="soft" icon={SparklesIcon}>
          Şablon değişkenleri her firma için otomatik doldurulur. Şablonları Firmalar → Ayarlar → Mesaj Şablonları bölümünden değiştirebilirsiniz.
        </Banner>
        <Field label="Mesaj Şablonu">
          <Select value={templateEvent} onChange={(event) => changeTemplate(event.target.value as CompanyNotificationEvent)} disabled={loading}>
            {EVENT_ORDER.map((event) => <option key={event} value={event}>{COMPANY_NOTIFICATION_META[event].label}</option>)}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow label="SMS gönder" description="Telefonu kayıtlı firmalara gider" checked={sms} onChange={setSms} />
          <ToggleRow label="Uygulama bildirimi" description="Firma bildirim kaydı oluşturur" checked={notify} onChange={setNotify} />
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
            <Textarea ref={customTextRef} value={customText} onChange={(event) => setCustomText(event.target.value)} rows={5} maxLength={500} placeholder="Örn: Sayın {{firma}}, kampanya başvurunuzla ilgili bilgilendirme..." />
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-card border border-success/25 bg-success-soft p-3">
              <p className="mb-2 inline-flex items-center gap-1.5 type-caption font-bold text-success"><MessageSquareIcon className="h-3.5 w-3.5" /> SMS Şablonu</p>
              <p className="whitespace-pre-wrap type-caption text-foreground-default">{selectedTemplate?.smsBody || 'SMS metni tanımlanmamış.'}</p>
            </div>
            <div className="rounded-card border border-primary/25 bg-primary-soft p-3">
              <p className="mb-2 inline-flex items-center gap-1.5 type-caption font-bold text-primary"><BellRingIcon className="h-3.5 w-3.5" /> Bildirim Şablonu</p>
              <p className="whitespace-pre-wrap type-caption text-foreground-default">{selectedTemplate?.smsBody || 'Bildirim metni için SMS şablonu kullanılır.'}</p>
            </div>
          </div>
        )}
        <p className="type-caption text-foreground-muted">{channelSummary}</p>
      </div>
    </Modal>
  )
}
