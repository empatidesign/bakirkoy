import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { DiscountUsage, DiscountUsageSummary } from '@/types/discountUsage.types'

const BASE = '/discount-usages'

const discountUsageService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<DiscountUsage>> {
    const res = await api.get<{ data: PagedResult<DiscountUsage> }>(BASE, { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<DiscountUsageSummary> {
    const res = await api.get<{ data: DiscountUsageSummary }>(`${BASE}/summary`, { params })
    return res.data.data
  },

  async getById(id: string): Promise<DiscountUsage> {
    const res = await api.get<{ data: DiscountUsage }>(`${BASE}/${id}`)
    return res.data.data
  },
}

export default discountUsageService
