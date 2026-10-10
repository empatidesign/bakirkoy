import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { Wheel, WheelInput, WheelSummary } from '@/types/wheel.types'

const BASE = '/wheels'

const wheelService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<Wheel>> {
    const res = await api.get<{ data: PagedResult<Wheel> }>(BASE, { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<WheelSummary> {
    const res = await api.get<{ data: WheelSummary }>(`${BASE}/summary`, { params })
    return res.data.data
  },

  async getById(id: string): Promise<Wheel> {
    const res = await api.get<{ data: Wheel }>(`${BASE}/${id}`)
    return res.data.data
  },

  async create(data: WheelInput): Promise<Wheel> {
    const res = await api.post<{ data: Wheel }>(BASE, data)
    return res.data.data
  },

  async update(id: string, data: WheelInput): Promise<Wheel> {
    const res = await api.put<{ data: Wheel }>(`${BASE}/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`)
  },

  async toggleStatus(id: string): Promise<Wheel> {
    const res = await api.patch<{ data: Wheel }>(`${BASE}/${id}/toggle-status`)
    return res.data.data
  },
}

export default wheelService
