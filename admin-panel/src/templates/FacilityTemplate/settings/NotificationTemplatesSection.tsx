import { useState } from 'react'
import { BellIcon, MessageSquareIcon, BellRingIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { FormSection, ToggleRow, Field } from '@/design-system'
import { Textarea } from '@/design-system'
import type { NotificationTemplate, NotificationEvent } from '@/types/facility.types'

const EVENT_LABELS: Record<NotificationEvent, { label: string; desc: string; vars: string[] }> = {
  application_approved: {
    label: 'Başvuru Onaylandı',
    desc: 'Başvuru admin tarafından onaylandığında',
    vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{tesis}}', '{{tarih}}'],
  },
  application_rejected: {
    label: 'Başvuru Reddedildi',
    desc: 'Başvuru admin tarafından reddedildiğinde',
    vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{red_nedeni}}'],
  },
  application_pending: {
    label: 'Başvuru Alındı (Beklemede)',
    desc: 'Başvuru sisteme alındığında, onay beklerken',
    vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{tesis}}'],
  },
  application_waitlisted: {
    label: 'Yedek Listeye Alındı',
    desc: 'Kontenjan doluysa yedek listeye eklendiğinde',
    vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{sira}}'],
  },
  application_documents_required: {
    label: 'Evrak Yükleme Gerekli',
    desc: 'Onay için evrak yüklemesi beklendiğinde',
    vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{evrak_listesi}}'],
  },
  attendance_absent: {
    label: 'Devamsızlık Kaydedildi',
    desc: 'Katılımcı seansa katılmadığında',
    vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{seans_tarihi}}', '{{devamsizlik_sayisi}}'],
  },
  absence_warning: {
    label: 'Devamsızlık Uyarısı',
    desc: 'Devamsızlık limitine yaklaşıldığında',
    vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{kalan_hak}}', '{{limit}}'],
  },
  absence_limit_reached: {
    label: 'Devamsızlık Limiti Aşıldı',
    desc: 'Devamsızlık hakkı dolduğunda (otomatik çıkarma öncesi)',
    vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{limit}}'],
  },
  session_reminder: {
    label: 'Seans Hatırlatması',
    desc: 'Seans başlamadan önce (saat/gün öncesi)',
    vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{seans_saati}}', '{{tesis}}'],
  },
  waitlist_promoted: {
    label: 'Yedekten Asile Yükseltildi',
    desc: 'Yedek listeden asil listeye geçildiğinde',
    vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{tesis}}', '{{onay_suresi}}', '{{seans_tarihi}}', '{{seans_saati}}'],
  },
  registration_cancelled: {
    label: 'Kayıt İptal Edildi',
    desc: 'Kayıt iptal edildiğinde (devamsızlık veya manuel)',
    vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{iptal_nedeni}}'],
  },
  postponed: {
    label: 'Program Ertelendi',
    desc: 'Seans/program tarihi değiştiğinde admin manuel gönderir',
    vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{tesis}}', '{{seans_tarihi}}'],
  },
  emergency: {
    label: 'Acil Durum Duyurusu',
    desc: 'Acil bir durumda admin manuel gönderir',
    vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{tesis}}'],
  },
  manual: {
    label: 'Manuel Bilgilendirme',
    desc: 'Şablonlu mesaj gönder ekranında elle seçilen genel bilgilendirme',
    vars: ['{{ad}}', '{{soyad}}', '{{grup}}', '{{tesis}}', '{{seans_tarihi}}', '{{seans_saati}}'],
  },
}

// Denetim bulgusu 2026-08-08 (badger ajanı, docs/sablon-sistemi-baglanti-denetimi-2026-08-08.md):
// tüm Facility modüllerinde (sports/pool/youth-camp/scout-camp/science-center/kasif/accessible-life)
// varsayılan şablon metinleri BOŞ string'ti (smsBody: '') — Travel/SEDA/Event'in aksine ki onlarda
// gerçek dolu varsayılan metinler var. Sonuç: admin hiç şablon girmediği sürece (ki hiçbir modülde
// canlı DB'de girilmemiş bulundu) SMS hiç gitmiyordu, altyapı var ama fiilen kullanılmıyordu.
// Artık Travel/SEDA/Event ile tutarlı, dolu varsayılan metinler var — admin hiç dokunmasa bile
// SMS/push anlamlı bir metinle gidiyor, isterse özelleştirebiliyor.
//
// Kullanıcı isteği (2026-10-06): "tüm devam/devamsızlık/üyelik/iptal bildirimlerinde SMS mi push
// mu gitsin seçilebilsin" — e-posta (hiçbir zaman çalışmayan, SMTP'siz) kanal kaldırıldı, yerine
// gerçek FCM push altyapısına bağlı "Uygulama Bildirimi" (notifyEnabled/notifyBody) eklendi.
// Push varsayılan olarak ücretsiz/müdahaleci-olmayan bir kanal olduğundan "manual" dışındaki tüm
// olaylarda varsayılan AÇIK (backend'deki DefaultNotifyEnabled ile simetrik).
const SMS_BODY: Record<string, string> = {
  application_approved: 'Sayın {{ad}} {{soyad}}, {{grup}} ({{tesis}}) başvurunuz onaylandı.',
  application_rejected: 'Sayın {{ad}} {{soyad}}, {{grup}} başvurunuz reddedildi. {{red_nedeni}}',
  application_pending: 'Sayın {{ad}} {{soyad}}, {{grup}} ({{tesis}}) başvurunuz alındı, onay bekliyor.',
  application_waitlisted: 'Sayın {{ad}} {{soyad}}, {{grup}} için yedek listeye alındınız. Sıra: {{sira}}.',
  application_documents_required: 'Sayın {{ad}} {{soyad}}, {{grup}} başvurunuz için şu belgeler gerekli: {{evrak_listesi}}',
  attendance_absent: 'Sayın {{ad}} {{soyad}}, {{seans_tarihi}} tarihli {{grup}} seansına katılmadığınız kaydedildi.',
  absence_warning: 'Sayın {{ad}} {{soyad}}, {{grup}} devamsızlık hakkınız: {{kalan_hak}}/{{limit}}. Lütfen dikkat ediniz.',
  absence_limit_reached: 'Sayın {{ad}} {{soyad}}, {{grup}} devamsızlık limitiniz ({{limit}}) doldu, kaydınız iptal edildi.',
  session_reminder: 'Sayın {{ad}} {{soyad}}, {{grup}} ({{tesis}}) seansınız {{seans_saati}} saatinde başlayacak.',
  waitlist_promoted: 'Sayın {{ad}} {{soyad}}, {{grup}} ({{tesis}}) programında yer açıldı, kaydınız onaylandı. İlk katılımınız: {{seans_tarihi}} {{seans_saati}}.',
  registration_cancelled: 'Sayın {{ad}} {{soyad}}, {{grup}} kaydınız iptal edildi. {{iptal_nedeni}}',
  postponed: 'Sayın {{ad}} {{soyad}}, {{grup}} ({{tesis}}) programı ertelendi. Yeni tarih: {{seans_tarihi}}.',
  emergency: 'Sayın {{ad}} {{soyad}}, {{grup}} ({{tesis}}) ile ilgili acil bir duyuru bulunmaktadır. Lütfen yetkiliyle iletişime geçin.',
  manual: 'Sayın {{ad}} {{soyad}}, {{grup}} ({{tesis}}) programı hakkında bilgilendirme: ',
}

const DEFAULT_TEMPLATES: NotificationTemplate[] = Object.keys(EVENT_LABELS).map((event) => ({
  event: event as NotificationEvent,
  smsEnabled: ['application_approved', 'application_rejected', 'waitlist_promoted', 'absence_warning', 'manual'].includes(event),
  smsBody: SMS_BODY[event] ?? '',
  notifyEnabled: event !== 'manual',
  notifyBody: SMS_BODY[event] ?? '',
}))

interface Props {
  templates: NotificationTemplate[]
  onChange: (templates: NotificationTemplate[]) => void
}

function TemplateRow({ template, onChange }: { template: NotificationTemplate; onChange: (t: NotificationTemplate) => void }) {
  const [open, setOpen] = useState(false)
  const meta = EVENT_LABELS[template.event]
  const isAnyEnabled = template.smsEnabled || template.notifyEnabled

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-surface-1 transition-colors text-left"
      >
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isAnyEnabled ? 'bg-[hsl(var(--accent-blue-soft))]' : 'bg-surface-2'}`}>
          <BellIcon className={`h-3.5 w-3.5 ${isAnyEnabled ? 'text-[hsl(var(--accent-blue))]' : 'text-foreground-subtle'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground-strong truncate">{meta.label}</p>
          <p className="text-[11px] text-foreground-subtle truncate">{meta.desc}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {template.smsEnabled && (
            <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--success-soft))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--success))]">
              <MessageSquareIcon className="h-2.5 w-2.5" /> SMS
            </span>
          )}
          {template.notifyEnabled && (
            <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--accent-blue-soft))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--accent-blue))]">
              <BellRingIcon className="h-2.5 w-2.5" /> Bildirim
            </span>
          )}
          {open ? <ChevronDownIcon className="h-4 w-4 text-foreground-subtle" /> : <ChevronRightIcon className="h-4 w-4 text-foreground-subtle" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border bg-surface-1/40 px-4 pb-4 pt-3 space-y-4">
          <div>
            <p className="text-[11px] font-bold text-foreground-muted mb-1.5">Kullanılabilir Değişkenler</p>
            <div className="flex flex-wrap gap-1.5">
              {meta.vars.map((v) => (
                <code key={v} className="rounded-md bg-[hsl(var(--card))] border border-border px-2 py-0.5 text-[11px] font-mono text-[hsl(var(--accent-blue))] select-all">
                  {v}
                </code>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquareIcon className="h-4 w-4 text-[hsl(var(--success))]" />
                <span className="text-[12px] font-bold text-foreground-default">SMS Bildirimi</span>
              </div>
              <ToggleRow
                label="SMS bildirimi"
                checked={template.smsEnabled}
                onChange={(v) => onChange({ ...template, smsEnabled: v })}
              />
            </div>
            {template.smsEnabled && (
              <Field label="SMS Metni" hint={`${template.smsBody.length}/320 karakter`}>
                <Textarea
                  rows={3}
                  value={template.smsBody}
                  onChange={(e) => onChange({ ...template, smsBody: e.target.value })}
                  placeholder={`Örn: Sayın {{ad}} {{soyad}}, ${meta.label.toLowerCase()} için bilgilendirme...`}
                  maxLength={320}
                />
              </Field>
            )}
          </div>

          <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRingIcon className="h-4 w-4 text-[hsl(var(--accent-blue))]" />
                <span className="text-[12px] font-bold text-foreground-default">Uygulama Bildirimi (Push)</span>
              </div>
              <ToggleRow
                label="Uygulama bildirimi"
                checked={template.notifyEnabled}
                onChange={(v) => onChange({ ...template, notifyEnabled: v })}
              />
            </div>
            {template.notifyEnabled && (
              <Field label="Bildirim Metni" hint={`${template.notifyBody.length}/500 karakter`}>
                <Textarea
                  rows={3}
                  value={template.notifyBody}
                  onChange={(e) => onChange({ ...template, notifyBody: e.target.value })}
                  placeholder={`Örn: ${meta.label} hakkında bilgilendirme...`}
                  maxLength={500}
                />
              </Field>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export const NotificationTemplatesSection = ({ templates, onChange }: Props) => {
  const merged = DEFAULT_TEMPLATES.map((def) => {
    const found = templates.find((t) => t.event === def.event)
    return found ?? def
  })

  const update = (updated: NotificationTemplate) => {
    const next = merged.map((t) => (t.event === updated.event ? updated : t))
    onChange(next)
  }

  const enabledCount = merged.filter((t) => t.smsEnabled || t.notifyEnabled).length

  return (
    <FormSection
      variant="card"
      tone="info"
      icon={BellIcon}
      title="Bildirim Şablonları"
      subtitle={`SMS ve push şablonları — ${enabledCount}/${merged.length} olay aktif`}
    >
      <div className="space-y-2">
        {merged.map((t) => (
          <TemplateRow key={t.event} template={t} onChange={update} />
        ))}
      </div>
    </FormSection>
  )
}
