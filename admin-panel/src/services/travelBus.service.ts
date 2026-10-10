import { api } from './api'
import { filenameFromContentDisposition } from '@/lib/utils'
import type { PagedResult } from '@/types/common'
import type { TravelBus, TravelBusFormData, TravelBusSummary, TravelBusSeating, TravelBusUsageHistory } from '@/types/travel.types'
import type { BusSeatState } from '@/components/specialized/seating/busSeatModel'

const travelBusService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<TravelBus>> {
    const res = await api.get<{ data: PagedResult<TravelBus> }>('/travel-buses', { params })
    return res.data.data
  },

  async getByTravel(travelId: string): Promise<TravelBus[]> {
    const res = await api.get<{ data: TravelBus[] }>('/travel-buses', { params: { travelId, all: true } })
    return res.data.data
  },

  async getAvailable(forTravelId?: string, startDate?: string, endDate?: string): Promise<TravelBus[]> {
    const params: Record<string, string> = {}
    if (forTravelId) params.travelId = forTravelId
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const res = await api.get<{ data: TravelBus[] }>('/travel-buses/available', { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<TravelBusSummary> {
    const res = await api.get<{ data: TravelBusSummary }>('/travel-buses/summary', { params })
    return res.data.data
  },

  async getTravelSeating(travelId: string): Promise<TravelBusSeating[]> {
    const res = await api.get<{ data: TravelBusSeating[] }>(`/travels/${travelId}/seating`)
    return res.data.data
  },

  async saveTravelSeating(travelId: string, busId: string, seatStates: Record<string, BusSeatState>): Promise<void> {
    await api.put(`/travels/${travelId}/buses/${busId}/seating`, { seatStates })
  },

  async getById(id: string): Promise<TravelBus> {
    const res = await api.get<{ data: TravelBus }>(`/travel-buses/${id}`)
    return res.data.data
  },

  async create(data: TravelBusFormData): Promise<TravelBus> {
    const res = await api.post<{ data: TravelBus }>('/travel-buses', data)
    return res.data.data
  },

  async update(id: string, data: TravelBusFormData): Promise<TravelBus> {
    const res = await api.put<{ data: TravelBus }>(`/travel-buses/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/travel-buses/${id}`)
  },

  async toggleStatus(id: string): Promise<TravelBus> {
    const res = await api.patch<{ data: TravelBus }>(`/travel-buses/${id}/toggle-status`)
    return res.data.data
  },

  async clone(id: string): Promise<TravelBus> {
    const res = await api.post<{ data: TravelBus }>(`/travel-buses/${id}/clone`)
    return res.data.data
  },

  async getUsageHistory(id: string): Promise<TravelBusUsageHistory> {
    const res = await api.get<{ data: TravelBusUsageHistory }>(`/travel-buses/${id}/usage-history`)
    return res.data.data
  },

  async exportWordSeating(travelId: string): Promise<{ blob: Blob; fileName: string }> {
    const res = await api.get(`/travels/${travelId}/seating/export-word`, { responseType: 'blob' })
    const fileName = filenameFromContentDisposition(
      res.headers['content-disposition'] as string | undefined, 'gezi-koltuk-plani.docx')
    return {
      blob: new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      fileName,
    }
  },
}

export default travelBusService
