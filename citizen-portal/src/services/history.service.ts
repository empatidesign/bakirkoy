import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { HistoryItemDto, HistoryListParams } from '@/types/history.types'

const historyService = {
  async getHistory(params: HistoryListParams = {}): Promise<PagedResult<HistoryItemDto>> {
    const query: Record<string, unknown> = {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    }
    if (params.type) query.type = params.type
    const res = await api.get<{ data: PagedResult<HistoryItemDto> }>('/me/history', { params: query })
    return res.data.data
  },
}

export default historyService
