import { api } from './api'
import type {
  CitizenLoginRequest,
  CitizenLoginChallenge,
  CitizenOtpChallenge,
  CitizenTokenPair,
  CitizenMeResponse,
  CitizenForgotPasswordRequest,
  CitizenForgotPasswordResponse,
  CitizenResetPasswordRequest,
  CitizenChangePasswordRequest,
  CitizenRequestContactChangeRequest,
  CitizenConfirmContactChangeRequest,
  CitizenRegisterRequest,
  NviLookupResult,
  CitizenSession,
  CitizenUser,
} from '@/types/auth.types'

const authService = {
  async login(data: CitizenLoginRequest): Promise<CitizenLoginChallenge> {
    const res = await api.post<{ data: CitizenLoginChallenge }>('/auth/citizen/login', data)
    return res.data.data
  },

  async verifyOtp(otpSessionToken: string, code: string, consent?: { kvkkAccepted: boolean; notificationConsentAccepted: boolean }): Promise<CitizenTokenPair> {
    const res = await api.post<{ data: CitizenTokenPair }>('/auth/citizen/verify-otp', { otpSessionToken, code, ...consent })
    return res.data.data
  },

  async resendOtp(otpSessionToken: string): Promise<CitizenOtpChallenge> {
    const res = await api.post<{ data: CitizenOtpChallenge }>('/auth/citizen/resend-otp', { otpSessionToken })
    return res.data.data
  },

  async refresh(refreshToken: string): Promise<CitizenTokenPair> {
    const res = await api.post<{ data: CitizenTokenPair }>('/auth/citizen/refresh', { refreshToken })
    return res.data.data
  },

  async me(): Promise<CitizenMeResponse> {
    const res = await api.get<{ data: CitizenMeResponse }>('/auth/citizen/me')
    return res.data.data
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post('/auth/citizen/logout', { refreshToken })
  },

  async changeInitialPassword(newPassword: string): Promise<CitizenTokenPair> {
    const res = await api.post<{ data: CitizenTokenPair }>('/auth/citizen/change-initial-password', { newPassword })
    return res.data.data
  },

  async forgotPassword(data: CitizenForgotPasswordRequest): Promise<CitizenForgotPasswordResponse> {
    const res = await api.post<{ data: CitizenForgotPasswordResponse }>('/auth/citizen/forgot-password', data)
    return res.data.data
  },

  async verifyResetOtp(identifier: string, otpCode: string): Promise<void> {
    await api.post('/auth/citizen/verify-reset-otp', { identifier, otpCode })
  },

  async resetPassword(data: CitizenResetPasswordRequest): Promise<void> {
    await api.post('/auth/citizen/reset-password', data)
  },

  async nviLookup(tckn: string, birthDate: string): Promise<NviLookupResult> {
    const res = await api.post<{ data: NviLookupResult }>('/auth/citizen/nvi-lookup', { tckn, birthDate })
    return res.data.data
  },

  async register(data: CitizenRegisterRequest): Promise<CitizenLoginChallenge> {
    const res = await api.post<{ data: CitizenLoginChallenge }>('/auth/citizen/register', data)
    return res.data.data
  },

  async changePassword(data: CitizenChangePasswordRequest): Promise<void> {
    await api.post('/auth/citizen/change-password', data)
  },

  async requestContactChange(data: CitizenRequestContactChangeRequest): Promise<CitizenOtpChallenge> {
    const res = await api.post<{ data: CitizenOtpChallenge }>('/auth/citizen/me/contact/request-change', data)
    return res.data.data
  },

  async confirmContactChange(data: CitizenConfirmContactChangeRequest): Promise<CitizenUser> {
    const res = await api.post<{ data: CitizenUser }>('/auth/citizen/me/contact/confirm-change', data)
    return res.data.data
  },

  async uploadPhoto(file: File): Promise<void> {
    const form = new FormData()
    form.append('file', file)
    await api.post('/auth/citizen/profile-photo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },

  async getSessions(): Promise<CitizenSession[]> {
    const res = await api.get<{ data: CitizenSession[] }>('/auth/citizen/sessions')
    return res.data.data
  },

  async revokeSession(sessionId: string): Promise<void> {
    await api.delete(`/auth/citizen/sessions/${sessionId}`)
  },

  async revokeAllSessions(): Promise<void> {
    const sessions = await authService.getSessions()
    const others = sessions.filter((s) => !s.isCurrent)
    await Promise.all(others.map((s) => api.delete(`/auth/citizen/sessions/${s.sessionId}`)))
  },

  async acceptKvkk(): Promise<CitizenUser> {
    const res = await api.post<{ data: CitizenUser }>('/auth/citizen/me/accept-kvkk')
    return res.data.data
  },

  async acceptNotificationConsent(): Promise<CitizenUser> {
    const res = await api.post<{ data: CitizenUser }>('/auth/citizen/me/accept-notification-consent')
    return res.data.data
  },
}

export default authService
