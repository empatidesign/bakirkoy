import { api } from './api'
import type {
  EducationInstitution,
  EducationInstitutionOption,
  EducationHistory,
  EducationInstitutionForm,
  EducationHistoryForm,
} from '@/types/education.types'
import type { PagedResult } from '@/types/common'

interface ApiResp<T> { data: T }

const educationService = {
  async getInstitutions(params?: Record<string, unknown>): Promise<PagedResult<EducationInstitution>> {
    const res = await api.get<ApiResp<PagedResult<EducationInstitution>>>('/education/institutions', { params })
    return res.data.data
  },

  async getInstitutionOptions(): Promise<EducationInstitutionOption[]> {
    const res = await api.get<ApiResp<EducationInstitutionOption[]>>('/education/institutions/options')
    return res.data.data
  },

  async createInstitution(form: EducationInstitutionForm): Promise<EducationInstitution> {
    const res = await api.post<ApiResp<EducationInstitution>>('/education/institutions', {
      type: form.type,
      name: form.name,
      faculty: form.faculty || null,
      department: form.department || null,
      degreeLevel: form.degreeLevel || null,
    })
    return res.data.data
  },

  async updateInstitution(id: string, form: EducationInstitutionForm): Promise<EducationInstitution> {
    const res = await api.put<ApiResp<EducationInstitution>>(`/education/institutions/${id}`, {
      type: form.type,
      name: form.name,
      faculty: form.faculty || null,
      department: form.department || null,
      degreeLevel: form.degreeLevel || null,
    })
    return res.data.data
  },

  async deleteInstitution(id: string): Promise<void> {
    await api.delete(`/education/institutions/${id}`)
  },

  async toggleInstitutionStatus(id: string): Promise<EducationInstitution> {
    const res = await api.patch<ApiResp<EducationInstitution>>(`/education/institutions/${id}/toggle-status`)
    return res.data.data
  },

  async getHistories(participantId: string): Promise<EducationHistory[]> {
    const res = await api.get<ApiResp<EducationHistory[]>>(`/education/participants/${participantId}/histories`)
    return res.data.data
  },

  async createHistory(participantId: string, form: EducationHistoryForm): Promise<EducationHistory> {
    const res = await api.post<ApiResp<EducationHistory>>(`/education/participants/${participantId}/histories`, {
      institutionId: form.institutionId || null,
      level: form.level,
      startYear: Number(form.startYear),
      endYear: form.endYear ? Number(form.endYear) : null,
      isGraduated: form.isGraduated,
    })
    return res.data.data
  },

  async updateHistory(participantId: string, id: string, form: EducationHistoryForm): Promise<EducationHistory> {
    const res = await api.put<ApiResp<EducationHistory>>(`/education/participants/${participantId}/histories/${id}`, {
      institutionId: form.institutionId || null,
      level: form.level,
      startYear: Number(form.startYear),
      endYear: form.endYear ? Number(form.endYear) : null,
      isGraduated: form.isGraduated,
    })
    return res.data.data
  },

  async deleteHistory(participantId: string, id: string): Promise<void> {
    await api.delete(`/education/participants/${participantId}/histories/${id}`)
  },
}

export default educationService
