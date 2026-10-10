import { api } from './api'
import { filenameFromContentDisposition } from '@/lib/utils'
import type { PagedResult } from '@/types/common'
import type { Application, ApplicationForm, ApplicationSummary, ApplicationStatus, SeatMap } from '@/types/application.types'

const applicationsService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<Application>> {
    const res = await api.get<{ data: PagedResult<Application> }>('/event-applications', { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<ApplicationSummary> {
    const res = await api.get<{ data: ApplicationSummary }>('/event-applications/summary', { params })
    return res.data.data
  },

  async getById(id: string): Promise<Application> {
    const res = await api.get<{ data: Application }>(`/event-applications/${id}`)
    return res.data.data
  },

  async create(data: ApplicationForm): Promise<Application> {
    const res = await api.post<{ data: Application }>('/event-applications', data)
    return res.data.data
  },

  async update(id: string, data: ApplicationForm): Promise<Application> {
    const res = await api.put<{ data: Application }>(`/event-applications/${id}`, data)
    return res.data.data
  },

  async setStatus(id: string, status: ApplicationStatus, reason?: string): Promise<Application> {
    const res = await api.patch<{ data: Application }>(`/event-applications/${id}/status`, { status, reason: reason || null })
    return res.data.data
  },

  async getSeatMap(eventId: string, sessionId?: string): Promise<SeatMap> {
    const params: Record<string, unknown> = { eventId }
    if (sessionId) params.sessionId = sessionId
    const res = await api.get<{ data: SeatMap }>('/event-applications/seat-map', { params })
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/event-applications/${id}`)
  },

  async exportExcel(params: Record<string, unknown>): Promise<{ blob: Blob; fileName: string }> {
    const res = await api.get('/event-applications/export', { params, responseType: 'blob' })
    const fileName = filenameFromContentDisposition(
      res.headers['content-disposition'] as string | undefined, 'etkinlik-basvurulari.xlsx')
    return { blob: res.data as Blob, fileName }
  },
}

export default applicationsService
