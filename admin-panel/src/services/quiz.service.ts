import { api } from './api'
import type { PagedResult, SelectOption } from '@/types/common'
import type {
  Quiz,
  QuizForm,
  QuizLeaderboard,
  QuizParticipation,
  QuizParticipationDetail,
  QuizQuestion,
  QuizQuestionForm,
  QuizStats,
  QuizSummary,
} from '@/types/quiz.types'

const BASE = '/quizzes'

const quizService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<Quiz>> {
    const res = await api.get<{ data: PagedResult<Quiz> }>(BASE, { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<QuizSummary> {
    const res = await api.get<{ data: QuizSummary }>(`${BASE}/summary`, { params })
    return res.data.data
  },

  async getOptions(): Promise<SelectOption[]> {
    const res = await api.get<{ data: SelectOption[] }>(`${BASE}/options`)
    return res.data.data
  },

  async getById(id: string): Promise<Quiz> {
    const res = await api.get<{ data: Quiz }>(`${BASE}/${id}`)
    return res.data.data
  },

  async create(data: QuizForm): Promise<Quiz> {
    const res = await api.post<{ data: Quiz }>(BASE, data)
    return res.data.data
  },

  async update(id: string, data: QuizForm): Promise<Quiz> {
    const res = await api.put<{ data: Quiz }>(`${BASE}/${id}`, data)
    return res.data.data
  },

  async toggleStatus(id: string): Promise<Quiz> {
    const res = await api.patch<{ data: Quiz }>(`${BASE}/${id}/toggle-status`)
    return res.data.data
  },

  async archive(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`)
  },

  async restore(id: string): Promise<Quiz> {
    const res = await api.patch<{ data: Quiz }>(`${BASE}/${id}/restore`)
    return res.data.data
  },

  async hardDelete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}/permanent`)
  },

  async getQuestions(quizId: string): Promise<QuizQuestion[]> {
    const res = await api.get<{ data: QuizQuestion[] }>(`${BASE}/${quizId}/questions`)
    return res.data.data
  },

  async saveQuestions(quizId: string, questions: QuizQuestionForm[]): Promise<QuizQuestion[]> {
    const res = await api.put<{ data: QuizQuestion[] }>(`${BASE}/${quizId}/questions`, { questions })
    return res.data.data
  },

  async getParticipants(quizId: string, params: Record<string, unknown>): Promise<PagedResult<QuizParticipation>> {
    const res = await api.get<{ data: PagedResult<QuizParticipation> }>(`${BASE}/${quizId}/participants`, { params })
    return res.data.data
  },

  async getParticipationDetail(quizId: string, participationId: string): Promise<QuizParticipationDetail> {
    const res = await api.get<{ data: QuizParticipationDetail }>(`${BASE}/${quizId}/participants/${participationId}`)
    return res.data.data
  },

  async getLeaderboard(quizId: string): Promise<QuizLeaderboard> {
    const res = await api.get<{ data: QuizLeaderboard }>(`${BASE}/${quizId}/leaderboard`)
    return res.data.data
  },

  async getQuestionStats(quizId: string): Promise<QuizStats> {
    const res = await api.get<{ data: QuizStats }>(`${BASE}/${quizId}/question-stats`)
    return res.data.data
  },
}

export default quizService
