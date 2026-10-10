import { api } from './api'
import type { PagedResult } from '@/types/common'
import type {
  AdminUser,
  CreateAdminRequest,
  UpdateAdminRequest,
  AdminDeliveryChannel,
} from '@/types/admin.types'

const adminService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<AdminUser>> {
    const res = await api.get<{ data: PagedResult<AdminUser> }>('/admins', { params })
    return res.data.data
  },

  // Kullanıcı isteği (2026-08-03): bir facility-template modülde ("sports" gibi) genel/scope'suz
  // yönetici olan kullanıcının, aynı modülde facility-scope'lu (tek/birkaç tesise atanmış) ALT
  // yönetici hesaplarını görmesi için — backend `facilityModule` query param'ıyla DB seviyesinde
  // filtreler (bkz. api AdminListParams.FacilityModule).
  async getSubUsersByFacilityModule(facilityModule: string): Promise<AdminUser[]> {
    const res = await api.get<{ data: PagedResult<AdminUser> }>('/admins', {
      params: { facilityModule, limit: 100, isActive: true },
    })
    return res.data.data.items.filter((u) => u.facilityScopeModule === facilityModule)
  },

  async getById(id: string): Promise<AdminUser> {
    const res = await api.get<{ data: AdminUser }>(`/admins/${id}`)
    return res.data.data
  },

  async create(data: CreateAdminRequest): Promise<AdminUser> {
    const res = await api.post<{ data: AdminUser }>('/admins', data)
    return res.data.data
  },

  async update(id: string, data: UpdateAdminRequest): Promise<AdminUser> {
    const res = await api.put<{ data: AdminUser }>(`/admins/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/admins/${id}`)
  },

  async toggleStatus(id: string): Promise<AdminUser> {
    const res = await api.patch<{ data: AdminUser }>(`/admins/${id}/toggle-status`)
    return res.data.data
  },

  async sendPasswordReset(id: string, channel: AdminDeliveryChannel): Promise<void> {
    await api.post(`/admins/${id}/send-password-reset`, { channel })
  },

  async setManualPassword(id: string, newPassword: string, mustChangeOnFirstLogin: boolean): Promise<void> {
    await api.post(`/admins/${id}/set-password`, { newPassword, mustChangeOnFirstLogin })
  },

  async unlock(id: string): Promise<AdminUser> {
    const res = await api.post<{ data: AdminUser }>(`/admins/${id}/unlock`)
    return res.data.data
  },
}

export default adminService
