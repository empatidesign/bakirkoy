import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Label, Input, PasswordInput } from '@/design-system'
import { AuthLayout } from '@/framework/layout/AuthLayout'
import { AuthIcon2D } from '@/components/AuthIcon2D'
import companyStaffAuthService from '@/services/companyStaffAuth.service'
import { useCompanyStaffAuth } from '@/framework/companyStaffAuth/CompanyStaffAuthContext'
import { ConsentCheckboxRow } from '@/modules/consent/ConsentCheckboxRow'
import { useLegalDocuments } from '@/modules/consent/useLegalDocuments'

export const CompanyStaffLoginPage = () => {
  const legalDocuments = useLegalDocuments()
  const navigate = useNavigate()
  const { login, refreshStaff } = useCompanyStaffAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [kvkkChecked, setKvkkChecked] = useState(false)
  const [notifChecked, setNotifChecked] = useState(false)
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const next: { phone?: string; password?: string } = {}
    if (!phone.trim()) next.phone = 'Telefon numaranızı giriniz.'
    if (!password) next.password = 'Şifrenizi giriniz.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    if (!kvkkChecked || !notifChecked) {
      toast.warning('Devam etmek için KVKK Aydınlatma Metni ve Bildirim İzni Sözleşmesi\'ni onaylamanız gerekiyor.')
      return
    }
    setLoading(true)
    try {
      const result = await companyStaffAuthService.login({ phone: phone.trim(), password })
      login(result)
      // Kullanıcı isteği (2026-08-02): login ekranında işaretlenen KVKK/Bildirim izni
      // onayları, oturum kurulduktan hemen sonra backend'e yazılır (DB'de gerçekten
      // görülebilir olması için).
      try {
        if (kvkkChecked) await companyStaffAuthService.acceptKvkk()
        if (notifChecked) await companyStaffAuthService.acceptNotificationConsent()
        await refreshStaff()
      } catch {
        void 0
      }
      navigate('/firma/personel/kullandir', { replace: true })
    } catch {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      variant="company"
      hideTabs
      title="Personel Girişi"
      subtitle="Firma yetkilinizin size verdiği telefon numarası ve şifreyle giriş yapın"
      footer={
        <div className="auth-footer-row">
          <span>Firma sahibi misiniz?</span>
          <Link to="/firma/login">Firma girişi</Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label required>Telefon</Label>
          <Input
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: undefined })) }}
            iconLeft={<AuthIcon2D kind="user" className="h-4 w-4" />}
            placeholder="05XX XXX XX XX"
            error={errors.phone}
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
        </div>
        <div className="space-y-2.5">
          <ConsentCheckboxRow
            id="company-staff-login-kvkk"
            text={legalDocuments.companyStaffKvkk}
            label="KVKK Aydınlatma Metni"
            checked={kvkkChecked}
            onChange={setKvkkChecked}
          />
          <ConsentCheckboxRow
            id="company-staff-login-notif"
            text={legalDocuments.companyStaffNotification}
            label="Bildirim İzni Sözleşmesi"
            checked={notifChecked}
            onChange={setNotifChecked}
          />
        </div>
        <Button type="submit" variant="primary" size="lg" isLoading={loading} className="w-full">Giriş Yap</Button>
      </form>
    </AuthLayout>
  )
}
