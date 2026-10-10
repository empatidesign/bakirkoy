import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { ServiceCategory, ServiceCategoryForm, ServiceCategoryRef } from '@/types/serviceCategory.types'

const BASE = '/service-categories'

const serviceCategoryService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<ServiceCategory>> {
    const res = await api.get<{ data: PagedResult<ServiceCategory> }>(BASE, { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<{ total: number; active: number; passive: number }> {
    const res = await api.get<{ data: { total: number; active: number; passive: number } }>(`${BASE}/summary`, { params })
    return res.data.data
  },

  async getOptions(): Promise<ServiceCategoryRef[]> {
    const res = await api.get<{ data: ServiceCategoryRef[] }>(`${BASE}/options`)
    return res.data.data
  },

  async getById(id: string): Promise<ServiceCategory> {
    const res = await api.get<{ data: ServiceCategory }>(`${BASE}/${id}`)
    return res.data.data
  },

  async create(data: ServiceCategoryForm): Promise<ServiceCategory> {
    const res = await api.post<{ data: ServiceCategory }>(BASE, data)
    return res.data.data
  },

  async update(id: string, data: ServiceCategoryForm): Promise<ServiceCategory> {
    const res = await api.put<{ data: ServiceCategory }>(`${BASE}/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`)
  },

  async toggleStatus(id: string): Promise<ServiceCategory> {
    const res = await api.patch<{ data: ServiceCategory }>(`${BASE}/${id}/toggle-status`)
    return res.data.data
  },
}

export default serviceCategoryService
