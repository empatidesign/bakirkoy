import { api } from './api'
import type { PagedResult, SelectOption } from '@/types/common'
import type {
  EmergencyArea,
  EmergencyAreaRequest,
  EmergencyAreaSummary,
  EmergencyAreaMapPoint,
  AfadSyncStatus,
  AfadSyncResult,
} from '@/types/emergencyArea.types'

const BASE = '/emergency-areas'

const emergencyAreaService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<EmergencyArea>> {
    const res = await api.get<{ data: PagedResult<EmergencyArea> }>(BASE, { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<EmergencyAreaSummary> {
    const res = await api.get<{ data: EmergencyAreaSummary }>(`${BASE}/summary`, { params })
    return res.data.data
  },

  async getMapPoints(): Promise<EmergencyAreaMapPoint[]> {
    const res = await api.get<{ data: EmergencyAreaMapPoint[] }>(`${BASE}/map-points`)
    return res.data.data
  },

  async getById(id: string): Promise<EmergencyArea> {
    const res = await api.get<{ data: EmergencyArea }>(`${BASE}/${id}`)
    return res.data.data
  },

  async getNeighborhoodOptions(): Promise<SelectOption[]> {
    const res = await api.get<{ data: SelectOption[] }>(`${BASE}/neighborhoods`)
    return res.data.data
  },

  async create(data: EmergencyAreaRequest): Promise<EmergencyArea> {
    const res = await api.post<{ data: EmergencyArea }>(BASE, data)
    return res.data.data
  },

  async update(id: string, data: EmergencyAreaRequest): Promise<EmergencyArea> {
    const res = await api.put<{ data: EmergencyArea }>(`${BASE}/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`)
  },

  async toggleStatus(id: string): Promise<EmergencyArea> {
    const res = await api.patch<{ data: EmergencyArea }>(`${BASE}/${id}/toggle-status`)
    return res.data.data
  },

  async getAfadSyncStatus(): Promise<AfadSyncStatus> {
    const res = await api.get<{ data: AfadSyncStatus }>(`${BASE}/afad-sync/status`)
    return res.data.data
  },

  async runAfadSync(): Promise<AfadSyncResult> {
    const res = await api.post<{ data: AfadSyncResult }>(`${BASE}/afad-sync`, undefined, { timeout: 180_000 })
    return res.data.data
  },
}

export default emergencyAreaService
