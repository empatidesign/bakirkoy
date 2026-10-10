import { useState } from 'react'
import { BanIcon } from 'lucide-react'
import { Modal, Button, Label, Textarea } from '@/design-system'

export const ParticipantBlockModal = ({
  open, participantName, loading, onClose, onConfirm,
}: {
  open: boolean
  participantName: string
  loading?: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) => {
  const [reason, setReason] = useState('')

  return (
    <Modal open={open} onClose={onClose} width={460}>
      <div className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-field bg-danger-soft">
            <BanIcon className="h-5 w-5 text-danger" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground-strong">Katılımcıyı Engelle</h3>
            <p className="type-muted mt-1">"{participantName}" engellenecek; sisteme erişimi durdurulur. Lütfen engel sebebini belirtin.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label required>Engel Sebebi</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Engel sebebini yazın..."
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
          <Button
            variant="danger"
            className="flex-1"
            isLoading={loading}
            disabled={loading || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            Engelle
          </Button>
        </div>
      </div>
    </Modal>
  )
}
