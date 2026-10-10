import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import smsSendService from '@/services/smsSend.service'

const OTP_LENGTH = 6

// Kullanıcı isteği (2026-09-19, güncelleme 2026-09-20 iki kez): SMS gönderimlerinde artık
// İLK gönderimden itibaren her seferinde zorunlu doğrulama isteniyor. PIN yöntemi kullanıcı
// isteğiyle tamamen kaldırıldı: "pin şifresini kaldırabilirsin sadece sms doğrulaması ile
// gönderilsin" — artık TEK yol, kullanıcının kendi telefonuna gönderilecek tek kullanımlık
// SMS doğrulama kodu (OTP). Bu hook her "Mesaj Gönder" modalında aynı davranışı (OTP
// isteme/geri sayım, hata kodu eşleme) tekrar yazmamak için ortak tutulur.
export function useSmsVerification() {
  const [otp, setOtp] = useState('')
  const [otpRequested, setOtpRequested] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [maskedPhone, setMaskedPhone] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  const requestOtp = async () => {
    setOtpSending(true)
    setError('')
    try {
      const result = await smsSendService.requestOtp()
      setMaskedPhone(result.maskedPhone)
      setCooldown(result.resendCooldownSeconds)
      setOtpRequested(true)
      setOtp('')
      toast.success(`Doğrulama kodu ${result.maskedPhone} numarasına gönderildi.`)
    } catch (err) {
      const code = axios.isAxiosError(err) ? err.response?.data?.errorCode : undefined
      const message = axios.isAxiosError(err) ? err.response?.data?.message : undefined
      if (code === 'SMS_OTP_NO_PHONE') setError(message ?? 'Hesabınızda kayıtlı telefon numarası yok.')
      else if (code !== 'OTP_RESEND_COOLDOWN') setError(message ?? 'Doğrulama kodu gönderilemedi.')
    } finally {
      setOtpSending(false)
    }
  }

  const reset = useCallback(() => {
    setOtp('')
    setOtpRequested(false)
    setMaskedPhone('')
    setCooldown(0)
    setError('')
  }, [])

  /** Başarılı gönderim sonrası OTP'yi bellekte tutmamak için temizler. */
  const consume = useCallback(() => {
    setOtp('')
    setOtpRequested(false)
    setError('')
  }, [])

  const payload = (): { smsOtp?: string } => ({ smsOtp: otp.trim() || undefined })

  const isReady = otp.trim().length === OTP_LENGTH

  /** Gönderim isteğinden dönen hatayı yorumlar; kendi ilgili hatasıysa true döner (ve mesajı gösterir). */
  const handleSendError = (err: unknown): boolean => {
    if (!axios.isAxiosError(err)) return false
    const code: string | undefined = err.response?.data?.errorCode
    const message: string | undefined = err.response?.data?.message
    switch (code) {
      case 'SMS_VERIFICATION_REQUIRED':
        setError(message ?? 'SMS göndermek için doğrulama kodu isteyin ve girin.')
        return true
      case 'OTP_MISMATCH':
        setError('Doğrulama kodu hatalı.')
        return true
      case 'OTP_EXPIRED':
        setError('Doğrulama kodunun süresi doldu. Yeni kod isteyin.')
        setOtpRequested(false)
        setOtp('')
        return true
      case 'OTP_TOO_MANY_ATTEMPTS':
        setError('Çok fazla hatalı deneme yapıldı. Yeni kod isteyin.')
        setOtpRequested(false)
        setOtp('')
        return true
      case 'OTP_LOCKED_OUT':
        setError(message ?? 'Çok fazla hatalı deneme yapıldı. Bir süre sonra tekrar deneyin.')
        return true
      default:
        return false
    }
  }

  return {
    otp, setOtp,
    otpRequested, otpSending, maskedPhone, cooldown,
    error, setError,
    requestOtp, reset, consume, payload, isReady, handleSendError,
  }
}

export type SmsVerificationState = ReturnType<typeof useSmsVerification>
