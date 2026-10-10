import { currentCoordinates } from '@/lib/geolocation'
import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { CitizenFacilityGroupDetail, CitizenFacilityApplication, CitizenFacilityApplyDocument, CitizenFacilityBranch, CitizenFacilityDiscoverResult, CitizenFacilityFilters } from '@/types/facility.types'

const facilityService = {
  async discover(module: string, params: Record<string, unknown>): Promise<CitizenFacilityDiscoverResult> {
    const res = await api.get<{ data: CitizenFacilityDiscoverResult }>(`/me/facilities/${module}/discover`, { params })
    return res.data.data
  },

  async branches(module: string, participantId?: string | null): Promise<CitizenFacilityBranch[]> {
    const res = await api.get<{ data: CitizenFacilityBranch[] }>(`/me/facilities/${module}/branches`, {
      params: participantId ? { participantId } : undefined,
    })
    return res.data.data
  },

  async filters(module: string, params?: Record<string, unknown>): Promise<CitizenFacilityFilters> {
    const res = await api.get<{ data: CitizenFacilityFilters }>(`/me/facilities/${module}/filters`, { params })
    return res.data.data
  },

  async detail(module: string, groupId: string): Promise<CitizenFacilityGroupDetail> {
    const res = await api.get<{ data: CitizenFacilityGroupDetail }>(`/me/facilities/${module}/groups/${groupId}`)
    return res.data.data
  },

  async apply(module: string, groupId: string, participantId?: string | null, documents?: CitizenFacilityApplyDocument[], customAnswers?: Record<string, string>): Promise<CitizenFacilityApplication> {
    const res = await api.post<{ data: CitizenFacilityApplication }>(`/me/facilities/${module}/groups/${groupId}/apply`, {
      participantId: participantId ?? null,
      documents: documents ?? [],
      customAnswers: customAnswers && Object.keys(customAnswers).length > 0 ? customAnswers : undefined,
    })
    return res.data.data
  },

  async uploadDocument(module: string, file: File, groupId?: string | null, documentType?: string): Promise<CitizenFacilityApplyDocument> {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post<{ data: { objectName: string; fileName: string; url: string } }>(`/me/facilities/${module}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { ...(groupId ? { groupId } : {}), ...(documentType ? { documentType } : {}) },
    })
    return { type: '', objectName: res.data.data.objectName, fileName: res.data.data.fileName }
  },

  async applications(params: Record<string, unknown>): Promise<PagedResult<CitizenFacilityApplication>> {
    const res = await api.get<{ data: PagedResult<CitizenFacilityApplication> }>('/me/facilities/applications', { params })
    return res.data.data
  },

  async cancel(id: string): Promise<void> {
    await api.delete(`/me/facilities/applications/${id}`)
  },

  async staticScan(code: string): Promise<{ allowed: boolean; message: string; participantName?: string | null; groupName?: string | null; action?: string | null; errorCode?: string | null }> {
    const res = await api.post<{ data: { allowed: boolean; message: string; participantName?: string | null; groupName?: string | null; action?: string | null; errorCode?: string | null } }>('/me/facilities/static-scan', { code, ...(await currentCoordinates()) })
    return res.data.data
  },
}

export default facilityService
