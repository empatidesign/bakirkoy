import { useState } from 'react'
import { toast } from 'sonner'
import { Modal, Button, Textarea, ToggleRow, Field } from '@/design-system'
import broadcastService, { type BroadcastTarget } from '@/services/broadcast.service'

interface BroadcastModalProps {
  open: boolean
  onClose: () => void
  target: BroadcastTarget
  ids: string[]
  count: number
  onSent?: () => void
}

export const BroadcastModal = ({ open, onClose, target, ids, count, onSent }: BroadcastModalProps) => {
  const [message, setMessage] = useState('')
  const [sms, setSms] = useState(true)
  const [notify, setNotify] = useState(true)
  const [sending, setSending] = useState(false)

  const close = () => {
    if (sending) return
    setMessage('')
    onClose()
  }

  const send = async () => {
    if (!message.trim()) { toast.warning('Lütfen gönderilecek mesajı yazın.'); return }
    if (!sms && !notify) { toast.warning('En az bir kanal seçin (SMS veya bildirim).'); return }
    setSending(true)
    try {
      const r = await broadcastService.send({ target, ids, sms, notify, message: message.trim() })
      if (r.recipients === 0) {
        toast.success('Seçili kayıtlarda kayıtlı kişi bulunamadı.')
      } else {
        toast.success(`${r.recipients} kişiye gönderildi (SMS: ${r.smsSent}, bildirim: ${r.notificationsCreated}).`)
        if (r.smsMockMode) {
          toast.warning('Dikkat: SMS şu an SAHTE modda (test/geliştirme ortamı) — yukarıdaki SMS sayısı gerçek gönderim değildir, hiçbir telefona SMS gitmedi.', { duration: 8000 })
        }
      }
      setMessage('')
      onSent?.()
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Toplu Mesaj Gönder"
      subtitle={`${count} seçili kayda kayıtlı kişilere`}
      width={460}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close} disabled={sending}>İptal</Button>
          <Button variant="primary" onClick={send} isLoading={sending}>Gönder</Button>
        </div>
      }
    >
      <div className="space-y-4 p-6">
        <ToggleRow label="SMS gönder" description="Telefonu olan kayıtlı kişilere SMS gider." checked={sms} onChange={setSms} />
        <ToggleRow label="Uygulama bildirimi gönder" description="Kişilerin uygulama bildirimlerine düşer." checked={notify} onChange={setNotify} />
        <Field label="Mesaj" hint={`${message.length}/320`}>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={320} placeholder="Gönderilecek mesajı yazın..." />
        </Field>
      </div>
    </Modal>
  )
}
