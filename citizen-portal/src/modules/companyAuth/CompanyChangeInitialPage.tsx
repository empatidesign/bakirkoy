import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheckIcon } from 'lucide-react'
import { Button, Label, PasswordInput } from '@/design-system'
import { AuthLayout } from '@/framework/layout/AuthLayout'
import { useCompanyAuth } from '@/framework/companyAuth/CompanyAuthContext'
import companyAuthService from '@/services/companyAuth.service'
import { isStrongPassword, PASSWORD_RULE_TEXT } from '@/lib/password'

export const CompanyChangeInitialPage = () => {
  const navigate = useNavigate()
  const { refreshCompany } = useCompanyAuth()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ pw?: string; confirm?: string }>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const next: { pw?: string; confirm?: string } = {}
    if (!isStrongPassword(pw)) next.pw = PASSWORD_RULE_TEXT
    if (confirm !== pw) next.confirm = 'Şifreler eşleşmiyor.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setLoading(true)
    try {
      await companyAuthService.changeInitial(pw)
      await refreshCompany()
      navigate('/firma', { replace: true })
    } catch {
      setLoading(false)
    }
  }

  return (
    <AuthLayout variant="company" hideTabs title="Şifrenizi Belirleyin" subtitle="İlk giriş için güvenliğiniz adına yeni bir şifre belirleyin">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2.5 rounded-card bg-primary-soft p-3">
          <ShieldCheckIcon className="h-5 w-5 flex-shrink-0 text-primary" />
          <p className="type-caption">{PASSWORD_RULE_TEXT}</p>
        </div>
        <div className="space-y-1.5">
          <Label required>Yeni Şifre</Label>
          <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Yeni şifre" error={errors.pw} />
        </div>
        <div className="space-y-1.5">
          <Label required>Yeni Şifre (Tekrar)</Label>
          <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Yeni şifre tekrar" error={errors.confirm} />
        </div>
        <Button type="submit" variant="primary" size="lg" isLoading={loading} className="w-full">Şifreyi Belirle</Button>
      </form>
    </AuthLayout>
  )
}
