import type { ServiceCategoryRef } from './serviceCategory.types'

export type CampaignStatus = 'Active' | 'Passive' | 'Completed' | 'Cancelled'

export type DiscountType = 'percentage' | 'fixed'

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

export interface Campaign {
  id: string
  companyId: string
  companyName?: string
  name: string
  discountType: DiscountType
  discountValue: number
  perUserLimit: number
  totalUsageLimit?: number | null
  minOrderAmount?: number | null
  startDate: string
  endDate: string
  usageCount: number
  status: CampaignStatus
  category: CampaignCategory
  isRedeemable: boolean
  isExhausted: boolean
  serviceCategory: ServiceCategoryRef | null
  createdAt: string
  updatedAt: string
  imageUrl?: string | null
  description?: string | null
  rules?: string | null
  kvkkText?: string | null
  products: CampaignProduct[]
}

export interface CampaignInput {
  companyId: string
  name: string
  discountType: DiscountType
  discountValue: number
  perUserLimit: number
  totalUsageLimit?: number | null
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

export interface CampaignSummary {
  total: number
  active: number
  completed: number
  passive: number
  totalUsages: number
}

type Tone = 'success' | 'neutral' | 'danger' | 'warning' | 'info' | 'primary'

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  Active: 'Aktif',
  Passive: 'Pasif',
  Completed: 'Tamamlandı',
  Cancelled: 'İptal',
}

export const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, Tone> = {
  Active: 'success',
  Passive: 'warning',
  Completed: 'neutral',
  Cancelled: 'danger',
}

export const CAMPAIGN_STATUS_OPTIONS: { value: CampaignStatus; label: string }[] = [
  { value: 'Active', label: 'Aktif' },
  { value: 'Passive', label: 'Pasif' },
  { value: 'Completed', label: 'Tamamlandı' },
  { value: 'Cancelled', label: 'İptal' },
]

export const DISCOUNT_TYPE_OPTIONS: { value: DiscountType; label: string; description: string }[] = [
  { value: 'percentage', label: 'Yüzde (%)', description: 'Tutarın yüzdesi kadar indirim' },
  { value: 'fixed', label: 'Sabit Tutar (TL)', description: 'Sabit TL tutarında indirim' },
]

export const formatDiscount = (type: DiscountType, value: number): string =>
  type === 'percentage' ? `%${value}` : `${value.toLocaleString('tr-TR')} TL`
