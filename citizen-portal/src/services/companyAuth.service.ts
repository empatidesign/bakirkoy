import type { AxiosRequestConfig } from 'axios'
import { api } from './api'
import type {
  CompanyLoginRequest,
  CompanyLoginChallenge,
  CompanyOtpChallenge,
  CompanyTokenPair,
  CompanyRegisterRequest,
  CompanyRegisterResult,
  CompanyForgotPasswordRequest,
  CompanyForgotPasswordResponse,
  CompanyResetPasswordRequest,
  CompanyChangePasswordRequest,
  CompanyUser,
} from '@/types/companyAuth.types'
import type { ServiceCategoryRef } from '@/types/serviceCategory.types'

const companyAuthService = {
  async getServiceCategories(): Promise<ServiceCategoryRef[]> {
    const res = await api.get<{ data: ServiceCategoryRef[] }>('/auth/company/service-categories')
    return res.data.data
  },

  async register(data: CompanyRegisterRequest): Promise<CompanyRegisterResult> {
    const res = await api.post<{ data: CompanyRegisterResult }>('/auth/company/register', data)
    return res.data.data
  },

  async login(data: CompanyLoginRequest, silent = false): Promise<CompanyLoginChallenge> {
    const config: (AxiosRequestConfig & { _silent?: boolean }) | undefined = silent ? { _silent: true } : undefined
    const res = await api.post<{ data: CompanyLoginChallenge }>('/auth/company/login', data, config)
    return res.data.data
  },

  async verifyOtp(otpSessionToken: string, code: string): Promise<CompanyTokenPair> {
    const res = await api.post<{ data: CompanyTokenPair }>('/auth/company/verify-otp', { otpSessionToken, code })
    return res.data.data
  },

  async resendOtp(otpSessionToken: string): Promise<CompanyOtpChallenge> {
    const res = await api.post<{ data: CompanyOtpChallenge }>('/auth/company/resend-otp', { otpSessionToken })
    return res.data.data
  },

  async changeInitial(newPassword: string): Promise<void> {
    await api.post('/auth/company/change-initial', { newPassword })
  },

  async changePassword(data: CompanyChangePasswordRequest): Promise<void> {
    await api.post('/auth/company/change-password', data)
  },

  async refresh(refreshToken: string): Promise<CompanyTokenPair> {
    const res = await api.post<{ data: CompanyTokenPair }>('/auth/company/refresh', { refreshToken })
    return res.data.data
  },

  async me(): Promise<CompanyUser> {
    const res = await api.get<{ data: CompanyUser }>('/auth/company/me')
    return res.data.data
  },

  async logout(): Promise<void> {
    await api.post('/auth/company/logout', {})
  },

  async forgotPassword(data: CompanyForgotPasswordRequest): Promise<CompanyForgotPasswordResponse> {
    const res = await api.post<{ data: CompanyForgotPasswordResponse }>('/auth/company/forgot-password', data)
    return res.data.data
  },

  async resetPassword(data: CompanyResetPasswordRequest): Promise<void> {
    await api.post('/auth/company/reset-password', data)
  },

  async exchangeBypassCode(code: string): Promise<CompanyTokenPair> {
    const res = await api.post<{ data: CompanyTokenPair }>('/auth/company/exchange-bypass-code', { code })
    return res.data.data
  },

  async acceptKvkk(): Promise<CompanyUser> {
    const res = await api.post<{ data: CompanyUser }>('/auth/company/me/accept-kvkk')
    return res.data.data
  },

  async acceptNotificationConsent(): Promise<CompanyUser> {
    const res = await api.post<{ data: CompanyUser }>('/auth/company/me/accept-notification-consent')
    return res.data.data
  },
}

export default companyAuthService
