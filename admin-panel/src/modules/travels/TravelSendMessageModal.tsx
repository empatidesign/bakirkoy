import { useEffect, useMemo, useRef, useState } from 'react'
import { BellRingIcon, MessageSquareIcon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Button, Field, Select, ToggleRow, Textarea, Banner } from '@/design-system'
import travelService from '@/services/travel.service'
import travelApplicationService from '@/services/travelApplication.service'
import { useSmsVerification } from '@/hooks/useSmsVerification'
import { SmsVerificationPanel } from '@/components/specialized/SmsVerificationPanel'
import {
  APPLICATION_STATUS_OPTIONS, TRAVEL_NOTIFICATION_META, mergeTravelNotificationTemplates,
} from './travelFormDefaults'
import type { ApplicationStatus, Travel, TravelNotificationEvent, TravelNotificationTemplate } from '@/types/travel.types'

interface Props {
  open?: boolean
  ids?: string[]
  target?: 'travel' | 'travelRoute'
  travel?: Travel | null
  onClose: () => void
}

const EVENT_ORDER: TravelNotificationEvent[] = [
  'application_received', 'approved', 'rejected', 'waitlist', 'promoted',
  'promoted_approved', 'cancelled', 'postponed', 'emergency', 'departure_reminder', 'manual',
]

export const TravelSendMessageModal = ({ open, ids, target = 'travel', travel, onClose }: Props) => {
  const effectiveOpen = open ?? !!travel
  const selectedIds = useMemo(() => travel ? [travel.id] : (ids ?? []), [travel, ids])
  const [templates, setTemplates] = useState<TravelNotificationTemplate[]>([])
  const [travelIds, setTravelIds] = useState<string[]>([])
  const [templateEvent, setTemplateEvent] = useState<TravelNotificationEvent>('manual')
  const [status, setStatus] = useState<ApplicationStatus | ''>('')
  const [useCustomText, setUseCustomText] = useState(false)
  const [customText, setCustomText] = useState('')
  const [sms, setSms] = useState(true)
  const [notify, setNotify] = useState(true)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  // Kullanıcı isteği (2026-09-20): SMS gönderiminde artık İLK gönderimden itibaren her
  // seferinde PIN veya OTP zorunlu.
  const verification = useSmsVerification()
  const customTextRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!effectiveOpen) return
    setLoading(true)
    setTemplateEvent('manual')
    setStatus('')
    setUseCustomText(false)
    setCustomText('')
    setSms(true)
    setNotify(true)
    verification.reset()
    const loadIds = target === 'travel'
      ? Promise.resolve(selectedIds)
      : Promise.all(selectedIds.map((routeId) => travelService.getList({ routeId, page: 1, limit: 500 })))
          .then((pages) => [...new Set(pages.flatMap((page) => page.items.map((travel) => travel.id)))])
    Promise.all([travelService.getSettings(), loadIds])
      .then(([settings, resolvedIds]) => {
        setTemplates(mergeTravelNotificationTemplates(settings.notificationTemplates))
        setTravelIds(resolvedIds)
      })
      .catch(() => {
        setTemplates(mergeTravelNotificationTemplates(null))
        setTravelIds(target === 'travel' ? selectedIds : [])
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- verification her render'da yeni obje döndürür, bağımlılığa eklemek sonsuz döngü oluşturur
  }, [effectiveOpen, selectedIds, target])

  const selectedTemplate = templates.find((template) => template.event === templateEvent)
  const meta = TRAVEL_NOTIFICATION_META[templateEvent]
  const templateText = (template?: TravelNotificationTemplate) => template?.smsBody || template?.notifyBody || ''

  const changeTemplate = (event: TravelNotificationEvent) => {
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
    if (travelIds.length === 0) { toast.warning('Mesaj gönderilecek sefer bulunamadı.'); return }
    if (sms && !verification.isReady) { toast.warning('SMS göndermek için doğrulama kodu isteyin ve girin.'); return }
    setSending(true)
    try {
      const results = []
      for (const travelId of travelIds) {
        results.push(await travelApplicationService.sendManualMessage({
          travelId,
          templateEvent,
          customText: useCustomText ? customText.trim() : null,
          sms,
          notify,
          statusFilter: status ? [status] : undefined,
          ...verification.payload(),
        }))
      }
      const totals = results.reduce((sum, result) => ({
        recipients: sum.recipients + result.recipients,
        sms: sum.sms + result.smsSent,
        notifications: sum.notifications + result.notificationsCreated,
      }), { recipients: 0, sms: 0, notifications: 0 })
      toast.success(`${totals.recipients} alıcı işlendi (SMS: ${totals.sms}, bildirim: ${totals.notifications}).`)
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
      open={effectiveOpen}
      onClose={() => { if (!sending) onClose() }}
      title="Gezi Mesajı Gönder"
      subtitle={`${selectedIds.length} seçili ${target === 'travel' ? 'sefer' : 'gezi'} · şablon veya özel metin kullanın`}
      width={620}
      footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={sending}>İptal</Button><Button variant="primary" onClick={send} isLoading={sending} disabled={loading || (sms && !verification.isReady)}>Gönder</Button></div>}
    >
      <div className="space-y-4 p-5">
        <Banner tone="info" variant="soft" icon={SparklesIcon}>
          Şablon değişkenleri her yolcu ve sefer için otomatik doldurulur. Şablonları Gezi Sistemi → Genel Ayarlar → Mesaj Şablonları bölümünden değiştirebilirsiniz.
        </Banner>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mesaj Şablonu">
            <Select value={templateEvent} onChange={(event) => changeTemplate(event.target.value as TravelNotificationEvent)} disabled={loading}>
              {EVENT_ORDER.map((event) => <option key={event} value={event}>{TRAVEL_NOTIFICATION_META[event].label}</option>)}
            </Select>
          </Field>
          <Field label="Yolcu Durumu" hint="Boş bırakılırsa tüm başvurular">
            <Select value={status} onChange={(event) => setStatus(event.target.value as ApplicationStatus | '')}>
              <option value="">Tüm durumlar</option>
              {APPLICATION_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow label="SMS gönder" description="Telefonu kayıtlı yolculara gider" checked={sms} onChange={setSms} />
          <ToggleRow label="Uygulama bildirimi" description="Vatandaş portalında görünür" checked={notify} onChange={setNotify} />
        </div>
        <SmsVerificationPanel state={verification} visible={sms} />
        <ToggleRow label="Özel mesaj kullan" description="Seçili şablon yerine aşağıdaki metni gönderir" checked={useCustomText} onChange={toggleCustomText} />
        <div className="rounded-card border border-border bg-surface-1 p-3">
          <p className="type-caption font-semibold text-foreground-default">Kullanılabilir değişkenler</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {meta.vars.map((variable) => (
              <button key={variable} type="button" onClick={() => insertVariable(variable)} className="rounded-md border border-primary/25 bg-card px-2 py-1 font-mono text-[11px] text-primary transition-colors hover:border-primary hover:bg-primary-soft" title="Özel mesaja ekle">
                {variable}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-foreground-muted">Bir değişkene tıklayın; özel mesaj alanında imlecin bulunduğu yere eklensin.</p>
        </div>
        {useCustomText ? (
          <Field label="Özel Mesaj" hint={`${customText.length}/500 · Değişkenleri metin içinde kullanabilirsiniz`}>
            <Textarea ref={customTextRef} value={customText} onChange={(event) => setCustomText(event.target.value)} rows={5} maxLength={500} placeholder="Örn: Sayın {{ad}} {{soyad}}, {{sefer}} gezimizin kalkış saati {{saat}} olarak güncellenmiştir." />
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-card border border-[#5a8a2a]/25 bg-[#f1f7e8] p-3">
              <p className="mb-2 inline-flex items-center gap-1.5 type-caption font-bold text-[#5a8a2a]"><MessageSquareIcon className="h-3.5 w-3.5" /> SMS Şablonu</p>
              <p className="whitespace-pre-wrap type-caption text-foreground-default">{selectedTemplate?.smsBody || 'SMS metni tanımlanmamış.'}</p>
            </div>
            <div className="rounded-card border border-[#0f4c81]/25 bg-[#eef3f8] p-3">
              <p className="mb-2 inline-flex items-center gap-1.5 type-caption font-bold text-[#0f4c81]"><BellRingIcon className="h-3.5 w-3.5" /> Bildirim Şablonu</p>
              <p className="whitespace-pre-wrap type-caption text-foreground-default">{selectedTemplate?.notifyBody || 'Bildirim metni tanımlanmamış.'}</p>
            </div>
          </div>
        )}
        <p className="type-caption text-foreground-muted">{channelSummary}</p>
      </div>
    </Modal>
  )
}
