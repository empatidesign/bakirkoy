import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheckIcon, SmartphoneIcon } from 'lucide-react'
import { Button } from '@/design-system'
import { OTPInput } from '@/components/specialized/OTPInput'
import { AuthLayout } from '@/framework/layout/AuthLayout'
import { useAuth } from '@/framework/auth/AuthContext'
import authService from '@/services/auth.service'
import { pendingQr } from '@/services/pendingQr'
import { pendingDeepLink } from '@/services/pendingDeepLink'
import surveyService from '@/services/survey.service'
import { loadOrInitDeadline, saveDeadline } from './otpCooldown'
import { secondsUntil } from '@/lib/countdown'

interface OtpState {
  otpSessionToken: string
  otpChannel: string
  maskedTarget: string
  resendCooldownSeconds: number
  kvkkChecked?: boolean
  notifChecked?: boolean
}

export const OtpVerifyPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, refreshUser } = useAuth()
  const state = location.state as OtpState | null

  const [otp, setOtp] = useState('')
  const [masked, setMasked] = useState(state?.maskedTarget ?? '')
  const resendEndRef = useRef<number | null>(null)
  if (resendEndRef.current === null) {
    resendEndRef.current = loadOrInitDeadline(state?.otpSessionToken ?? '', state?.resendCooldownSeconds ?? 0)
  }
  const [cooldown, setCooldown] = useState(() => secondsUntil(resendEndRef.current ?? Date.now()))
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const tick = () => setCooldown(secondsUntil(resendEndRef.current ?? Date.now()))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  if (!state?.otpSessionToken) return <Navigate to="/login" replace />
  const otpSessionToken = state.otpSessionToken

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    if (loading || success) return
    if (otp.length !== 6) { setError('Doğrulama kodu 6 hanelidir.'); return }
    setError(undefined)
    setLoading(true)
    try {
      const result = await authService.verifyOtp(otpSessionToken, otp, {
        kvkkAccepted: state?.kvkkChecked === true,
        notificationConsentAccepted: state?.notifChecked === true,
      })
      setSuccess(true)
      setTimeout(async () => {
        await login(result)
        if (state?.kvkkChecked || state?.notifChecked) await refreshUser()
        // Kullanıcı isteği (2026-09-03): "anket kullanıcısı sisteme girdiğinde hiçbir
        // vatandaşlık portalı girişine basmadan anket soru cevap ekranı(na) gelsin" —
        // saha görevlisi atanmış kullanıcı giriş sonrası ARA SEÇİM EKRANI GÖRMEDEN doğrudan
        // saha anket sistemine (/saha) yönlendirilir. (Önceden /mod-secimi seçim ekranı
        // çıkıyordu; artık anketör için tek tıkla iş başı.)
        const hasFieldAssignment = await surveyService.fieldAssignment().catch(() => false)
        if (hasFieldAssignment) {
          navigate('/saha', { replace: true })
          return
        }
        const pending = pendingQr.take()
        // Kullanıcı isteği (2026-08-02): dış sitelerden gelen /etkinlikler?eventId=<id>
        // derin bağlantısı, giriş öncesi App.tsx'te sessionStorage'a kaydedilmişse
        // (bkz. pendingDeepLink.ts) girişten sonra oraya dönülür.
        const pendingLink = pendingDeepLink.take()
        navigate(pending ? `/qr-giris/${pending}` : (pendingLink ?? '/'), { replace: true })
      }, 600)
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
      const res = await authService.resendOtp(otpSessionToken)
      setMasked(res.maskedTarget)
      resendEndRef.current = saveDeadline(otpSessionToken, res.resendCooldownSeconds)
      setCooldown(res.resendCooldownSeconds)
      setOtp('')
      setError(undefined)
    } catch {
      setError(undefined)
    } finally {
      setResending(false)
    }
  }

  const canSubmit = otp.length === 6 && !loading && !success

  return (
    <AuthLayout 
      hideTabs 
      title="Kodu Doğrula" 
      subtitle="Güvenliğiniz için gönderilen kodu girin."
      footer={<Link to="/login" className="text-sm font-bold text-blue-500 hover:text-blue-600 transition-colors">Giriş ekranına dön</Link>} 
      centerContent
    >
      <form onSubmit={verify} className="w-full space-y-10">
        <div className="flex justify-center">
          <div className="relative">
             <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
             <div className="relative flex h-24 w-24 items-center justify-center rounded-[32px] bg-white text-blue-600 shadow-xl border border-blue-50">
                <SmartphoneIcon className="h-10 w-10" />
                <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white shadow-lg border-4 border-white">
                   <ShieldCheckIcon className="h-4 w-4" />
                </div>
             </div>
          </div>
        </div>

        <div className="text-center space-y-2">
           <p className="text-base font-bold text-foreground-strong">
              <span className="text-blue-600 px-2 py-0.5 rounded-full bg-blue-50">{masked || '••••••••'}</span>
           </p>
           <p className="text-sm font-medium text-foreground-muted">numarasına 6 haneli kod gönderildi</p>
        </div>

        <div className="flex justify-center scale-110">
           <OTPInput value={otp} onChange={setOtp} error={error} />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="h-16 w-full rounded-full text-lg font-black bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98]"
          disabled={!canSubmit}
          isLoading={loading}
        >
          {success ? 'Doğrulandı' : 'Doğrula & Giriş Yap'}
        </Button>

        <div className="flex flex-col items-center gap-4">
          {cooldown > 0 ? (
            <div className="flex items-center gap-2 text-sm font-bold text-foreground-subtle">
               <div className="h-2 w-2 rounded-full bg-blue-400 animate-ping" />
               <span>Kodu tekrar gönder ({cooldown} sn)</span>
            </div>
          ) : (
            <button 
              type="button" 
              className="text-sm font-black text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-wide" 
              onClick={resend} 
              disabled={resending}
            >
              Kodu tekrar gönder
            </button>
          )}
        </div>

        {(import.meta.env.DEV || /^(localhost|127\.0\.0\.1|192\.168\.|10\.)/.test(window.location.hostname)) && (
          <button 
            type="button" 
            className="w-full border-2 border-dashed border-blue-200 bg-blue-50/50 text-xs font-bold text-blue-600 py-3 rounded-2xl hover:text-blue-700 hover:border-blue-300 transition-all flex items-center justify-center gap-1.5 shadow-sm" 
            onClick={() => setOtp('111111')}
          >
            <span>Test Doğrulama Kodu:</span> <strong className="underline">111111 (Doldur)</strong>
          </button>
        )}
      </form>
    </AuthLayout>
  )
}
