import { useState } from 'react'
import { BellIcon, MessageSquareIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { FormSection, ToggleRow, Field } from '@/design-system'
import { Textarea } from '@/design-system'
import type { CompanyNotificationTemplate } from '@/types/company.types'
import { COMPANY_NOTIFICATION_META, mergeCompanyNotificationTemplates } from './companyNotificationDefaults'

interface Props {
  templates: CompanyNotificationTemplate[]
  onChange: (templates: CompanyNotificationTemplate[]) => void
}

function TemplateRow({ template, onChange }: { template: CompanyNotificationTemplate; onChange: (t: CompanyNotificationTemplate) => void }) {
  const [open, setOpen] = useState(false)
  const meta = COMPANY_NOTIFICATION_META[template.event]

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-surface-1 transition-colors text-left"
      >
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${template.smsEnabled ? 'bg-[hsl(var(--accent-blue-soft))]' : 'bg-surface-2'}`}>
          <BellIcon className={`h-3.5 w-3.5 ${template.smsEnabled ? 'text-[hsl(var(--accent-blue))]' : 'text-foreground-subtle'}`} />
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
                <span className="text-[12px] font-bold text-foreground-default">SMS</span>
              </div>
              <ToggleRow
                label=""
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
                  placeholder="Örn: Sayın {{firma}}, giriş şifreniz: {{sifre}}."
                  maxLength={320}
                />
              </Field>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Kullanıcı isteği (2026-08-08): şablon sisteminin tüm modüllere yayılması denetimi
 * (docs/sablon-sistemi-baglanti-denetimi-2026-08-08.md) — Companies modülündeki 3 sabit
 * kodlu SMS metni (geçici şifre/onay/şifre sıfırlama) artık düzenlenebilir. Bunlar hesap
 * güvenlik mesajları olduğu için tek kanal (SMS) — Facility/SEDA'daki gibi uygulama
 * bildirimi kanalı yok (Companies hesapları için hiç in-app bildirim mekanizması mevcut değil).
 */
export const CompanyNotificationTemplatesSection = ({ templates, onChange }: Props) => {
  const merged = mergeCompanyNotificationTemplates(templates)

  const update = (updated: CompanyNotificationTemplate) => {
    const next = merged.map((t) => (t.event === updated.event ? updated : t))
    onChange(next)
  }

  const enabledCount = merged.filter((t) => t.smsEnabled).length

  return (
    <FormSection
      variant="card"
      icon={BellIcon}
      title="Mesaj Şablonları"
      subtitle={`Geçici şifre, onay ve şifre sıfırlama SMS metinleri — ${enabledCount}/${merged.length} olay aktif`}
    >
      <div className="space-y-2">
        {merged.map((t) => (
          <TemplateRow key={t.event} template={t} onChange={update} />
        ))}
      </div>
    </FormSection>
  )
}
