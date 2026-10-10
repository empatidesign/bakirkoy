import { api } from './api'
import type { PagedResult, SelectOption } from '@/types/common'
import type { Gift, GiftInput, GiftSummary } from '@/types/gift.types'

const BASE = '/gifts'

const giftService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<Gift>> {
    const res = await api.get<{ data: PagedResult<Gift> }>(BASE, { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<GiftSummary> {
    const res = await api.get<{ data: GiftSummary }>(`${BASE}/summary`, { params })
    return res.data.data
  },

  async getOptions(): Promise<SelectOption[]> {
    const res = await api.get<{ data: SelectOption[] }>(`${BASE}/options`)
    return res.data.data
  },

  async getById(id: string): Promise<Gift> {
    const res = await api.get<{ data: Gift }>(`${BASE}/${id}`)
    return res.data.data
  },

  async create(data: GiftInput): Promise<Gift> {
    const res = await api.post<{ data: Gift }>(BASE, data)
    return res.data.data
  },

  async update(id: string, data: GiftInput): Promise<Gift> {
    const res = await api.put<{ data: Gift }>(`${BASE}/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`)
  },

  async toggleStatus(id: string): Promise<Gift> {
    const res = await api.patch<{ data: Gift }>(`${BASE}/${id}/toggle-status`)
    return res.data.data
  },

  async uploadImage(file: File): Promise<{ url: string }> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<{ data: { url: string } }>(`${BASE}/images`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },
}

export default giftService
