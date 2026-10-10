import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Input, PasswordInput, Button, CheckboxRow } from '@/design-system'
import { AuthLayout } from '@/framework/layout/AuthLayout'
import { AuthIcon2D } from '@/components/AuthIcon2D'
import authService from '@/services/auth.service'
import { showApiErrorToast } from '@/services/api'
import { tokenStorage } from '@/services/tokenStorage'
import { DEV_DEFAULT_TCKN, DEV_DEFAULT_PASSWORD } from '@/lib/devDefaults'


export const LoginPage = () => {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState(() => tokenStorage.getSavedEmail())
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(() => tokenStorage.isRemembered())
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    const next: { identifier?: string; password?: string } = {}
    if (!identifier.trim()) next.identifier = 'Telefon numarası veya T.C. kimlik numarası giriniz.'
    if (!password) next.password = 'Şifrenizi giriniz.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const trimmedIdentifier = identifier.trim()
    tokenStorage.setRemember(rememberMe)
    if (rememberMe) tokenStorage.setSavedEmail(trimmedIdentifier)
    else tokenStorage.clearSavedEmail()

    setLoading(true)
    try {
      const result = await authService.login({ identifier: trimmedIdentifier, password })
      navigate('/login/otp', {
        state: {
          otpSessionToken: result.otpSessionToken,
          otpChannel: result.otpChannel,
          maskedTarget: result.maskedTarget,
          resendCooldownSeconds: result.resendCooldownSeconds,
        },
      })
    } catch (err) {
      // SORUN (2026-09-23, kullanıcı bulgusu): burada hata sessizce yutuluyordu
      // (`catch { setLoading(false) }`). Backend'in gerçek sebebi (ör. 409
      // ACCOUNT_LOCKED "Hesabınız kilitlendi. 5 dakika sonra tekrar deneyin.",
      // ACCOUNT_PASSIVE, ACCOUNT_BLOCKED) kullanıcıya hiç ulaşmıyor, ekranda
      // yalnızca giriş başarısız gibi görünüyordu. Kullanıcı bunu "TC ve şifre
      // doğru olmasına rağmen giremiyorum" olarak yaşıyordu. Global interceptor
      // yalnızca 401'leri ele aldığı için 409'lar da sessiz kalıyordu.
      showApiErrorToast(err)
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Giriş Yap"
      subtitle="Telefon veya T.C. kimlik numaranız ve şifrenizle giriş yapın"
      footer={
        <div className="space-y-0">
          <p className="auth-footer-touch-row type-caption">Hesabınız yok mu? <Link to="/register" className="type-link-sm">Kayıt olun</Link></p>
          <p className="auth-footer-touch-row type-caption">Firma mısınız? <Link to="/firma/login" className="type-link-sm">Firma girişi</Link></p>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="auth-login-form space-y-4">
        <div className="space-y-1.5">
          <Input
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); setErrors((p) => ({ ...p, identifier: undefined })) }}
            iconLeft={<AuthIcon2D kind="user" className="h-4 w-4" />}
            placeholder="Telefon veya T.C. kimlik numaranız"
            error={errors.identifier}
          />
        </div>
        <div className="space-y-1.5">
          <PasswordInput
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })) }}
            iconLeft={<AuthIcon2D kind="lock" className="h-4 w-4" />}
            placeholder="Şifreniz"
            error={errors.password}
          />
        </div>
        <div className="auth-login-options flex items-center justify-between">
          <CheckboxRow variant="inline" className="min-h-11" label={<span style={{ textTransform: 'none' }}>Beni hatırla</span>} checked={rememberMe} onChange={setRememberMe} />
          <Link to="/forgot-password" className="inline-flex min-h-11 items-center type-link-sm">Şifremi unuttum</Link>
        </div>
        <Button type="submit" variant="primary" size="lg" isLoading={loading} className="w-full">Giriş Yap</Button>
        {import.meta.env.DEV && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 w-full"
            onClick={() => { setIdentifier(DEV_DEFAULT_TCKN); setPassword(DEV_DEFAULT_PASSWORD); setErrors({}) }}
          >
            Test bilgileriyle doldur
          </Button>
        )}
      </form>
    </AuthLayout>
  )
}
