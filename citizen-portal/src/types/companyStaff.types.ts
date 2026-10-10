export interface CompanyStaff {
  id: string
  companyId: string
  fullName: string
  phone: string
  email: string | null
  isActive: boolean
  canRedeem: boolean
  canManageCampaigns: boolean
  lastLoginAt: string | null
  createdAt: string
  kvkkAccepted?: boolean
  notificationConsentAccepted?: boolean
}

export interface CreateCompanyStaffRequest {
  fullName: string
  phone: string
  email?: string | null
  password: string
  canRedeem: boolean
  canManageCampaigns: boolean
}

export interface UpdateCompanyStaffRequest {
  fullName: string
  phone: string
  email?: string | null
  canRedeem: boolean
  canManageCampaigns: boolean
}

export interface ResetCompanyStaffPasswordResult {
  newPassword: string
}

export interface SetStaffPasswordRequest {
  newPassword: string
}
