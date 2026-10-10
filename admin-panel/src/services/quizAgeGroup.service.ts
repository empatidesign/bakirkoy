import { api } from './api'
import type { PagedResult, SelectOption } from '@/types/common'
import type { QuizAgeGroup, QuizAgeGroupForm } from '@/types/quizAgeGroup.types'

const BASE = '/quiz-age-groups'

const quizAgeGroupService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<QuizAgeGroup>> {
    const res = await api.get<{ data: PagedResult<QuizAgeGroup> }>(BASE, { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<{ total: number; active: number; passive: number }> {
    const res = await api.get<{ data: { total: number; active: number; passive: number } }>(`${BASE}/summary`, { params })
    return res.data.data
  },

  async getOptions(): Promise<SelectOption[]> {
    const res = await api.get<{ data: { id: string; name: string }[] }>(`${BASE}/options`)
    return res.data.data.map((g) => ({ value: g.id, label: g.name }))
  },

  async create(data: QuizAgeGroupForm): Promise<QuizAgeGroup> {
    const res = await api.post<{ data: QuizAgeGroup }>(BASE, data)
    return res.data.data
  },

  async update(id: string, data: QuizAgeGroupForm): Promise<QuizAgeGroup> {
    const res = await api.put<{ data: QuizAgeGroup }>(`${BASE}/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`)
  },

  async toggleStatus(id: string): Promise<QuizAgeGroup> {
    const res = await api.patch<{ data: QuizAgeGroup }>(`${BASE}/${id}/toggle-status`)
    return res.data.data
  },
}

export default quizAgeGroupService
