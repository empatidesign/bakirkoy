import { useState, useRef, useEffect } from 'react'
import { UserIcon, KeyRoundIcon, LogOutIcon, ChevronDownIcon, ShieldCheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/framework/auth/AuthContext'
import { Button, Field, Input, Modal } from '@/design-system'
import { PasswordInput } from '@/design-system/Input/PasswordInput'
import authService from '@/services/auth.service'

const getInitials = (name: string) =>
  name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()


const ProfileModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { state, updateUser } = useAuth()
  const user = state.status === 'authenticated' ? state.user : null

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && user) {
      setFullName(user.fullName ?? '')
      setPhone(user.phone ?? '')
    }
  }, [open, user])

  const handleSave = async () => {
    if (!fullName.trim()) return
    setSaving(true)
    try {
      const updated = await authService.updateProfile(fullName.trim(), phone.trim() || undefined)
      updateUser(updated)
      toast.success('Profil güncellendi.')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bilgilerim"
      width={440}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => void handleSave()}
            isLoading={saving}
            disabled={!fullName.trim()}
          >
            Kaydet
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        <div className="flex items-center gap-3 rounded-xl bg-surface-1 p-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold"
            style={{ backgroundColor: user?.roleColor ?? 'hsl(var(--primary))' }}
          >
            {getInitials(user?.fullName ?? 'A')}
          </div>
          <div className="min-w-0">
            <p className="type-body-strong truncate">{user?.fullName}</p>
            <p className="type-caption text-foreground-muted">{user?.roleName}</p>
            <p className="type-caption text-foreground-subtle">{user?.email}</p>
          </div>
        </div>

        <Field label="Ad Soyad" required>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ad Soyad"
          />
        </Field>

        <Field label="E-posta">
          <Input value={user?.email ?? ''} disabled />
        </Field>

        <Field label="Telefon" hint="Opsiyonel">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="05XX XXX XX XX"
          />
        </Field>

        {user?.isSuperAdmin && (
          <div className="flex items-center gap-2 rounded-lg bg-primary-soft px-3 py-2">
            <ShieldCheckIcon className="h-4 w-4 text-primary shrink-0" />
            <span className="type-caption text-primary font-medium">Süper Yönetici hesabı</span>
          </div>
        )}
      </div>
    </Modal>
  )
}


const ChangePasswordModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }, [open])

  const passwordsMatch = newPassword === confirmPassword
  const isValid = currentPassword.length >= 1 && newPassword.length >= 8 && passwordsMatch

  const handleSave = async () => {
    if (!isValid) return
    setSaving(true)
    try {
      await authService.changePassword(currentPassword, newPassword)
      toast.success('Şifreniz başarıyla güncellendi.')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Şifre Değiştir"
      width={420}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => void handleSave()}
            isLoading={saving}
            disabled={!isValid}
          >
            Şifreyi Güncelle
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        <Field label="Mevcut Şifre" required>
          <PasswordInput
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Mevcut şifreniz"
          />
        </Field>

        <Field label="Yeni Şifre" required hint="En az 8 karakter">
          <PasswordInput
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Yeni şifre"
            error={newPassword.length > 0 && newPassword.length < 8 ? 'En az 8 karakter olmalıdır.' : undefined}
          />
        </Field>

        <Field
          label="Yeni Şifre (Tekrar)"
          required
          error={confirmPassword.length > 0 && !passwordsMatch ? 'Şifreler eşleşmiyor.' : undefined}
        >
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Yeni şifreyi tekrar girin"
          />
        </Field>
      </div>
    </Modal>
  )
}


interface UserMenuProps {
  displayName: string
  displayRole: string
  roleColor?: string
}

export const UserMenu = ({ displayName, displayRole, roleColor }: UserMenuProps) => {
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const openProfile = () => { setOpen(false); setProfileOpen(true) }
  const openPassword = () => { setOpen(false); setPasswordOpen(true) }
  const handleLogout = async () => { setOpen(false); await logout() }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex items-center gap-2 rounded-lg px-2 py-1 transition-colors',
            open ? 'bg-surface-2' : 'hover:bg-surface-1'
          )}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-semibold"
            style={{ backgroundColor: roleColor ?? 'hsl(var(--primary))' }}
          >
            {getInitials(displayName)}
          </div>
          <div className="hidden md:block min-w-0 text-left">
            <p className="type-user-name leading-tight">{displayName}</p>
            <p className="type-user-role leading-tight flex items-center gap-1.5">
              {roleColor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: roleColor }} />}
              {displayRole}
            </p>
          </div>
          <ChevronDownIcon className={cn('hidden md:block h-3.5 w-3.5 text-foreground-muted transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-52 rounded-card border border-border bg-card shadow-pop z-50 py-1 overflow-hidden">
            <div className="px-3 py-2 border-b border-border">
              <p className="type-body-strong truncate">{displayName}</p>
              <p className="type-caption text-foreground-muted">{displayRole}</p>
            </div>

            <button
              type="button"
              onClick={openProfile}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground-default hover:bg-surface-1 transition-colors"
            >
              <UserIcon className="h-4 w-4 text-foreground-muted shrink-0" />
              Bilgilerim
            </button>

            <button
              type="button"
              onClick={openPassword}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground-default hover:bg-surface-1 transition-colors"
            >
              <KeyRoundIcon className="h-4 w-4 text-foreground-muted shrink-0" />
              Şifre Değiştir
            </button>

            <div className="my-1 border-t border-border" />

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger/5 transition-colors"
            >
              <LogOutIcon className="h-4 w-4 shrink-0" />
              Çıkış Yap
            </button>
          </div>
        )}
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  )
}
