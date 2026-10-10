import { api } from './api'
import type { PagedResult, SelectOption } from '@/types/common'
import type {
  Company,
  CompanyInput,
  CompanySummary,
  CompanyServiceItem,
  CompanyDashboard,
  CompanyImportResult,
  CompanyDeliveryChannel,
  CompanySettings,
  CompanyManualMessageRequest,
  CompanyManualMessageResult,
} from '@/types/company.types'

const BASE = '/companies'

const companyService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<Company>> {
    const res = await api.get<{ data: PagedResult<Company> }>(BASE, { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<CompanySummary> {
    const res = await api.get<{ data: CompanySummary }>(`${BASE}/summary`, { params })
    return res.data.data
  },

  async getOptions(): Promise<SelectOption[]> {
    const res = await api.get<{ data: SelectOption[] }>(`${BASE}/options`)
    return res.data.data
  },

  async getDashboard(params: Record<string, unknown> = {}): Promise<CompanyDashboard> {
    const res = await api.get<{ data: CompanyDashboard }>(`${BASE}/dashboard`, { params })
    return res.data.data
  },

  async getById(id: string): Promise<Company> {
    const res = await api.get<{ data: Company }>(`${BASE}/${id}`)
    return res.data.data
  },

  async getServices(companyId: string): Promise<CompanyServiceItem[]> {
    const res = await api.get<{ data: CompanyServiceItem[] }>(`${BASE}/${companyId}/services`)
    return res.data.data
  },

  async create(data: CompanyInput): Promise<Company> {
    const res = await api.post<{ data: Company }>(BASE, data)
    return res.data.data
  },

  async update(id: string, data: CompanyInput): Promise<Company> {
    const res = await api.put<{ data: Company }>(`${BASE}/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`)
  },

  async toggleStatus(id: string): Promise<Company> {
    const res = await api.patch<{ data: Company }>(`${BASE}/${id}/toggle-status`)
    return res.data.data
  },

  async approve(id: string): Promise<Company> {
    const res = await api.patch<{ data: Company }>(`${BASE}/${id}/approve`)
    return res.data.data
  },

  async reject(id: string, reason?: string): Promise<Company> {
    const res = await api.patch<{ data: Company }>(`${BASE}/${id}/reject`, { reason })
    return res.data.data
  },

  async revertApproval(id: string): Promise<Company> {
    const res = await api.patch<{ data: Company }>(`${BASE}/${id}/revert-approval`)
    return res.data.data
  },

  async unlock(id: string): Promise<Company> {
    const res = await api.post<{ data: Company }>(`${BASE}/${id}/unlock`)
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

  async import(file: File): Promise<CompanyImportResult> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<{ data: CompanyImportResult }>(`${BASE}/import`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },

  async generateBypassCode(id: string): Promise<{ code: string }> {
    const res = await api.post<{ data: { code: string } }>(`/auth/company/${id}/bypass-code`)
    return res.data.data
  },

  async sendPasswordReset(id: string, channel: CompanyDeliveryChannel): Promise<void> {
    await api.post(`${BASE}/${id}/send-password-reset`, { channel })
  },

  async setManualPassword(id: string, newPassword: string, mustChangeOnFirstLogin: boolean): Promise<void> {
    await api.post(`${BASE}/${id}/set-password`, { newPassword, mustChangeOnFirstLogin })
  },

  async getSettings(): Promise<CompanySettings> {
    const res = await api.get<{ data: CompanySettings }>('/company-settings')
    return res.data.data
  },

  async updateSettings(patch: Partial<CompanySettings>): Promise<CompanySettings> {
    const res = await api.put<{ data: CompanySettings }>('/company-settings', patch)
    return res.data.data
  },

  async sendManualMessage(data: CompanyManualMessageRequest): Promise<CompanyManualMessageResult> {
    const res = await api.post<{ data: CompanyManualMessageResult }>(`${BASE}/messages/send`, data)
    return res.data.data
  },
}

export default companyService
