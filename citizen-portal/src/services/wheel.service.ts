import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { CitizenWheel, CitizenGiftRequest, WheelSpinResult, AvailableGiftsResult } from '@/types/wheel.types'

const wheelService = {
  async wheels(params: Record<string, unknown>): Promise<PagedResult<CitizenWheel>> {
    const res = await api.get<{ data: PagedResult<CitizenWheel> }>('/me/wheels', { params })
    return res.data.data
  },

  async gifts(params: Record<string, unknown>): Promise<PagedResult<CitizenGiftRequest>> {
    const res = await api.get<{ data: PagedResult<CitizenGiftRequest> }>('/me/wheels/gifts', { params })
    return res.data.data
  },

  async spin(id: string): Promise<WheelSpinResult> {
    const res = await api.post<{ data: WheelSpinResult }>(`/wheels/${id}/spin`)
    return res.data.data
  },

  async getAvailableGifts(): Promise<AvailableGiftsResult> {
    const res = await api.get<{ data: AvailableGiftsResult }>('/me/wheels/gifts/available')
    return res.data.data
  },

  async applyForGift(giftId: string): Promise<void> {
    await api.post(`/wheels/gifts/${giftId}/apply`)
  },
}

export default wheelService
