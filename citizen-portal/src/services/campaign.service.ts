import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { CitizenCampaign, CitizenCampaignRedeem, CitizenCampaignUsage, CitizenCampaignCompany, CitizenDirectoryCompany } from '@/types/campaign.types'
import type { ServiceCategoryRef } from '@/types/serviceCategory.types'

const campaignService = {
  async list(params: Record<string, unknown>): Promise<PagedResult<CitizenCampaign>> {
    const res = await api.get<{ data: PagedResult<CitizenCampaign> }>('/me/campaigns', { params })
    return res.data.data
  },

  async categories(): Promise<ServiceCategoryRef[]> {
    const res = await api.get<{ data: ServiceCategoryRef[] }>('/me/campaigns/categories')
    return res.data.data
  },

  async company(companyId: string): Promise<CitizenCampaignCompany> {
    const res = await api.get<{ data: CitizenCampaignCompany }>(`/me/campaigns/companies/${companyId}`)
    return res.data.data
  },

  async detail(id: string): Promise<CitizenCampaign> {
    const res = await api.get<{ data: CitizenCampaign }>(`/me/campaigns/${id}`)
    return res.data.data
  },

  async redeem(id: string): Promise<CitizenCampaignRedeem> {
    const res = await api.post<{ data: CitizenCampaignRedeem }>(`/me/campaigns/${id}/redeem`)
    return res.data.data
  },

  async setBookmark(id: string, saved: boolean): Promise<void> {
    if (saved) await api.post(`/me/campaigns/${id}/bookmark`)
    else await api.delete(`/me/campaigns/${id}/bookmark`)
  },

  async myUsages(): Promise<CitizenCampaignUsage[]> {
    const res = await api.get<{ data: CitizenCampaignUsage[] }>('/me/campaigns/my-usages')
    return res.data.data
  },

  async settings(): Promise<{ lastDayThresholdDays: number }> {
    const res = await api.get<{ data: { lastDayThresholdDays: number } }>('/me/campaigns/settings')
    return res.data.data
  },

  async directory(params: Record<string, unknown>): Promise<PagedResult<CitizenDirectoryCompany>> {
    const res = await api.get<{ data: PagedResult<CitizenDirectoryCompany> }>('/me/campaigns/directory', { params })
    return res.data.data
  },

  async directoryDistricts(): Promise<string[]> {
    const res = await api.get<{ data: string[] }>('/me/campaigns/directory/districts')
    return res.data.data
  },

  async directoryCompany(companyId: string, coords?: { lat?: number; lng?: number }): Promise<CitizenDirectoryCompany> {
    const res = await api.get<{ data: CitizenDirectoryCompany }>(`/me/campaigns/directory/${companyId}`, {
      params: coords?.lat != null && coords?.lng != null ? { lat: coords.lat, lng: coords.lng } : undefined,
    })
    return res.data.data
  },
}

export default campaignService
