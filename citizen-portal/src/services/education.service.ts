import { api } from './api'

export interface EducationInstitutionOption {
  id: string
  name: string
  faculty?: string | null
  department?: string | null
  type: string
  typeLabel: string
}

export interface EducationHistoryDto {
  id: string
  institutionId?: string | null
  institutionName?: string | null
  faculty?: string | null
  department?: string | null
  level: string
  levelLabel: string
  startYear: number
  endYear?: number | null
  isGraduated: boolean
  createdAt: string
}

export interface SaveEducationHistoryRequest {
  institutionId?: string | null
  level: string
  startYear: number
  endYear?: number | null
  isGraduated: boolean
}

interface ApiResp<T> { data: T }

const educationService = {
  async getInstitutionOptions(): Promise<EducationInstitutionOption[]> {
    const res = await api.get<ApiResp<EducationInstitutionOption[]>>('/me/education/institutions/options')
    return res.data.data
  },

  async getHistories(): Promise<EducationHistoryDto[]> {
    const res = await api.get<ApiResp<EducationHistoryDto[]>>('/me/education/histories')
    return res.data.data
  },

  async create(req: SaveEducationHistoryRequest): Promise<EducationHistoryDto> {
    const res = await api.post<ApiResp<EducationHistoryDto>>('/me/education/histories', req)
    return res.data.data
  },

  async update(id: string, req: SaveEducationHistoryRequest): Promise<EducationHistoryDto> {
    const res = await api.put<ApiResp<EducationHistoryDto>>(`/me/education/histories/${id}`, req)
    return res.data.data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/me/education/histories/${id}`)
  },
}

export default educationService
