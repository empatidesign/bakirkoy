import { api } from './api'
import { filenameFromContentDisposition } from '@/lib/utils'
import type { PagedResult } from '@/types/common'
import type {
  TravelApplication,
  TravelApplicationFormData,
  TravelApplicationSummary,
  ApplicationStatus,
  TravelBulkTcknEntry,
  TravelBulkTcknResult,
  TravelManualMessageRequest,
  TravelManualMessageResult,
} from '@/types/travel.types'

const travelApplicationService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<TravelApplication>> {
    const res = await api.get<{ data: PagedResult<TravelApplication> }>('/travel-applications', { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<TravelApplicationSummary> {
    const res = await api.get<{ data: TravelApplicationSummary }>('/travel-applications/summary', { params })
    return res.data.data
  },

  async getNeighborhoodOptions(travelId?: string): Promise<string[]> {
    const res = await api.get<{ data: string[] }>('/travel-applications/neighborhoods', { params: travelId ? { travelId } : {} })
    return res.data.data
  },

  async getById(id: string): Promise<TravelApplication> {
    const res = await api.get<{ data: TravelApplication }>(`/travel-applications/${id}`)
    return res.data.data
  },

  async create(data: TravelApplicationFormData): Promise<TravelApplication> {
    const res = await api.post<{ data: TravelApplication }>('/travel-applications', data)
    return res.data.data
  },

  async update(id: string, data: TravelApplicationFormData): Promise<TravelApplication> {
    const res = await api.put<{ data: TravelApplication }>(`/travel-applications/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/travel-applications/${id}`)
  },

  async setStatus(id: string, status: ApplicationStatus, reason?: string): Promise<TravelApplication> {
    const res = await api.patch<{ data: TravelApplication }>(`/travel-applications/${id}/status`, { status, reason: reason || null })
    return res.data.data
  },

  async exportExcel(params: Record<string, unknown>): Promise<{ blob: Blob; fileName: string }> {
    const res = await api.get('/travel-applications/export', { params, responseType: 'blob' })
    const fileName = filenameFromContentDisposition(
      res.headers['content-disposition'] as string | undefined, 'gezi-basvurulari.xlsx')
    return { blob: res.data as Blob, fileName }
  },

  async bulkAddByTckn(travelId: string, entries: TravelBulkTcknEntry[], busId?: string, sendInviteSms = true): Promise<TravelBulkTcknResult> {
    const res = await api.post<{ data: TravelBulkTcknResult }>('/travel-applications/bulk-tckn', {
      travelId, entries, busId: busId || null, sendInviteSms,
    })
    return res.data.data
  },

  async sendManualMessage(req: TravelManualMessageRequest): Promise<TravelManualMessageResult> {
    const res = await api.post<{ data: TravelManualMessageResult }>('/travel-applications/send-message', req)
    return res.data.data
  },
}

export default travelApplicationService
