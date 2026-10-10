import { api } from './api'
import type { PagedResult, SelectOption } from '@/types/common'
import type { Campaign, CampaignInput, CampaignSummary } from '@/types/campaign.types'

const BASE = '/campaigns'

const campaignService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<Campaign>> {
    const res = await api.get<{ data: PagedResult<Campaign> }>(BASE, { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<CampaignSummary> {
    const res = await api.get<{ data: CampaignSummary }>(`${BASE}/summary`, { params })
    return res.data.data
  },

  async getOptions(companyId?: string): Promise<SelectOption[]> {
    const res = await api.get<{ data: SelectOption[] }>(`${BASE}/options`, {
      params: companyId ? { companyId } : {},
    })
    return res.data.data
  },

  async getById(id: string): Promise<Campaign> {
    const res = await api.get<{ data: Campaign }>(`${BASE}/${id}`)
    return res.data.data
  },

  async create(data: CampaignInput): Promise<Campaign> {
    const res = await api.post<{ data: Campaign }>(BASE, data)
    return res.data.data
  },

  async update(id: string, data: CampaignInput): Promise<Campaign> {
    const res = await api.put<{ data: Campaign }>(`${BASE}/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`)
  },

  async toggleStatus(id: string): Promise<Campaign> {
    const res = await api.patch<{ data: Campaign }>(`${BASE}/${id}/toggle-status`)
    return res.data.data
  },
}

export default campaignService
