type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'

export type BakkartApplicationStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'
export type BakkartCardType = 'Standard' | 'Student' | 'Retiree' | 'SocialSupport'
export type BakkartDeliveryType = 'Digital' | 'Physical'
export type BakkartCardStatus = 'Active' | 'Passive' | 'Blocked'
export type BakkartTransactionType = 'BalanceLoad' | 'BalanceSpend' | 'PointsEarn' | 'PointsSpend' | 'AdminAdjustment'

export const BAKKART_STATUS_LABELS: Record<BakkartApplicationStatus, string> = {
  Pending: 'Onay Bekliyor',
  Approved: 'Onaylandı',
  Rejected: 'Reddedildi',
  Cancelled: 'İptal Edildi',
}

export const BAKKART_STATUS_TONE: Record<BakkartApplicationStatus, BadgeTone> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'danger',
  Cancelled: 'neutral',
}

export const BAKKART_STATUS_OPTIONS = (Object.keys(BAKKART_STATUS_LABELS) as BakkartApplicationStatus[])
  .map((v) => ({ value: v, label: BAKKART_STATUS_LABELS[v] }))

export const BAKKART_CARD_TYPE_LABELS: Record<BakkartCardType, string> = {
  Standard: 'Standart Bakkart',
  Student: 'Öğrenci Bakkart',
  Retiree: 'Emekli Bakkart',
  SocialSupport: 'Sosyal Destek Bakkart',
}

export const BAKKART_CARD_TYPE_OPTIONS = (Object.keys(BAKKART_CARD_TYPE_LABELS) as BakkartCardType[])
  .map((v) => ({ value: v, label: BAKKART_CARD_TYPE_LABELS[v] }))

export const BAKKART_DELIVERY_TYPE_LABELS: Record<BakkartDeliveryType, string> = {
  Digital: 'Dijital Kart',
  Physical: 'Fiziksel Kart',
}

export const BAKKART_CARD_STATUS_LABELS: Record<BakkartCardStatus, string> = {
  Active: 'Aktif',
  Passive: 'Pasif',
  Blocked: 'Engellendi',
}

export const BAKKART_CARD_STATUS_TONE: Record<BakkartCardStatus, BadgeTone> = {
  Active: 'success',
  Passive: 'neutral',
  Blocked: 'danger',
}

export const BAKKART_TRANSACTION_TYPE_LABELS: Record<BakkartTransactionType, string> = {
  BalanceLoad: 'Bakiye Yükleme',
  BalanceSpend: 'Bakiye Kullanımı',
  PointsEarn: 'Puan Kazanımı',
  PointsSpend: 'Puan Kullanımı',
  AdminAdjustment: 'Yönetici Düzeltmesi',
}

export interface BakkartDocument {
  name: string
  url: string
}

export interface BakkartApplication {
  id: string
  trackingNo: string
  participantId?: string | null
  fullName: string
  tckn: string
  tcknLast4: string
  phone: string
  district: string
  cardType: BakkartCardType
  deliveryType: BakkartDeliveryType
  status: BakkartApplicationStatus
  documents: BakkartDocument[]
  appliedAt: string
  reviewedBy?: string | null
  reviewedAt?: string | null
  rejectReason?: string | null
  notes?: string | null
  cardId?: string | null
  cardNo?: string | null
  cardBalance?: number | null
  cardPoints?: number | null
  cardStatus?: BakkartCardStatus | null
}

export interface BakkartApplicationSummary {
  total: number
  pending: number
  approved: number
  rejected: number
  totalActiveCards: number
  totalMerchants: number
}

export interface AdminCreateBakkartApplicationRequest {
  fullName: string
  tckn: string
  phone: string
  district: string
  cardType: BakkartCardType
}

export interface RejectBakkartApplicationRequest {
  reason?: string
}

export interface AdjustBakkartCardRequest {
  balanceDelta?: number
  pointsDelta?: number
  note?: string
}

export interface BakkartCard {
  id: string
  applicationId: string
  cardNo: string
  cardType: BakkartCardType
  status: BakkartCardStatus
  balance: number
  points: number
  issuedAt: string
  holderName: string
  tcknLast4: string
  phone: string
  district: string
}

export interface BakkartTransaction {
  id: string
  type: BakkartTransactionType
  amountDelta: number
  pointsDelta: number
  balanceAfter: number
  pointsAfter: number
  description?: string | null
  performedBy?: string | null
  occurredAt: string
}

export interface BakkartCardStats {
  currentBalance: number
  currentPoints: number
  totalLoaded: number
  totalSpent: number
  totalPointsEarned: number
  totalPointsSpent: number
  transactionCount: number
  lastTransactionAt?: string | null
}
