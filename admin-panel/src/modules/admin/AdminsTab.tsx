import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  UserIcon, Users2Icon, UserCheckIcon, UserXIcon, PowerIcon, Building2Icon, LockOpenIcon, LockIcon, IdCardIcon, KeyRoundIcon, LogInIcon, ShieldIcon,
} from 'lucide-react'
import { openAdminPanelAs } from '@/lib/muhtarBypass'
import { useAuth } from '@/framework/auth/AuthContext'
import { toast } from 'sonner'
import {
  Button, Input, PhoneInput, EmailInput, Label, Field, Badge, Switch, Banner, IconButton,
  FilterField, Select, Combobox, CredentialDeliveryCard, FormSection, SegmentedControl, type ComboOption,
} from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import adminService from '@/services/admin.service'
import departmentService from '@/services/department.service'
import roleService from '@/services/role.service'
import participantService from '@/services/participant.service'
import libraryService from '@/services/library.service'
import type { AdminUser, AdminDeliveryChannel, CreateAdminRequest, UpdateAdminRequest } from '@/types/admin.types'
import type { Participant } from '@/types/participant.types'
import type { DepartmentOption } from '@/types/department.types'
import type { RoleOption } from '@/types/role.types'
import { adminColumns } from './adminColumns'
import { AdminDepartmentHierarchy } from './AdminDepartmentHierarchy'
import { AdminPasswordSection } from './AdminPasswordSection'
import { AdminFacilityScopeSection } from './AdminFacilityScopeSection'
import { AdminLibraryDoorAccessSection } from './AdminLibraryDoorAccessSection'
import { AdminSurveyAccessSection } from './AdminSurveyAccessSection'

interface AdminForm {
  fullName: string; email: string; phone: string; department: string; role: string
  password: string
  mustChangeOnFirstLogin: boolean
  createPasswordMode: 'auto' | 'manual'
  facilityScopeIds: string[]
  libraryHasDoorAccess: boolean
  libraryIds: string[]
  isSurveyUser: boolean
  surveyAllNeighborhoods: boolean
  surveyOwnSurveysOnly: boolean
  surveyCanViewParticipants: boolean
  surveyCanViewPastSurveys: boolean
  surveyCreateOnly: boolean
  surveyNeighborhoods: string[]
}
const emptyForm: AdminForm = {
  fullName: '', email: '', phone: '', department: '', role: '', password: '', mustChangeOnFirstLogin: false,
  createPasswordMode: 'auto', facilityScopeIds: [], libraryHasDoorAccess: false, libraryIds: [],
  isSurveyUser: false, surveyAllNeighborhoods: true, surveyOwnSurveysOnly: false,
  surveyCanViewParticipants: false, surveyCanViewPastSurveys: true, surveyCreateOnly: false,
  surveyNeighborhoods: [],
}

export interface AdminsTabScope {
  roleId?: string
  roleName?: string
  department?: string
}

interface AdminsTabProps {
  scope?: AdminsTabScope
  embedded?: boolean
  editRequestId?: string | null
  onEditRequestHandled?: () => void
  createRole?: string | null
  onCreateRequestHandled?: () => void
}

export const AdminsTab = ({ scope, embedded, editRequestId, onEditRequestHandled, createRole, onCreateRequestHandled }: AdminsTabProps = {}) => {
  const createRequestSeed = useMemo<Partial<AdminForm> | null>(() => (createRole == null ? null : { role: createRole }), [createRole])
  const { can, isSuperAdmin } = useAuth()
  const [deptOptions, setDeptOptions] = useState<DepartmentOption[]>([])
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([])
  const [roleFilter, setRoleFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')

  const fetchOptions = useCallback(async () => {
    try { setDeptOptions(await departmentService.getOptions()) } catch { setDeptOptions([]) }
    try { setRoleOptions(await roleService.getOptions()) } catch { setRoleOptions([]) }
  }, [])
  useEffect(() => { fetchOptions() }, [fetchOptions])

  const maybeCreateLibraryStaff = async (adminId: string, form: AdminForm) => {
    if (!form.libraryHasDoorAccess) return
    try {
      await libraryService.staff.create({
        adminUserId: adminId, participantId: null,
        workingLibraryIds: form.libraryIds, canEditOwnShifts: false, hasDoorAccess: true,
      })
    } catch {
      toast.error('Yönetici oluşturuldu, ancak kütüphane kapı erişimi kaydı başarısız oldu. Lütfen daha sonra tekrar deneyin.')
    }
  }

  const sendCreate = async (form: AdminForm, channel: AdminDeliveryChannel, close: () => void) => {
    if (!form.fullName.trim() || !form.email.trim() || !form.role) return
    const req: CreateAdminRequest = {
      fullName: form.fullName, email: form.email,
      phone: form.phone || undefined, department: form.department || undefined,
      role: form.role, deliveryChannel: channel,
      facilityScopeIds: form.facilityScopeIds.length > 0 ? form.facilityScopeIds : undefined,
      isSurveyUser: form.isSurveyUser,
      surveyAllNeighborhoods: form.surveyAllNeighborhoods,
      surveyOwnSurveysOnly: form.surveyOwnSurveysOnly,
      surveyCanViewParticipants: form.surveyCanViewParticipants,
      surveyCanViewPastSurveys: form.surveyCanViewPastSurveys,
      surveyCreateOnly: form.surveyCreateOnly,
      surveyNeighborhoods: form.surveyNeighborhoods,
    }
    const created = await adminService.create(req)
    await maybeCreateLibraryStaff(created.id, form)
    toast.success(`Yönetici oluşturuldu. Geçici şifre ${channel === 'Email' ? 'e-posta' : 'SMS'} ile gönderildi.`)
    close()
  }

  const sendCreateManual = async (form: AdminForm, close: () => void) => {
    if (!form.fullName.trim() || !form.email.trim() || !form.role || !form.password) return
    const req: CreateAdminRequest = {
      fullName: form.fullName, email: form.email,
      phone: form.phone || undefined, department: form.department || undefined,
      role: form.role, deliveryChannel: 'Email',
      facilityScopeIds: form.facilityScopeIds.length > 0 ? form.facilityScopeIds : undefined,
      manualPassword: form.password,
      isSurveyUser: form.isSurveyUser,
      surveyAllNeighborhoods: form.surveyAllNeighborhoods,
      surveyOwnSurveysOnly: form.surveyOwnSurveysOnly,
      surveyCanViewParticipants: form.surveyCanViewParticipants,
      surveyCanViewPastSurveys: form.surveyCanViewPastSurveys,
      surveyCreateOnly: form.surveyCreateOnly,
      surveyNeighborhoods: form.surveyNeighborhoods,
    }
    const created = await adminService.create(req)
    await maybeCreateLibraryStaff(created.id, form)
    toast.success('Yönetici, belirlediğiniz şifreyle oluşturuldu.')
    close()
  }

  const [unlockingId, setUnlockingId] = useState<string | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const unlockAdmin = async (id: string, name: string) => {
    if (unlockingId) return
    setUnlockingId(id)
    try {
      await adminService.unlock(id)
      toast.success(`"${name}" hesabının kilidi kaldırıldı.`)
      setRefreshSignal((n) => n + 1)
    } finally {
      setUnlockingId(null)
    }
  }

  const [bypassingId, setBypassingId] = useState<string | null>(null)
  const goToPanel = async (id: string) => {
    if (bypassingId) return
    setBypassingId(id)
    try {
      await openAdminPanelAs(id)
    } finally {
      setBypassingId(null)
    }
  }

  return (
    <CrudListTemplate<AdminUser, AdminForm>
      icon={UserIcon}
      title="Yöneticiler"
      subtitle="Sistem yöneticilerini görüntüleyin, düzenleyin ve yönetin"
      resourceName="Yönetici"
      service={{
        getList: (p) => adminService.getList(p),
        remove: can('admins.delete') ? (id) => adminService.delete(id) : undefined,
        toggleStatus: can('admins.edit') ? (id) => adminService.toggleStatus(id) : undefined,
      }}
      rowKey={(r) => r.id}
      creatable={can('admins.create')}
      editRequestId={editRequestId}
      onEditRequestHandled={onEditRequestHandled}
      createRequestSeed={createRequestSeed}
      onCreateRequestHandled={onCreateRequestHandled}
      columns={adminColumns}
      toggleOnColumnKey="durum"
      refreshSignal={refreshSignal}
      extraRowActions={(row) => {
        const canImpersonate = can('admins.impersonate') && row.roleKey !== 'SuperAdmin'
        const canUnlock = can('admins.edit')
        if (!canImpersonate && !canUnlock) return undefined
        return (
          <>
            {canImpersonate && (
              <IconButton
                tone="primary"
                aria-label="Paneline git"
                title="Paneline git — bu yöneticinin yetkilerine göre gördüğü ekranları yeni sekmede görüntüle (yöneticinin kendi oturumu etkilenmez)"
                disabled={bypassingId === row.id}
                onClick={() => void goToPanel(row.id)}
              >
                <LogInIcon className={`h-4 w-4${bypassingId === row.id ? ' animate-pulse' : ''}`} />
              </IconButton>
            )}
            {canUnlock && (
              <IconButton
                tone={row.isLocked ? 'danger' : 'default'}
                title={row.isLocked
                  ? `Hesap kilitli${row.lockedUntil ? ` (${new Date(row.lockedUntil).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla otomatik açılır)` : ''} — kaldırmak için tıklayın`
                  : 'Hesap kilidini ve hatalı giriş sayacını sıfırla'}
                disabled={unlockingId === row.id}
                onClick={() => void unlockAdmin(row.id, row.fullName)}
              >
                {unlockingId === row.id
                  ? <LockOpenIcon className="h-4 w-4 animate-pulse" />
                  : row.isLocked ? <LockIcon className="h-4 w-4" /> : <LockOpenIcon className="h-4 w-4" />}
              </IconButton>
            )}
          </>
        )
      }}
      collapseRowActions
      defaultSort={{ key: 'createdAt', dir: 'desc' }}
      searchPlaceholder="İsim, e-posta, telefon, rol veya departman ara..."
      selectable
      viewable={!embedded}
      embedded={embedded}
      extraParams={{
        role: scope?.roleId ? '' : roleFilter,
        department: scope?.department ?? deptFilter,
        ...(scope?.roleId ? { roleId: scope.roleId } : {}),
      }}
      hasActiveFilters={(!scope?.roleId && !!roleFilter) || (!scope?.department && !!deptFilter)}
      onClearFilters={() => { if (!scope?.roleId) setRoleFilter(''); if (!scope?.department) setDeptFilter('') }}
      renderFilters={() => (
        <>
          <FilterField label="Departman">
            {scope?.department ? (
              <Select value={scope.department} disabled>
                <option value={scope.department}>{scope.department}</option>
              </Select>
            ) : (
              <Select searchable searchPlaceholder="Departman ara..." value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                <option value="">Tüm Departmanlar</option>
                {deptOptions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </Select>
            )}
          </FilterField>
          <FilterField label="Rol">
            {scope?.roleId ? (
              <Select value="__scoped" disabled>
                <option value="__scoped">{scope.roleName ?? 'Seçili rol'}</option>
              </Select>
            ) : (
              <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option value="">Tüm Roller</option>
                {roleOptions.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}
              </Select>
            )}
          </FilterField>
        </>
      )}
      stats={({ rows, total }) => [
        { label: 'Toplam Yönetici', value: total, icon: Users2Icon, accent: 'blue' },
        { label: 'Aktif Yönetici', value: rows.filter(r => r.isActive).length, icon: UserCheckIcon, accent: 'green' },
        { label: 'Pasif Yönetici', value: rows.filter(r => !r.isActive).length, icon: UserXIcon, accent: 'orange' },
      ]}
      emptyForm={emptyForm}
      toForm={(r) => ({
        fullName: r.fullName, email: r.email, phone: r.phone ?? '', department: r.department ?? '', role: r.roleKey ?? '',
        password: '', mustChangeOnFirstLogin: false, createPasswordMode: 'auto',
        facilityScopeIds: r.facilityScopeIds ?? [], libraryHasDoorAccess: false, libraryIds: [],
        isSurveyUser: r.isSurveyUser ?? false,
        surveyAllNeighborhoods: r.surveyAllNeighborhoods ?? true,
        surveyOwnSurveysOnly: r.surveyOwnSurveysOnly ?? false,
        surveyCanViewParticipants: r.surveyCanViewParticipants ?? false,
        surveyCanViewPastSurveys: r.surveyCanViewPastSurveys ?? true,
        surveyCreateOnly: r.surveyCreateOnly ?? false,
        surveyNeighborhoods: r.surveyNeighborhoods ?? [],
      })}
      getFormErrors={(f) => [
        !f.fullName.trim() && 'Ad Soyad zorunludur.',
        !f.email.trim() && 'E-posta zorunludur.',
        !f.role && 'Rol seçimi zorunludur.',
        f.phone.length < 10 && 'Geçerli bir telefon numarası giriniz.',
        !!f.password && !(f.password.length >= 8 && /\p{Lu}/u.test(f.password) && /[0-9]/.test(f.password)) &&
          'Yeni şifre en az 8 karakter, bir büyük harf ve bir rakam içermelidir.',
      ].filter(Boolean) as string[]}
      onUpdate={can('admins.edit') ? async (id, f) => {
        const selectedFacilityModule = roleOptions.find((o) => o.key === f.role)?.facilityModule
        const req: UpdateAdminRequest = {
          fullName: f.fullName, phone: f.phone || undefined, department: f.department || undefined, role: f.role, email: f.email || undefined,
          facilityScopeIds: selectedFacilityModule ? f.facilityScopeIds : undefined,
          isSurveyUser: f.isSurveyUser,
          surveyAllNeighborhoods: f.surveyAllNeighborhoods,
          surveyOwnSurveysOnly: f.surveyOwnSurveysOnly,
          surveyCanViewParticipants: f.surveyCanViewParticipants,
          surveyCanViewPastSurveys: f.surveyCanViewPastSurveys,
          surveyCreateOnly: f.surveyCreateOnly,
          surveyNeighborhoods: f.surveyNeighborhoods,
        }
        await adminService.update(id, req)
        if (f.password) {
          await adminService.setManualPassword(id, f.password, f.mustChangeOnFirstLogin)
        }
        toast.success('Değişiklikler kaydedildi.')
      } : undefined}
      canEdit={() => can('admins.edit')}
      canDelete={(r) => can('admins.delete') && r.roleKey !== 'SuperAdmin'}
      canToggle={(r) => can('admins.edit') && r.roleKey !== 'SuperAdmin'}
      isActive={(r) => r.isActive}
      deleteConfirm={{ title: 'Yöneticiyi Sil', description: 'Bu yöneticiyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.' }}
      toggleConfirm={(row, willActivate) => willActivate
        ? { title: 'Yöneticiyi Aktif Et', description: `"${row.fullName}" yeniden aktif edilecek ve giriş yapabilecek.` }
        : { title: 'Yöneticiyi Pasife Al', description: `"${row.fullName}" pasife alınacak ve sisteme girişi engellenecek. Devam edilsin mi?` }}
      drawerWidth={480}
      renderFormFooter={({ mode, saving, submit, close }) =>
        mode === 'edit' ? (
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={close}>İptal</Button>
            <Button variant="primary" className="flex-1" isLoading={saving} onClick={submit}>Güncelle</Button>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={close}>İptal</Button>
        )
      }
      renderForm={({ form, setForm, mode, editingId, editingRow, requestToggleStatus, close, refetch }) => {
        const valid = !!form.fullName.trim() && !!form.email.trim() && !!form.role && form.phone.length >= 10
          && (!form.libraryHasDoorAccess || form.libraryIds.length > 0)
        const selectedFacilityModule = roleOptions.find((o) => o.key === form.role)?.facilityModule
        const selectedRoleHasLibraryDoorPermission = !!roleOptions.find((o) => o.key === form.role)?.hasLibraryDoorPermission
        return (
          <div className="-m-5 space-y-5 px-[10px] pt-[10px] pb-5">
            {editingRow?.isLocked && (
              <UnlockBanner admin={editingRow} onUnlocked={refetch} />
            )}
            {mode === 'create' && (
              <FormSection title="Katılımcıdan Doldur" variant="card" icon={IdCardIcon}>
                <Field label="Katılımcı (Vatandaş) Ara" hint="Mevcut bir katılımcıdan (vatandaştan) yönetici hesabı oluşturmak isterseniz, ad veya TCKN ile arayıp seçin — ad, telefon ve e-posta otomatik doldurulur. Bu, aynı kişiyi yeniden yazmanıza gerek bırakmaz; hesabı normal bir yönetici hesabıdır, ayrıca rol atayarak (ör. 'Kütüphane Görevlisi') mesai düzenleme/kapı erişimi gibi yetkiler verebilirsiniz.">
                  <ParticipantFillCombobox onPick={(p) => {
                    setForm((prev) => ({
                      ...prev,
                      fullName: p.fullName,
                      phone: p.phone ?? prev.phone,
                      email: p.email ?? prev.email,
                    }))
                  }} />
                </Field>
              </FormSection>
            )}
            <FormSection title="Yönetici Bilgileri" variant="card" icon={Users2Icon}>
              <Field label="Ad Soyad" required>
                <Input placeholder="Ad ve soyadını giriniz..." sanitize="letters" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} />
              </Field>

              <Field label="E-posta Adresi" required hint={mode === 'edit' ? 'E-postayı değiştirirseniz yöneticinin açık oturumu kapatılır.' : undefined}>
                <EmailInput value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} disabled={mode === 'edit' && editingRow?.roleKey === 'SuperAdmin'} />
              </Field>

              <Field label="Telefon" required>
                <PhoneInput value={form.phone} onChange={v => setForm(p => ({ ...p, phone: v }))} />
              </Field>

              <Field label="Rol / Yetki Grubu" required hint="Seçilen rolün içindeki tüm yetkiler bu yöneticiye birlikte verilir.">
                <Combobox
                  value={form.role}
                  onChange={(value) => setForm(p => ({ ...p, role: value, facilityScopeIds: [] }))}
                  options={roleOptions.map(o => ({ value: o.key, label: o.name }))}
                  placeholder="Rol seçiniz..."
                  searchInList
                  searchPlaceholder="Rol veya yetki grubu ara..."
                  emptyText="Eşleşen rol bulunamadı"
                  clearable
                />
              </Field>

              <Field label="Departman">
                <Select searchable searchPlaceholder="Departman ara..." value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
                  <option value="">Departman seçiniz...</option>
                  {deptOptions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </Select>
              </Field>
            </FormSection>

            {selectedFacilityModule && (
              <FormSection title="Görebileceği Tesisler" variant="card" icon={Building2Icon}>
                <AdminFacilityScopeSection
                  facilityModule={selectedFacilityModule}
                  selectedIds={form.facilityScopeIds}
                  onChange={(ids) => setForm((p) => ({ ...p, facilityScopeIds: ids }))}
                />
              </FormSection>
            )}

            {mode === 'create' && selectedRoleHasLibraryDoorPermission && (
              <FormSection title="Kütüphane Kapı Erişimi" variant="card" icon={IdCardIcon}>
                <AdminLibraryDoorAccessSection
                  hasDoorAccess={form.libraryHasDoorAccess}
                  onHasDoorAccessChange={(v) => setForm((p) => ({ ...p, libraryHasDoorAccess: v }))}
                  libraryIds={form.libraryIds}
                  onLibraryIdsChange={(ids) => setForm((p) => ({ ...p, libraryIds: ids }))}
                />
              </FormSection>
            )}

            <AdminSurveyAccessSection
              value={form}
              onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
            />

            {mode === 'create' ? (
              <FormSection title="Şifre" variant="card" icon={KeyRoundIcon}>
                <SegmentedControl
                  value={form.createPasswordMode}
                  onChange={(v) => setForm((p) => ({ ...p, createPasswordMode: v as 'auto' | 'manual' }))}
                  columns={2}
                  options={[
                    { value: 'auto', label: 'Otomatik Oluştur' },
                    { value: 'manual', label: 'Manuel Belirle' },
                  ]}
                />
                {form.createPasswordMode === 'manual' ? (
                  <>
                    <Field label="Şifre" required hint="En az 8 karakter, bir büyük harf ve bir rakam içermelidir. Yönetici ilk girişte yine de değiştirmek zorundadır.">
                      <Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Şifre belirleyin..." />
                    </Field>
                    <Button
                      variant="primary" className="w-full"
                      disabled={!valid || !form.password}
                      onClick={() => sendCreateManual(form, close)}
                    >
                      Bu Şifreyle Oluştur
                    </Button>
                    {(!valid || !form.password) && (
                      <p className="type-caption text-danger">Göndermeden önce ad, e-posta, telefon, rol ve şifre alanlarını doldurun.</p>
                    )}
                  </>
                ) : (
                  <CredentialDeliveryCard
                    title="Otomatik Geçici Şifre"
                    description="Güçlü ve rastgele bir geçici şifre otomatik oluşturulur. Yönetici ilk girişte şifresini değiştirmek zorundadır. Şifrenin nasıl iletileceğini seçin:"
                    onSend={(ch) => sendCreate(form, ch, close)}
                    disabled={!valid}
                    disabledHint="Göndermeden önce ad, e-posta, telefon ve rol alanlarını doldurun."
                  />
                )}
              </FormSection>
            ) : (
              <>
                {editingRow && (
                  <FormSection title="Hesap Durumu" variant="card" icon={PowerIcon}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label>Durum</Label>
                        <Badge className="rounded-[10px]" tone={editingRow.isActive ? 'success' : 'neutral'}>{editingRow.isActive ? 'Aktif' : 'Pasif'}</Badge>
                      </div>
                      {editingRow.roleKey !== 'SuperAdmin' && (
                        <Switch
                          checked={editingRow.isActive}
                          onCheckedChange={requestToggleStatus}
                          className="h-6 w-11 rounded-[10px] [&>span]:h-5 [&>span]:w-5 [&>span]:rounded-[8px] aria-checked:[&>span]:translate-x-5"
                        />
                      )}
                    </div>
                  </FormSection>
                )}
                <FormSection title="Şifre" variant="card" icon={UserIcon}>
                  <AdminPasswordSection
                    adminId={editingId ?? undefined}
                    isSuperAdmin={editingRow?.roleKey === 'SuperAdmin'}
                    callerIsSuperAdmin={isSuperAdmin}
                    password={form.password}
                    onPasswordChange={(v) => setForm((p) => ({ ...p, password: v }))}
                    mustChange={form.mustChangeOnFirstLogin}
                    onMustChangeChange={(v) => setForm((p) => ({ ...p, mustChangeOnFirstLogin: v }))}
                  />
                </FormSection>
              </>
            )}
          </div>
        )
      }}
      altView={embedded ? undefined : {
        toggleLabel: (active) => (active ? 'Tablo Görünümü' : 'Role Göre Grupla'),
        toggleIcon: ShieldIcon,
        pageSize: 500,
        render: (rows, api) => (
          <AdminDepartmentHierarchy admins={rows} loading={api.loading} onEdit={api.openEdit} />
        ),
      }}
    />
  )
}

const fmtLockUntil = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''

const ParticipantFillCombobox = ({ onPick }: { onPick: (p: Participant) => void }) => {
  const cacheRef = useRef<Map<string, Participant>>(new Map())
  const [value, setValue] = useState('')

  const search = useCallback(async (q: string): Promise<ComboOption[]> => {
    if (!q || q.trim().length < 2) return []
    const res = await participantService.getList({ page: 1, limit: 10, search: q })
    res.items.forEach((p) => cacheRef.current.set(p.id, p))
    return res.items.map((p) => ({ value: p.id, label: p.fullName, description: p.tckn }))
  }, [])

  const onChange = (id: string) => {
    setValue(id)
    const p = id ? cacheRef.current.get(id) : undefined
    if (p) onPick(p)
  }

  return (
    <Combobox
      value={value}
      onSearch={search}
      onChange={onChange}
      placeholder="Ad veya TCKN ile ara..."
      emptyText="Katılımcı bulunamadı"
      iconLeft={<IdCardIcon className="h-4 w-4" />}
      clearable
    />
  )
}

const UnlockBanner = ({ admin, onUnlocked }: { admin: AdminUser; onUnlocked: () => void }) => {
  const { can } = useAuth()
  const [unlocking, setUnlocking] = useState(false)

  const runUnlock = async () => {
    setUnlocking(true)
    try {
      await adminService.unlock(admin.id)
      toast.success(`"${admin.fullName}" hesabının kilidi kaldırıldı.`)
      onUnlocked()
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <Banner
      tone="danger"
      variant="soft"
      icon={LockIcon}
      action={
        can('admins.edit') ? (
          <Button variant="danger" size="sm" isLoading={unlocking} onClick={runUnlock}>
            <LockOpenIcon className="h-3.5 w-3.5" /> Kilidi Kaldır
          </Button>
        ) : undefined
      }
    >
      Bu hesap {admin.failedLoginCount} hatalı giriş denemesi nedeniyle kilitlendi.
      {admin.lockedUntil && ` Kilit ${fmtLockUntil(admin.lockedUntil)} itibarıyla otomatik açılacak.`}
    </Banner>
  )
}
