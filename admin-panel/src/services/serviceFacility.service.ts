import { api } from './api'
import type { PagedResult } from '@/types/common'
import type {
  ServiceFacility,
  ServiceFacilitySummary,
  ServiceFacilityRequest,
  FacilityServiceCatalogItem,
  FacilityImage,
  FacilityMapPoint,
  MasterQrInfo,
  MasterCardRotateResult,
  ServiceFacilityModuleUsage,
  AssignServiceFacilityModulesResult,
} from '@/types/serviceFacility.types'

const MAP_CACHE_KEY = 'nexora:service-facilities:map-points:v1'
const MAP_CACHE_TTL = 10 * 60 * 1000
let mapPointsMemoryCache: { value: FacilityMapPoint[]; expiresAt: number } | null = null
let mapPointsRequest: Promise<FacilityMapPoint[]> | null = null
const facilityDetailCache = new Map<string, { value: ServiceFacility; expiresAt: number }>()
const facilityDetailRequests = new Map<string, Promise<ServiceFacility>>()

const readMapPointsCache = (): FacilityMapPoint[] | null => {
  const now = Date.now()
  if (mapPointsMemoryCache && mapPointsMemoryCache.expiresAt > now) {
    return mapPointsMemoryCache.value
  }
  try {
    const raw = sessionStorage.getItem(MAP_CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as { value: FacilityMapPoint[]; expiresAt: number }
    if (!Array.isArray(cached.value) || cached.expiresAt <= now) {
      sessionStorage.removeItem(MAP_CACHE_KEY)
      return null
    }
    mapPointsMemoryCache = cached
    return cached.value
  } catch {
    return null
  }
}

const writeMapPointsCache = (value: FacilityMapPoint[]) => {
  const cached = { value, expiresAt: Date.now() + MAP_CACHE_TTL }
  mapPointsMemoryCache = cached
  try { sessionStorage.setItem(MAP_CACHE_KEY, JSON.stringify(cached)) } catch { /* storage kullanılamıyorsa bellek önbelleği yeterli */ }
}

const clearMapPointsCache = () => {
  mapPointsMemoryCache = null
  try { sessionStorage.removeItem(MAP_CACHE_KEY) } catch { /* no-op */ }
}

const serviceFacilityService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<ServiceFacility>> {
    const res = await api.get<{ data: PagedResult<ServiceFacility> }>('/service-facilities', { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<ServiceFacilitySummary> {
    const res = await api.get<{ data: ServiceFacilitySummary }>('/service-facilities/summary', { params })
    return res.data.data
  },

  getCachedMapPoints(): FacilityMapPoint[] | null {
    return readMapPointsCache()
  },

  async getMapPoints(forceRefresh = false): Promise<FacilityMapPoint[]> {
    if (!forceRefresh) {
      const cached = readMapPointsCache()
      if (cached) return cached
    }
    if (mapPointsRequest) return mapPointsRequest
    mapPointsRequest = api
      .get<{ data: FacilityMapPoint[] }>('/service-facilities/map-points')
      .then((res) => {
        writeMapPointsCache(res.data.data)
        return res.data.data
      })
      .finally(() => { mapPointsRequest = null })
    return mapPointsRequest
  },

  async getById(id: string): Promise<ServiceFacility> {
    const cached = facilityDetailCache.get(id)
    if (cached && cached.expiresAt > Date.now()) return cached.value
    const pending = facilityDetailRequests.get(id)
    if (pending) return pending
    const request = api
      .get<{ data: ServiceFacility }>(`/service-facilities/${id}`)
      .then((res) => {
        facilityDetailCache.set(id, { value: res.data.data, expiresAt: Date.now() + MAP_CACHE_TTL })
        return res.data.data
      })
      .finally(() => { facilityDetailRequests.delete(id) })
    facilityDetailRequests.set(id, request)
    return request
  },

  async create(data: ServiceFacilityRequest): Promise<ServiceFacility> {
    const res = await api.post<{ data: ServiceFacility }>('/service-facilities', data)
    clearMapPointsCache()
    facilityDetailCache.set(res.data.data.id, { value: res.data.data, expiresAt: Date.now() + MAP_CACHE_TTL })
    return res.data.data
  },

  async update(id: string, data: ServiceFacilityRequest): Promise<ServiceFacility> {
    const res = await api.put<{ data: ServiceFacility }>(`/service-facilities/${id}`, data)
    clearMapPointsCache()
    facilityDetailCache.set(id, { value: res.data.data, expiresAt: Date.now() + MAP_CACHE_TTL })
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/service-facilities/${id}`)
    clearMapPointsCache()
    facilityDetailCache.delete(id)
  },

  async toggleStatus(id: string): Promise<ServiceFacility> {
    const res = await api.patch<{ data: ServiceFacility }>(`/service-facilities/${id}/toggle-status`)
    clearMapPointsCache()
    facilityDetailCache.set(id, { value: res.data.data, expiresAt: Date.now() + MAP_CACHE_TTL })
    return res.data.data
  },

  async getServiceCatalog(): Promise<FacilityServiceCatalogItem[]> {
    const res = await api.get<{ data: FacilityServiceCatalogItem[] }>('/service-facilities/service-catalog')
    return res.data.data
  },

  async uploadImage(file: File): Promise<FacilityImage> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<{ data: FacilityImage }>('/service-facilities/images', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },

  async getMasterQr(id: string): Promise<MasterQrInfo> {
    const res = await api.get<{ data: MasterQrInfo }>(`/service-facilities/${id}/master-qr`)
    return res.data.data
  },

  async toggleMasterQr(id: string, enabled: boolean): Promise<void> {
    await api.patch(`/service-facilities/${id}/master-qr/toggle`, { enabled })
  },

  async rotateMasterCard(id: string): Promise<MasterCardRotateResult> {
    const res = await api.post<{ data: MasterCardRotateResult }>(`/service-facilities/${id}/master-card/rotate`)
    return res.data.data
  },

  async getModuleUsage(id: string): Promise<ServiceFacilityModuleUsage[]> {
    const res = await api.get<{ data: ServiceFacilityModuleUsage[] }>(`/service-facilities/${id}/module-usage`)
    return res.data.data
  },

  async assignModules(id: string, modules: string[]): Promise<AssignServiceFacilityModulesResult> {
    const res = await api.post<{ data: AssignServiceFacilityModulesResult }>(`/service-facilities/${id}/module-usage`, { modules })
    clearMapPointsCache()
    facilityDetailCache.delete(id)
    return res.data.data
  },
}

export default serviceFacilityService
