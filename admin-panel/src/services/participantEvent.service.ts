import { api } from './api'
import type { ParticipantEventResult } from '@/types/participant.types'

const participantEventService = {
  async getList(params: Record<string, unknown>): Promise<ParticipantEventResult> {
    const res = await api.get<{ data: ParticipantEventResult }>('/participant-events', { params })
    return res.data.data
  },
}

export default participantEventService
