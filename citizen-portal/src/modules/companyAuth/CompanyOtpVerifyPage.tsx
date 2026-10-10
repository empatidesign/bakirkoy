import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/design-system'
import { OTPInput } from '@/components/specialized/OTPInput'
import { AuthLayout } from '@/framework/layout/AuthLayout'
import { useCompanyAuth } from '@/framework/companyAuth/CompanyAuthContext'
import companyAuthService from '@/services/companyAuth.service'

interface OtpState {
  otpSessionToken: string
  otpChannel: string
  maskedTarget: string
  resendCooldownSeconds: number
}

export const CompanyOtpVerifyPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useCompanyAuth()
  const state = location.state as OtpState | null

  const [otp, setOtp] = useState('')
  const [masked, setMasked] = useState(state?.maskedTarget ?? '')
  const [cooldown, setCooldown] = useState(state?.resendCooldownSeconds ?? 0)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [])

  if (!state?.otpSessionToken) return <Navigate to="/firma/login" replace />
  const otpSessionToken = state.otpSessionToken

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) { setError('Doğrulama kodu 6 hanelidir.'); return }
    setError(undefined)
    setLoading(true)
    try {
      const result = await companyAuthService.verifyOtp(otpSessionToken, otp)
      login(result)
      navigate(result.mustChangePassword ? '/firma/login/change-initial' : '/firma', { replace: true })
    } catch {
      setOtp('')
      setError('Doğrulama kodu hatalı veya süresi dolmuş.')
      setLoading(false)
    }
  }

  const resend = async () => {
    if (cooldown > 0 || resending) return
    setResending(true)
    try {
      const res = await companyAuthService.resendOtp(otpSessionToken)
      setMasked(res.maskedTarget)
      setCooldown(res.resendCooldownSeconds)
      setOtp('')
      setError(undefined)
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout hideTabs variant="company" centerContent
      title=""
      footer={<Link to="/firma/login" className="type-link-sm">Giriş ekranına dön</Link>}
    >
      <form onSubmit={verify} className="otp-form">
        <div className="otp-form__header">
          <h2 className="otp-form__title">Doğrulama</h2>
          <p className="otp-form__sub">{masked} adresine gönderilen 6 haneli kodu girin</p>
        </div>
        <OTPInput value={otp} onChange={setOtp} error={error} />
        <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={loading} disabled={otp.length !== 6}>Doğrula</Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          disabled={cooldown > 0 || resending}
          isLoading={resending}
          onClick={resend}
        >
          {cooldown > 0 ? `Kodu tekrar gönder (${cooldown}sn)` : 'Kodu tekrar gönder'}
        </Button>
        {import.meta.env.DEV && (
          <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setOtp('111111')}>
            Test kodu (111111)
          </Button>
        )}
      </form>
    </AuthLayout>
  )
}
