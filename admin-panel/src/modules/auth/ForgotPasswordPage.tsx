import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AtSign, ArrowLeft, ShieldCheck, KeyRound, CheckCircle2 } from 'lucide-react'
import { Button } from '@/design-system/Button'
import { Input, PasswordInput, isValidEmail } from '@/design-system/Input'
import { Label } from '@/design-system/Label'
import { OTPInput } from '@/components/specialized/OTPInput'
import { isStrongPassword, PASSWORD_RULE_TEXT } from '@/lib/password'
import authService from '@/services/auth.service'

// F28 (2026-09-26): Yönetici "şifremi unuttum" akışı artık üç adımlı ve OTP ile sahiplik
// kanıtı ister — anonim istekle şifre DOĞRUDAN değiştirilmez. Adımlar: kimlik → OTP → yeni şifre.
const digitsOf = (value: string) => value.replace(/\D/g, '')
const looksLikeEmail = (value: string) => value.includes('@')
const isValidIdentifier = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (looksLikeEmail(trimmed)) return isValidEmail(trimmed)
  const digits = digitsOf(trimmed)
  return digits.length >= 10 && digits.length <= 15
}

type Step = 'identifier' | 'otp' | 'password' | 'done'

export const ForgotPasswordPage = () => {
  const [step, setStep] = useState<Step>('identifier')
  const [identifier, setIdentifier] = useState('')
  const [maskedTarget, setMaskedTarget] = useState('')
  const [channel, setChannel] = useState<'sms' | 'email'>('sms')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)

  const normalized = () => (looksLikeEmail(identifier) ? identifier.trim().toLowerCase() : identifier.trim())

  const submitIdentifier = async (e: FormEvent) => {
    e.preventDefault()
    if (!isValidIdentifier(identifier)) { setError('Geçerli bir e-posta adresi veya telefon numarası girin.'); return }
    setError(undefined); setIsLoading(true)
    try {
      const res = await authService.forgotPassword({ identifier: normalized() })
      setMaskedTarget(res.maskedTarget ?? '')
      setChannel(res.channel)
      setOtp('')
      setStep('otp')
    } finally { setIsLoading(false) }
  }

  const submitOtp = async (e: FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) { setError('6 haneli doğrulama kodunu girin.'); return }
    setError(undefined); setIsLoading(true)
    try {
      await authService.verifyResetOtp(normalized(), otp)
      setStep('password')
    } catch {
      setError('Doğrulama kodu geçersiz veya süresi dolmuş.')
    } finally { setIsLoading(false) }
  }

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!isStrongPassword(password)) { setError(PASSWORD_RULE_TEXT); return }
    if (confirm !== password) { setError('Şifreler eşleşmiyor.'); return }
    setError(undefined); setIsLoading(true)
    try {
      await authService.resetPassword(normalized(), otp, password)
      setStep('done')
    } catch {
      setError('Şifre belirlenemedi. Kodun süresi dolmuş olabilir; işlemi baştan başlatın.')
    } finally { setIsLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--surface-1))] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-panel bg-[hsl(var(--surface-0))] p-8 shadow-pop">

          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 type-desc hover:text-[hsl(var(--foreground-default))] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Girişe dön
          </Link>

          <div className="mt-8 mb-7 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-panel bg-[hsl(var(--primary-soft))]">
                {step === 'identifier' && <AtSign className="h-7 w-7 text-[hsl(var(--primary))]" />}
                {step === 'otp' && <KeyRound className="h-7 w-7 text-[hsl(var(--primary))]" />}
                {step === 'password' && <ShieldCheck className="h-7 w-7 text-[hsl(var(--primary))]" />}
                {step === 'done' && <CheckCircle2 className="h-7 w-7 text-[hsl(var(--success))]" />}
              </div>
            </div>
            <h1 className="type-heading-sm">
              {step === 'identifier' && 'Şifre Sıfırlama'}
              {step === 'otp' && 'Doğrulama Kodu'}
              {step === 'password' && 'Yeni Şifre'}
              {step === 'done' && 'Şifreniz Güncellendi'}
            </h1>
            <p className="mx-auto mt-2 max-w-xs type-desc">
              {step === 'identifier' && 'Kayıtlı e-posta adresinizi veya telefon numaranızı girin. Bilgileriniz uygun bir hesapla eşleşiyorsa kayıtlı iletişim kanalınıza doğrulama kodu gönderilir.'}
              {step === 'otp' && <>Kodu {channel === 'sms' ? 'SMS ile' : 'e-posta ile'}{maskedTarget ? <> <span className="font-medium" style={{ color: 'hsl(var(--foreground-default))' }}>{maskedTarget}</span> adresine</> : null} gönderdik. 6 haneli kodu girin.</>}
              {step === 'password' && 'Yeni şifrenizi belirleyin.'}
              {step === 'done' && 'Yeni şifrenizle giriş yapabilirsiniz.'}
            </p>
          </div>

          {step === 'identifier' && (
            <form onSubmit={submitIdentifier} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="identifier" required>E-posta veya Telefon</Label>
                <Input
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  error={error}
                  placeholder="ornek@belediye.gov.tr veya 05XX XXX XX XX"
                  iconLeft={<AtSign className="h-3.5 w-3.5" />}
                  autoFocus
                />
              </div>
              <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
                {!isLoading && 'Doğrulama Kodu Gönder'}
              </Button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={submitOtp} className="space-y-6" noValidate>
              <div className="flex justify-center">
                <OTPInput value={otp} onChange={setOtp} length={6} disabled={isLoading} error={error} />
              </div>
              <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
                {!isLoading && 'Kodu Doğrula'}
              </Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => { setStep('identifier'); setError(undefined) }}>
                Farklı e-posta veya telefon kullan
              </Button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={submitPassword} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="new-password" required>Yeni Şifre</Label>
                <PasswordInput
                  id="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="En az 8 karakter, bir büyük harf ve bir rakam"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" required>Yeni Şifre (Tekrar)</Label>
                <PasswordInput
                  id="confirm-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  error={error}
                  placeholder="Yeni şifrenizi tekrar girin"
                />
              </div>
              <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
                {!isLoading && 'Şifreyi Belirle'}
              </Button>
            </form>
          )}

          {step === 'done' && (
            <Button variant="primary" size="lg" className="w-full" onClick={() => { window.location.href = `${import.meta.env.BASE_URL}login` }}>
              Giriş Yap
            </Button>
          )}

        </div>
      </div>
    </div>
  )
}
