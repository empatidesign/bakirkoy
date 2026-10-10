import { useEffect, useState } from 'react'
import { Modal, SkeletonRows } from '@/design-system'
import participantService from '@/services/participant.service'
import { ParticipantEventsView } from '@/modules/participants/ParticipantEventsView'
import type { ParticipantDetail } from '@/types/participant.types'

export const ApplicantHistoryModal = ({ participantId, onClose }: { participantId: string | null; onClose: () => void }) => {
  const [participant, setParticipant] = useState<ParticipantDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!participantId) { setParticipant(null); return }
    setLoading(true)
    participantService.getById(participantId)
      .then(setParticipant)
      .catch(() => setParticipant(null))
      .finally(() => setLoading(false))
  }, [participantId])

  return (
    <Modal
      open={!!participantId}
      onClose={onClose}
      title="Katılım Geçmişi"
      subtitle={participant?.fullName}
      width={920}
      className="max-w-[96vw]"
      bodyClassName="px-6 py-5"
    >
      {loading ? (
        <SkeletonRows rows={5} />
      ) : participant ? (
        <ParticipantEventsView participant={participant} />
      ) : (
        <p className="type-muted">Katılımcı bilgisi yüklenemedi.</p>
      )}
    </Modal>
  )
}
