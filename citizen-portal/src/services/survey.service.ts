import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { CitizenSurvey, CitizenSurveyDetail, PendingSurveySummary, SurveyAnswerDto, SurveySubmitResult } from '@/types/survey.types'

const surveyService = {
  async list(params: Record<string, unknown>): Promise<PagedResult<CitizenSurvey>> {
    const res = await api.get<{ data: PagedResult<CitizenSurvey> }>('/me/surveys', { params })
    return res.data.data
  },

  async detail(id: string): Promise<CitizenSurveyDetail> {
    const res = await api.get<{ data: CitizenSurveyDetail }>(`/me/surveys/${id}`)
    return res.data.data
  },

  async submit(id: string, answers: SurveyAnswerDto[]): Promise<SurveySubmitResult> {
    const res = await api.post<{ data: SurveySubmitResult }>(`/me/surveys/${id}/submit`, { answers })
    return res.data.data
  },

  async pending(): Promise<CitizenSurvey[]> {
    const res = await api.get<{ data: CitizenSurvey[] }>('/me/surveys/pending')
    return res.data.data
  },

  async pendingSummary(): Promise<PendingSurveySummary> {
    const res = await api.get<{ data: PendingSurveySummary }>('/me/surveys/pending/summary')
    return res.data.data
  },

  async markPrompted(): Promise<void> {
    await api.post('/me/surveys/pending/prompted')
  },

  // Kullanıcı isteği (2026-09-01): giriş sonrası saha görevlisi olarak atanmış
  // vatandaşlara "Vatandaş Portalı / Anket Sistemi" seçim ekranı göstermek için.
  async fieldAssignment(): Promise<boolean> {
    const res = await api.get<{ data: { hasActiveAssignment: boolean } }>('/me/surveys/field-assignment')
    return res.data.data.hasActiveAssignment
  },
}

export default surveyService

