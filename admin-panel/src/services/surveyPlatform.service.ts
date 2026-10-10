import { api } from './api'
import type { PagedResult } from '@/types/common'
import type {
  SurveyAnalyticsFilters,
  SurveyExecutiveDashboard,
  SurveyFieldOperations,
  SurveyFieldTask,
  SurveyFieldTaskForm,
  SurveyInterviewerMessagePayload,
  SurveyInterviewerMessageResult,
  SurveyNotificationSummary,
  SurveyInterviewerStats,
  SurveyNeighborhoodStats,
  SurveyQuestionBankForm,
  SurveyQuestionBankItem,
  SurveyQuota,
  SurveyQuotaForm,
  SurveyTemplate,
  SurveyTopicStats,
  SurveyInterviewerCandidate,
  BatchCreateSurveyFieldTaskForm,
  SurveyFieldTaskBulkRequest,
  SurveyFieldTaskBulkResult,
  SurveyFieldLiveAgent,
  SurveyFieldTrail,
  SurveyInterviewerPerformanceResult,
} from '@/types/surveyPlatform.types'

const BASE = '/surveys'

const cleanFilters = (f: SurveyAnalyticsFilters = {}): Record<string, unknown> =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== null && v !== ''))

const taskPayload = (f: SurveyFieldTaskForm) => ({
  surveyId: f.surveyId,
  interviewerId: f.interviewerId,
  interviewerType: f.interviewerType,
  neighborhood: f.neighborhood,
  startDate: f.startDate,
  endDate: f.endDate,
  targetCount: f.targetCount,
  dailyTarget: f.dailyTarget,
  note: f.note || null,
  status: f.status,
})

const batchTaskPayload = (f: BatchCreateSurveyFieldTaskForm) => ({
  surveyId: f.surveyId,
  interviewers: f.interviewers.map((i) => ({ id: i.id, type: i.type })),
  neighborhoods: f.allNeighborhoods ? [] : f.neighborhoods,
  startDate: f.startDate,
  endDate: f.endDate,
  targetCount: f.targetCount,
  dailyTarget: f.dailyTarget,
  note: f.note || null,
})

const bankPayload = (f: SurveyQuestionBankForm) => ({
  question: f.question,
  description: f.description || null,
  type: f.type,
  options: f.options,
  topic: f.topic,
  unit: f.unit || null,
  config: f.config,
  isActive: f.isActive,
})

const surveyPlatformService = {
  // --- Saha görevleri ---
  async getFieldTasks(params: Record<string, unknown>): Promise<PagedResult<SurveyFieldTask>> {
    const res = await api.get<{ data: PagedResult<SurveyFieldTask> }>(`${BASE}/field-tasks`, { params })
    return res.data.data
  },

  async getFieldTask(id: string): Promise<SurveyFieldTask> {
    const res = await api.get<{ data: SurveyFieldTask }>(`${BASE}/field-tasks/${id}`)
    return res.data.data
  },

  async createFieldTask(form: SurveyFieldTaskForm): Promise<SurveyFieldTask> {
    const res = await api.post<{ data: SurveyFieldTask }>(`${BASE}/field-tasks`, taskPayload(form))
    return res.data.data
  },

  async updateFieldTask(id: string, form: SurveyFieldTaskForm): Promise<SurveyFieldTask> {
    const res = await api.put<{ data: SurveyFieldTask }>(`${BASE}/field-tasks/${id}`, taskPayload(form))
    return res.data.data
  },

  async removeFieldTask(id: string): Promise<void> {
    await api.delete(`${BASE}/field-tasks/${id}`)
  },

  async batchCreateFieldTasks(form: BatchCreateSurveyFieldTaskForm): Promise<SurveyFieldTask[]> {
    const res = await api.post<{ data: SurveyFieldTask[] }>(`${BASE}/field-tasks/batch`, batchTaskPayload(form))
    return res.data.data
  },

  // Kullanıcı isteği (2026-09-01): seçili görevlere toplu aktif/pasif, mahalle ata,
  // anket ata veya sil (soft-delete; toplanan yanıtlar korunur).
  async bulkFieldTaskAction(req: SurveyFieldTaskBulkRequest): Promise<SurveyFieldTaskBulkResult> {
    const res = await api.post<{ data: SurveyFieldTaskBulkResult }>(`${BASE}/field-tasks/bulk`, req)
    return res.data.data
  },

  async searchInterviewerCandidates(search: string): Promise<SurveyInterviewerCandidate[]> {
    const res = await api.get<{ data: SurveyInterviewerCandidate[] }>(`${BASE}/interviewer-candidates`, { params: { search } })
    return res.data.data
  },

  // --- Anketör performansı ---
  async getInterviewers(filters: SurveyAnalyticsFilters = {}): Promise<SurveyInterviewerStats[]> {
    const res = await api.get<{ data: SurveyInterviewerStats[] }>(`${BASE}/interviewers`, { params: cleanFilters(filters) })
    return res.data.data
  },

  // --- Anketörlere toplu mesaj / duyuru (Kullanıcı isteği 2026-09-01) ---
  async sendInterviewerMessage(payload: SurveyInterviewerMessagePayload): Promise<SurveyInterviewerMessageResult> {
    const res = await api.post<{ data: SurveyInterviewerMessageResult }>(`${BASE}/interviewers/messages`, payload)
    return res.data.data
  },

  // Kullanıcı isteği (2026-09-02): gönderilen bildirimin okunma/onay takibi.
  async getInterviewerNotificationReceipts(params: { interviewerId?: string; surveyId?: string; take?: number } = {}): Promise<SurveyNotificationSummary[]> {
    const res = await api.get<{ data: SurveyNotificationSummary[] }>(`${BASE}/interviewers/notifications`, { params })
    return res.data.data
  },

  // --- Saha canlı takip + performans (Kullanıcı isteği 2026-09-01) ---
  async getLiveAgents(filters: SurveyAnalyticsFilters = {}): Promise<SurveyFieldLiveAgent[]> {
    const res = await api.get<{ data: SurveyFieldLiveAgent[] }>(`${BASE}/field-live`, { params: cleanFilters(filters) })
    return res.data.data
  },

  async getAgentTrail(interviewerId: string, date?: string): Promise<SurveyFieldTrail> {
    const res = await api.get<{ data: SurveyFieldTrail }>(`${BASE}/field-live/${interviewerId}/trail`, {
      params: date ? { date } : {},
    })
    return res.data.data
  },

  async getInterviewerPerformance(filters: SurveyAnalyticsFilters = {}): Promise<SurveyInterviewerPerformanceResult> {
    const res = await api.get<{ data: SurveyInterviewerPerformanceResult }>(`${BASE}/interviewer-performance`, {
      params: cleanFilters(filters),
    })
    return res.data.data
  },

  // --- Kota ---
  async getQuotas(surveyId: string): Promise<SurveyQuota[]> {
    const res = await api.get<{ data: SurveyQuota[] }>(`${BASE}/${surveyId}/quotas`)
    return res.data.data
  },

  async saveQuotas(surveyId: string, quotas: SurveyQuotaForm[]): Promise<SurveyQuota[]> {
    const res = await api.put<{ data: SurveyQuota[] }>(`${BASE}/${surveyId}/quotas`, { quotas })
    return res.data.data
  },

  // --- Soru bankası ---
  async getQuestionBank(params: Record<string, unknown>): Promise<PagedResult<SurveyQuestionBankItem>> {
    const res = await api.get<{ data: PagedResult<SurveyQuestionBankItem> }>(`${BASE}/question-bank`, { params })
    return res.data.data
  },

  async getQuestionBankTopics(): Promise<string[]> {
    const res = await api.get<{ data: string[] }>(`${BASE}/question-bank/topics`)
    return res.data.data
  },

  async createQuestionBankItem(form: SurveyQuestionBankForm): Promise<SurveyQuestionBankItem> {
    const res = await api.post<{ data: SurveyQuestionBankItem }>(`${BASE}/question-bank`, bankPayload(form))
    return res.data.data
  },

  async updateQuestionBankItem(id: string, form: SurveyQuestionBankForm): Promise<SurveyQuestionBankItem> {
    const res = await api.put<{ data: SurveyQuestionBankItem }>(`${BASE}/question-bank/${id}`, bankPayload(form))
    return res.data.data
  },

  async toggleQuestionBankItem(id: string): Promise<SurveyQuestionBankItem> {
    const res = await api.patch<{ data: SurveyQuestionBankItem }>(`${BASE}/question-bank/${id}/toggle-status`)
    return res.data.data
  },

  async removeQuestionBankItem(id: string): Promise<void> {
    await api.delete(`${BASE}/question-bank/${id}`)
  },

  // --- Şablonlar ---
  async getTemplates(): Promise<SurveyTemplate[]> {
    const res = await api.get<{ data: SurveyTemplate[] }>(`${BASE}/templates`)
    return res.data.data
  },

  // --- Analitik / karar destek ---
  async getNeighborhoodStats(filters: SurveyAnalyticsFilters = {}): Promise<SurveyNeighborhoodStats[]> {
    const res = await api.get<{ data: SurveyNeighborhoodStats[] }>(`${BASE}/analytics/neighborhoods`, { params: cleanFilters(filters) })
    return res.data.data
  },

  async getTopicStats(filters: SurveyAnalyticsFilters = {}): Promise<SurveyTopicStats[]> {
    const res = await api.get<{ data: SurveyTopicStats[] }>(`${BASE}/analytics/topics`, { params: cleanFilters(filters) })
    return res.data.data
  },

  async getFieldOperations(filters: SurveyAnalyticsFilters = {}): Promise<SurveyFieldOperations> {
    const res = await api.get<{ data: SurveyFieldOperations }>(`${BASE}/analytics/field-operations`, { params: cleanFilters(filters) })
    return res.data.data
  },

  async getExecutiveDashboard(filters: SurveyAnalyticsFilters = {}): Promise<SurveyExecutiveDashboard> {
    const res = await api.get<{ data: SurveyExecutiveDashboard }>(`${BASE}/analytics/executive`, { params: cleanFilters(filters) })
    return res.data.data
  },
}

export default surveyPlatformService
