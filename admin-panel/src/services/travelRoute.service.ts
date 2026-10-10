import { api } from './api'
import type { PagedResult, SelectOption } from '@/types/common'
import type { Travel, TravelRoute, TravelRouteFormData } from '@/types/travel.types'

/**
 * "Gezi" (rota/lokasyon) yönetimi — ör. Çanakkale. Her Route altında birden çok
 * Sefer (Travel) açılabilir. İçerik alanları (isim, açıklama, kural, görsel, fiyat,
 * yaş/cinsiyet kısıtı) yalnızca Route üzerinden düzenlenir, Sefer bunları miras alır.
 */
const travelRouteService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<TravelRoute>> {
    const res = await api.get<{ data: PagedResult<TravelRoute> }>('/travel-routes', { params })
    return res.data.data
  },

  async getOptions(search?: string): Promise<SelectOption[]> {
    const res = await api.get<{ data: { id: string; name: string; destination?: string }[] }>('/travel-routes/options', {
      params: search ? { search } : {},
    })
    return res.data.data.map((r) => ({ value: r.id, label: r.name }))
  },

  async getById(id: string): Promise<TravelRoute> {
    const res = await api.get<{ data: TravelRoute }>(`/travel-routes/${id}`)
    return res.data.data
  },

  async getTravels(id: string, params: Record<string, unknown> = {}): Promise<PagedResult<Travel>> {
    const res = await api.get<{ data: PagedResult<Travel> }>(`/travel-routes/${id}/travels`, { params })
    return res.data.data
  },

  async create(data: TravelRouteFormData): Promise<TravelRoute> {
    const res = await api.post<{ data: TravelRoute }>('/travel-routes', data)
    return res.data.data
  },

  async update(id: string, data: TravelRouteFormData): Promise<TravelRoute> {
    const res = await api.put<{ data: TravelRoute }>(`/travel-routes/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/travel-routes/${id}`)
  },

  async toggleStatus(id: string): Promise<TravelRoute> {
    const res = await api.patch<{ data: TravelRoute }>(`/travel-routes/${id}/toggle-status`)
    return res.data.data
  },
}

export default travelRouteService
