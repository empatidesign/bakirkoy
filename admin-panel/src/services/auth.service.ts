import { api } from './api'
import type {
  LoginRequest,
  LoginResponse,
  VerifyOtpRequest,
  ResendOtpRequest,
  ResendOtpResponse,
  TokenPair,
  RefreshRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  MeDto,
  SessionConfig,
} from '@/types/auth.types'

const authService = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const res = await api.post<{ data: LoginResponse }>('/auth/login', data)
    return res.data.data
  },

  async verifyOtp(data: VerifyOtpRequest): Promise<TokenPair> {
    const res = await api.post<{ data: TokenPair }>('/auth/verify-otp', data)
    return res.data.data
  },

  async resendOtp(data: ResendOtpRequest): Promise<ResendOtpResponse> {
    const res = await api.post<{ data: ResendOtpResponse }>('/auth/resend-otp', data)
    return res.data.data
  },

  async refresh(data: RefreshRequest): Promise<TokenPair> {
    const res = await api.post<{ data: TokenPair }>('/auth/refresh', data)
    return res.data.data
  },

  async me(): Promise<MeDto> {
    const res = await api.get<{ data: { me: MeDto; sessionConfig: unknown } }>('/auth/me')
    return res.data.data.me
  },

  async meWithSessionConfig(): Promise<{ me: MeDto; sessionConfig: SessionConfig }> {
    const res = await api.get<{ data: { me: MeDto; sessionConfig: SessionConfig } }>('/auth/me')
    return res.data.data
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post('/auth/logout', { refreshToken })
  },

  async forgotPassword(data: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    const res = await api.post<{ data: ForgotPasswordResponse }>('/auth/forgot-password', data)
    return res.data.data
  },

  async verifyResetOtp(identifier: string, otpCode: string): Promise<void> {
    await api.post('/auth/verify-reset-otp', { identifier, otpCode })
  },

  async resetPassword(identifier: string, otpCode: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', { identifier, otpCode, newPassword })
  },

  async changeInitialPassword(newPassword: string): Promise<void> {
    await api.post('/auth/change-initial-password', { newPassword })
  },

  async updateProfile(fullName: string, phone?: string): Promise<MeDto> {
    const res = await api.put<{ data: MeDto }>('/auth/profile', { fullName, phone: phone || null })
    return res.data.data
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword })
  },

  async generateBypassCode(id: string): Promise<{ code: string }> {
    const res = await api.post<{ data: { code: string } }>(`/auth/${id}/bypass-code`)
    return res.data.data
  },
}

export default authService
