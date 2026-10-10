import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MessageSquareIcon, UsersIcon } from 'lucide-react'
import { Modal, Button, Field, Textarea, Badge } from '@/design-system'

export interface SmsRecipient {
  id: string
  name: string
  phone: string
}

interface SmsTemplate {
  key: string
  label: string
  text: string
}

interface SmsComposeModalProps {
  open: boolean
  onClose: () => void
  recipients: SmsRecipient[]
  templates: SmsTemplate[]
  onSent?: (ids: string[]) => void
}

const SMS_LIMIT = 160

/**
 * Seçili kayıtlara toplu / tekil SMS gönderimi.
 * {AD} değişkeni her alıcı için ad-soyad ile değiştirilir.
 */
export const SmsComposeModal = ({ open, onClose, recipients, templates, onSent }: SmsComposeModalProps) => {
  const [templateKey, setTemplateKey] = useState(templates[0]?.key ?? '')
  const [text, setText] = useState(templates[0]?.text ?? '')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) {
      setTemplateKey(templates[0]?.key ?? '')
      setText(templates[0]?.text ?? '')
    }
  }, [open, templates])

  const pickTemplate = (t: SmsTemplate) => {
    setTemplateKey(t.key)
    setText(t.text)
  }

  const preview = text.replace(/\{AD\}/g, recipients[0]?.name ?? 'Ad Soyad')
  const segments = Math.max(1, Math.ceil(preview.length / SMS_LIMIT))

  const send = () => {
    setSending(true)
    setTimeout(() => {
      setSending(false)
      toast.success(`${recipients.length} alıcıya SMS gönderildi (${segments * recipients.length} kredi).`)
      onSent?.(recipients.map(r => r.id))
      onClose()
    }, 700)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="SMS Gönder"
      subtitle={`${recipients.length} alıcı seçildi`}
      width={520}
      footer={
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Vazgeç</Button>
          <Button
            variant="primary" className="flex-1"
            isLoading={sending}
            disabled={!text.trim() || recipients.length === 0}
            onClick={send}
          >
            <MessageSquareIcon className="h-4 w-4" /> Gönder ({recipients.length})
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-5">
        <Field label="Alıcılar">
          <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-border bg-surface-0 p-2">
            {recipients.map(r => (
              <Badge key={r.id} tone="neutral">{r.name} · {r.phone}</Badge>
            ))}
          </div>
        </Field>

        <Field label="Hazır Şablon">
          <div className="flex flex-wrap gap-1.5">
            {templates.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => pickTemplate(t)}
                className={`rounded-field border px-3 py-1.5 text-xs font-medium transition-colors ${
                  templateKey === t.key
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary))]'
                    : 'border-border bg-surface-0 text-foreground hover:bg-surface-1'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Mesaj" hint="{AD} yazdığınız yer her alıcının adıyla değiştirilir.">
          <Textarea rows={4} value={text} onChange={e => { setText(e.target.value); setTemplateKey('') }} />
          <div className="mt-1 flex justify-between text-xs text-foreground-muted">
            <span className="inline-flex items-center gap-1"><UsersIcon className="h-3 w-3" /> Toplam {segments * recipients.length} SMS kredisi</span>
            <span>{preview.length} karakter · {segments} SMS</span>
          </div>
        </Field>

        <div className="rounded-lg bg-surface-1 px-3 py-2.5 text-xs text-foreground">
          <div className="mb-1 text-xs font-semibold text-foreground-muted">Önizleme</div>
          {preview}
        </div>
      </div>
    </Modal>
  )
}
