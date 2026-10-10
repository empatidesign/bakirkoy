import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { CitizenQuiz, CitizenQuizDetail, CitizenQuizSubmitRequest, CitizenQuizSubmitResult, CitizenQuizLeaderboard } from '@/types/quiz.types'

const quizService = {
  async list(params: Record<string, unknown>): Promise<PagedResult<CitizenQuiz>> {
    const res = await api.get<{ data: PagedResult<CitizenQuiz> }>('/me/quizzes', { params })
    return res.data.data
  },

  async detail(id: string): Promise<CitizenQuizDetail> {
    const res = await api.get<{ data: CitizenQuizDetail }>(`/me/quizzes/${id}`)
    return res.data.data
  },

  async submit(id: string, req: CitizenQuizSubmitRequest): Promise<CitizenQuizSubmitResult> {
    const res = await api.post<{ data: CitizenQuizSubmitResult }>(`/me/quizzes/${id}/submit`, req)
    return res.data.data
  },

  async checkAnswer(id: string, questionIndex: number, selectedAnswer: string): Promise<boolean> {
    const res = await api.post<{ data: { questionIndex: number; isCorrect: boolean } }>(
      `/me/quizzes/${id}/check-answer`,
      { questionIndex, selectedAnswer },
    )
    return res.data.data.isCorrect
  },

  async leaderboard(id: string): Promise<CitizenQuizLeaderboard> {
    const res = await api.get<{ data: CitizenQuizLeaderboard }>(`/me/quizzes/${id}/leaderboard`)
    return res.data.data
  },
}

export default quizService
