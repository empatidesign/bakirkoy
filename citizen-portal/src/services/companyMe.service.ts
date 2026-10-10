import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { CompanyUser, UpdateCompanyProfileRequest } from '@/types/companyAuth.types'
import type { Campaign, CreateCampaignRequest, UpdateCampaignRequest, CampaignRedeemResult, ScanCitizenResult, RedemptionResult, CompanyCampaignUsage } from '@/types/companyCampaign.types'
import type { ServiceCategoryRef } from '@/types/serviceCategory.types'
import type { CompanyStaff, CreateCompanyStaffRequest, UpdateCompanyStaffRequest, ResetCompanyStaffPasswordResult, SetStaffPasswordRequest } from '@/types/companyStaff.types'

export interface CompanyCampaignListParams {
  page: number
  limit: number
  search?: string
  status?: string
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CompanyCampaignUsageListParams {
  page: number
  limit: number
  campaignId?: string
  dateRange?: string
}


const cleanParams = (params: CompanyCampaignListParams): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  )

const companyMeService = {
  async profile(): Promise<CompanyUser> {
    const res = await api.get<{ data: CompanyUser }>('/company/me/profile')
    return res.data.data
  },

  async updateProfile(data: UpdateCompanyProfileRequest): Promise<CompanyUser> {
    const res = await api.put<{ data: CompanyUser }>('/company/me/profile', data)
    return res.data.data
  },

  async uploadImage(file: File): Promise<string> {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post<{ data: { url: string } }>('/company/me/images', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data.url
  },

  async campaigns(params: CompanyCampaignListParams): Promise<PagedResult<Campaign>> {
    const res = await api.get<{ data: PagedResult<Campaign> }>('/company/me/campaigns', { params: cleanParams(params) })
    return res.data.data
  },

  async redeemableCampaigns(): Promise<PagedResult<Campaign>> {
    const res = await api.get<{ data: PagedResult<Campaign> }>('/company/me/redeem/campaigns')
    return res.data.data
  },

  async campaignUsages(params: CompanyCampaignUsageListParams): Promise<PagedResult<CompanyCampaignUsage>> {
    const res = await api.get<{ data: PagedResult<CompanyCampaignUsage> }>('/company/me/campaign-usages', {
      params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)),
    })
    return res.data.data
  },

  async createCampaign(data: CreateCampaignRequest): Promise<Campaign> {
    const res = await api.post<{ data: Campaign }>('/company/me/campaigns', data)
    return res.data.data
  },

  async updateCampaign(id: string, data: UpdateCampaignRequest): Promise<Campaign> {
    const res = await api.put<{ data: Campaign }>(`/company/me/campaigns/${id}`, data)
    return res.data.data
  },

  async deleteCampaign(id: string): Promise<void> {
    await api.delete(`/company/me/campaigns/${id}`)
  },

  async toggleCampaign(id: string): Promise<Campaign> {
    const res = await api.patch<{ data: Campaign }>(`/company/me/campaigns/${id}/toggle-status`)
    return res.data.data
  },

  async serviceCategoryOptions(): Promise<ServiceCategoryRef[]> {
    const res = await api.get<{ data: ServiceCategoryRef[] }>('/company/me/service-categories')
    return res.data.data
  },

  async createServiceCategory(name: string): Promise<ServiceCategoryRef> {
    const res = await api.post<{ data: ServiceCategoryRef }>('/company/me/service-categories', { name })
    return res.data.data
  },

  async setCategories(categoryIds: string[]): Promise<CompanyUser> {
    const res = await api.put<{ data: CompanyUser }>('/company/me/categories', { categoryIds })
    return res.data.data
  },

  async redeemByQr(token: string): Promise<CampaignRedeemResult> {
    const res = await api.post<{ data: CampaignRedeemResult }>('/company/me/redeem/qr', { token })
    return res.data.data
  },

  async redeemManual(campaignId: string, identifier: { tckn?: string; phone?: string }, orderAmount?: number): Promise<CampaignRedeemResult> {
    const res = await api.post<{ data: CampaignRedeemResult }>(`/company/me/campaigns/${campaignId}/redeem/manual`, { ...identifier, orderAmount })
    return res.data.data
  },

  async scanCitizenQr(token: string): Promise<ScanCitizenResult> {
    const res = await api.post<{ data: ScanCitizenResult }>('/qr/company/scan-citizen', { token })
    return res.data.data
  },

  async redeemAfterScan(participantId: string, campaignId: string | null, orderAmount?: number): Promise<RedemptionResult> {
    const res = await api.post<{ data: RedemptionResult }>('/qr/company/redeem', { participantId, campaignId, orderAmount })
    return res.data.data
  },

  async getMyQr(): Promise<{ id: string; staticCode: string; isActive: boolean; validUntil?: string }> {
    const res = await api.get<{ data: { id: string; staticCode: string; isActive: boolean; validUntil?: string } }>('/qr/company/my-qr')
    return res.data.data
  },

  async staffList(): Promise<CompanyStaff[]> {
    const res = await api.get<{ data: CompanyStaff[] }>('/company/me/staff')
    return res.data.data
  },

  async createStaff(data: CreateCompanyStaffRequest): Promise<CompanyStaff> {
    const res = await api.post<{ data: CompanyStaff }>('/company/me/staff', data)
    return res.data.data
  },

  async updateStaff(id: string, data: UpdateCompanyStaffRequest): Promise<CompanyStaff> {
    const res = await api.put<{ data: CompanyStaff }>(`/company/me/staff/${id}`, data)
    return res.data.data
  },

  async resetStaffPassword(id: string): Promise<ResetCompanyStaffPasswordResult> {
    const res = await api.post<{ data: ResetCompanyStaffPasswordResult }>(`/company/me/staff/${id}/reset-password`)
    return res.data.data
  },

  async setStaffPassword(id: string, data: SetStaffPasswordRequest): Promise<void> {
    await api.post(`/company/me/staff/${id}/set-password`, data)
  },

  async activateStaff(id: string): Promise<CompanyStaff> {
    const res = await api.patch<{ data: CompanyStaff }>(`/company/me/staff/${id}/activate`)
    return res.data.data
  },

  async deactivateStaff(id: string): Promise<CompanyStaff> {
    const res = await api.patch<{ data: CompanyStaff }>(`/company/me/staff/${id}/deactivate`)
    return res.data.data
  },

  async deleteStaff(id: string): Promise<void> {
    await api.delete(`/company/me/staff/${id}`)
  },
}

export default companyMeService
