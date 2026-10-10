import { useState } from 'react'
import { EyeIcon, EyeOffIcon, KeyRoundIcon, InfoIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Field, Input, SegmentedControl, ToggleRow, CredentialDeliveryCard, Banner } from '@/design-system'
import adminService from '@/services/admin.service'
import type { AdminDeliveryChannel } from '@/types/admin.types'

interface AdminPasswordSectionProps {
  adminId?: string
  isSuperAdmin?: boolean
  // Kullanıcı isteği (2026-08-02): süper adminler birbirlerinin şifresini elle
  // değiştirebilmeli — backend zaten bunu destekliyordu (AdminUserManagementService.
  // SetManualPasswordAsync: hedef SuperAdmin ise yalnız ÇAĞIRAN da SuperAdmin değilse
  // reddediyor), ama bu bileşen hedef SuperAdmin olduğunda her zaman kilitliyordu —
  // çağıranın kendi rolüne bakılmaksızın. callerIsSuperAdmin true ise kilit açılır.
  callerIsSuperAdmin?: boolean
  // Kullanıcı bulgusu: "Elle Şifre Belirle" alanı önceden kendi başına ayrı bir "Şifreyi
  // Kaydet" butonuyla anında API çağrısı yapıyordu — kullanıcılar tekrar tekrar şifreyi girip
  // formun ana "Güncelle" butonuna basıyor, o buton bu alanı hiç görmediği için şifre asla
  // kaydolmuyordu (üç farklı hesapta üst üste yaşandı). Artık bu alan tamamen dıştan (parent
  // form state'i üzerinden) kontrol ediliyor; kaydetme, formun tek "Güncelle" butonuna
  // devrediliyor — ikinci/gizli bir kaydetme yolu kalmadı.
  password: string
  onPasswordChange: (value: string) => void
  mustChange: boolean
  onMustChangeChange: (value: boolean) => void
}

const isStrong = (v: string) => v.length >= 8 && /\p{Lu}/u.test(v) && /[0-9]/.test(v)

export const AdminPasswordSection = ({
  adminId, isSuperAdmin, callerIsSuperAdmin, password, onPasswordChange, mustChange, onMustChangeChange,
}: AdminPasswordSectionProps) => {
  const [mode, setMode] = useState<'send' | 'manual'>('send')
  const [show, setShow] = useState(false)

  const superAdminLocked = !!isSuperAdmin && !callerIsSuperAdmin
  const disabled = !adminId || superAdminLocked
  const valid = !password || isStrong(password)

  const sendReset = async (channel: AdminDeliveryChannel) => {
    if (!adminId) return
    await adminService.sendPasswordReset(adminId, channel)
    toast.success(`Geçici şifre ${channel === 'Email' ? 'e-posta' : 'SMS'} ile gönderildi. Yönetici ilk girişte şifresini değiştirecek.`)
  }

  return (
    <div className="space-y-3">
      {superAdminLocked && (
        <Banner tone="neutral" variant="soft">
          Süper Yönetici hesabının şifresini yalnızca başka bir Süper Yönetici değiştirebilir.
        </Banner>
      )}
      <SegmentedControl
        value={mode}
        onChange={(v) => setMode(v as 'send' | 'manual')}
        disabled={disabled}
        columns={2}
        options={[
          { value: 'send', label: 'Geçici Şifre Gönder', description: 'Rastgele üretilir, kanaldan iletilir' },
          { value: 'manual', label: 'Elle Şifre Belirle', description: 'Şifreyi siz girin' },
        ]}
      />

      {mode === 'send' ? (
        <CredentialDeliveryCard
          title="Geçici Şifre Gönder"
          description="Şifre buradan görünmez. Yöneticiye geçici bir şifre gönderilir; ilk girişte kendi şifresini belirlemek zorundadır. Bu, formun altındaki Güncelle butonundan bağımsız olarak anında gönderilir."
          onSend={sendReset}
          disabled={disabled}
        />
      ) : (
        <div className="space-y-3 rounded-card border border-border bg-surface-1/60 p-3">
          <Field
            label="Yeni Şifre"
            error={password && !valid ? 'En az 8 karakter, bir büyük harf ve bir rakam içermelidir.' : undefined}
            hint={!password ? 'Boş bırakırsanız mevcut şifre değişmez.' : undefined}
          >
            <Input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              disabled={disabled}
              placeholder="Yeni şifreyi girin (opsiyonel)"
              autoComplete="new-password"
              iconRight={
                <button type="button" onClick={() => setShow((s) => !s)} className="text-foreground-muted transition-colors hover:text-foreground-strong" tabIndex={-1}>
                  {show ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              }
            />
          </Field>

          <ToggleRow
            label="İlk girişte değiştirmesi zorunlu"
            description="Açıkken yönetici bu şifreyle giriş yapar ama ilk girişte kendi şifresini belirlemek zorunda kalır."
            checked={mustChange}
            onChange={onMustChangeChange}
            disabled={disabled || !password}
          />

          <Banner tone="primary" variant="soft" icon={KeyRoundIcon}>
            Buraya yazdığınız şifre, ayrı bir düğmeye basmanız gerekmeden, formun altındaki
            <b> "Güncelle"</b> butonuna bastığınızda diğer bilgilerle birlikte kaydedilir.
          </Banner>

          {password && valid && (
            <Banner tone="warning" variant="soft" icon={InfoIcon}>
              Güncelle'ye bastığınızda yöneticinin açık oturumu kapatılır; yeni şifresiyle yeniden giriş yapması gerekir.
            </Banner>
          )}
        </div>
      )}
    </div>
  )
}
