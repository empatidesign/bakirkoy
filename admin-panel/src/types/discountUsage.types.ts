export type DiscountUsageStatus = 'Used'

export interface DiscountUsage {
  id: string
  userId: string
  userName: string
  userPhone?: string
  campaignId: string
  campaignName?: string
  serviceId?: string
  serviceName?: string
  companyId: string
  companyName?: string
  discountCode?: string
  usedAt: string
  qrScannedAt?: string
  status: DiscountUsageStatus
}

export interface DiscountUsageSummary {
  total: number
  used: number
  uniqueUsers: number
}

type Tone = 'success' | 'neutral' | 'danger' | 'warning' | 'info' | 'primary'

export const DISCOUNT_USAGE_STATUS_LABELS: Record<DiscountUsageStatus, string> = {
  Used: 'Kullanıldı',
}

export const DISCOUNT_USAGE_STATUS_TONE: Record<DiscountUsageStatus, Tone> = {
  Used: 'success',
}
