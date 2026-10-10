import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ShieldCheckIcon, UserCheckIcon, ArrowLeftIcon,
  CalendarIcon, UserIcon, PhoneIcon, MailIcon, LockIcon
} from 'lucide-react'
import {
  Button, Label, TcknInput, DatePicker, PhoneInput, EmailInput, PasswordInput, Badge, isValidTckn, isValidEmail,
} from '@/design-system'
import { AuthLayout } from '@/framework/layout/AuthLayout'
import { AddressBlock } from '@/components/specialized/AddressBlock'
import authService from '@/services/auth.service'
import { showApiErrorToast } from '@/services/api'
import { tokenStorage } from '@/services/tokenStorage'
import { isStrongPassword, PASSWORD_RULE_TEXT } from '@/lib/password'
import { DEV_DEFAULT_TCKN, DEV_DEFAULT_BIRTHDATE, DEV_DEFAULT_PASSWORD, DEV_DEFAULT_PHONE, DEV_DEFAULT_EMAIL } from '@/lib/devDefaults'
import { type NviLookupResult } from '@/types/auth.types'
import { todayIso } from '@/lib/utils'
import { toast } from 'sonner'
import { ConsentCheckboxRow } from '@/modules/consent/ConsentCheckboxRow'
import { useLegalDocuments } from '@/modules/consent/useLegalDocuments'

interface RegisterErrors {
  phone?: string
  email?: string
  guardianPhone?: string
  guardianEmail?: string
  pw?: string
  confirm?: string
}

export const RegisterPage = () => {
  const navigate = useNavigate()
  // Şifremi unuttum'dan gelen telefonsuz kayıt: NVİ zaten doğrulandı, form önceden dolu gelir.
  const prefill = useLocation().state as { tckn?: string; birthDate?: string; nvi?: NviLookupResult } | null
  const [tckn, setTckn] = useState(prefill?.tckn ?? '')
  const [birthDate, setBirthDate] = useState(prefill?.birthDate ?? '')
  const [nvi, setNvi] = useState<NviLookupResult | null>(prefill?.nvi ?? null)
  const [verifying, setVerifying] = useState(false)

  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [kvkkChecked, setKvkkChecked] = useState(false)
  const [notifChecked, setNotifChecked] = useState(false)
  const legalDocuments = useLegalDocuments()
  const [errors, setErrors] = useState<RegisterErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const today = todayIso()
  const queryValid = isValidTckn(tckn) && !!birthDate
  const minor = nvi?.isMinor ?? false

  const verify = async () => {
    if (!queryValid) return
    setVerifying(true)
    try { setNvi(await authService.nviLookup(tckn, birthDate)) }
    catch { void 0 }
    finally { setVerifying(false) }
  }

  const submit = async () => {
    if (submitting) return
    const next: RegisterErrors = {}
    if (minor) {
      if (guardianPhone.length < 10) next.guardianPhone = 'Veli telefonu giriniz.'
      if (guardianEmail && !isValidEmail(guardianEmail)) next.guardianEmail = 'Geçerli bir e-posta giriniz.'
    } else {
      if (phone.length < 10) next.phone = 'Telefon numaranızı giriniz.'
      if (email && !isValidEmail(email)) next.email = 'Geçerli bir e-posta giriniz.'
    }
    if (!isStrongPassword(pw)) next.pw = PASSWORD_RULE_TEXT
    if (confirm !== pw) next.confirm = 'Şifreler eşleşmiyor.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    if (!kvkkChecked || !notifChecked) {
      toast.warning('Devam etmek için KVKK Aydınlatma Metni ve Bildirim İzni Sözleşmesi\'ni onaylamanız gerekiyor.')
      return
    }
    setSubmitting(true)
    try {
      const result = await authService.register({
        tckn,
        birthDate,
        phone: minor ? guardianPhone : phone,
        email: (minor ? guardianEmail : email) || null,
        password: pw,
        guardianPhone: minor ? guardianPhone : undefined,
        guardianEmail: minor ? guardianEmail : undefined,
      })
      tokenStorage.setRemember(true)
      navigate('/login/otp', {
        state: {
          otpSessionToken: result.otpSessionToken,
          otpChannel: result.otpChannel,
          maskedTarget: result.maskedTarget,
          resendCooldownSeconds: result.resendCooldownSeconds,
          kvkkChecked,
          notifChecked,
        },
      })
    } catch (err) {
      showApiErrorToast(err)
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout wide
      title="Kayıt Ol"
      subtitle={nvi ? 'Hesabınızı oluşturun' : 'Kimlik bilgilerinizle başlayın'}
      footer={<span className="text-sm font-bold text-foreground-muted">Zaten hesabınız var mı? <Link to="/login" className="text-blue-600 hover:underline">Giriş yapın</Link></span>}
    >
      {!nvi ? (
        <div className="space-y-6">
          <div className="rounded-[24px] bg-blue-50/50 p-4 border border-blue-100 shadow-sm text-center">
            <p className="text-sm font-bold text-blue-600 leading-tight">
              T.C. Kimlik numaranız ile anında doğrulama
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label required className="text-sm font-black text-foreground-strong ml-2">T.C. Kimlik No</Label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-500 group-focus-within:bg-blue-500 group-focus-within:text-white transition-all">
                  <UserIcon className="h-4 w-4" />
                </div>
                <TcknInput value={tckn} onChange={setTckn} className="h-14 pl-14 pr-6 rounded-full border-white bg-white shadow-sm focus:shadow-xl focus:shadow-blue-500/10 transition-all text-base font-bold" />
              </div>
            </div>

            <div className="space-y-2">
              <Label required className="text-sm font-black text-foreground-strong ml-2">Doğum Tarihi</Label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 group-focus-within:bg-indigo-500 group-focus-within:text-white transition-all">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <DatePicker value={birthDate} max={today} onChange={setBirthDate} className="h-14 pl-14 pr-6 rounded-full border-white bg-white shadow-sm focus:shadow-xl focus:shadow-indigo-500/10 transition-all text-base font-bold" />
              </div>
            </div>
          </div>

          <Button 
            variant="primary" 
            size="lg" 
            className="h-16 w-full rounded-full text-lg font-black bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98]" 
            isLoading={verifying} 
            disabled={!queryValid || verifying} 
            onClick={verify} 
            iconLeft={<ShieldCheckIcon className="h-5 w-5" />}
          >
            Bilgileri Doğrula
          </Button>

          {import.meta.env.DEV && (
            <button type="button" className="w-full py-3 rounded-2xl border-2 border-dashed border-border text-xs font-bold text-foreground-subtle hover:text-blue-500 transition-all" onClick={() => { setTckn(DEV_DEFAULT_TCKN); setBirthDate(DEV_DEFAULT_BIRTHDATE) }}>
              Test bilgilerini doldur
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="rounded-[32px] bg-green-50 p-6 border border-green-100 shadow-lg shadow-green-500/5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500 text-white shadow-lg">
                <UserCheckIcon className="h-6 w-6" />
              </div>
              <div>
                <span className="text-lg font-black text-foreground-strong block">Kimlik Doğrulandı</span>
                {minor && <Badge tone="warning" className="rounded-full px-2 mt-1">18 yaş altı</Badge>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-2xl bg-white/50 border border-white">
                <p className="text-[10px] font-black text-foreground-subtle uppercase tracking-widest mb-1">Ad Soyad</p>
                <p className="text-sm font-bold text-foreground-strong">{nvi.fullName}</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/50 border border-white">
                <p className="text-[10px] font-black text-foreground-subtle uppercase tracking-widest mb-1">T.C. Kimlik</p>
                <p className="text-sm font-bold text-foreground-strong">{nvi.tckn}</p>
              </div>
              <div className="col-span-1 sm:col-span-2 p-3 rounded-2xl bg-white/50 border border-white">
                 <AddressBlock address={{ fullAddress: nvi.address, city: nvi.city, district: nvi.district, neighborhood: nvi.neighborhood, districtCode: nvi.districtCode }} />
              </div>
            </div>

            <button className="mt-4 flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-tight" onClick={() => setNvi(null)}>
              <ArrowLeftIcon className="h-3 w-3" /> Bilgileri Değiştir
            </button>
          </div>

          <div className="space-y-6">
             <div className="space-y-4">
               {minor ? (
                 <>
                   <div className="space-y-2">
                     <Label required className="text-sm font-black text-foreground-strong ml-2">Veli Telefonu</Label>
                     <div className="relative group">
                       <div className="absolute left-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-500 group-focus-within:bg-blue-500 group-focus-within:text-white transition-all">
                         <PhoneIcon className="h-4 w-4" />
                       </div>
                       <PhoneInput value={guardianPhone} onChange={setGuardianPhone} error={errors.guardianPhone} className="h-14 pl-14 pr-6 rounded-full border-white bg-white shadow-sm focus:shadow-xl focus:shadow-blue-500/10 transition-all text-base font-bold" />
                     </div>
                   </div>
                   <div className="space-y-2">
                     <Label className="text-sm font-black text-foreground-strong ml-2">Veli E-postası <span className="text-xs text-foreground-subtle font-bold">(opsiyonel)</span></Label>
                     <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 group-focus-within:bg-indigo-500 group-focus-within:text-white transition-all">
                          <MailIcon className="h-4 w-4" />
                        </div>
                        <EmailInput value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} error={errors.guardianEmail} className="h-14 pl-14 pr-6 rounded-full border-white bg-white shadow-sm focus:shadow-xl focus:shadow-indigo-500/10 transition-all text-base font-bold" />
                     </div>
                   </div>
                 </>
               ) : (
                 <>
                   <div className="space-y-2">
                     <Label required className="text-sm font-black text-foreground-strong ml-2">Telefon</Label>
                     <div className="relative group">
                       <div className="absolute left-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-500 group-focus-within:bg-blue-500 group-focus-within:text-white transition-all">
                         <PhoneIcon className="h-4 w-4" />
                       </div>
                       <PhoneInput value={phone} onChange={setPhone} error={errors.phone} className="h-14 pl-14 pr-6 rounded-full border-white bg-white shadow-sm focus:shadow-xl focus:shadow-blue-500/10 transition-all text-base font-bold" />
                     </div>
                   </div>
                   <div className="space-y-2">
                     <Label className="text-sm font-black text-foreground-strong ml-2">E-posta <span className="text-xs text-foreground-subtle font-bold">(opsiyonel)</span></Label>
                     <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 group-focus-within:bg-indigo-500 group-focus-within:text-white transition-all">
                          <MailIcon className="h-4 w-4" />
                        </div>
                        <EmailInput value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} className="h-14 pl-14 pr-6 rounded-full border-white bg-white shadow-sm focus:shadow-xl focus:shadow-indigo-500/10 transition-all text-base font-bold" />
                     </div>
                   </div>
                 </>
               )}

               <div className="space-y-2">
                 <Label required className="text-sm font-black text-foreground-strong ml-2">Şifre Belirleyin</Label>
                 <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-purple-50 text-purple-500 group-focus-within:bg-purple-500 group-focus-within:text-white transition-all">
                      <LockIcon className="h-4 w-4" />
                    </div>
                    <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} placeholder="En az 6 karakter" error={errors.pw} className="h-14 pl-14 pr-6 rounded-full border-white bg-white shadow-sm focus:shadow-xl focus:shadow-purple-500/10 transition-all text-base font-bold" />
                 </div>
               </div>
               
               <div className="space-y-2">
                 <Label required className="text-sm font-black text-foreground-strong ml-2">Şifre Tekrar</Label>
                 <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-purple-50 text-purple-500 group-focus-within:bg-purple-500 group-focus-within:text-white transition-all">
                      <LockIcon className="h-4 w-4" />
                    </div>
                    <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Şifrenizi tekrar girin" error={errors.confirm} className="h-14 pl-14 pr-6 rounded-full border-white bg-white shadow-sm focus:shadow-xl focus:shadow-purple-500/10 transition-all text-base font-bold" />
                 </div>
               </div>
             </div>

             <div className="auth-consent-list space-y-1">
               <ConsentCheckboxRow
                 id="register-kvkk"
                 text={legalDocuments.citizenKvkk}
                 label="KVKK Aydınlatma Metni"
                 checked={kvkkChecked}
                 onChange={setKvkkChecked}
               />
               <ConsentCheckboxRow
                 id="register-notif"
                 text={legalDocuments.citizenNotification}
                 label="Bildirim İzni Sözleşmesi"
                 checked={notifChecked}
                 onChange={setNotifChecked}
               />
             </div>

             <Button
               variant="primary"
               size="lg"
               className="h-16 w-full rounded-full text-lg font-black bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98]"
               isLoading={submitting}
               onClick={submit}
             >
               Hesabı Oluştur
             </Button>
          </div>
          
          {import.meta.env.DEV && (
            <button type="button" className="w-full py-3 rounded-2xl border-2 border-dashed border-border text-xs font-bold text-foreground-subtle hover:text-blue-500 transition-all" onClick={() => { setPhone(DEV_DEFAULT_PHONE); setEmail(DEV_DEFAULT_EMAIL); setPw(DEV_DEFAULT_PASSWORD); setConfirm(DEV_DEFAULT_PASSWORD); setKvkkChecked(true); setNotifChecked(true) }}>
              Test bilgilerini doldur
            </button>
          )}
        </div>
      )}
    </AuthLayout>
  )
}
