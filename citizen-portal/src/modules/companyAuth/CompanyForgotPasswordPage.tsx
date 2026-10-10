import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Label, Input, PasswordInput } from '@/design-system'
import { OTPInput } from '@/components/specialized/OTPInput'
import { AuthLayout } from '@/framework/layout/AuthLayout'
import companyAuthService from '@/services/companyAuth.service'
import { isStrongPassword, PASSWORD_RULE_TEXT } from '@/lib/password'
import { cn } from '@/lib/utils'

type Step = 'identifier' | 'otp' | 'password'

const STEP_INDEX: Record<Step, number> = { identifier: 0, otp: 1, password: 2 }

export const CompanyForgotPasswordPage = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('identifier')
  const [identifier, setIdentifier] = useState('')
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

  const submitIdentifier = async (e: FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) { setErrors({ identifier: 'Telefon numarası veya e-posta adresinizi giriniz.' }); return }
    setErrors({})
    setLoading(true)
    try {
      const res = await companyAuthService.forgotPassword({ identifier: identifier.trim() })
      setMasked(res.maskedTarget)
      setCooldown(res.resendCooldownSeconds)
      setStep('otp')
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (cooldown > 0 || resending) return
    setResending(true)
    try {
      const res = await companyAuthService.forgotPassword({ identifier: identifier.trim() })
      setMasked(res.maskedTarget)
      setCooldown(res.resendCooldownSeconds)
      setOtp('')
      setErrors({})
      toast.success('Yeni doğrulama kodu gönderildi.')
    } finally {
      setResending(false)
    }
  }

  const submitOtp = (e: FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) { setErrors({ otp: 'Doğrulama kodu 6 hanelidir.' }); return }
    setErrors({})
    setStep('password')
  }

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault()
    const next: { pw?: string; confirm?: string } = {}
    if (!isStrongPassword(pw)) next.pw = PASSWORD_RULE_TEXT
    if (confirm !== pw) next.confirm = 'Şifreler eşleşmiyor.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setLoading(true)
    try {
      await companyAuthService.resetPassword({ identifier: identifier.trim(), otpCode: otp, newPassword: pw })
      toast.success('Şifreniz güncellendi. Giriş yapabilirsiniz.')
      navigate('/firma/login', { replace: true })
    } catch {
      setStep('otp')
      setErrors({ otp: 'Doğrulama kodu hatalı veya süresi dolmuş.' })
      setLoading(false)
    }
  }

  return (
    <AuthLayout hideTabs variant="company"
      title="Şifremi Unuttum"
      subtitle={
        step === 'identifier'
          ? 'Kayıtlı telefon numaranıza veya e-postanıza doğrulama kodu gönderelim'
          : step === 'otp'
            ? `${masked} adresine gönderilen 6 haneli kodu girin`
            : 'Yeni şifrenizi belirleyin'
      }
      footer={<Link to="/firma/login" className="type-link-sm">Giriş ekranına dön</Link>}
    >
      <div className="mb-5 flex items-center justify-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 rounded-pill transition-all',
              i === STEP_INDEX[step] ? 'w-6 bg-primary' : i < STEP_INDEX[step] ? 'w-4 bg-primary' : 'w-4 bg-surface-2',
            )}
          />
        ))}
      </div>

      {step === 'identifier' && (
        <form onSubmit={submitIdentifier} className="space-y-4">
          <div className="space-y-1.5">
            <Label required>Telefon veya E-posta</Label>
            <Input value={identifier} onChange={(e) => { setIdentifier(e.target.value); setErrors({}) }} placeholder="Telefon numarası veya e-posta adresiniz" error={errors.identifier} />
          </div>
          <Button type="submit" variant="primary" size="lg" isLoading={loading} className="w-full">Kod Gönder</Button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={submitOtp} className="space-y-4">
          <div className="text-center space-y-1">
            <p className="type-body-strong text-foreground-strong">Doğrulama kodu gönderildi</p>
            <p className="type-caption text-foreground-muted">
              {masked ? `${masked} adresine/numarasına` : 'Kayıtlı telefon veya e-postanıza'} 6 haneli bir doğrulama kodu gönderdik. Kod birkaç saniye içinde ulaşır; gelen kodu aşağıya girin.
            </p>
          </div>
          <OTPInput value={otp} onChange={setOtp} error={errors.otp} />
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={otp.length !== 6}>Devam Et</Button>
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
          <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => { setStep('identifier'); setOtp(''); setCooldown(0) }}>
            Farklı telefon veya e-posta kullan
          </Button>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={submitPassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label required>Yeni Şifre</Label>
            <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Yeni şifre" error={errors.pw} />
          </div>
          <div className="space-y-1.5">
            <Label required>Yeni Şifre (Tekrar)</Label>
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Yeni şifre tekrar" error={errors.confirm} />
          </div>
          <Button type="submit" variant="primary" size="lg" isLoading={loading} className="w-full">Şifreyi Güncelle</Button>
        </form>
      )}
    </AuthLayout>
  )
}
