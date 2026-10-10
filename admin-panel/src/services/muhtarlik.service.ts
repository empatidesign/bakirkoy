import { api } from './api'
import type { PagedResult, SelectOption } from '@/types/common'
import type {
  CitizenSubmission,
  SubmissionListParams,
  SubmissionSummary,
  SubmissionMapPoint,
  SubmissionReportsSummary,
  SubmissionStatus,
  MuhtarAssignment,
  ProvisionMuhtarRequest,
  ProvisionMuhtarResult,
  CreateSubmissionByMuhtarRequest,
  MuhtarDashboard,
  MuhtarNviLookupResult,
  MuhtarSubmissionMediaUpload,
} from '@/types/muhtarlik.types'

const BASE = '/citizen-submissions'
const MUHTARLIK_BASE = '/muhtarlik'

const muhtarlikService = {
  async getList(params: SubmissionListParams): Promise<PagedResult<CitizenSubmission>> {
    const res = await api.get<{ data: PagedResult<CitizenSubmission> }>(BASE, { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<SubmissionSummary> {
    const res = await api.get<{ data: SubmissionSummary }>(`${BASE}/summary`, { params })
    return res.data.data
  },

  async getMapPoints(params: Record<string, unknown>): Promise<SubmissionMapPoint[]> {
    const res = await api.get<{ data: SubmissionMapPoint[] }>(`${BASE}/map-points`, { params })
    return res.data.data
  },

  async getReportsSummary(params: Record<string, unknown>): Promise<SubmissionReportsSummary> {
    const res = await api.get<{ data: SubmissionReportsSummary }>(`${BASE}/reports-summary`, { params })
    return res.data.data
  },

  async getById(id: string): Promise<CitizenSubmission> {
    const res = await api.get<{ data: CitizenSubmission }>(`${BASE}/${id}`)
    return res.data.data
  },

  async getNeighborhoodOptions(): Promise<SelectOption[]> {
    const res = await api.get<{ data: SelectOption[] }>(`${BASE}/neighborhoods`)
    return res.data.data
  },

  async updateStatus(id: string, status: SubmissionStatus): Promise<CitizenSubmission> {
    const res = await api.patch<{ data: CitizenSubmission }>(`${BASE}/${id}/status`, { status })
    return res.data.data
  },

  async forwardToUlakbel(id: string): Promise<CitizenSubmission> {
    const res = await api.post<{ data: CitizenSubmission }>(`${BASE}/${id}/forward`)
    return res.data.data
  },

  async resetForwardState(id: string, reason: string): Promise<CitizenSubmission> {
    const res = await api.post<{ data: CitizenSubmission }>(`${BASE}/${id}/reset-forward-state`, { reason })
    return res.data.data
  },

  async toggleNotifyMuhtar(id: string): Promise<CitizenSubmission> {
    const res = await api.patch<{ data: CitizenSubmission }>(`${BASE}/${id}/notify-muhtar`)
    return res.data.data
  },

  async getMuhtarAssignments(): Promise<MuhtarAssignment[]> {
    const res = await api.get<{ data: MuhtarAssignment[] }>(`${BASE}/muhtar-assignments`)
    return res.data.data
  },

  async provisionMuhtar(neighborhood: string, req: ProvisionMuhtarRequest): Promise<ProvisionMuhtarResult> {
    const res = await api.post<{ data: ProvisionMuhtarResult }>(
      `${BASE}/neighborhoods/${encodeURIComponent(neighborhood)}/provision-muhtar`,
      req,
    )
    return res.data.data
  },

  async createByMuhtar(req: CreateSubmissionByMuhtarRequest): Promise<CitizenSubmission> {
    const res = await api.post<{ data: CitizenSubmission }>(`${BASE}/muhtar-create`, req)
    return res.data.data
  },

  async muhtarNviLookup(tckn: string, birthDate: string): Promise<MuhtarNviLookupResult> {
    const res = await api.post<{ data: MuhtarNviLookupResult }>(`${BASE}/muhtar-nvi-lookup`, { tckn, birthDate })
    return res.data.data
  },

  async uploadMuhtarMedia(file: File): Promise<MuhtarSubmissionMediaUpload> {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post<{ data: MuhtarSubmissionMediaUpload }>(`${BASE}/muhtar-media`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },

  async getMuhtarDashboard(neighborhood?: string): Promise<MuhtarDashboard> {
    const res = await api.get<{ data: MuhtarDashboard }>(`${MUHTARLIK_BASE}/dashboard`, {
      params: neighborhood ? { neighborhood } : undefined,
    })
    return res.data.data
  },
}

export default muhtarlikService
