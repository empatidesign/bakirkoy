import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { GiftRequest, GiftRequestSummary } from '@/types/giftRequest.types'

const BASE = '/gift-requests'

const giftRequestService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<GiftRequest>> {
    const res = await api.get<{ data: PagedResult<GiftRequest> }>(BASE, { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<GiftRequestSummary> {
    const res = await api.get<{ data: GiftRequestSummary }>(`${BASE}/summary`, { params })
    return res.data.data
  },

  async getById(id: string): Promise<GiftRequest> {
    const res = await api.get<{ data: GiftRequest }>(`${BASE}/${id}`)
    return res.data.data
  },

  async approve(id: string): Promise<GiftRequest> {
    const res = await api.patch<{ data: GiftRequest }>(`${BASE}/${id}/approve`)
    return res.data.data
  },

  async reject(id: string, reason?: string): Promise<GiftRequest> {
    const res = await api.patch<{ data: GiftRequest }>(`${BASE}/${id}/reject`, { reason })
    return res.data.data
  },

  async deliver(id: string, note?: string): Promise<GiftRequest> {
    const res = await api.patch<{ data: GiftRequest }>(`${BASE}/${id}/deliver`, { note })
    return res.data.data
  },
}

export default giftRequestService
