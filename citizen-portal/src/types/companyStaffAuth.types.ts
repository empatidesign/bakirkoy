import type { CompanyUser } from './companyAuth.types'
import type { CompanyStaff } from './companyStaff.types'

export interface CompanyStaffLoginRequest {
  phone: string
  password: string
}

export interface CompanyStaffTokenPair {
  accessToken: string
  refreshToken: string
  expiresAt: string
  staff: CompanyStaff
  company: CompanyUser
}
