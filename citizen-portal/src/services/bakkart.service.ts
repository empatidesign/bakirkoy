import { api } from './api'
import type {
  CreateBakkartApplicationRequest, BakkartApplication, MyBakkartStatus, BakkartCardStats, BakkartTransaction, BakkartDocument,
} from '@/types/bakkart.types'

const bakkartService = {
  async status(): Promise<MyBakkartStatus> {
    const res = await api.get<{ data: MyBakkartStatus }>('/me/bakkart/status')
    return res.data.data
  },

  async stats(): Promise<BakkartCardStats | null> {
    const res = await api.get<{ data: BakkartCardStats | null }>('/me/bakkart/stats')
    return res.data.data
  },

  async transactions(): Promise<BakkartTransaction[]> {
    const res = await api.get<{ data: BakkartTransaction[] }>('/me/bakkart/transactions')
    return res.data.data
  },

  async apply(req: CreateBakkartApplicationRequest): Promise<BakkartApplication> {
    const res = await api.post<{ data: BakkartApplication }>('/me/bakkart/apply', req)
    return res.data.data
  },

  async uploadDocument(file: File): Promise<BakkartDocument> {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post<{ data: BakkartDocument }>('/me/bakkart/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },

  async cancel(id: string): Promise<void> {
    await api.post(`/me/bakkart/${id}/cancel`)
  },
}

export default bakkartService
