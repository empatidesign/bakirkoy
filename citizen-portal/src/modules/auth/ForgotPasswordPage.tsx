import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LockIcon, UserIcon, ArrowLeftIcon, ShieldCheckIcon, CalendarIcon } from 'lucide-react'
import { Button, Label, Input, PasswordInput, DatePicker } from '@/design-system'
import { OTPInput } from '@/components/specialized/OTPInput'
import { AuthLayout } from '@/framework/layout/AuthLayout'
import authService from '@/services/auth.service'
import { isStrongPassword, PASSWORD_RULE_TEXT } from '@/lib/password'
import { cn, todayIso } from '@/lib/utils'

type Step = 'identity' | 'otp' | 'password'

const STEP_INDEX: Record<Step, number> = { identity: 0, otp: 1, password: 2 }

export const ForgotPasswordPage = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('identity')
  const [identifier, setIdentifier] = useState('')
  // Telefonsuz kayıt (BIRTHDATE_REQUIRED): doğum tarihiyle NVİ doğrulanıp kayıt akışına alınır.
  const [needBirthDate, setNeedBirthDate] = useState(false)
  const [birthDate, setBirthDate] = useState('')
  const [otp, setOtp] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [masked, setMasked] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [errors, setErrors] = useState<{ identifier?: string; otp?: string; pw?: string; confirm?: string }>({})
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (step !== 'otp') return
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [step])

  const submitIdentity = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!identifier.trim()) { setErrors({ identifier: 'Telefon numarası veya T.C. kimlik numarası giriniz.' }); return }
    if (needBirthDate && !birthDate) { setErrors({ identifier: 'Doğum tarihinizi giriniz.' }); return }
    setErrors({})
    setLoading(true)
    try {
      const res = await authService.forgotPassword({ identifier: identifier.trim(), birthDate: needBirthDate ? birthDate : undefined })
      if (res.registrationRequired && res.registration) {
        toast.info('Hesabınızda telefon kaydı yok. Telefonunuzu ve şifrenizi belirleyerek kaydınızı tamamlayın.')
        navigate('/register', {
          state: { tckn: identifier.replace(/\D/g, ''), birthDate, nvi: res.registration },
        })
        return
      }
      setMasked(res.maskedTarget)
      setCooldown(res.resendCooldownSeconds)
      setStep('otp')
    } catch (err) {
      const code = (err as { response?: { data?: { errorCode?: string } } })?.response?.data?.errorCode
      if (code === 'BIRTHDATE_REQUIRED') setNeedBirthDate(true)
      setErrors({})
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (cooldown > 0 || resending) return
    setResending(true)
    try {
      const res = await authService.forgotPassword({ identifier: identifier.trim() })
      setMasked(res.maskedTarget)
      setCooldown(res.resendCooldownSeconds)
      setOtp('')
      setErrors({})
      toast.success('Yeni doğrulama kodu gönderildi.')
    } catch {
      setErrors({})
    } finally {
      setResending(false)
    }
  }

  const submitOtp = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (otp.length !== 6) { setErrors({ otp: 'Doğrulama kodu 6 hanelidir.' }); return }
    setErrors({})
    setLoading(true)
    try {
      // F03: parola ekranına geçmeden önce OTP gerçekten doğrulanır (yalnız 6 hane kontrolü değil).
      await authService.verifyResetOtp(identifier.trim(), otp)
      setStep('password')
    } catch {
      setErrors({ otp: 'Doğrulama kodu hatalı veya süresi dolmuş.' })
    } finally {
      setLoading(false)
    }
  }

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    const next: { pw?: string; confirm?: string } = {}
    if (!isStrongPassword(pw)) next.pw = PASSWORD_RULE_TEXT
    if (confirm !== pw) next.confirm = 'Şifreler eşleşmiyor.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setLoading(true)
    try {
      await authService.resetPassword({ identifier: identifier.trim(), otpCode: otp, newPassword: pw })
      toast.success('Şifreniz güncellendi. Giriş yapabilirsiniz.')
      navigate('/login', { replace: true })
    } catch (err) {
      // F19: her hatayı OTP adımına düşürme — şifre-politikası/aynı-şifre hatası bu adımda kalır.
      const code = (err as { response?: { data?: { errorCode?: string } } })?.response?.data?.errorCode
      if (code === 'SAME_AS_CURRENT_PASSWORD' || code === 'PASSWORD_POLICY_FAILED' || code === 'VALIDATION_ERROR') {
        setErrors({ pw: 'Şifre geçersiz veya mevcut şifrenizle aynı. Farklı bir şifre deneyin.' })
      } else {
        setStep('otp')
        setErrors({ otp: 'Doğrulama kodunun süresi dolmuş olabilir. Lütfen tekrar deneyin.' })
      }
      setLoading(false)
    }
  }

  return (
    <AuthLayout hideTabs
      title="Şifremi Unuttum"
      subtitle={
        step === 'identity'
          ? 'Hesabınızı doğrulamak için bilgilerinizi girin.'
          : step === 'otp'
            ? `${masked} numarasına gönderilen kodu girin.`
            : 'Yeni şifrenizi belirleyin.'
      }
      footer={<Link to="/login" className="text-sm font-semibold text-primary hover:underline flex items-center gap-2"><ArrowLeftIcon className="h-4 w-4" /> Giriş ekranına dön</Link>}
    >
      <div className="mb-8 flex items-center justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === STEP_INDEX[step] ? 'w-10 bg-primary' : i < STEP_INDEX[step] ? 'w-4 bg-primary/60' : 'w-4 bg-surface-2 border border-border',
            )}
          />
        ))}
      </div>

      {step === 'identity' && (
        <form onSubmit={submitIdentity} className="space-y-6">
          <div className="space-y-2">
            <Label required className="text-sm font-bold flex items-center gap-2">
               <UserIcon className="h-4 w-4 text-foreground-subtle" />
               Telefon veya T.C. Kimlik No
            </Label>
            <Input
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setErrors({}); setNeedBirthDate(false) }}
              placeholder="05XX / T.C. Kimlik"
              error={errors.identifier}
              className="h-12 text-base"
              autoFocus
            />
          </div>
          {needBirthDate && (
            <div className="space-y-2">
              <Label required className="text-sm font-bold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-foreground-subtle" />
                Doğum Tarihi
              </Label>
              <DatePicker value={birthDate} max={todayIso()} onChange={setBirthDate} className="h-12 text-base" />
              <p className="type-caption text-foreground-muted">
                Hesabınızda kayıtlı telefon olmadığı için kimliğinizi doğum tarihinizle doğruluyoruz. Kaydınız silinmez, yeni telefon ve şifrenizle etkinleştirilir.
              </p>
            </div>
          )}
          <Button type="submit" variant="primary" size="lg" isLoading={loading} className="h-14 w-full text-base font-bold shadow-lg shadow-primary/20">{needBirthDate ? 'Devam Et' : 'Kod Gönder'}</Button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={submitOtp} className="space-y-8">
          <div className="flex justify-center">
             <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-primary border border-blue-100">
                <ShieldCheckIcon className="h-8 w-8" />
             </div>
          </div>
          <div className="text-center space-y-1">
             <p className="type-body-strong text-foreground-strong">Doğrulama kodu gönderildi</p>
             <p className="type-caption text-foreground-muted">
                Bilgileriniz uygun bir hesapla eşleşiyorsa {masked ? `${masked} numaralı iletişim adresinize` : 'kayıtlı iletişim kanalınıza'} 6 haneli bir doğrulama kodu gönderilir. Gelen kodu aşağıya girin.
             </p>
          </div>
          <OTPInput value={otp} onChange={setOtp} error={errors.otp} />
          <div className="space-y-3">
             <Button type="submit" variant="primary" size="lg" className="h-14 w-full text-base font-bold shadow-lg shadow-primary/20" disabled={otp.length !== 6}>Devam Et</Button>
             <div className="flex flex-col items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-sm font-bold text-primary"
                  disabled={cooldown > 0 || resending}
                  isLoading={resending}
                  onClick={resend}
                >
                  {cooldown > 0 ? `Kodu tekrar gönder (${cooldown} sn)` : 'Kodu tekrar gönder'}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="text-xs text-foreground-muted" onClick={() => { setStep('identity'); setOtp(''); setCooldown(0) }}>
                  Farklı bilgi kullan
                </Button>
             </div>
          </div>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={submitPassword} className="space-y-6">
          <div className="space-y-2">
            <Label required className="text-sm font-bold flex items-center gap-2">
               <LockIcon className="h-4 w-4 text-foreground-subtle" />
               Yeni Şifre
            </Label>
            <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Yeni şifre" error={errors.pw} className="h-12 text-base" />
          </div>
          <div className="space-y-2">
            <Label required className="text-sm font-bold flex items-center gap-2">
               <LockIcon className="h-4 w-4 text-foreground-subtle" />
               Yeni Şifre (Tekrar)
            </Label>
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Şifre tekrar" error={errors.confirm} className="h-12 text-base" />
          </div>
          <Button type="submit" variant="primary" size="lg" isLoading={loading} className="h-14 w-full text-base font-bold shadow-lg shadow-primary/20">Şifreyi Güncelle</Button>
        </form>
      )}
    </AuthLayout>
  )
}
