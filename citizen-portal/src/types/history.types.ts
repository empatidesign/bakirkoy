export interface HistoryItemDto {
  applicationId: string
  type: 'event' | 'travel'
  sourceId: string
  title: string
  categoryName: string
  categoryColor: string
  startDate: string
  endDate: string
  imageUrl: string | null
  status: string
  appliedAt: string
  hasReviewed: boolean
  canReview: boolean
  checkedIn: boolean
  facilityName: string | null
  hallName: string | null
  seatNumber: string | null
  location: string | null
  reservationType: 'none' | 'row' | 'seat' | null
}

export interface HistoryListParams {
  page?: number
  limit?: number
  type?: 'event' | 'travel'
}
