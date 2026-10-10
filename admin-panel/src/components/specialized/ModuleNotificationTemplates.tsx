import { useEffect, useRef, useState } from 'react'
import { BellIcon, BellRingIcon, MessageSquareIcon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Banner, Button, Field, FormSection, Modal, Select, Textarea, ToggleRow } from '@/design-system'
import moduleNotificationService from '@/services/moduleNotification.service'
import { useSmsVerification } from '@/hooks/useSmsVerification'
import { SmsVerificationPanel } from '@/components/specialized/SmsVerificationPanel'
import type { ModuleNotificationTemplate, ModuleTemplateMeta } from '@/types/moduleNotification.types'

export type ModuleNotificationKey = 'quiz' | 'survey' | 'wheel' | 'muhtarlik'

// 2026-08-13 denetiminde bulundu (GERÇEK HATA — TEMPLATE_NOT_FOUND): bu event
// anahtarları backend'in ModuleNotificationSettingsService.Defaults sözlüğündeki
// GERÇEK anahtarlarla uyuşmuyordu (result≠result_announced, reminder≠thank_you,
// result≠winner_announced, status≠resolved). Canlı testte kanıtlandı: admin panelde
// "Manuel Bilgilendirme" DIŞINDA herhangi bir şablon seçip mesaj göndermeye çalışan
// her kullanıcı 409 TEMPLATE_NOT_FOUND alıyordu (4 modülün 3'ünde tam kırık, survey'de
// targetKind ayrı bir sorun yüzünden sessizce 0 alıcı dönüyordu). Anahtarlar backend'le
// birebir eşleştirildi.
export const MODULE_NOTIFICATION_META: Record<ModuleNotificationKey, Record<string, ModuleTemplateMeta>> = {
  quiz: {
    manual: { label: 'Manuel Bilgilendirme', desc: 'Seçili yarışma katılımcılarına serbest bilgilendirme', vars: ['{{ad}}', '{{soyad}}', '{{yarisma}}', '{{puan}}'] },
    result_announced: { label: 'Yarışma Sonucu', desc: 'Puan/sonuç bilgilendirmesi', vars: ['{{ad}}', '{{soyad}}', '{{yarisma}}', '{{puan}}'] },
  },
  survey: {
    manual: { label: 'Manuel Bilgilendirme', desc: 'Seçili anket yanıtlayıcılarına serbest bilgilendirme', vars: ['{{ad}}', '{{soyad}}', '{{anket}}'] },
    thank_you: { label: 'Katılım Teşekkürü', desc: 'Ankete katılım sonrası teşekkür mesajı', vars: ['{{ad}}', '{{soyad}}', '{{anket}}'] },
  },
  wheel: {
    manual: { label: 'Manuel Bilgilendirme', desc: 'Seçili hediye taleplerine serbest bilgilendirme', vars: ['{{ad}}', '{{soyad}}', '{{hediye}}', '{{sira_no}}'] },
    winner_announced: { label: 'Hediye Sonucu', desc: 'Hediye talebi sonuç bilgilendirmesi', vars: ['{{ad}}', '{{soyad}}', '{{hediye}}', '{{sira_no}}'] },
  },
  muhtarlik: {
    manual: { label: 'Manuel Bilgilendirme', desc: 'Seçili muhtarlık taleplerine serbest bilgilendirme', vars: ['{{ad}}', '{{soyad}}', '{{talep_no}}', '{{kategori}}'] },
    resolved: { label: 'Talep Durumu', desc: 'Talep durum güncellemesi', vars: ['{{ad}}', '{{soyad}}', '{{talep_no}}', '{{kategori}}'] },
  },
}

const moduleTitle: Record<ModuleNotificationKey, string> = { quiz: 'Bilgi Yarışması', survey: 'Anket', wheel: 'Çark / Hediye', muhtarlik: 'Muhtarlık' }
const fallbackText = 'Sayın {{ad}} {{soyad}}, bilgilendirme mesajınız bulunmaktadır.'

function mergeTemplates(module: ModuleNotificationKey, templates?: ModuleNotificationTemplate[] | null) {
  const existing = templates ?? []
  return Object.entries(MODULE_NOTIFICATION_META[module]).map(([event]) => {
    const found = existing.find((t) => t.event === event)
    return found ?? { event, smsEnabled: true, smsBody: fallbackText, notifyEnabled: true, notifyBody: fallbackText }
  })
}

interface SettingsProps { module: ModuleNotificationKey; templates: ModuleNotificationTemplate[]; onChange: (templates: ModuleNotificationTemplate[]) => void }
export function ModuleNotificationSettingsSection({ module, templates, onChange }: SettingsProps) {
  const merged = mergeTemplates(module, templates)
  const update = (updated: ModuleNotificationTemplate) => onChange(merged.map((t) => (t.event === updated.event ? updated : t)))
  return (
    <FormSection variant="card" icon={BellIcon} title="Mesaj Şablonları" subtitle={`${moduleTitle[module]} olay bazlı SMS ve bildirim metinleri`}>
      <div className="space-y-3">
        {merged.map((template) => {
          const meta = MODULE_NOTIFICATION_META[module][template.event]
          return (
            <div key={template.event} className="rounded-card border border-border bg-card p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div><p className="type-section">{meta.label}</p><p className="type-caption text-foreground-muted">{meta.desc}</p></div>
                <div className="flex gap-2"><ToggleRow label="SMS" checked={template.smsEnabled} onChange={(v) => update({ ...template, smsEnabled: v })} /><ToggleRow label="Bildirim" checked={template.notifyEnabled} onChange={(v) => update({ ...template, notifyEnabled: v })} /></div>
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">{meta.vars.map((v) => <code key={v} className="rounded-field border border-border bg-surface-1 px-2 py-1 font-mono type-caption text-primary">{v}</code>)}</div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="SMS Metni" hint={`${template.smsBody.length}/320`}><Textarea rows={3} maxLength={320} value={template.smsBody} onChange={(e) => update({ ...template, smsBody: e.target.value })} /></Field>
                <Field label="Bildirim Metni" hint={`${template.notifyBody.length}/500`}><Textarea rows={3} maxLength={500} value={template.notifyBody} onChange={(e) => update({ ...template, notifyBody: e.target.value })} /></Field>
              </div>
            </div>
          )
        })}
      </div>
    </FormSection>
  )
}

interface SendProps { open: boolean; module: ModuleNotificationKey; ids: string[]; targetKind: string; title?: string; onClose: () => void }
export function ModuleSendMessageModal({ open, module, ids, targetKind, title, onClose }: SendProps) {
  const [templates, setTemplates] = useState<ModuleNotificationTemplate[]>([])
  const [templateEvent, setTemplateEvent] = useState('manual')
  const [useCustomText, setUseCustomText] = useState(false)
  const [customText, setCustomText] = useState('')
  const [sms, setSms] = useState(true)
  const [notify, setNotify] = useState(true)
  const [sending, setSending] = useState(false)
  // Kullanıcı isteği (2026-09-20): SMS gönderiminde artık İLK gönderimden itibaren her
  // seferinde PIN veya OTP zorunlu.
  const verification = useSmsVerification()
  const textRef = useRef<HTMLTextAreaElement>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- verification her render'da yeni obje döndürür, bağımlılığa eklemek sonsuz döngü oluşturur
  useEffect(() => { if (open) { verification.reset(); moduleNotificationService.getSettings(module).then((s) => setTemplates(mergeTemplates(module, s.notificationTemplates))).catch(() => setTemplates(mergeTemplates(module))) } }, [open, module])
  const selectedTemplate = templates.find((t) => t.event === templateEvent)
  const meta = MODULE_NOTIFICATION_META[module][templateEvent] ?? MODULE_NOTIFICATION_META[module].manual
  const templateText = selectedTemplate?.smsBody || selectedTemplate?.notifyBody || fallbackText
  const insertVariable = (variable: string) => { const base = useCustomText ? customText : templateText; setUseCustomText(true); setCustomText(`${base} ${variable}`); requestAnimationFrame(() => textRef.current?.focus()) }
  const send = async () => {
    if (ids.length === 0) { toast.warning('En az bir kayıt seçin.'); return }
    if (!sms && !notify) { toast.warning('En az bir kanal seçin.'); return }
    if (sms && !verification.isReady) { toast.warning('SMS göndermek için doğrulama kodu isteyin ve girin.'); return }
    setSending(true)
    try {
      const result = await moduleNotificationService.send(module, { targetKind, ids, templateEvent, customText: useCustomText ? customText.trim() : null, sms, notify, ...verification.payload() })
      toast.success(`${result.recipients} alıcı işlendi (SMS: ${result.smsSent}, bildirim: ${result.notificationsCreated}).`)
      onClose()
    } catch (err) {
      if (verification.handleSendError(err)) return
      throw err
    } finally { setSending(false) }
  }
  return (
    <Modal open={open} onClose={() => { if (!sending) onClose() }} title={title ?? `${moduleTitle[module]} Şablonlu Mesaj`} subtitle={`${ids.length} seçili kayıt`} width={620} footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={sending}>İptal</Button><Button variant="primary" onClick={send} isLoading={sending} disabled={sms && !verification.isReady}>Gönder</Button></div>}>
      <div className="space-y-4 p-5">
        <Banner tone="info" variant="soft" icon={SparklesIcon}>Şablon değişkenleri her alıcı için otomatik doldurulur. Özel mesaj kullanırsanız aynı değişkenleri metin içinde kullanabilirsiniz.</Banner>
        <Field label="Mesaj Şablonu"><Select value={templateEvent} onChange={(e) => setTemplateEvent(e.target.value)}>{Object.entries(MODULE_NOTIFICATION_META[module]).map(([event, item]) => <option key={event} value={event}>{item.label}</option>)}</Select></Field>
        <div className="grid gap-3 sm:grid-cols-2"><ToggleRow label="SMS gönder" checked={sms} onChange={setSms} /><ToggleRow label="Uygulama bildirimi" checked={notify} onChange={setNotify} /></div>
        <SmsVerificationPanel state={verification} visible={sms} />
        <ToggleRow label="Özel mesaj kullan" description="Seçili şablon yerine aşağıdaki metni gönderir" checked={useCustomText} onChange={(v) => { setUseCustomText(v); if (v && !customText.trim()) setCustomText(templateText) }} />
        <div className="rounded-card border border-border bg-surface-1 p-3"><p className="type-caption font-semibold text-foreground-default">Kullanılabilir değişkenler</p><div className="mt-2 flex flex-wrap gap-1.5">{meta.vars.map((v) => <Button key={v} variant="outline" size="sm" onClick={() => insertVariable(v)}>{v}</Button>)}</div></div>
        {useCustomText ? <Field label="Özel Mesaj" hint={`${customText.length}/500`}><Textarea ref={textRef} value={customText} onChange={(e) => setCustomText(e.target.value)} rows={5} maxLength={500} /></Field> : <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-card border border-border bg-surface-1 p-3"><p className="mb-2 inline-flex items-center gap-1 type-caption font-semibold text-success"><MessageSquareIcon className="h-3.5 w-3.5" /> SMS</p><p className="whitespace-pre-wrap type-caption text-foreground-default">{selectedTemplate?.smsBody}</p></div><div className="rounded-card border border-border bg-surface-1 p-3"><p className="mb-2 inline-flex items-center gap-1 type-caption font-semibold text-primary"><BellRingIcon className="h-3.5 w-3.5" /> Bildirim</p><p className="whitespace-pre-wrap type-caption text-foreground-default">{selectedTemplate?.notifyBody}</p></div></div>}
      </div>
    </Modal>
  )
}

export { mergeTemplates as mergeModuleNotificationTemplates }
