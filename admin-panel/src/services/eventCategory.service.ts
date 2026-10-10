import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { EventCategory, EventCategoryForm, EventCategoryOption, EventCategoryBulkResultItem } from '@/types/eventCategory.types'

const eventCategoryService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<EventCategory>> {
    const res = await api.get<{ data: PagedResult<EventCategory> }>('/event-categories', { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<{ total: number; active: number; passive: number }> {
    const res = await api.get<{ data: { total: number; active: number; passive: number } }>('/event-categories/summary', { params })
    return res.data.data
  },

  async getOptions(): Promise<EventCategoryOption[]> {
    const res = await api.get<{ data: { id: string; name: string; defaultPoints: number }[] }>('/event-categories/options')
    return res.data.data.map((c) => ({ value: c.id, label: c.name, defaultPoints: c.defaultPoints }))
  },

  async getById(id: string): Promise<EventCategory> {
    const res = await api.get<{ data: EventCategory }>(`/event-categories/${id}`)
    return res.data.data
  },

  async create(data: EventCategoryForm): Promise<EventCategory> {
    const res = await api.post<{ data: EventCategory }>('/event-categories', data)
    return res.data.data
  },

  async bulkCreate(items: EventCategoryForm[]): Promise<EventCategoryBulkResultItem[]> {
    const res = await api.post<{ data: { results: EventCategoryBulkResultItem[] } }>('/event-categories/bulk', { items })
    return res.data.data.results
  },

  async update(id: string, data: EventCategoryForm): Promise<EventCategory> {
    const res = await api.put<{ data: EventCategory }>(`/event-categories/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/event-categories/${id}`)
  },

  async toggleStatus(id: string): Promise<EventCategory> {
    const res = await api.patch<{ data: EventCategory }>(`/event-categories/${id}/toggle-status`)
    return res.data.data
  },
}

export default eventCategoryService
