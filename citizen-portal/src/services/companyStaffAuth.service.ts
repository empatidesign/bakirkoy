import type { AxiosRequestConfig } from 'axios'
import { api } from './api'
import type { CompanyStaffLoginRequest, CompanyStaffTokenPair } from '@/types/companyStaffAuth.types'
import type { CompanyStaff } from '@/types/companyStaff.types'

const companyStaffAuthService = {
  async login(data: CompanyStaffLoginRequest, silent = false): Promise<CompanyStaffTokenPair> {
    const config: (AxiosRequestConfig & { _silent?: boolean }) | undefined = silent ? { _silent: true } : undefined
    const res = await api.post<{ data: CompanyStaffTokenPair }>('/auth/company-staff/login', data, config)
    return res.data.data
  },

  async refresh(refreshToken: string): Promise<CompanyStaffTokenPair> {
    const res = await api.post<{ data: CompanyStaffTokenPair }>('/auth/company-staff/refresh', { refreshToken })
    return res.data.data
  },

  async me(): Promise<CompanyStaff> {
    const res = await api.get<{ data: CompanyStaff }>('/auth/company-staff/me')
    return res.data.data
  },

  async logout(): Promise<void> {
    await api.post('/auth/company-staff/logout', {})
  },

  async acceptKvkk(): Promise<CompanyStaff> {
    const res = await api.post<{ data: CompanyStaff }>('/auth/company-staff/me/accept-kvkk')
    return res.data.data
  },

  async acceptNotificationConsent(): Promise<CompanyStaff> {
    const res = await api.post<{ data: CompanyStaff }>('/auth/company-staff/me/accept-notification-consent')
    return res.data.data
  },
}

export default companyStaffAuthService
