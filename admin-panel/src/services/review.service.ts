import { api } from './api'

export interface AdminReviewDto {
  id: string
  participantName: string
  rating: number
  comment: string | null
  submittedAt: string
}

export interface AdminReviewsDto {
  reviews: AdminReviewDto[]
  averageRating: number | null
  reviewCount: number
}

const reviewService = {
  async getEventReviews(eventId: string): Promise<AdminReviewsDto> {
    const res = await api.get<{ data: AdminReviewsDto }>(`/events/${eventId}/reviews`)
    return res.data.data
  },

  async getTravelReviews(travelId: string): Promise<AdminReviewsDto> {
    const res = await api.get<{ data: AdminReviewsDto }>(`/travels/${travelId}/reviews`)
    return res.data.data
  },
}

export default reviewService
