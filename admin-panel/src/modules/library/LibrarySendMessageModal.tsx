import { useEffect, useMemo, useRef, useState } from 'react'
import { BellRingIcon, MessageSquareIcon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Button, Field, Select, ToggleRow, Textarea, Banner } from '@/design-system'
import libraryService from '@/services/library.service'
import { useSmsVerification } from '@/hooks/useSmsVerification'
import { SmsVerificationPanel } from '@/components/specialized/SmsVerificationPanel'
import { EVENT_LABELS, EVENT_ORDER } from './LibraryNotificationTemplatesSection'
import type { LibraryNotificationTemplate } from '@/types/library.types'

interface Props {
  open: boolean
  libraryId: string
  sessionIds?: string[]
  onClose: () => void
}

const mergeTemplates = (templates?: LibraryNotificationTemplate[] | null) => EVENT_ORDER.map((event) => {
  const existing = templates?.find((template) => template.event === event)
  return existing ?? { event, smsEnabled: true, smsBody: '', notifyEnabled: true, notifyBody: '' }
})

export const LibrarySendMessageModal = ({ open, libraryId, sessionIds, onClose }: Props) => {
  const selectedSessionIds = useMemo(() => sessionIds ?? [], [sessionIds])
  const [templates, setTemplates] = useState<LibraryNotificationTemplate[]>([])
  const [templateEvent, setTemplateEvent] = useState('manual')
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
    setUseCustomText(false)
    setCustomText('')
    setSms(true)
    setNotify(true)
    verification.reset()
    libraryService.settings.get(libraryId)
      .then((settings) => setTemplates(mergeTemplates(settings.notificationTemplates)))
      .catch(() => setTemplates(mergeTemplates(null)))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- verification her render'da yeni obje döndürür, bağımlılığa eklemek sonsuz döngü oluşturur
  }, [open, libraryId])

  const selectedTemplate = templates.find((template) => template.event === templateEvent)
  const meta = EVENT_LABELS[templateEvent] ?? { label: templateEvent, desc: '', vars: [] }
  const templateText = (template?: LibraryNotificationTemplate) => template?.smsBody || template?.notifyBody || ''

  const changeTemplate = (event: string) => {
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
    const channels = [selectedTemplate?.smsEnabled && 'SMS', selectedTemplate?.notifyEnabled && 'bildirim'].filter(Boolean)
    return channels.length > 0 ? `Şablonda aktif kanallar: ${channels.join(' + ')}` : 'Bu şablonun kanalları ayarlarda kapalı.'
  }, [selectedTemplate, useCustomText])

  const send = async () => {
    if (!sms && !notify) { toast.warning('En az bir kanal seçin.'); return }
    if (useCustomText && !customText.trim()) { toast.warning('Özel mesaj metnini yazın.'); return }
    if (sms && !verification.isReady) { toast.warning('SMS göndermek için doğrulama kodu isteyin ve girin.'); return }
    setSending(true)
    try {
      const result = await libraryService.sendManualMessage(libraryId, {
        sessionIds: selectedSessionIds.length > 0 ? selectedSessionIds : undefined,
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
      title="Kütüphane Mesajı Gönder"
      subtitle={selectedSessionIds.length > 0 ? `${selectedSessionIds.length} seçili aktif oturum` : 'Tüm aktif oturumlara gönderilir'}
      width={620}
      footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={sending}>İptal</Button><Button variant="primary" onClick={send} isLoading={sending} disabled={loading || (sms && !verification.isReady)}>Gönder</Button></div>}
    >
      <div className="space-y-4 p-5">
        <Banner tone="info" variant="soft" icon={SparklesIcon}>
          Şablon değişkenleri her üye ve aktif oturum için otomatik doldurulur. Şablonları Kütüphane → Ayarlar → Mesaj Şablonları bölümünden değiştirebilirsiniz.
        </Banner>
        <Field label="Mesaj Şablonu">
          <Select value={templateEvent} onChange={(event) => changeTemplate(event.target.value)} disabled={loading}>
            {EVENT_ORDER.map((event) => <option key={event} value={event}>{EVENT_LABELS[event]?.label ?? event}</option>)}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow label="SMS gönder" description="Telefonu kayıtlı aktif üyelere gider" checked={sms} onChange={setSms} />
          <ToggleRow label="Uygulama bildirimi" description="Vatandaş portalında görünür" checked={notify} onChange={setNotify} />
        </div>
        <SmsVerificationPanel state={verification} visible={sms} />
        <ToggleRow label="Özel mesaj kullan" description="Seçili şablon yerine aşağıdaki metni gönderir" checked={useCustomText} onChange={toggleCustomText} />
        <div className="rounded-card border border-border bg-surface-1 p-3">
          <p className="type-caption font-semibold text-foreground-default">Kullanılabilir değişkenler</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {meta.vars.map((variable) => (
              <Button key={variable} type="button" variant="outline" size="sm" onClick={() => insertVariable(variable)} title="Özel mesaja ekle">
                <span className="font-mono">{variable}</span>
              </Button>
            ))}
          </div>
          <p className="mt-2 type-caption text-foreground-muted">Bir değişkene tıklayın; özel mesaj alanında imlecin bulunduğu yere eklensin.</p>
        </div>
        {useCustomText ? (
          <Field label="Özel Mesaj" hint={`${customText.length}/500 · Değişkenleri metin içinde kullanabilirsiniz`}>
            <Textarea ref={customTextRef} value={customText} onChange={(event) => setCustomText(event.target.value)} rows={5} maxLength={500} placeholder="Örn: Sayın {{ad}} {{soyad}}, {{kutuphane}} için önemli bir bilgilendirme..." />
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-card border border-success bg-success-soft p-3">
              <p className="mb-2 inline-flex items-center gap-1.5 type-caption font-bold text-success"><MessageSquareIcon className="h-3.5 w-3.5" /> SMS Şablonu</p>
              <p className="whitespace-pre-wrap type-caption text-foreground-default">{selectedTemplate?.smsBody || 'SMS metni tanımlanmamış.'}</p>
            </div>
            <div className="rounded-card border border-info bg-info-soft p-3">
              <p className="mb-2 inline-flex items-center gap-1.5 type-caption font-bold text-info"><BellRingIcon className="h-3.5 w-3.5" /> Bildirim Şablonu</p>
              <p className="whitespace-pre-wrap type-caption text-foreground-default">{selectedTemplate?.notifyBody || 'Bildirim metni tanımlanmamış.'}</p>
            </div>
          </div>
        )}
        <p className="type-caption text-foreground-muted">{channelSummary}</p>
      </div>
    </Modal>
  )
}
