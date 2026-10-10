import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Label, Input, PasswordInput } from '@/design-system'
import { AuthLayout } from '@/framework/layout/AuthLayout'
import { AuthIcon2D } from '@/components/AuthIcon2D'
import companyAuthService from '@/services/companyAuth.service'
import companyStaffAuthService from '@/services/companyStaffAuth.service'
import { showApiErrorToast } from '@/services/api'
import { useCompanyStaffAuth } from '@/framework/companyStaffAuth/CompanyStaffAuthContext'
import { DEV_DEFAULT_COMPANY_PHONE, DEV_DEFAULT_COMPANY_PASSWORD } from '@/lib/devDefaults'

export const CompanyLoginPage = () => {
  const navigate = useNavigate()
  const { login: staffLogin } = useCompanyStaffAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const next: { identifier?: string; password?: string } = {}
    if (!identifier.trim()) next.identifier = 'Telefon numarası veya e-posta adresinizi giriniz.'
    if (!password) next.password = 'Şifrenizi giriniz.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setLoading(true)
    try {
      const result = await companyAuthService.login({ identifier: identifier.trim(), password }, true)
      navigate('/firma/login/otp', {
        state: {
          otpSessionToken: result.otpSessionToken,
          otpChannel: result.otpChannel,
          maskedTarget: result.maskedTarget,
          resendCooldownSeconds: result.resendCooldownSeconds,
        },
      })
    } catch (ownerErr) {
      const isInvalidCredentials = (ownerErr as { response?: { data?: { errorCode?: string } } })?.response?.data?.errorCode === 'INVALID_CREDENTIALS'
      const looksLikePhone = !identifier.includes('@')
      if (isInvalidCredentials && looksLikePhone) {
        try {
          const staffResult = await companyStaffAuthService.login({ phone: identifier.trim(), password }, true)
          staffLogin(staffResult)
          navigate('/firma/personel/kullandir', { replace: true })
          return
        } catch {
        }
      }
      showApiErrorToast(ownerErr)
      setLoading(false)
    }
  }

  return (
    <AuthLayout variant="company"
      title="Firma Girişi"
      subtitle="Firma telefon numaranız veya e-postanız ve şifrenizle giriş yapın"
      footer={
        <div className="auth-footer-row">
          <span>Firmanız kayıtlı değil mi?</span>
          <Link to="/firma/register">Kayıt olun</Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label required>Telefon veya E-posta</Label>
          <Input
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); setErrors((p) => ({ ...p, identifier: undefined })) }}
            iconLeft={<AuthIcon2D kind="user" className="h-4 w-4" />}
            placeholder="Telefon numarası veya e-posta adresiniz"
            error={errors.identifier}
          />
        </div>
        <div className="space-y-1.5">
          <Label required>Şifre</Label>
          <PasswordInput
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })) }}
            iconLeft={<AuthIcon2D kind="lock" className="h-4 w-4" />}
            placeholder="Şifreniz"
            error={errors.password}
          />
          <div className="text-right">
            <Link to="/firma/forgot-password" className="type-link-sm">Şifremi unuttum</Link>
          </div>
        </div>
        <Button type="submit" variant="primary" size="lg" isLoading={loading} className="w-full">Giriş Yap</Button>
        {import.meta.env.DEV && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => { setIdentifier(DEV_DEFAULT_COMPANY_PHONE); setPassword(DEV_DEFAULT_COMPANY_PASSWORD); setErrors({}) }}
          >
            Test bilgileriyle doldur
          </Button>
        )}
      </form>
    </AuthLayout>
  )
}
