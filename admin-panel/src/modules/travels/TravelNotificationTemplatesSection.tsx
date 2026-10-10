import { useState } from 'react'
import { BellIcon, MessageSquareIcon, BellRingIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { FormSection, ToggleRow, Field } from '@/design-system'
import { Textarea } from '@/design-system'
import type { TravelNotificationTemplate, TravelNotificationEvent } from '@/types/travel.types'
import { TRAVEL_NOTIFICATION_META, mergeTravelNotificationTemplates } from './travelFormDefaults'

interface Props {
  templates: TravelNotificationTemplate[]
  onChange: (templates: TravelNotificationTemplate[]) => void
}

function TemplateRow({ template, onChange }: { template: TravelNotificationTemplate; onChange: (t: TravelNotificationTemplate) => void }) {
  const [open, setOpen] = useState(false)
  const meta = TRAVEL_NOTIFICATION_META[template.event]
  const isAnyEnabled = template.smsEnabled || template.notifyEnabled

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
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
                  placeholder={`Örn: Sayın {{ad}} {{soyad}}, {{sefer}} gezisi hakkında bilgilendirme...`}
                  maxLength={320}
                />
              </Field>
            )}
          </div>

          <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRingIcon className="h-4 w-4 text-[hsl(var(--accent-blue))]" />
                <span className="text-[12px] font-bold text-foreground-default">Uygulama Bildirimi</span>
              </div>
              <ToggleRow
                label=""
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
                  placeholder={`Örn: {{sefer}} gezisi hakkında bilgilendirme...`}
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

/**
 * Kullanıcı isteği (2026-08-07): Gezi modülündeki tüm mesajlaşmayı (başvuru, onay, iptal,
 * yaklaşan gezi hatırlatması, manuel/toplu mesaj) tek bir şablon sisteminde birleştirme.
 * Facility'nin NotificationTemplatesSection.tsx paterni taban alındı (accordion, kanal
 * bazlı toggle, değişken chip listesi) — SMS+Email yerine SMS+Uygulama Bildirimi kanalları.
 */
export const TravelNotificationTemplatesSection = ({ templates, onChange }: Props) => {
  const merged = mergeTravelNotificationTemplates(templates)

  const update = (updated: TravelNotificationTemplate) => {
    const next = merged.map((t) => (t.event === updated.event ? updated : t))
    onChange(next)
  }

  const enabledCount = merged.filter((t) => t.smsEnabled || t.notifyEnabled).length

  return (
    <FormSection
      variant="card"
      icon={BellIcon}
      title="Mesaj Şablonları"
      subtitle={`Başvuru, onay, iptal, hatırlatma ve manuel mesaj şablonları — ${enabledCount}/${merged.length} olay aktif`}
    >
      <div className="space-y-2">
        {merged.map((t) => (
          <TemplateRow key={t.event} template={t} onChange={update} />
        ))}
      </div>
    </FormSection>
  )
}

export type { TravelNotificationEvent }
