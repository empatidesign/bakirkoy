import { useCallback, useEffect, useRef, useState } from 'react'
import { UserPlusIcon, UserIcon, IdCardIcon } from 'lucide-react'
import { Drawer, Button, Field, FormSection, Combobox, RoleBadge, DetailRow, AdminFormShell, SegmentedControl, Banner, type ComboOption } from '@/design-system'
import libraryService from '@/services/library.service'
import adminService from '@/services/admin.service'
import participantService from '@/services/participant.service'
import { useRoleColor } from '@/lib/roleColors'
import type { AdminUser } from '@/types/admin.types'
import type { Participant } from '@/types/participant.types'
import type { LibraryStaff, LibraryStaffForm } from '@/types/library.types'

interface PickedAdmin {
  fullName: string
  email?: string
  phone?: string
  roleKey?: string
  roleName?: string
}

interface PickedParticipant {
  fullName: string
  tckn: string
  email?: string
  phone?: string
}

interface Props {
  open: boolean
  libraryId: string
  editing: LibraryStaff | null
  onClose: () => void
  onSaved: () => void
}

// Kullanıcı talimatı (2026-08-04, revizyon): "kütüphane görevlilerini gerekirse
// katılımcılardan ekleyebiliriz, kişi hem katılımcı hem de görevli olabilir" —
// personel artık ya bir yöneticiden (klasik, e-posta/şifre) ya da mevcut bir
// katılımcıdan (TCKN ile, aynı kişi hem vatandaş hem görevli) atanabilir.
// Kaynak, kayıt oluşturulduktan sonra değiştirilemez (editing'de sabit gösterilir).
type StaffSource = 'admin' | 'participant'

export const StaffFormDrawer = ({ open, libraryId, editing, onClose, onSaved }: Props) => {
  const adminCacheRef = useRef<Map<string, AdminUser>>(new Map())
  const participantCacheRef = useRef<Map<string, Participant>>(new Map())
  const [source, setSource] = useState<StaffSource>('admin')
  const [adminId, setAdminId] = useState('')
  const [pickedAdmin, setPickedAdmin] = useState<PickedAdmin | null>(null)
  const [participantId, setParticipantId] = useState('')
  const [pickedParticipant, setPickedParticipant] = useState<PickedParticipant | null>(null)
  const [libIds, setLibIds] = useState<string[]>([])
  const [canEditOwnShifts, setCanEditOwnShifts] = useState(false)
  const [hasDoorAccess, setHasDoorAccess] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      const isParticipant = editing.sourceType === 'participant'
      setSource(isParticipant ? 'participant' : 'admin')
      if (isParticipant) {
        setParticipantId(editing.participantId ?? '')
        setPickedParticipant({ fullName: editing.fullName, tckn: '', email: editing.email, phone: editing.phone })
        setAdminId(''); setPickedAdmin(null)
      } else {
        setAdminId(editing.adminUserId ?? '')
        setPickedAdmin({ fullName: editing.fullName, email: editing.email, phone: editing.phone, roleName: editing.roleName ?? undefined })
        setParticipantId(''); setPickedParticipant(null)
      }
      setLibIds(editing.workingLibraryIds)
      setCanEditOwnShifts(!!editing.canEditOwnShifts)
      setHasDoorAccess(!!editing.hasDoorAccess)
    } else {
      setSource('admin')
      setAdminId(''); setPickedAdmin(null)
      setParticipantId(''); setPickedParticipant(null)
      setLibIds([libraryId]); setCanEditOwnShifts(false); setHasDoorAccess(false)
    }
  }, [open, editing, libraryId])

  const searchAdmins = useCallback(async (q: string): Promise<ComboOption[]> => {
    const res = await adminService.getList({ page: 1, limit: 10, search: q })
    res.items.forEach((a) => adminCacheRef.current.set(a.id, a))
    return res.items.map((a) => ({
      value: a.id,
      label: a.fullName,
      description: a.email,
      badge: a.roleName ? { label: a.roleName, color: a.roleColor } : undefined,
    }))
  }, [])

  const searchParticipants = useCallback(async (q: string): Promise<ComboOption[]> => {
    if (!q || q.trim().length < 2) return []
    const res = await participantService.getList({ page: 1, limit: 10, search: q })
    res.items.forEach((p) => participantCacheRef.current.set(p.id, p))
    return res.items.map((p) => ({
      value: p.id,
      label: p.fullName,
      description: p.tckn,
    }))
  }, [])

  const onSelectAdmin = (id: string) => {
    setAdminId(id)
    const a = id ? adminCacheRef.current.get(id) : undefined
    setPickedAdmin(a ? { fullName: a.fullName, email: a.email, phone: a.phone, roleKey: a.roleKey, roleName: a.roleName } : null)
  }

  const onSelectParticipant = (id: string) => {
    setParticipantId(id)
    const p = id ? participantCacheRef.current.get(id) : undefined
    setPickedParticipant(p ? { fullName: p.fullName, tckn: p.tckn, email: p.email, phone: p.phone } : null)
  }

  const roleColor = useRoleColor(pickedAdmin?.roleKey)
  const sourceValid = source === 'admin' ? !!adminId : !!participantId
  const valid = sourceValid && libIds.length > 0
  const submit = async () => {
    if (!valid) return
    setSaving(true)
    try {
      const form: LibraryStaffForm = source === 'admin'
        ? { adminUserId: adminId, participantId: null, workingLibraryIds: libIds, canEditOwnShifts, hasDoorAccess }
        : { adminUserId: null, participantId, workingLibraryIds: libIds, canEditOwnShifts, hasDoorAccess }
      if (editing) await libraryService.staff.update(editing.id, form)
      else await libraryService.staff.create(form)
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      icon={UserPlusIcon}
      width={480}
      title={editing ? 'Personel Düzenle' : 'Yeni Personel'}
      subtitle={editing ? 'Çalışma kütüphanelerini güncelleyin' : 'Yöneticiler veya katılımcılar arasından personel tanımlayın'}
      footer={
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
          <Button variant="primary" className="flex-1" isLoading={saving} disabled={!valid} onClick={submit}>
            {editing ? 'Güncelle' : 'Kaydet'}
          </Button>
        </div>
      }
    >
      <AdminFormShell
        icon={UserPlusIcon}
        title={editing ? 'Personel Düzenle' : 'Yeni Personel'}
        subtitle={editing ? 'Çalışma kütüphanelerini güncelleyin' : 'Yöneticiler veya katılımcılar arasından personel tanımlayın'}
        badge="Personel"
        tone="green"
      >
        <FormSection variant="card" title="Personel Seçimi" icon={UserIcon}>
          {!editing && (
            <Field label="Kaynak" hint="Personel ya mevcut bir yöneticiden ya da mevcut bir katılımcıdan (vatandaştan) atanabilir. Katılımcı seçilirse kişi hem vatandaş hem görevli olarak kalır, kendi kişisel QR'ını kullanır.">
              <SegmentedControl
                value={source}
                onChange={(v) => setSource(v as StaffSource)}
                options={[
                  { value: 'admin', label: 'Yönetici' },
                  { value: 'participant', label: 'Katılımcı (Vatandaş)' },
                ]}
              />
            </Field>
          )}

          {(source === 'admin' || (editing && editing.sourceType !== 'participant')) && (
            <Field label="Yönetici (Personel)" required hint="Personel mevcut yöneticilerden seçilir; ad, rol ve iletişim otomatik gelir.">
              <Combobox
                value={adminId}
                displayValue={pickedAdmin?.fullName}
                onSearch={searchAdmins}
                onChange={onSelectAdmin}
                placeholder="Yöneticilerden ara ve seç..."
                emptyText="Yönetici bulunamadı"
                iconLeft={<UserIcon className="h-4 w-4" />}
                disabled={!!editing}
                clearable
              />
            </Field>
          )}

          {(source === 'participant' && !editing) && (
            <Field label="Katılımcı (Vatandaş)" required hint="En az 2 karakter yazarak ad veya TCKN ile arayın. Seçilen kişi kendi kişisel QR'ıyla kapı giriş/çıkışı yapabilir hale gelir, vatandaş kimliği DEĞİŞMEZ.">
              <Combobox
                value={participantId}
                displayValue={pickedParticipant?.fullName}
                onSearch={searchParticipants}
                onChange={onSelectParticipant}
                placeholder="Ad veya TCKN ile ara..."
                emptyText="Katılımcı bulunamadı"
                iconLeft={<IdCardIcon className="h-4 w-4" />}
                clearable
              />
            </Field>
          )}

          {editing && editing.sourceType === 'participant' && (
            <div className="rounded-card bg-surface-1 px-4 py-2 text-sm text-foreground-muted">
              Bu personel bir katılımcı (vatandaş) kaydına bağlıdır, kaynak değiştirilemez.
            </div>
          )}

          {pickedAdmin && source === 'admin' && (
            <div className="grid grid-cols-1 gap-x-[15px] rounded-card bg-surface-1 px-4 py-2 sm:grid-cols-2">
              <DetailRow label="Rol" layout="inline">{pickedAdmin.roleName ? <RoleBadge name={pickedAdmin.roleName} color={roleColor} /> : '—'}</DetailRow>
              <DetailRow label="Telefon" layout="inline">{pickedAdmin.phone || '—'}</DetailRow>
              <DetailRow label="E-posta" layout="inline">{pickedAdmin.email || '—'}</DetailRow>
            </div>
          )}

          {pickedParticipant && source === 'participant' && (
            <div className="grid grid-cols-1 gap-x-[15px] rounded-card bg-surface-1 px-4 py-2 sm:grid-cols-2">
              <DetailRow label="TCKN" layout="inline">{pickedParticipant.tckn || '—'}</DetailRow>
              <DetailRow label="Telefon" layout="inline">{pickedParticipant.phone || '—'}</DetailRow>
              <DetailRow label="E-posta" layout="inline">{pickedParticipant.email || '—'}</DetailRow>
            </div>
          )}
        </FormSection>

        <Banner tone="info" variant="soft">
          Rol, çalışabileceği kütüphaneler, kapı erişimi ve diğer yetkiler Yönetici sayfasından yönetilir.
          Vatandaş seçildiğinde Kütüphane Görevlisi yönetici hesabı otomatik oluşturulur ve giriş bilgileri SMS ile gönderilir.
        </Banner>
      </AdminFormShell>
    </Drawer>
  )
}
