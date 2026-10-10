import { api } from './api'
import { todayIso } from '@/lib/utils'
import type { PagedResult } from '@/types/common'
import type { Session, SessionForm, SessionSummary, SessionConflict } from '@/types/session.types'
import type { SeatStateMap } from '@/types/hall.types'

const toPayload = (data: SessionForm): SessionForm => {
  const fallback = data.date || data.startDate || data.endDate || todayIso()
  return {
    ...data,
    date: data.date || fallback,
    startDate: data.startDate || fallback,
    endDate: data.endDate || data.startDate || fallback,
  }
}

const sessionService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<Session>> {
    const res = await api.get<{ data: PagedResult<Session> }>('/sessions', { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<SessionSummary> {
    const res = await api.get<{ data: SessionSummary }>('/sessions/summary', { params })
    return res.data.data
  },

  async getById(id: string): Promise<Session> {
    const res = await api.get<{ data: Session }>(`/sessions/${id}`)
    return res.data.data
  },

  async getOptionsByEvent(eventId: string): Promise<{ value: string; label: string }[]> {
    const res = await api.get<{ data: { id: string; label: string }[] }>('/sessions/options', {
      params: { eventId },
    })
    return res.data.data.map((s) => ({ value: s.id, label: s.label }))
  },

  async create(data: SessionForm): Promise<Session> {
    const res = await api.post<{ data: Session }>('/sessions', toPayload(data))
    return res.data.data
  },

  async generate(data: SessionForm): Promise<{ created: number; skipped: number }> {
    const res = await api.post<{ data: { created: number; skipped: number } }>('/sessions/generate', toPayload(data))
    return res.data.data
  },

  async checkConflicts(data: SessionForm): Promise<SessionConflict[]> {
    const res = await api.post<{ data: SessionConflict[] }>('/sessions/check-conflicts', toPayload(data))
    return res.data.data
  },

  async update(id: string, data: SessionForm): Promise<Session> {
    const res = await api.put<{ data: Session }>(`/sessions/${id}`, toPayload(data))
    return res.data.data
  },

  async getSeatPlan(id: string): Promise<SeatStateMap> {
    const res = await api.get<{ data: SeatStateMap }>(`/sessions/${id}/seat-plan`)
    return res.data.data
  },

  async saveSeatPlan(id: string, states: SeatStateMap): Promise<void> {
    await api.put(`/sessions/${id}/seat-plan`, { states })
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/sessions/${id}`)
  },

  async toggleStatus(id: string): Promise<Session> {
    const res = await api.patch<{ data: Session }>(`/sessions/${id}/toggle-status`)
    return res.data.data
  },
}

export default sessionService
