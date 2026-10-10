import { api } from './api'
import type { PagedResult } from '@/types/common'
import type {
  BakkartApplication,
  BakkartApplicationSummary,
  AdminCreateBakkartApplicationRequest,
  RejectBakkartApplicationRequest,
  AdjustBakkartCardRequest,
  BakkartCard,
  BakkartTransaction,
  BakkartCardStats,
  BakkartDocument,
} from '@/types/bakkart.types'

const BASE = '/bakkart'

const bakkartService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<BakkartApplication>> {
    const res = await api.get<{ data: PagedResult<BakkartApplication> }>(`${BASE}/applications`, { params })
    return res.data.data
  },

  async getSummary(): Promise<BakkartApplicationSummary> {
    const res = await api.get<{ data: BakkartApplicationSummary }>(`${BASE}/applications/summary`)
    return res.data.data
  },

  async getById(id: string): Promise<BakkartApplication> {
    const res = await api.get<{ data: BakkartApplication }>(`${BASE}/applications/${id}`)
    return res.data.data
  },

  async create(data: AdminCreateBakkartApplicationRequest): Promise<BakkartApplication> {
    const res = await api.post<{ data: BakkartApplication }>(`${BASE}/applications`, data)
    return res.data.data
  },

  async approve(id: string): Promise<BakkartApplication> {
    const res = await api.patch<{ data: BakkartApplication }>(`${BASE}/applications/${id}/approve`)
    return res.data.data
  },

  async reject(id: string, req: RejectBakkartApplicationRequest): Promise<BakkartApplication> {
    const res = await api.patch<{ data: BakkartApplication }>(`${BASE}/applications/${id}/reject`, req)
    return res.data.data
  },

  async updateDocuments(id: string, documents: BakkartDocument[]): Promise<BakkartApplication> {
    const res = await api.put<{ data: BakkartApplication }>(`${BASE}/applications/${id}/documents`, { documents })
    return res.data.data
  },

  async adjustCard(cardId: string, req: AdjustBakkartCardRequest): Promise<BakkartCard> {
    const res = await api.post<{ data: BakkartCard }>(`${BASE}/cards/${cardId}/adjust`, req)
    return res.data.data
  },

  async getCardTransactions(cardId: string): Promise<BakkartTransaction[]> {
    const res = await api.get<{ data: BakkartTransaction[] }>(`${BASE}/cards/${cardId}/transactions`)
    return res.data.data
  },

  async getCardStats(cardId: string): Promise<BakkartCardStats> {
    const res = await api.get<{ data: BakkartCardStats }>(`${BASE}/cards/${cardId}/stats`)
    return res.data.data
  },
}

export default bakkartService
