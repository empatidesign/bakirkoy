import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { PopupCampaign, PopupForm, PopupListParams, PopupSummary } from '@/types/popup.types'

const BASE = '/popups'

const toPayload = (data: PopupForm) => ({
  ...data,
  triggerModuleKey: data.triggerType === 'module_enter' ? data.triggerModuleKey || null : null,
  startDate: data.startDate || null,
  endDate: data.endDate || null,
  mediaItems: data.mediaItems.map((m) => ({ type: m.type, url: m.url || null, text: m.text || null })),
})

const popupService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<PopupCampaign>> {
    const res = await api.get<{ data: PagedResult<PopupCampaign> }>(BASE, { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<PopupSummary> {
    const res = await api.get<{ data: PopupSummary }>(`${BASE}/summary`, { params })
    return res.data.data
  },

  async getById(id: string): Promise<PopupCampaign> {
    const res = await api.get<{ data: PopupCampaign }>(`${BASE}/${id}`)
    return res.data.data
  },

  async create(data: PopupForm): Promise<PopupCampaign> {
    const res = await api.post<{ data: PopupCampaign }>(BASE, toPayload(data))
    return res.data.data
  },

  async update(id: string, data: PopupForm): Promise<PopupCampaign> {
    const res = await api.put<{ data: PopupCampaign }>(`${BASE}/${id}`, toPayload(data))
    return res.data.data
  },

  async toggleStatus(id: string): Promise<PopupCampaign> {
    const res = await api.patch<{ data: PopupCampaign }>(`${BASE}/${id}/toggle-status`)
    return res.data.data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`)
  },

  async uploadMedia(file: File): Promise<{ url: string }> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<{ data: { url: string } }>(`${BASE}/media`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },
}

export type { PopupListParams }
export default popupService
