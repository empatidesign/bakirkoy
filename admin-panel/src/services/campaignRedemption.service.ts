import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { CampaignRedemption, CampaignRedemptionSummary } from '@/types/campaignRedemption.types'

const BASE = '/campaign-redemptions'

const campaignRedemptionService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<CampaignRedemption>> {
    const res = await api.get<{ data: PagedResult<CampaignRedemption> }>(BASE, { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<CampaignRedemptionSummary> {
    const res = await api.get<{ data: CampaignRedemptionSummary }>(`${BASE}/summary`, { params })
    return res.data.data
  },

  async getById(id: string): Promise<CampaignRedemption> {
    const res = await api.get<{ data: CampaignRedemption }>(`${BASE}/${id}`)
    return res.data.data
  },
}

export default campaignRedemptionService
