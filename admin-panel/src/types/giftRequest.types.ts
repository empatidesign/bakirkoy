export type GiftRequestStatus = 'pending' | 'approved' | 'rejected'

export type GiftRequestSource = 'wheel' | 'application'

export interface GiftRequest {
  id: string
  giftId: string
  giftName: string
  giftPoints: number
  citizenName: string
  citizenTc: string
  citizenPhone: string
  orderNumber: number
  isWinner: boolean
  source: GiftRequestSource
  status: GiftRequestStatus
  requestedAt: string
  approvedAt?: string
  approvedBy?: string
  rejectedAt?: string
  rejectedBy?: string
  rejectReason?: string
  deliveredAt?: string
  deliveredBy?: string
  deliveryNote?: string
}

export interface GiftRequestSummary {
  total: number
  pending: number
  approved: number
  rejected: number
  winners: number
  winnersPending: number
}

type Tone = 'success' | 'neutral' | 'danger' | 'warning' | 'info' | 'primary'

export const GIFT_REQUEST_STATUS_LABELS: Record<GiftRequestStatus, string> = {
  pending: 'Bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
}

export const GIFT_REQUEST_STATUS_TONE: Record<GiftRequestStatus, Tone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

export const GIFT_REQUEST_SOURCE_LABELS: Record<GiftRequestSource, string> = {
  wheel: 'Çark',
  application: 'Başvuru',
}

export const GIFT_REQUEST_SOURCE_TONE: Record<GiftRequestSource, Tone> = {
  wheel: 'primary',
  application: 'info',
}

export const GIFT_REQUEST_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'pending', label: 'Bekleyen' },
  { value: 'approved', label: 'Onaylanan' },
  { value: 'rejected', label: 'Reddedilen' },
  { value: 'winner', label: 'Kazanan (Tümü)' },
  { value: 'winner_pending', label: 'Kazanan (Onay Bekleyen)' },
]
