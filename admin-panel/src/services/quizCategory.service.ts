import { api } from './api'
import type { PagedResult, SelectOption } from '@/types/common'
import type { QuizCategory, QuizCategoryForm } from '@/types/quizCategory.types'

const BASE = '/quiz-categories'

const quizCategoryService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<QuizCategory>> {
    const res = await api.get<{ data: PagedResult<QuizCategory> }>(BASE, { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<{ total: number; active: number; passive: number }> {
    const res = await api.get<{ data: { total: number; active: number; passive: number } }>(`${BASE}/summary`, { params })
    return res.data.data
  },

  async getOptions(): Promise<SelectOption[]> {
    const res = await api.get<{ data: { id: string; name: string }[] }>(`${BASE}/options`)
    return res.data.data.map((c) => ({ value: c.id, label: c.name }))
  },

  async getById(id: string): Promise<QuizCategory> {
    const res = await api.get<{ data: QuizCategory }>(`${BASE}/${id}`)
    return res.data.data
  },

  async create(data: QuizCategoryForm): Promise<QuizCategory> {
    const res = await api.post<{ data: QuizCategory }>(BASE, data)
    return res.data.data
  },

  async update(id: string, data: QuizCategoryForm): Promise<QuizCategory> {
    const res = await api.put<{ data: QuizCategory }>(`${BASE}/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`)
  },

  async toggleStatus(id: string): Promise<QuizCategory> {
    const res = await api.patch<{ data: QuizCategory }>(`${BASE}/${id}/toggle-status`)
    return res.data.data
  },
}

export default quizCategoryService
