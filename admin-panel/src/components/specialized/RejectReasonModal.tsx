import { useEffect, useState } from 'react'
import { Modal, Button, Field, Textarea } from '@/design-system'

interface RejectReasonModalProps {
  open: boolean
  count?: number
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}

export const RejectReasonModal = ({ open, count = 1, onClose, onConfirm }: RejectReasonModalProps) => {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) setReason('') }, [open])

  const confirm = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm(reason.trim())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose() }}
      title={count > 1 ? `${count} Başvuruyu Reddet` : 'Başvuruyu Reddet'}
      width={480}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>İptal</Button>
          <Button variant="danger" isLoading={busy} onClick={() => void confirm()}>Reddet</Button>
        </div>
      }
    >
      <div className="space-y-3 p-5">
        <p className="type-body text-foreground-muted">
          Gerekçe vatandaşa bildirimde ve başvuru detayında gösterilir. Boş bırakılırsa gerekçesiz red bildirimi gider.
        </p>
        <Field label="Red Gerekçesi">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Örn. Başvuru koşulları sağlanmıyor..."
            autoFocus
          />
        </Field>
      </div>
    </Modal>
  )
}
