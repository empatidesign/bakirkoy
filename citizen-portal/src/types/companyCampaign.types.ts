import type { ServiceCategoryRef } from './serviceCategory.types'

export type DiscountType = 'percentage' | 'fixed'

export type CampaignStatus = 'Active' | 'Passive' | 'Completed' | 'Cancelled'

export type CampaignCategory =
  | 'Discount'
  | 'BuyXGetY'
  | 'Seasonal'
  | 'NewCustomer'
  | 'Bundle'
  | 'Clearance'
  | 'Other'

export const CAMPAIGN_CATEGORY_LABELS: Record<CampaignCategory, string> = {
  Discount: 'İndirim',
  BuyXGetY: '2 Al 1 Öde',
  Seasonal: 'Sezonluk',
  NewCustomer: 'Yeni Müşteri',
  Bundle: 'Paket',
  Clearance: 'Tasfiye',
  Other: 'Diğer',
}

export const CAMPAIGN_CATEGORY_OPTIONS: { value: CampaignCategory; label: string }[] = (
  Object.keys(CAMPAIGN_CATEGORY_LABELS) as CampaignCategory[]
).map((value) => ({ value, label: CAMPAIGN_CATEGORY_LABELS[value] }))

export interface CampaignProduct {
  id?: string
  name: string
  imageUrl?: string | null
  price?: number | null
  sortOrder: number
}

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percentage: 'Yüzde (%)',
  fixed: 'Tutar (₺)',
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  Active: 'Aktif',
  Passive: 'Pasif',
  Completed: 'Süresi Doldu',
  Cancelled: 'İptal Edildi',
}

export const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, 'success' | 'neutral' | 'info' | 'danger'> = {
  Active: 'success',
  Passive: 'neutral',
  Completed: 'info',
  Cancelled: 'danger',
}

export interface Campaign {
  id: string
  companyId: string
  companyName: string
  name: string
  discountType: DiscountType
  discountValue: number
  perUserLimit: number
  totalUsageLimit: number | null
  isExhausted: boolean
  isRedeemable: boolean
  minOrderAmount?: number | null
  startDate: string
  endDate: string
  usageCount: number
  status: CampaignStatus
  category: CampaignCategory
  serviceCategory: ServiceCategoryRef | null
  createdAt: string
  updatedAt?: string | null
  imageUrl?: string | null
  description?: string | null
  rules?: string | null
  kvkkText?: string | null
  products: CampaignProduct[]
}

export interface CreateCampaignRequest {
  name: string
  discountType: DiscountType
  discountValue: number
  perUserLimit: number
  totalUsageLimit: number | null
  minOrderAmount?: number | null
  startDate: string
  endDate: string
  category: CampaignCategory
  imageUrl?: string | null
  description?: string | null
  rules?: string | null
  kvkkText?: string | null
  products: CampaignProduct[]
}

export type UpdateCampaignRequest = CreateCampaignRequest

export const formatDiscount = (type: DiscountType, value: number): string =>
  type === 'percentage' ? `%${value}` : `${value.toLocaleString('tr-TR')} ₺`

export interface CampaignRedeemResult {
  campaignId: string
  campaignName: string
  companyName: string
  participantName: string
  discountType: DiscountType
  discountValue: number
  perUserLimit: number
  usedCount: number
  remainingUses: number
}

export interface ActiveCampaignItem {
  id: string
  name: string
  discountType: DiscountType
  discountValue: number
  endDate: string
  description?: string | null
  minOrderAmount?: number | null
}

export interface ScanCitizenResult {
  participantId: string
  fullName: string
  photoUrl?: string | null
  activeCampaigns: ActiveCampaignItem[]
}

export interface RedemptionResult {
  id: string
  redemptionCode: string
  participantId: string
  participantName: string
  campaignId?: string | null
  campaignName?: string | null
  redeemedAt: string
}

export interface CompanyCampaignUsage {
  id: string
  campaignId: string
  campaignName: string
  maskedUserName: string
  maskedUserPhone: string
  usedAt: string
  status: string
}

