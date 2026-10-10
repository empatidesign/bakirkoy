import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2Icon, MailCheckIcon, ClockIcon } from 'lucide-react'
import { Button, Label, Input, PhoneInput, EmailInput, Textarea, PasswordInput, Combobox, Banner, isValidEmail } from '@/design-system'
import type { ServiceCategoryRef } from '@/types/serviceCategory.types'
import { AuthLayout } from '@/framework/layout/AuthLayout'
import companyAuthService from '@/services/companyAuth.service'
import { isStrongPassword, PASSWORD_RULE_TEXT } from '@/lib/password'
import { MapPicker, type MapCoords } from '@/components/specialized/MapPicker'
import { ConsentCheckboxRow } from '@/modules/consent/ConsentCheckboxRow'
import { useLegalDocuments } from '@/modules/consent/useLegalDocuments'
import {
  DEV_DEFAULT_COMPANY_NAME, DEV_DEFAULT_COMPANY_TAX, DEV_DEFAULT_COMPANY_PHONE,
  DEV_DEFAULT_COMPANY_EMAIL, DEV_DEFAULT_COMPANY_ADDRESS, DEV_DEFAULT_COMPANY_PASSWORD,
} from '@/lib/devDefaults'

interface RegisterErrors {
  name?: string
  taxNumber?: string
  phone?: string
  email?: string
  address?: string
  serviceCategory?: string
  pw?: string
  confirm?: string
}

export const CompanyRegisterPage = () => {
  const navigate = useNavigate()
  const legalDocuments = useLegalDocuments()
  const [name, setName] = useState('')
  const [taxNumber, setTaxNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<MapCoords>({})
  const [categories, setCategories] = useState<ServiceCategoryRef[]>([])
  const [serviceCategoryId, setServiceCategoryId] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [kvkkChecked, setKvkkChecked] = useState(false)
  const [notifChecked, setNotifChecked] = useState(false)
  const [errors, setErrors] = useState<RegisterErrors>({})
  const [consentError, setConsentError] = useState<string | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    companyAuthService.getServiceCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  const submit = async () => {
    const next: RegisterErrors = {}
    if (!name.trim()) next.name = 'Firma adı zorunludur.'
    if (taxNumber.length !== 10) next.taxNumber = 'Vergi numarası 10 haneli olmalıdır.'
    if (!/^0\d{10}$/.test(phone)) next.phone = 'Telefon 0 ile başlamalı ve 11 haneli olmalıdır.'
    if (email.trim() && !isValidEmail(email.trim())) next.email = 'Geçerli bir e-posta adresi giriniz.'
    if (!address.trim()) next.address = 'Adres zorunludur.'
    if (!serviceCategoryId) next.serviceCategory = 'Hizmet kategorisi zorunludur.'
    if (!isStrongPassword(pw)) next.pw = PASSWORD_RULE_TEXT
    if (confirm !== pw) next.confirm = 'Şifreler eşleşmiyor.'
    const consentInvalid = !kvkkChecked || !notifChecked
    setConsentError(consentInvalid ? 'Devam etmek için KVKK Aydınlatma Metni ve Bildirim İzni Sözleşmesi\'ni onaylayın.' : undefined)
    setErrors(next)
    if (Object.keys(next).length > 0 || consentInvalid) return
    setSubmitting(true)
    try {
      await companyAuthService.register({
        name: name.trim(),
        taxNumber: taxNumber.trim(),
        phone,
        email: email.trim() || undefined,
        address: address.trim(),
        serviceCategoryId,
        password: pw,
        latitude: coords.latitude,
        longitude: coords.longitude,
        kvkkAccepted: kvkkChecked,
        notificationConsentAccepted: notifChecked,
      })
      setDone(true)
    } catch {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthLayout variant="company" title="Kaydınız Alındı" subtitle="Firma başvurunuz belediye onayına gönderildi">
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft">
            <MailCheckIcon className="h-7 w-7 text-success" />
          </span>
          <div className="space-y-2">
            <p className="type-section">Onay bekleniyor</p>
            <p className="type-desc">
              Firma kaydınız alındı. Belediye yetkilileri başvurunuzu inceleyip onayladığında
              bilgilendirileceksiniz. Onaydan sonra giriş yapıp kampanyalarınızı oluşturabilirsiniz.
            </p>
          </div>
          <Banner tone="info" variant="soft" icon={ClockIcon}>
            Onay süreci tamamlanana kadar giriş yapsanız bile kampanya oluşturamazsınız.
          </Banner>
          <Button variant="primary" size="lg" className="w-full" onClick={() => navigate('/firma/login', { replace: true })}>
            Giriş ekranına git
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout variant="company" wide
      title="Firma Kaydı"
      subtitle="Firma bilgilerinizle başvuru oluşturun"
      footer={<span className="type-caption">Zaten kayıtlı mısınız? <Link to="/firma/login" className="type-link-sm">Giriş yapın</Link></span>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-card border border-border bg-surface-1 p-3">
          <Building2Icon className="h-4 w-4 flex-shrink-0 text-primary" />
          <p className="type-caption">Kayıt sonrası başvurunuz belediye onayına düşer. Onaylanınca kampanya ekleyebilirsiniz.</p>
        </div>

        <div className="space-y-1.5">
          <Label required>Firma Adı</Label>
          <Input value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })) }} placeholder="Firma ünvanı" error={errors.name} />
        </div>
        <div className="space-y-1.5">
          <Label required>Vergi Numarası</Label>
          <Input value={taxNumber} onChange={(e) => { setTaxNumber(e.target.value); setErrors((p) => ({ ...p, taxNumber: undefined })) }} sanitize="digits" maxLength={10} inputMode="numeric" placeholder="10 haneli vergi no" error={errors.taxNumber} />
        </div>
        <div className="space-y-1.5">
          <Label required>Telefon</Label>
          <PhoneInput value={phone} onChange={(v) => { setPhone(v); setErrors((p) => ({ ...p, phone: undefined })) }} error={errors.phone} />
        </div>
        <div className="space-y-1.5">
          <Label>E-posta (opsiyonel)</Label>
          <EmailInput value={email} onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })) }} placeholder="firma@ornek.com" error={errors.email} />
        </div>
        <div className="space-y-1.5">
          <Label required>Adres</Label>
          <Textarea value={address} onChange={(e) => { setAddress(e.target.value); setErrors((p) => ({ ...p, address: undefined })) }} rows={2} placeholder="Firma adresi" error={errors.address} />
        </div>
        <div className="space-y-1.5">
          <Label>Konum (opsiyonel)</Label>
          <p className="type-caption">Haritadan arayarak veya konumunuzu kullanarak firmanızın konumunu işaretleyin — firma sayfanızda ve haritalı listelerde gösterilir.</p>
          <MapPicker
            value={coords}
            onChange={setCoords}
            onAddressPick={(picked) => setAddress((current) => current.trim() ? current : picked)}
          />
        </div>
        <div className="space-y-1.5">
          <Label required>Hizmet Kategorisi</Label>
          <Combobox
            value={serviceCategoryId}
            displayValue={categories.find((c) => c.id === serviceCategoryId)?.name}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Kategori ara veya seç…"
            error={errors.serviceCategory}
            onChange={(value) => { setServiceCategoryId(value); setErrors((p) => ({ ...p, serviceCategory: undefined })) }}
          />
          {!errors.serviceCategory && <p className="type-caption">Kampanyalarınız bu kategori altında listelenecektir.</p>}
        </div>
        <div className="space-y-1.5">
          <Label required>Şifre</Label>
          <PasswordInput value={pw} onChange={(e) => { setPw(e.target.value); setErrors((p) => ({ ...p, pw: undefined })) }} placeholder="Şifre belirleyin" error={errors.pw} />
        </div>
        <div className="space-y-1.5">
          <Label required>Şifre (Tekrar)</Label>
          <PasswordInput value={confirm} onChange={(e) => { setConfirm(e.target.value); setErrors((p) => ({ ...p, confirm: undefined })) }} placeholder="Şifre tekrar" error={errors.confirm} />
        </div>

        <div className="space-y-2.5">
          <ConsentCheckboxRow
            id="company-register-kvkk"
            text={legalDocuments.companyKvkk}
            label="KVKK Aydınlatma Metni"
            checked={kvkkChecked}
            onChange={(v) => { setKvkkChecked(v); setConsentError(undefined) }}
          />
          <ConsentCheckboxRow
            id="company-register-notif"
            text={legalDocuments.companyNotification}
            label="Bildirim İzni Sözleşmesi"
            checked={notifChecked}
            onChange={(v) => { setNotifChecked(v); setConsentError(undefined) }}
          />
          {consentError && <p className="type-caption text-danger">{consentError}</p>}
        </div>

        <Button variant="primary" size="lg" className="w-full" isLoading={submitting} onClick={submit}>Başvuru Oluştur</Button>
        {import.meta.env.DEV && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setName(DEV_DEFAULT_COMPANY_NAME); setTaxNumber(DEV_DEFAULT_COMPANY_TAX); setPhone(DEV_DEFAULT_COMPANY_PHONE)
              setEmail(DEV_DEFAULT_COMPANY_EMAIL); setAddress(DEV_DEFAULT_COMPANY_ADDRESS)
              setPw(DEV_DEFAULT_COMPANY_PASSWORD); setConfirm(DEV_DEFAULT_COMPANY_PASSWORD); setErrors({})
              setKvkkChecked(true); setNotifChecked(true); setConsentError(undefined)
            }}
          >
            Test bilgileriyle doldur
          </Button>
        )}
      </div>
    </AuthLayout>
  )
}
