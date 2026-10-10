import { api } from './api'

export interface ParticipantServiceUsage {
  id: string
  module: string
  participantId: string
  participantFullName?: string
  participantTckn?: string
  branchId?: string
  branchName?: string
  facilityId?: string
  facilityName?: string
  hasReceivedService: boolean
  firstServiceDate?: string
  lastServiceDate?: string
  note?: string
  createdAt: string
  updatedAt?: string
}

export interface SetParticipantServiceUsageRequest {
  hasReceivedService: boolean
  branchId?: string | null
  branchName?: string | null
  facilityId?: string | null
  facilityName?: string | null
  firstServiceDate?: string | null
  lastServiceDate?: string | null
  note?: string | null
}

const participantServiceUsageService = {
  async get(participantId: string, module: string): Promise<ParticipantServiceUsage | null> {
    const res = await api.get<{ data: ParticipantServiceUsage | null }>(`/participants/${participantId}/service-usage/${module}`)
    return res.data.data
  },

  async getMany(module: string, participantIds: string[]): Promise<Record<string, ParticipantServiceUsage>> {
    if (participantIds.length === 0) return {}
    const res = await api.get<{ data: Record<string, ParticipantServiceUsage> }>(
      `/participants-service-usage/${module}`,
      { params: { ids: participantIds.join(',') } },
    )
    return res.data.data
  },

  async set(participantId: string, module: string, req: SetParticipantServiceUsageRequest): Promise<ParticipantServiceUsage> {
    const res = await api.put<{ data: ParticipantServiceUsage }>(`/participants/${participantId}/service-usage/${module}`, req)
    return res.data.data
  },

  async remove(participantId: string, module: string): Promise<void> {
    await api.delete(`/participants/${participantId}/service-usage/${module}`)
  },
}

export default participantServiceUsageService
