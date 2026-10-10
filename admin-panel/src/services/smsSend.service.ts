import { api } from './api'

export interface SmsSendOtpRequestResult {
  maskedPhone: string
  resendCooldownSeconds: number
}

// Kullanıcı isteği (2026-09-20): manuel SMS gönderiminde PIN'e alternatif olarak,
// admin kendi telefonuna gönderilecek tek kullanımlık bir SMS doğrulama kodu (OTP)
// isteyebilir. Bkz. backend SmsSendEndpoints.RequestOtp / OtpPurpose.SmsSendConfirmation.
export const smsSendService = {
  async requestOtp(): Promise<SmsSendOtpRequestResult> {
    const res = await api.post<{ data: SmsSendOtpRequestResult }>('/sms-send/request-otp')
    return res.data.data
  },
}

export default smsSendService
