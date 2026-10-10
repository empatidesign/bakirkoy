export interface WheelSlice {
  label: string
  type: string
  value: number
  winRate: number
  color: string
  giftId: string | null
  giftName: string | null
}

export interface CitizenWheel {
  id: string
  title: string
  description: string | null
  slices: WheelSlice[]
  dailySpinLimit: number
  remainingSpinsToday: number | null
  status: string
  createdAt: string
}

export interface CitizenGiftRequest {
  id: string
  giftId: string
  giftName: string
  giftPoints: number
  orderNumber: string
  isWinner: boolean
  status: string
  requestedAt: string
  approvedAt: string | null
  rejectedAt: string | null
  rejectReason: string | null
}

export interface AvailableGift {
  id: string
  name: string
  points: number
  imageUrl: string | null
  remaining: number
  hasPendingRequest: boolean
}

export interface AvailableGiftsResult {
  balance: number
  gifts: AvailableGift[]
}

export interface WheelSpinResult {
  sliceLabel: string
  sliceType: string
  sliceValue: number
  giftId: string | null
  giftRequestId: string | null
  pointsWon: number | null
  remainingSpinsToday: number | null
}
