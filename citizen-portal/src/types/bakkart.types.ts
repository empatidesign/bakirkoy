export type BakkartApplicationStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'
export type BakkartCardType = 'Standard' | 'Student' | 'Retiree' | 'SocialSupport'
export type BakkartDeliveryType = 'Digital' | 'Physical'
export type BakkartCardStatus = 'Active' | 'Passive' | 'Blocked'
export type BakkartTransactionType = 'BalanceLoad' | 'BalanceSpend' | 'PointsEarn' | 'PointsSpend' | 'AdminAdjustment'

export interface BakkartDocument {
  name: string
  url: string
}

export interface CreateBakkartApplicationRequest {
  fullName: string
  tckn: string
  phone: string
  district: string
  cardType: BakkartCardType
  deliveryType: BakkartDeliveryType
  documents?: BakkartDocument[]
  notes?: string
}

export interface BakkartApplication {
  id: string
  trackingNo: string
  status: BakkartApplicationStatus
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

export interface MyBakkartStatus {
  trackingNo?: string | null
  status?: BakkartApplicationStatus | null
  appliedAt?: string | null
  rejectReason?: string | null
  card?: BakkartCard | null
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

export const BAKKART_TRANSACTION_TYPE_LABELS: Record<BakkartTransactionType, string> = {
  BalanceLoad: 'Bakiye Yükleme',
  BalanceSpend: 'Bakiye Kullanımı',
  PointsEarn: 'Puan Kazanımı',
  PointsSpend: 'Puan Kullanımı',
  AdminAdjustment: 'Yönetici Düzeltmesi',
}
