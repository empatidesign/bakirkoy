import type { ServiceCategoryRef } from './serviceCategory.types'

export type CompanyStatus = 'Pending' | 'Approved' | 'Rejected' | 'Passive'

export interface CompanySocialMedia {
  facebook?: string
  instagram?: string
  twitter?: string
  linkedin?: string
}

export interface Company {
  id: string
  name: string
  taxNumber: string
  phone: string
  email: string | null
  address: string
  district: string
  status: CompanyStatus
  emailVerified: boolean
  phoneVerified: boolean
  isLocked?: boolean
  lockedUntil?: string | null
  logo?: string
  bannerImage?: string
  bannerImageMobile?: string
  description?: string
  website?: string
  socialMedia?: CompanySocialMedia
  latitude?: number
  longitude?: number
  googlePlaceId?: string | null
  rejectReason?: string
  serviceCategory: ServiceCategoryRef | null
  totalServices: number
  totalCampaigns: number
  totalUsages: number
  createdAt: string
  updatedAt: string
}

export interface CompanyInput {
  name: string
  taxNumber: string
  phone: string
  email?: string
  address: string
  district: string
  logo?: string
  bannerImage?: string
  bannerImageMobile?: string
  description?: string
  website?: string
  socialMedia?: CompanySocialMedia
  serviceCategoryId?: string
  deliveryChannel?: CompanyDeliveryChannel
  latitude?: number
  longitude?: number
}

export type CompanyDeliveryChannel = 'Email' | 'Sms'

export interface CompanySummary {
  total: number
  pending: number
  approved: number
  rejected: number
  passive: number
}

export interface CompanyServiceItem {
  id: string
  companyId: string
  name: string
  category: string
  description?: string
  price?: number
  isActive: boolean
  createdAt: string
}

export interface CompanyStatusDistribution {
  approved: number
  pending: number
  rejected: number
  passive: number
}

export interface CompanyRanked {
  id: string
  name: string
  count: number
}

export interface CompanyDashboard {
  totalCompanies: number
  pendingCompanies: number
  approvedCompanies: number
  activeCampaigns: number
  totalUsages: number
  monthlyUsages: number
  previousMonthlyUsages: number
  statusDistribution: CompanyStatusDistribution
  topByCampaigns: CompanyRanked[]
  topByUsages: CompanyRanked[]
}

type Tone = 'success' | 'neutral' | 'danger' | 'warning' | 'info' | 'primary'

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  Pending: 'Beklemede',
  Approved: 'Onaylandı',
  Rejected: 'Reddedildi',
  Passive: 'Pasif',
}

export const COMPANY_STATUS_TONE: Record<CompanyStatus, Tone> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'danger',
  Passive: 'neutral',
}

export const COMPANY_STATUS_OPTIONS: { value: CompanyStatus; label: string }[] = [
  { value: 'Pending', label: 'Beklemede' },
  { value: 'Approved', label: 'Onaylandı' },
  { value: 'Rejected', label: 'Reddedildi' },
  { value: 'Passive', label: 'Pasif' },
]

export const DEFAULT_COMPANY_DISTRICT = 'Bakırköy'

export const COMPANY_LOGO_SPEC = { width: 400, height: 400, maxSizeKb: 512 }
export const COMPANY_BANNER_SPEC = { width: 1200, height: 400, maxSizeKb: 1024 }
export const COMPANY_BANNER_MOBILE_SPEC = { width: 900, height: 1200, maxSizeKb: 768 }

export interface CompanyImportRowResult {
  row: number
  name: string
  outcome: 'Eklendi' | 'Atlandı' | 'Hata'
  reason: string | null
  assignedCategory: string | null
}

export interface CompanyImportResult {
  totalRows: number
  added: number
  skipped: number
  failedRows: number
  rows: CompanyImportRowResult[]
}

export type CompanyNotificationEvent = 'temporary_password' | 'approved' | 'password_reset' | 'manual'

export interface CompanyNotificationTemplate {
  event: CompanyNotificationEvent
  smsEnabled: boolean
  smsBody: string
}

export interface CompanySettings {
  notificationTemplates: CompanyNotificationTemplate[] | null
}

export interface CompanyManualMessageRequest {
  companyIds: string[]
  templateEvent: CompanyNotificationEvent
  customText?: string | null
  sms: boolean
  notify: boolean
  // Kullanıcı isteği (2026-09-19, güncelleme 2026-09-20 iki kez): SMS göndermek için
  // doğrulama kodu (OTP) zorunlu. PIN yöntemi kaldırıldı.
  smsOtp?: string
}

export interface CompanyManualMessageResult {
  recipients: number
  smsSent: number
  notificationsCreated: number
  smsMockMode: boolean
}
