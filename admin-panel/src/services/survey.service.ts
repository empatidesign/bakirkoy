import { api } from './api'
import type { PagedResult } from '@/types/common'
import type {
  SurveyDeleteImpact,
  Survey,
  SurveyAnalytics,
  SurveyForm,
  SurveyQuestion,
  SurveyResponseListItem,
  SurveySummary,
  SurveyGlobalSettings,
  UpdateSurveyGlobalSettingsForm,
} from '@/types/survey.types'

const BASE = '/surveys'

const toPayload = (data: SurveyForm) => ({
  ...data,
  startDate: data.startDate || null,
  endDate: data.endDate || null,
})

const surveyService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<Survey>> {
    const res = await api.get<{ data: PagedResult<Survey> }>(BASE, { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<SurveySummary> {
    const res = await api.get<{ data: SurveySummary }>(`${BASE}/summary`, { params })
    return res.data.data
  },

  async getById(id: string): Promise<Survey> {
    const res = await api.get<{ data: Survey }>(`${BASE}/${id}`)
    return res.data.data
  },

  async getQuestions(surveyId: string): Promise<SurveyQuestion[]> {
    const res = await api.get<{ data: SurveyQuestion[] }>(`${BASE}/${surveyId}/questions`)
    return res.data.data
  },

  async create(data: SurveyForm): Promise<Survey> {
    const res = await api.post<{ data: Survey }>(BASE, toPayload(data))
    return res.data.data
  },

  async update(id: string, data: SurveyForm): Promise<Survey> {
    const res = await api.put<{ data: Survey }>(`${BASE}/${id}`, toPayload(data))
    return res.data.data
  },

  async toggleStatus(id: string): Promise<Survey> {
    const res = await api.patch<{ data: Survey }>(`${BASE}/${id}/toggle-status`)
    return res.data.data
  },

  async duplicate(id: string): Promise<Survey> {
    const res = await api.post<{ data: Survey }>(`${BASE}/${id}/duplicate`)
    return res.data.data
  },

  // Kullanıcı isteği (2026-09-01): anket silmek tüm yanıtları da yok ettiği için tek tıkla
  // yapılamaz — yönetici "silmek istiyorum" metnini yazmak zorundadır ve işlem yalnızca
  // süper yöneticiye açıktır (backend de aynı iki kuralı ayrıca doğrular).
  async deleteImpact(id: string): Promise<SurveyDeleteImpact> {
    const res = await api.get<{ data: SurveyDeleteImpact }>(`${BASE}/${id}/delete-impact`)
    return res.data.data
  },

  async remove(id: string, confirmation: string): Promise<void> {
    await api.delete(`${BASE}/${id}`, { data: { confirmation } })
  },

  async getAnalytics(surveyId: string): Promise<SurveyAnalytics> {
    const res = await api.get<{ data: SurveyAnalytics }>(`${BASE}/${surveyId}/analytics`)
    return res.data.data
  },

  async getResponses(surveyId: string, params: { page: number; limit: number }): Promise<PagedResult<SurveyResponseListItem>> {
    const res = await api.get<{ data: PagedResult<SurveyResponseListItem> }>(`${BASE}/${surveyId}/responses`, { params })
    return res.data.data
  },

  async getResponseById(surveyId: string, responseId: string): Promise<SurveyResponseListItem> {
    const res = await api.get<{ data: SurveyResponseListItem }>(`${BASE}/${surveyId}/responses/${responseId}`)
    return res.data.data
  },

  async getGlobalSettings(): Promise<SurveyGlobalSettings> {
    const res = await api.get<{ data: SurveyGlobalSettings }>(`${BASE}/global-settings`)
    return res.data.data
  },

  async updateGlobalSettings(data: UpdateSurveyGlobalSettingsForm): Promise<SurveyGlobalSettings> {
    const res = await api.put<{ data: SurveyGlobalSettings }>(`${BASE}/global-settings`, data)
    return res.data.data
  },
}

export default surveyService
