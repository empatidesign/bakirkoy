import { api } from './api'
import type { PagedResult, SelectOption } from '@/types/common'
import type { TravelCategory, TravelCategoryFormData } from '@/types/travel.types'

const travelCategoryService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<TravelCategory>> {
    const res = await api.get<{ data: PagedResult<TravelCategory> }>('/travel-categories', { params })
    return res.data.data
  },

  async getOptions(): Promise<(SelectOption & { color?: string })[]> {
    const res = await api.get<{ data: { id: string; name: string; color?: string }[] }>('/travel-categories/options')
    return res.data.data.map((c) => ({ value: c.id, label: c.name, color: c.color }))
  },

  async getById(id: string): Promise<TravelCategory> {
    const res = await api.get<{ data: TravelCategory }>(`/travel-categories/${id}`)
    return res.data.data
  },

  async create(data: TravelCategoryFormData): Promise<TravelCategory> {
    const res = await api.post<{ data: TravelCategory }>('/travel-categories', data)
    return res.data.data
  },

  async update(id: string, data: TravelCategoryFormData): Promise<TravelCategory> {
    const res = await api.put<{ data: TravelCategory }>(`/travel-categories/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/travel-categories/${id}`)
  },

  async toggleStatus(id: string): Promise<TravelCategory> {
    const res = await api.patch<{ data: TravelCategory }>(`/travel-categories/${id}/toggle-status`)
    return res.data.data
  },
}

export default travelCategoryService
