import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  PhoneIcon, MailIcon, FingerprintIcon, LogOutIcon,
  CalendarIcon, MapPinIcon, UserRoundIcon, CameraIcon,
  KeyRoundIcon, PencilIcon, Loader2Icon, ShieldIcon, ChevronRightIcon, BookmarkIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import { Badge, Button, Modal, Field, PhoneInput, EmailInput, PasswordInput } from '@/design-system'
import { OTPInput } from '@/components/specialized/OTPInput'
import { formatDate, maskTC } from '@/lib/utils'
import { useAuth } from '@/framework/auth/AuthContext'
import { GENDER_LABELS, type CitizenStatus } from '@/types/auth.types'
import type { CitizenChild } from '@/types/family.types'
import familyService from '@/services/family.service'
import authService from '@/services/auth.service'
import { api } from '@/services/api'
import { ImageCropModal } from '@/components/specialized/ImageCropModal'
import { formatAddressLine, isBakirkoyResident, hasAnyAddress } from '@/lib/residency'
import { EducationSection } from './EducationSection'

const STATUS_META: Record<CitizenStatus, { label: string; tone: 'success' | 'neutral' | 'danger' }> = {
  Active: { label: 'Aktif', tone: 'success' },
  Passive: { label: 'Pasif', tone: 'neutral' },
  Blocked: { label: 'Engellendi', tone: 'danger' },
}

const statusMeta = (status: CitizenStatus): { label: string; tone: 'success' | 'neutral' | 'danger' } =>
  STATUS_META[status] ?? { label: String(status), tone: 'neutral' }

interface InfoRowProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}

const InfoRow = ({ icon: Icon, label, value }: InfoRowProps) => (
  <div className="flex items-center gap-3 border-b border-border py-3">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-surface-2" style={{ borderRadius: 8 }}>
      <Icon className="h-4 w-4 text-foreground-subtle" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-medium text-foreground-subtle leading-none mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-foreground-strong truncate">{value}</p>
    </div>
  </div>
)

export const ProfilePage = () => {
  const navigate = useNavigate()
  const { state, logout, switchToChild, refreshUser } = useAuth()
  const [children, setChildren] = useState<CitizenChild[]>([])


  const [switchingChild, setSwitchingChild] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoCropSrc, setPhotoCropSrc] = useState<string | null>(null)

  const [contactOpen, setContactOpen] = useState(false)
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPassword, setContactPassword] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [contactStep, setContactStep] = useState<'form' | 'otp'>('form')
  const [contactOtp, setContactOtp] = useState('')
  const [contactOtpMasked, setContactOtpMasked] = useState('')
  const [contactOtpError, setContactOtpError] = useState<string>()
  const [confirmingContact, setConfirmingContact] = useState(false)
  const [refreshingNvi, setRefreshingNvi] = useState(false)

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('bolum') !== 'sifre') return
    setPasswordOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete('bolum')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  const impersonating = state.status === 'authenticated' && !!state.impersonatedFrom

  useEffect(() => {
    if (impersonating) { setChildren([]); return }
    let active = true
    familyService.getChildren()
      .then((c) => { if (active) setChildren(c) })
      .catch(() => { if (active) setChildren([]) })
    return () => { active = false }
  }, [impersonating])

  if (state.status !== 'authenticated') return null
  const user = state.user
  const status = statusMeta(user.status)
  const userAddress = { fullAddress: user.address, city: user.city, district: user.district, neighborhood: user.neighborhood, districtCode: user.districtCode }
  const userAddressLine = formatAddressLine(userAddress)

  const handleSwitch = async (id: string, resetSelect?: () => void) => {
    if (switchingChild) return
    setSwitchingChild(true)
    try {
      await switchToChild(id)
      navigate('/', { replace: true })
    } catch {
      toast.error('Hesap geçişi yapılamadı. Lütfen tekrar deneyin.')
      resetSelect?.()
    } finally {
      setSwitchingChild(false)
    }
  }

  const openContact = () => {
    setContactPhone(user.phone ?? '')
    setContactEmail(user.email ?? '')
    setContactPassword('')
    setContactStep('form')
    setContactOtp('')
    setContactOtpError(undefined)
    setContactOpen(true)
  }

  const closeContact = () => {
    setContactOpen(false)
    setContactStep('form')
    setContactOtp('')
    setContactOtpError(undefined)
  }

  const saveContact = async () => {
    if (!contactPassword.trim()) { toast.warning('Mevcut şifrenizi girin.'); return }
    const phoneChanged = (contactPhone || '') !== (user.phone || '')
    const emailChanged = (contactEmail || '') !== (user.email || '')
    if (!phoneChanged && !emailChanged) { toast.warning('Bir değişiklik yapmadınız.'); return }
    if (phoneChanged && emailChanged) { toast.warning('Telefon ve e-postayı aynı anda değiştiremezsiniz. Lütfen teker teker değiştirin.'); return }
    setSavingContact(true)
    try {
      const result = await authService.requestContactChange(
        phoneChanged
          ? { phone: contactPhone, email: null, currentPassword: contactPassword }
          : { phone: null, email: contactEmail, currentPassword: contactPassword })
      setContactOtpMasked(result.maskedTarget)
      setContactStep('otp')
    } catch { void 0 } finally { setSavingContact(false) }
  }

  const confirmContact = async () => {
    if (contactOtp.length !== 6) { setContactOtpError('Doğrulama kodu 6 hanelidir.'); return }
    setContactOtpError(undefined)
    setConfirmingContact(true)
    try {
      await authService.confirmContactChange({ code: contactOtp })
      closeContact()
      toast.success('İletişim bilginiz güncellendi. Güvenlik için tekrar giriş yapın.')
      await logout()
      navigate('/login', { replace: true })
    } catch (e) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setContactOtpError(message ?? 'Kod hatalı veya süresi doldu.')
    } finally { setConfirmingContact(false) }
  }

  const refreshFromNvi = async () => {
    if (refreshingNvi) return
    setRefreshingNvi(true)
    try {
      await api.post('/auth/citizen/me/nvi-refresh')
      await refreshUser()
      toast.success('Adres bilgileriniz NVİ’den yenilendi.')
    } catch { void 0 } finally { setRefreshingNvi(false) }
  }

  const savePassword = async () => {
    if (newPw !== confirmPw) { toast.warning('Yeni şifreler eşleşmiyor.'); return }
    setSavingPw(true)
    try {
      await authService.changePassword({ currentPassword: currentPw, newPassword: newPw })
      toast.success('Şifreniz değiştirildi.')
      setPasswordOpen(false)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch { void 0 } finally { setSavingPw(false) }
  }

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhotoCropSrc(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handlePhotoCropped = async (blob: Blob) => {
    setPhotoCropSrc(null)
    setUploadingPhoto(true)
    try {
      const file = new File([blob], 'profil.jpg', { type: 'image/jpeg' })
      await authService.uploadPhoto(file)
      await refreshUser()
      toast.success('Profil fotoğrafı güncellendi.')
    } catch { void 0 } finally { setUploadingPhoto(false) }
  }

  const initials = user.fullName.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="flex-1 overflow-y-auto pb-8">

        <div
          className="relative overflow-hidden px-5 pt-12 pb-5"
          style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4f46e5 100%)' }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at 80% 20%, #a5b4fc 0%, transparent 50%), radial-gradient(circle at 15% 80%, #818cf8 0%, transparent 40%)',
            }}
          />
          <div className="relative flex items-center gap-4">
            <label
              htmlFor={uploadingPhoto ? undefined : 'profile-photo-input'}
              className="relative shrink-0 overflow-hidden cursor-pointer"
              style={{
                width: 72, height: 72,
                borderRadius: 10,
                border: '3px solid rgba(255,255,255,0.4)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                display: 'block',
              }}
            >
              {user.photoUrl ? (
                <img src={user.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-xl font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  {initials}
                </div>
              )}
              {uploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2Icon className="h-5 w-5 animate-spin text-white" />
                </div>
              )}
              {!uploadingPhoto && (
                <div className="absolute bottom-0 inset-x-0 flex items-center justify-center bg-black/35 py-1">
                  <CameraIcon className="h-3 w-3 text-white" />
                </div>
              )}
            </label>

            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-white leading-tight truncate">{user.fullName}</h1>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge tone={status.tone}>{status.label}</Badge>
                {user.isMinor && <Badge tone="info">Çocuk</Badge>}
              </div>
            </div>
          </div>

          {!impersonating && children.length > 0 && (
            <div className="relative mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300 mb-2">Hesap Geçişi</p>
              <select
                defaultValue=""
                disabled={switchingChild}
                onChange={(e) => {
                  const el = e.target
                  if (el.value) void handleSwitch(el.value, () => { el.value = '' })
                }}
                className="w-full appearance-none px-3 py-2.5 text-sm font-semibold text-white outline-none cursor-pointer"
                style={{
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  backdropFilter: 'blur(8px)',
                  WebkitAppearance: 'none',
                }}
              >
                <option value="" disabled style={{ background: '#312e81', color: '#a5b4fc' }}>
                  Çocuk hesabına geç…
                </option>
                {children.map((c) => (
                  <option key={c.id} value={c.id} style={{ background: '#312e81', color: '#fff' }}>
                    {c.fullName} · {c.age} yaş
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mx-4 mt-4 grid overflow-hidden rounded-[10px] border border-border bg-card shadow-sm" style={{ gridTemplateColumns: impersonating ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)' }}>
            <button
              type="button"
              onClick={openContact}
              className="flex flex-col items-center gap-1.5 border-r border-border py-4 transition-colors active:bg-surface-1"
            >
              <PencilIcon className="h-5 w-5 text-indigo-500" />
              <span className="text-[11px] font-semibold text-foreground-muted">İletişim</span>
            </button>
            {!impersonating && (
              <button
                type="button"
                onClick={() => setPasswordOpen(true)}
                className="flex flex-col items-center gap-1.5 border-r border-border py-4 transition-colors active:bg-surface-1"
              >
                <KeyRoundIcon className="h-5 w-5 text-indigo-500" />
                <span className="text-[11px] font-semibold text-foreground-muted">Şifre</span>
              </button>
            )}
            <label
              htmlFor={uploadingPhoto ? undefined : 'profile-photo-input'}
              className="flex flex-col items-center gap-1.5 py-4 transition-colors active:bg-surface-1 cursor-pointer"
            >
              {uploadingPhoto
                ? <Loader2Icon className="h-5 w-5 animate-spin text-indigo-400" />
                : <CameraIcon className="h-5 w-5 text-indigo-500" />}
              <span className="text-[11px] font-semibold text-foreground-muted">Fotoğraf</span>
            </label>
          </div>

        <div className="mx-4 mt-4 overflow-hidden rounded-[10px] border border-border bg-card shadow-sm">
          <div className="px-4 pt-4 pb-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-foreground-subtle">Kişisel Bilgiler</p>
          </div>
          <div className="px-4">
            <InfoRow icon={FingerprintIcon} label="T.C. Kimlik No" value={maskTC(user.tckn)} />
            <InfoRow icon={CalendarIcon} label="Doğum Tarihi" value={`${formatDate(user.birthDate)} · ${user.age} yaş`} />
            <InfoRow icon={UserRoundIcon} label="Cinsiyet" value={GENDER_LABELS[user.gender]} />
            <InfoRow icon={PhoneIcon} label="Telefon" value={user.phone ?? '—'} />
            <InfoRow icon={MailIcon} label="E-Posta" value={user.email ?? '—'} />
            <div className="flex items-start gap-3 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-surface-2 mt-0.5">
                <MapPinIcon className="h-4 w-4 text-foreground-subtle" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-foreground-subtle leading-none">Adres</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshFromNvi}
                    disabled={refreshingNvi}
                    isLoading={refreshingNvi}
                    iconLeft={<ShieldCheckIcon className="h-3.5 w-3.5" />}
                  >
                    NVİ’den Yenile
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground-strong">{userAddressLine || '—'}</p>
                  {hasAnyAddress(userAddress) && (
                    <Badge tone={isBakirkoyResident(userAddress) ? 'info' : 'neutral'}>{isBakirkoyResident(userAddress) ? 'Bakırköy sakini' : 'Bakırköy dışı'}</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <EducationSection />

        <div className="mx-4 mt-4 overflow-hidden rounded-[10px] border border-border bg-card shadow-sm">
          <button
            type="button"
            onClick={() => navigate('/kaydettiklerim')}
            className="flex w-full items-center gap-3 border-b border-border px-4 py-4 transition-colors active:bg-surface-1"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center" style={{ borderRadius: 10, background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
              <BookmarkIcon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-bold text-foreground-strong">Kaydettiklerim</p>
              <p className="text-xs text-foreground-subtle">Kaydettiğiniz kampanyalar</p>
            </div>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground-subtle" />
          </button>
          {!impersonating && (
            <button
              type="button"
              onClick={() => navigate('/profil/oturumlar')}
              className="flex w-full items-center gap-3 border-b border-border px-4 py-4 transition-colors active:bg-surface-1"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center" style={{ borderRadius: 10, background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                <ShieldIcon className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-bold text-foreground-strong">Aktif Oturumlar</p>
                <p className="text-xs text-foreground-subtle">Bağlı cihazları görüntüle ve yönet</p>
              </div>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground-subtle" />
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/bildirimler/tercihler')}
            className="flex w-full items-center gap-3 border-b border-border px-4 py-4 transition-colors active:bg-surface-1"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center" style={{ borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
              <ShieldCheckIcon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-bold text-foreground-strong">Gizlilik ve İzinler</p>
              <p className="text-xs text-foreground-subtle">
                KVKK: {user.kvkkAccepted ? 'Onaylandı' : 'Onaylanmadı'} · Bildirim izni: {user.notificationConsentAccepted ? 'Onaylandı' : 'Onaylanmadı'}
              </p>
            </div>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground-subtle" />
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 px-4 py-4 transition-colors active:bg-danger-soft"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-danger-soft">
              <LogOutIcon className="h-4 w-4 text-danger" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-bold text-danger">Çıkış Yap</p>
              <p className="text-xs text-foreground-subtle">Hesabınızdan güvenli çıkış yapın</p>
            </div>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground-subtle" />
          </button>
        </div>

      </div>

      <input id="profile-photo-input" type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />

      <Modal
        open={contactOpen}
        onClose={closeContact}
        title="İletişim Bilgileri"
        subtitle={
          contactStep === 'form'
            ? (impersonating ? 'Telefon numarasını güncelleyin' : 'Telefon ve e-posta adresinizi güncelleyin')
            : `${contactOtpMasked} adresine gönderilen 6 haneli kodu girin`
        }
        width={420}
        bodyClassName="p-5"
        footer={
          contactStep === 'form' ? (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeContact}>Vazgeç</Button>
              <Button variant="primary" className="flex-1" isLoading={savingContact} onClick={saveContact}>Kod Gönder</Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setContactStep('form')}>Geri</Button>
              <Button variant="primary" className="flex-1" isLoading={confirmingContact} onClick={confirmContact}>Onayla</Button>
            </div>
          )
        }
      >
        {contactStep === 'form' ? (
          <div className="space-y-4">
            <Field label="Telefon"><PhoneInput value={contactPhone} onChange={setContactPhone} /></Field>
            {!impersonating && (
              <Field label="E-Posta"><EmailInput value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></Field>
            )}
            <Field label="Mevcut Şifre">
              <PasswordInput value={contactPassword} onChange={(e) => setContactPassword(e.target.value)} placeholder="Mevcut şifreniz" />
            </Field>
          </div>
        ) : (
          <div className="space-y-4">
            <OTPInput value={contactOtp} onChange={setContactOtp} error={contactOtpError} />
          </div>
        )}
      </Modal>

      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Şifre Değiştir"
        width={420}
        bodyClassName="p-5"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setPasswordOpen(false)}>Vazgeç</Button>
            <Button variant="primary" className="flex-1" isLoading={savingPw} disabled={!currentPw || !newPw || !confirmPw} onClick={savePassword}>Kaydet</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Mevcut Şifre">
            <PasswordInput value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Mevcut şifreniz" />
          </Field>
          <Field label="Yeni Şifre" hint="En az 8 karakter, bir büyük harf ve bir rakam.">
            <PasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Yeni şifre" />
          </Field>
          <Field label="Yeni Şifre (Tekrar)" error={confirmPw && confirmPw !== newPw ? 'Şifreler eşleşmiyor.' : undefined}>
            <PasswordInput value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Yeni şifre tekrar" />
          </Field>
        </div>
      </Modal>

      {photoCropSrc && (
        <ImageCropModal
          open={!!photoCropSrc}
          imageSrc={photoCropSrc}
          aspect={1}
          onClose={() => setPhotoCropSrc(null)}
          onCrop={(blob) => void handlePhotoCropped(blob)}
        />
      )}
    </div>
  )
}
