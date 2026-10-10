import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { FacilityDevice as FullFacilityDevice, FacilityDeviceForm as FullFacilityDeviceForm } from '@/types/facility.types'

export interface FacilityDevice {
  id: string
  module: string
  facilityId?: string
  name: string
  serialNumber?: string
  type: string
  location?: string
  isActive: boolean
  lastSeenAt?: string
  createdAt: string
}

export interface FacilityDeviceForm {
  facilityId?: string
  name: string
  serialNumber?: string
  type: string
  location?: string
}

const facilityDeviceService = {
  async getList(module: string, params?: Record<string, unknown>): Promise<PagedResult<FacilityDevice>> {
    const res = await api.get<{ data: PagedResult<FacilityDevice> }>(`/${module}/devices`, { params })
    return res.data.data
  },

  async create(module: string, data: FacilityDeviceForm): Promise<FacilityDevice> {
    const res = await api.post<{ data: FacilityDevice }>(`/${module}/devices`, data)
    return res.data.data
  },

  async update(module: string, id: string, data: FacilityDeviceForm): Promise<FacilityDevice> {
    const res = await api.put<{ data: FacilityDevice }>(`/${module}/devices/${id}`, data)
    return res.data.data
  },

  async toggleStatus(module: string, id: string): Promise<FacilityDevice> {
    const res = await api.patch<{ data: FacilityDevice }>(`/${module}/devices/${id}/toggle-status`)
    return res.data.data
  },

  async delete(module: string, id: string): Promise<void> {
    await api.delete(`/${module}/devices/${id}`)
  },

  async getById(module: string, id: string): Promise<FullFacilityDevice> {
    const res = await api.get<{ data: FullFacilityDevice }>(`/${module}/devices/${id}`)
    return res.data.data
  },

  async updateFull(module: string, id: string, data: FullFacilityDeviceForm): Promise<FullFacilityDevice> {
    const res = await api.put<{ data: FullFacilityDevice }>(`/${module}/devices/${id}`, data)
    return res.data.data
  },
}

export default facilityDeviceService
