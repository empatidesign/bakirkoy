import { api } from './api'
import type { PagedResult } from '@/types/common'
import type {
  Hall,
  HallSummary,
  HallFeatureCatalog,
  HallFeatureTemplate,
  FeatureGroupRequest,
  FeatureRequest,
  FeatureTemplateRequest,
  FacilityOption,
  SeatStateMap,
  CreateHallRequest,
  UpdateHallRequest,
} from '@/types/hall.types'
import type { FacilityDevice, FacilityDeviceForm, FacilityDeviceTestResult, FacilityDeviceOpenResult } from '@/types/facility.types'

const hallService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<Hall>> {
    const res = await api.get<{ data: PagedResult<Hall> }>('/halls', { params })
    return res.data.data
  },

  async getById(id: string): Promise<Hall> {
    const res = await api.get<{ data: Hall }>(`/halls/${id}`)
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<HallSummary> {
    const res = await api.get<{ data: HallSummary }>('/halls/summary', { params })
    return res.data.data
  },

  async create(data: CreateHallRequest): Promise<Hall> {
    const res = await api.post<{ data: Hall }>('/halls', data)
    return res.data.data
  },

  async update(id: string, data: UpdateHallRequest): Promise<Hall> {
    const res = await api.put<{ data: Hall }>(`/halls/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/halls/${id}`)
  },

  async toggleStatus(id: string): Promise<Hall> {
    const res = await api.patch<{ data: Hall }>(`/halls/${id}/toggle-status`)
    return res.data.data
  },

  async getHallOptions(facilityId?: string): Promise<{ value: string; label: string; capacity: number; available: number; floorCount: number }[]> {
    const params: Record<string, unknown> = { page: 1, limit: 100, isActive: 'true' }
    if (facilityId) params.facilityId = facilityId
    const res = await api.get<{ data: PagedResult<Hall> }>('/halls', { params })
    return res.data.data.items.map((h) => ({ value: h.id, label: h.name, capacity: h.capacity, available: h.availableCapacity, floorCount: h.floorCount }))
  },

  async getFacilityOptions(): Promise<FacilityOption[]> {
    const res = await api.get<{ data: { id: string; name: string; locationType: string }[] }>('/service-facilities/options')
    return res.data.data.map((f) => ({ value: f.id, label: f.name, locationType: f.locationType }))
  },

  async getFeatureCatalog(): Promise<HallFeatureCatalog> {
    const res = await api.get<{ data: HallFeatureCatalog }>('/halls/feature-catalog')
    return res.data.data
  },

  async createFeatureGroup(data: FeatureGroupRequest): Promise<HallFeatureCatalog> {
    const res = await api.post<{ data: HallFeatureCatalog }>('/halls/feature-groups', data)
    return res.data.data
  },

  async updateFeatureGroup(id: string, data: FeatureGroupRequest): Promise<HallFeatureCatalog> {
    const res = await api.put<{ data: HallFeatureCatalog }>(`/halls/feature-groups/${id}`, data)
    return res.data.data
  },

  async deleteFeatureGroup(id: string): Promise<HallFeatureCatalog> {
    const res = await api.delete<{ data: HallFeatureCatalog }>(`/halls/feature-groups/${id}`)
    return res.data.data
  },

  async createFeature(data: FeatureRequest): Promise<HallFeatureCatalog> {
    const res = await api.post<{ data: HallFeatureCatalog }>('/halls/features', data)
    return res.data.data
  },

  async updateFeature(id: string, data: FeatureRequest): Promise<HallFeatureCatalog> {
    const res = await api.put<{ data: HallFeatureCatalog }>(`/halls/features/${id}`, data)
    return res.data.data
  },

  async deleteFeature(id: string): Promise<HallFeatureCatalog> {
    const res = await api.delete<{ data: HallFeatureCatalog }>(`/halls/features/${id}`)
    return res.data.data
  },

  async getFeatureTemplates(): Promise<HallFeatureTemplate[]> {
    const res = await api.get<{ data: HallFeatureTemplate[] }>('/halls/feature-templates')
    return res.data.data
  },

  async createFeatureTemplate(data: FeatureTemplateRequest): Promise<HallFeatureTemplate> {
    const res = await api.post<{ data: HallFeatureTemplate }>('/halls/feature-templates', data)
    return res.data.data
  },

  async deleteFeatureTemplate(id: string): Promise<void> {
    await api.delete(`/halls/feature-templates/${id}`)
  },

  async getSeatPlan(id: string): Promise<SeatStateMap> {
    const res = await api.get<{ data: SeatStateMap }>(`/halls/${id}/seat-plan`)
    return res.data.data
  },

  async saveSeatPlan(id: string, states: SeatStateMap): Promise<void> {
    await api.put(`/halls/${id}/seat-plan`, { states })
  },

  async getDevices(hallId: string): Promise<FacilityDevice[]> {
    const res = await api.get<{ data: FacilityDevice[] }>(`/halls/${hallId}/devices`)
    return res.data.data
  },
  async createDevice(hallId: string, form: FacilityDeviceForm): Promise<FacilityDevice> {
    const res = await api.post<{ data: FacilityDevice }>(`/halls/${hallId}/devices`, form)
    return res.data.data
  },
  async updateDevice(deviceId: string, form: FacilityDeviceForm): Promise<FacilityDevice> {
    const res = await api.put<{ data: FacilityDevice }>(`/halls/devices/${deviceId}`, form)
    return res.data.data
  },
  async deleteDevice(deviceId: string): Promise<void> {
    await api.delete(`/halls/devices/${deviceId}`)
  },
  async toggleDevice(deviceId: string): Promise<FacilityDevice> {
    const res = await api.patch<{ data: FacilityDevice }>(`/halls/devices/${deviceId}/toggle-status`)
    return res.data.data
  },
  async rotateDeviceKey(deviceId: string): Promise<FacilityDevice> {
    const res = await api.post<{ data: FacilityDevice }>(`/halls/devices/${deviceId}/rotate-key`)
    return res.data.data
  },
  async testDeviceLock(deviceId: string): Promise<FacilityDeviceTestResult> {
    const res = await api.post<{ data: FacilityDeviceTestResult }>(`/halls/devices/${deviceId}/test-lock`)
    return res.data.data
  },
  async openDevice(deviceId: string): Promise<FacilityDeviceOpenResult> {
    const res = await api.post<{ data: FacilityDeviceOpenResult }>(`/halls/devices/${deviceId}/open`)
    return res.data.data
  },
}

export default hallService
