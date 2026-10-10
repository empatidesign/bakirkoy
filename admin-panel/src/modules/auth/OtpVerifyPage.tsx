import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/design-system/Button'
import { OTPInput } from '@/components/specialized/OTPInput'
import { useAuth } from '@/framework/auth/AuthContext'
import authService from '@/services/auth.service'
import { toast } from 'sonner'

interface LocationState {
  otpSessionToken: string
  otpChannel: string
  email: string
  hasActiveSessions: boolean
  resendCooldownSeconds?: number
}

const DEFAULT_RESEND_SECONDS = 60

export const OtpVerifyPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const state = location.state as LocationState | null

  const [sessionToken, setSessionToken] = useState(state?.otpSessionToken ?? '')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(state?.resendCooldownSeconds ?? DEFAULT_RESEND_SECONDS)

  useEffect(() => {
    if (!state?.otpSessionToken) {
      navigate('/login', { replace: true })
    }
  }, [state, navigate])

  useEffect(() => {
    if (countdown <= 0) return
    const id = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(id)
  }, [countdown])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) {
      setError('6 haneli kodu eksiksiz girin.')
      return
    }

    if (!state) return

    setError('')
    setIsLoading(true)
    try {
      const result = await authService.verifyOtp({
        otpSessionToken: sessionToken,
        code,
      })
      login(result.user, result.accessToken, result.refreshToken, result.sessionConfig)
      navigate('/', { replace: true })
    } catch {
      setError('Kod hatalı veya süresi dolmuş.')
      setCode('')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0 || isResending || !sessionToken) return
    setIsResending(true)
    try {
      const result = await authService.resendOtp({ otpSessionToken: sessionToken })
      setSessionToken(result.otpSessionToken)
      setCode('')
      setError('')
      setCountdown(result.resendCooldownSeconds)
      toast.success('Yeni doğrulama kodu gönderildi.')
    } finally {
      setIsResending(false)
    }
  }

  const channelLabel = state?.otpChannel === 'sms' ? 'telefon numaranıza' : 'e-posta adresinize'

  return (
    <div className="min-h-screen bg-[hsl(var(--surface-1))] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-3">

        {state?.hasActiveSessions && (
          <div className="flex items-start gap-3 rounded-xl border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning-soft))] px-4 py-3.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--warning))]" />
            <div>
              <p className="text-sm font-medium text-[hsl(var(--warning))]">
                Hesabınız başka bir oturumda açık
              </p>
              <p className="mt-0.5 text-xs text-[hsl(var(--foreground-muted))]">
                Doğrulamayı tamamlarsanız diğer tüm aktif oturumlar otomatik kapatılacaktır.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-panel bg-[hsl(var(--surface-0))] p-10 shadow-pop">

          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-panel bg-[hsl(var(--primary-soft))]">
                <ShieldCheck className="h-8 w-8 text-[hsl(var(--primary))]" />
              </div>
            </div>
            <h1 className="type-heading-sm">Kimlik Doğrulama</h1>
            <p className="mt-1.5 type-desc">
              {state?.email && (
                <>
                  <span className="font-medium" style={{ color: 'hsl(var(--foreground-default))' }}>{state.email}</span>
                  {' '}hesabı için{' '}
                </>
              )}
              {channelLabel} gönderilen 6 haneli kodu girin
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center">
              <OTPInput
                value={code}
                onChange={setCode}
                length={6}
                disabled={isLoading}
                error={error}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={isLoading}
              disabled={code.length !== 6}
            >
              {!isLoading && (state?.hasActiveSessions ? 'Doğrula ve Diğer Oturumları Kapat' : 'Doğrula')}
            </Button>

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">← Geri dön</Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={handleResend}
                disabled={countdown > 0 || isResending}
                iconLeft={<RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />}
              >
                {isResending
                  ? 'Gönderiliyor...'
                  : countdown > 0
                    ? `Tekrar gönder (${countdown}s)`
                    : 'Tekrar gönder'}
              </Button>
            </div>
          </form>

        </div>
      </div>
    </div>
  )
}
