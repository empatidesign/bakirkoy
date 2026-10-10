import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  UsersIcon, UserPlusIcon, PhoneIcon, MailIcon, KeyRoundIcon, Trash2Icon,
  PowerIcon, CopyIcon, PencilIcon, RefreshCwIcon, ShieldCheckIcon,
} from 'lucide-react'
import { ModuleHeader, Card, Button, Field, Input, PasswordInput, Switch, Modal, Badge, EmptyState, SkeletonRows, SegmentedControl, Banner } from '@/design-system'
import companyMeService from '@/services/companyMe.service'
import { generateSuggestedPassword } from '@/lib/password'
import type { CompanyStaff } from '@/types/companyStaff.types'

const STAFF_MIN_LENGTH = 6
const isValidStaffPassword = (v: string) => v.trim().length >= STAFF_MIN_LENGTH
const STAFF_PASSWORD_HINT = `En az ${STAFF_MIN_LENGTH} karakter olmalıdır.`

const EMPTY_CREATE = { fullName: '', phone: '', email: '', password: '', canRedeem: true, canManageCampaigns: false }

export const CompanyStaffPage = () => {
  const [staff, setStaff] = useState<CompanyStaff[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE)
  const [saving, setSaving] = useState(false)

  const [editing, setEditing] = useState<CompanyStaff | null>(null)
  const [editForm, setEditForm] = useState({ fullName: '', phone: '', email: '', canRedeem: true, canManageCampaigns: false })

  const [passwordStaff, setPasswordStaff] = useState<CompanyStaff | null>(null)
  const [passwordMode, setPasswordMode] = useState<'random' | 'manual'>('random')
  const [manualPassword, setManualPassword] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState<CompanyStaff | null>(null)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(() => {
    setLoadError(false)
    companyMeService.staffList().then(setStaff).catch(() => {
      setStaff(null)
      setLoadError(true)
    })
  }, [])
  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!createForm.fullName.trim() || !createForm.phone.trim() || !isValidStaffPassword(createForm.password)) return
    setSaving(true)
    try {
      await companyMeService.createStaff({
        fullName: createForm.fullName.trim(),
        phone: createForm.phone.trim(),
        email: createForm.email.trim() || undefined,
        password: createForm.password,
        canRedeem: createForm.canRedeem,
        canManageCampaigns: createForm.canManageCampaigns,
      })
      toast.success('Personel eklendi.')
      setCreateOpen(false)
      setCreateForm(EMPTY_CREATE)
      load()
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (s: CompanyStaff) => {
    setEditing(s)
    setEditForm({ fullName: s.fullName, phone: s.phone, email: s.email ?? '', canRedeem: s.canRedeem, canManageCampaigns: s.canManageCampaigns })
  }

  const handleEditSave = async () => {
    if (!editing || !editForm.fullName.trim() || !editForm.phone.trim()) return
    setSaving(true)
    try {
      await companyMeService.updateStaff(editing.id, {
        fullName: editForm.fullName.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim() || undefined,
        canRedeem: editForm.canRedeem,
        canManageCampaigns: editForm.canManageCampaigns,
      })
      toast.success('Personel bilgileri güncellendi.')
      setEditing(null)
      load()
    } catch {
      void 0
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (s: CompanyStaff) => {
    try {
      if (s.isActive) await companyMeService.deactivateStaff(s.id)
      else await companyMeService.activateStaff(s.id)
      toast.success(s.isActive ? 'Personel pasife alındı.' : 'Personel aktifleştirildi.')
      load()
    } catch {
      void 0
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await companyMeService.deleteStaff(confirmDelete.id)
      toast.success('Personel silindi.')
      setConfirmDelete(null)
      load()
    } catch {
      void 0
    }
  }

  const openPasswordManager = (s: CompanyStaff) => {
    setPasswordStaff(s)
    setPasswordMode('random')
    setManualPassword('')
    setGeneratedPassword(null)
  }

  const closePasswordManager = () => {
    setPasswordStaff(null)
    setGeneratedPassword(null)
    setManualPassword('')
  }

  const generateRandom = async () => {
    if (!passwordStaff) return
    setSavingPassword(true)
    try {
      const result = await companyMeService.resetStaffPassword(passwordStaff.id)
      setGeneratedPassword(result.newPassword)
    } catch {
      void 0
    } finally {
      setSavingPassword(false)
    }
  }

  const suggestManualPassword = () => setManualPassword(generateSuggestedPassword())

  const saveManualPassword = async () => {
    if (!passwordStaff || !isValidStaffPassword(manualPassword)) return
    setSavingPassword(true)
    try {
      await companyMeService.setStaffPassword(passwordStaff.id, { newPassword: manualPassword })
      toast.success(`${passwordStaff.fullName} için şifre belirlendi.`)
      closePasswordManager()
    } catch {
      void 0
    } finally {
      setSavingPassword(false)
    }
  }

  const copyPassword = (value: string) => {
    navigator.clipboard.writeText(value).then(() => toast.success('Şifre panoya kopyalandı.'))
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={UsersIcon}
        title="Personel Yönetimi"
        subtitle="Kampanya kullandırma yetkisi verilecek personel hesapları"
        gradient="linear-gradient(160deg, #1e3a5f 0%, #2563eb 55%, #60a5fa 100%)"
      />

      <div className="flex-1 space-y-4 overflow-auto p-4">
        <Button variant="primary" iconLeft={<UserPlusIcon className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          Personel Ekle
        </Button>

        {loadError ? (
          <EmptyState
            icon={UsersIcon}
            title="Personel listesi yüklenemedi"
            description="Bağlantınızı kontrol edip tekrar deneyin."
            action={<Button variant="outline" size="sm" onClick={load}>Tekrar Dene</Button>}
          />
        ) : staff === null ? (
          <SkeletonRows rows={3} />
        ) : staff.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="Henüz personel eklenmedi"
            description="Kampanya kullandırma işlemini kendi şifrenizle yapabilir ya da burada personel ekleyerek yetki verebilirsiniz."
          />
        ) : (
          <div className="space-y-3">
            {staff.map((s) => (
              <Card key={s.id} padded className={!s.isActive ? 'opacity-60' : ''}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="type-body-strong truncate">{s.fullName}</p>
                      <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Aktif' : 'Pasif'}</Badge>
                      {s.canRedeem
                        ? <Badge tone="info">Kullandırma Yetkili</Badge>
                        : <Badge tone="warning">Kullandırma Kapalı</Badge>}
                      {s.canManageCampaigns && <Badge tone="success">Kampanya Yönetimi Yetkili</Badge>}
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      <p className="type-caption flex items-center gap-1.5 text-foreground-subtle">
                        <PhoneIcon className="h-3 w-3 shrink-0" /> {s.phone}
                      </p>
                      {s.email && (
                        <p className="type-caption flex items-center gap-1.5 text-foreground-subtle">
                          <MailIcon className="h-3 w-3 shrink-0" /> {s.email}
                        </p>
                      )}
                      {s.lastLoginAt && (
                        <p className="type-caption text-foreground-subtle">
                          Son giriş: {new Date(s.lastLoginAt).toLocaleString('tr-TR')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)} title="Düzenle">
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openPasswordManager(s)} title="Şifre Yönetimi">
                      <KeyRoundIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(s)} title={s.isActive ? 'Pasife Al' : 'Aktifleştir'}>
                      <PowerIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(s)} title="Sil">
                      <Trash2Icon className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Personel Ekle"
        subtitle="Kampanya kullandırma yetkisi için telefon + şifre belirleyin"
        width={440}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>İptal</Button>
            <Button
              variant="primary"
              isLoading={saving}
              disabled={saving || !createForm.fullName.trim() || !createForm.phone.trim() || !isValidStaffPassword(createForm.password)}
              onClick={handleCreate}
            >
              Ekle
            </Button>
          </div>
        }
      >
        <div className="space-y-4 p-4">
          <Field label="Ad Soyad" required>
            <Input value={createForm.fullName} onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Personelin adı soyadı" />
          </Field>
          <Field label="Telefon" required hint="Personel bu numarayla giriş yapacak.">
            <Input value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} placeholder="05XX XXX XX XX" />
          </Field>
          <Field label="E-posta (opsiyonel)">
            <Input value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} placeholder="personel@ornek.com" />
          </Field>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="Şifre" required hint={`${STAFF_PASSWORD_HINT} Bu şifreyi personele siz ileteceksiniz.`}>
                <PasswordInput value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} placeholder="Şifre belirleyin" />
              </Field>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mb-0.5"
              iconLeft={<RefreshCwIcon className="h-4 w-4" />}
              onClick={() => setCreateForm((f) => ({ ...f, password: generateSuggestedPassword() }))}
              title="Güçlü bir şifre öner"
            >
              Öner
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-card border border-border bg-surface-1 px-3.5 py-3">
            <div>
              <p className="type-body-strong">Kampanya Kullandırma Yetkisi</p>
              <p className="type-caption text-foreground-muted">Kapatırsanız personel yalnızca giriş yapabilir, kullandıramaz.</p>
            </div>
            <Switch checked={createForm.canRedeem} onCheckedChange={(v) => setCreateForm((f) => ({ ...f, canRedeem: v }))} />
          </div>
          <div className="flex items-center justify-between rounded-card border border-border bg-surface-1 px-3.5 py-3">
            <div>
              <p className="type-body-strong">Kampanya Oluşturma / Düzenleme Yetkisi</p>
              <p className="type-caption text-foreground-muted">Açarsanız personel yeni kampanya oluşturabilir, mevcut kampanyaları düzenleyip silebilir.</p>
            </div>
            <Switch checked={createForm.canManageCampaigns} onCheckedChange={(v) => setCreateForm((f) => ({ ...f, canManageCampaigns: v }))} />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Personeli Düzenle"
        width={440}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>İptal</Button>
            <Button variant="primary" isLoading={saving} disabled={saving || !editForm.fullName.trim() || !editForm.phone.trim()} onClick={handleEditSave}>
              Kaydet
            </Button>
          </div>
        }
      >
        <div className="space-y-4 p-4">
          <Field label="Ad Soyad" required>
            <Input value={editForm.fullName} onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))} />
          </Field>
          <Field label="Telefon" required>
            <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="E-posta (opsiyonel)">
            <Input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <div className="flex items-center justify-between rounded-card border border-border bg-surface-1 px-3.5 py-3">
            <div>
              <p className="type-body-strong">Kampanya Kullandırma Yetkisi</p>
              <p className="type-caption text-foreground-muted">Kapatırsanız personel yalnızca giriş yapabilir, kullandıramaz.</p>
            </div>
            <Switch checked={editForm.canRedeem} onCheckedChange={(v) => setEditForm((f) => ({ ...f, canRedeem: v }))} />
          </div>
          <div className="flex items-center justify-between rounded-card border border-border bg-surface-1 px-3.5 py-3">
            <div>
              <p className="type-body-strong">Kampanya Oluşturma / Düzenleme Yetkisi</p>
              <p className="type-caption text-foreground-muted">Açarsanız personel yeni kampanya oluşturabilir, mevcut kampanyaları düzenleyip silebilir.</p>
            </div>
            <Switch checked={editForm.canManageCampaigns} onCheckedChange={(v) => setEditForm((f) => ({ ...f, canManageCampaigns: v }))} />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!passwordStaff}
        onClose={closePasswordManager}
        width={500}
        bodyClassName="bg-slate-50"
        header={
          <div className="-mx-6 -my-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 px-6 py-5 text-white">
            <div className="flex items-center gap-3 pr-10">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 shadow-sm">
                <KeyRoundIcon className="h-5 w-5 text-blue-200" />
              </span>
              <div>
                <h3 className="text-base font-bold">Personel Şifre Yönetimi</h3>
                <p className="mt-0.5 text-xs text-blue-200">Güvenli giriş şifresi oluşturun veya değiştirin</p>
              </div>
            </div>
          </div>
        }
        footer={
          passwordMode === 'manual' ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 text-[11px] text-foreground-muted">
                Şifre en az {STAFF_MIN_LENGTH} karakter olmalıdır.
              </p>
              <Button variant="outline" onClick={closePasswordManager}>Vazgeç</Button>
              <Button variant="primary" iconLeft={<ShieldCheckIcon className="h-4 w-4" />} isLoading={savingPassword} disabled={!isValidStaffPassword(manualPassword)} onClick={saveManualPassword}>
                Şifreyi Kaydet
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button variant="outline" onClick={closePasswordManager}>Kapat</Button>
            </div>
          )
        }
      >
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/70 p-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
              <UsersIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500">Şifresi değiştirilecek personel</p>
              <p className="truncate text-sm font-bold text-foreground-strong">{passwordStaff?.fullName}</p>
              {passwordStaff?.phone && <p className="mt-0.5 text-xs text-foreground-muted">{passwordStaff.phone}</p>}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-foreground-strong">Şifre oluşturma yöntemi</p>
          <SegmentedControl
            value={passwordMode}
            onChange={(v) => { setPasswordMode(v as 'random' | 'manual'); setGeneratedPassword(null) }}
            columns={2}
            options={[
              { value: 'random', label: 'Rastgele Üret', description: 'Sistem güçlü bir şifre üretir' },
              { value: 'manual', label: 'Elle Belirle', description: 'Şifreyi siz girin' },
            ]}
          />
          </div>

          {passwordMode === 'random' ? (
            generatedPassword ? (
              <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                <div>
                  <p className="text-xs font-bold text-emerald-700">Yeni şifre hazır</p>
                  <p className="mt-0.5 text-[11px] text-emerald-700/70">Şifreyi kopyalayıp personele güvenli şekilde iletin.</p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-white p-3.5">
                  <span className="font-mono text-base font-bold tracking-wider text-foreground-strong">{generatedPassword}</span>
                  <Button variant="outline" size="sm" iconLeft={<CopyIcon className="h-4 w-4" />} onClick={() => copyPassword(generatedPassword)}>
                    Kopyala
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-border bg-white p-4">
                <p className="text-xs leading-5 text-foreground-muted">Sistem güçlü ve rastgele bir şifre oluşturur. Üretilen şifre yalnızca bu ekranda gösterilir.</p>
                <Button variant="primary" className="w-full" isLoading={savingPassword} onClick={generateRandom}>
                  <RefreshCwIcon className="h-4 w-4" /> Yeni Şifre Üret
                </Button>
              </div>
            )
          ) : (
            <div className="space-y-3 rounded-lg border border-border bg-white p-4">
              <Field label="Yeni Şifre" hint={STAFF_PASSWORD_HINT}>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <PasswordInput value={manualPassword} onChange={(e) => setManualPassword(e.target.value)} placeholder="Yeni şifreyi girin" />
                  </div>
                  <Button
                    variant="outline"
                    className="h-[var(--control-h)] shrink-0"
                    iconLeft={<RefreshCwIcon className="h-4 w-4" />}
                    onClick={suggestManualPassword}
                    title="Güçlü bir şifre öner"
                  >
                    Öner
                  </Button>
                </div>
              </Field>
              <Banner tone="warning" variant="soft" icon={ShieldCheckIcon}>
                Şifreyi kaydettiğinizde personel yeni şifresiyle giriş yapmalıdır.
              </Banner>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Personeli Sil"
        width={400}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Vazgeç</Button>
            <Button variant="danger" onClick={handleDelete}>Sil</Button>
          </div>
        }
      >
        {confirmDelete && (
          <div className="p-4">
            <p className="type-body">
              <strong>{confirmDelete.fullName}</strong> adlı personeli silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
