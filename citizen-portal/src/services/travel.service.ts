import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { CitizenTravel, CitizenTravelDetail, CitizenTravelApplication, CitizenReservationRequest } from '@/types/travel.types'
import type { CitizenReviewsDto, CitizenReviewDto, SubmitReviewRequest } from '@/types/review.types'
import type { NviLookupResult } from '@/types/auth.types'

const travelService = {
  async discover(params: Record<string, unknown>): Promise<PagedResult<CitizenTravel>> {
    const res = await api.get<{ data: PagedResult<CitizenTravel> }>('/me/travels/discover', { params })
    return res.data.data
  },

  async detail(id: string): Promise<CitizenTravelDetail> {
    const res = await api.get<{ data: CitizenTravelDetail }>(`/me/travels/${id}`)
    return res.data.data
  },

  /** Gezi rezervasyonuna eklenecek misafir için kimlik önizlemesi. Misafirin sistemde
   * zaten bir vatandaş hesabı olması sorun değildir — /auth/citizen/nvi-lookup'ın aksine
   * bu uç nokta "zaten kayıtlı" hatası fırlatmaz. */
  async guestLookup(tckn: string, birthDate: string): Promise<NviLookupResult> {
    const res = await api.post<{ data: NviLookupResult }>('/me/travels/guest-lookup', { tckn, birthDate })
    return res.data.data
  },

  async reserve(id: string, payload: CitizenReservationRequest): Promise<CitizenTravelApplication> {
    const res = await api.post<{ data: CitizenTravelApplication }>(`/me/travels/${id}/reserve`, payload)
    return res.data.data
  },

  async applications(params: Record<string, unknown>): Promise<PagedResult<CitizenTravelApplication>> {
    const res = await api.get<{ data: PagedResult<CitizenTravelApplication> }>('/me/travels/applications', { params })
    return res.data.data
  },

  async cancel(id: string): Promise<void> {
    await api.delete(`/me/travels/applications/${id}`)
  },

  async getReviews(travelId: string): Promise<CitizenReviewsDto> {
    const res = await api.get<{ data: CitizenReviewsDto }>(`/me/travels/${travelId}/reviews`)
    return res.data.data
  },

  async submitReview(travelId: string, req: SubmitReviewRequest): Promise<CitizenReviewDto> {
    const res = await api.post<{ data: CitizenReviewDto }>(`/me/travels/${travelId}/reviews`, req)
    return res.data.data
  },
}

export default travelService
