import { api } from './api'
import type { PagedResult } from '@/types/common'
import type {
  Participant,
  ParticipantDetail,
  ParticipantSummary,
  CreateParticipantRequest,
  UpdateParticipantRequest,
  ParticipantStatus,
  ParticipantDeliveryChannel,
  NviLookupResult,
  ParticipantLookupResult,
  ParticipantDemographicsParams,
  ParticipantDemographicsOverview,
  NeighborhoodDetail,
  ParticipantSurveyResponse,
  ParticipantNotification,
} from '@/types/participant.types'

const participantService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<Participant>> {
    const res = await api.get<{ data: PagedResult<Participant> }>('/participants', { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<ParticipantSummary> {
    const res = await api.get<{ data: ParticipantSummary }>('/participants/summary', { params })
    return res.data.data
  },

  async getDemographics(params: ParticipantDemographicsParams): Promise<ParticipantDemographicsOverview> {
    const res = await api.get<{ data: ParticipantDemographicsOverview }>('/participants/demographics', { params })
    return res.data.data
  },

  async getNeighborhoodDetail(
    neighborhood: string,
    params: ParticipantDemographicsParams & { page?: number; limit?: number },
  ): Promise<NeighborhoodDetail> {
    const res = await api.get<{ data: NeighborhoodDetail }>(
      `/participants/demographics/neighborhood/${encodeURIComponent(neighborhood)}`,
      { params },
    )
    return res.data.data
  },

  async getById(id: string): Promise<ParticipantDetail> {
    const res = await api.get<{ data: ParticipantDetail }>(`/participants/${id}`)
    return res.data.data
  },

  async lookupByTckn(tckn: string): Promise<ParticipantLookupResult> {
    const res = await api.get<{ data: ParticipantLookupResult }>(`/participants/by-tckn/${tckn}`)
    return res.data.data
  },

  async nviLookup(tckn: string, birthDate: string): Promise<NviLookupResult> {
    const res = await api.post<{ data: NviLookupResult }>('/participants/nvi-lookup', { tckn, birthDate })
    return res.data.data
  },

  async create(data: CreateParticipantRequest): Promise<Participant> {
    const res = await api.post<{ data: Participant }>('/participants', data)
    return res.data.data
  },

  async update(id: string, data: UpdateParticipantRequest): Promise<Participant> {
    const res = await api.put<{ data: Participant }>(`/participants/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/participants/${id}`)
  },

  async toggleStatus(id: string): Promise<Participant> {
    const res = await api.patch<{ data: Participant }>(`/participants/${id}/toggle-status`)
    return res.data.data
  },

  async setStatus(id: string, status: ParticipantStatus, reason?: string): Promise<Participant> {
    const res = await api.patch<{ data: Participant }>(`/participants/${id}/status`, { status, reason })
    return res.data.data
  },

  async sendPasswordReset(id: string, channel: ParticipantDeliveryChannel): Promise<void> {
    await api.post(`/participants/${id}/send-password-reset`, { channel })
  },

  async setManualPassword(id: string, newPassword: string, mustChangeOnFirstLogin: boolean): Promise<void> {
    await api.post(`/participants/${id}/set-password`, { newPassword, mustChangeOnFirstLogin })
  },

  updateAdminNotes: async (id: string, notes: string | null) => {
    await api.patch(`/participants/${id}/admin-notes`, { notes })
  },

  async unlock(id: string): Promise<Participant> {
    const res = await api.post<{ data: Participant }>(`/participants/${id}/unlock`)
    return res.data.data
  },

  async getAppointmentKey(id: string): Promise<string | null> {
    const res = await api.get<{ data: { key: string | null } }>(`/participants/${id}/appointment-key`)
    return res.data.data.key
  },

  async generateAppointmentKey(id: string): Promise<string> {
    const res = await api.post<{ data: { key: string } }>(`/participants/${id}/appointment-key`)
    return res.data.data.key
  },

  async revokeAppointmentKey(id: string): Promise<void> {
    await api.delete(`/participants/${id}/appointment-key`)
  },

  async getSurveyHistory(id: string): Promise<ParticipantSurveyResponse[]> {
    const res = await api.get<{ data: ParticipantSurveyResponse[] }>(`/participants/${id}/surveys`)
    return res.data.data
  },

  async getNotifications(id: string, params: { page?: number; limit?: number } = {}): Promise<PagedResult<ParticipantNotification>> {
    const res = await api.get<{ data: PagedResult<ParticipantNotification> }>(`/participants/${id}/notifications`, { params })
    return res.data.data
  },

  async generateBypassCode(id: string): Promise<{ code: string }> {
    const res = await api.post<{ data: { code: string } }>(`/auth/citizen/${id}/bypass-code`)
    return res.data.data
  },
}

export default participantService
