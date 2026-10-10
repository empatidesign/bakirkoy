import type { ServiceCategoryRef } from './serviceCategory.types'
import type { CampaignCategory, CampaignProduct } from './companyCampaign.types'
import type { CompanySocialMedia } from './companyAuth.types'

export interface CitizenCampaign {
  id: string
  companyId: string
  companyName: string
  companyLogo: string | null
  name: string
  discountType: string
  discountValue: number
  perUserLimit: number
  totalUsageLimit: number | null
  myUsageCount: number
  minOrderAmount: number | null
  startDate: string
  endDate: string
  status: string
  isExhausted: boolean
  serviceCategory: ServiceCategoryRef | null
  createdAt: string
  imageUrl?: string | null
  description?: string | null
  category: CampaignCategory
  products: CampaignProduct[]
  isSaved: boolean
  isNew: boolean
  companyLatitude?: number | null
  companyLongitude?: number | null
  distanceKm?: number | null
}

export interface CitizenCampaignUsage {
  usageId: string
  campaignId: string
  campaignName: string
  companyName: string
  companyLogo: string | null
  discountType: string
  discountValue: number
  usedAt: string
}

export interface CitizenCampaignRedeem {
  campaignId: string
  campaignName: string
  companyName: string
  token: string
  rotationSeconds: number
  perUserLimit: number
  remainingUses: number
}

export interface CitizenCampaignCompany {
  id: string
  name: string
  logo: string | null
  description: string | null
  address: string | null
  phone: string | null
  serviceCategory: ServiceCategoryRef | null
  activeCampaignCount: number
}

export interface CitizenDirectoryCompany {
  id: string
  name: string
  logo: string | null
  bannerImage: string | null
  bannerImageMobile: string | null
  description: string | null
  serviceDescription: string | null
  address: string
  district: string
  phone: string | null
  website: string | null
  latitude: number | null
  longitude: number | null
  galleryImages: string[]
  serviceCategory: ServiceCategoryRef | null
  activeCampaignCount: number
  socialMedia?: CompanySocialMedia | null
  distanceKm?: number | null
  googlePlaceId?: string | null
}

