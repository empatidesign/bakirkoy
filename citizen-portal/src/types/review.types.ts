export interface CitizenReviewDto {
  id: string
  rating: number
  comment: string | null
  submittedAt: string
}

export interface CitizenReviewsDto {
  reviews: CitizenReviewDto[]
  canReview: boolean
  alreadyReviewed: boolean
  checkedIn: boolean
  averageRating: number | null
  reviewCount: number
  windowDays: number
}

export interface SubmitReviewRequest {
  rating: number
  comment?: string
}
