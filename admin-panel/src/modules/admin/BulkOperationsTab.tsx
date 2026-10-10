import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  ShieldCheckIcon, SendIcon, MapPinIcon, PlusIcon, XIcon, Loader2Icon, UsersIcon,
} from 'lucide-react'
import {
  Button, Badge, RoleBadge, FormSection, Field, Combobox, SectionToolbar,
  IconButton, MultiSelect, type ComboOption,
} from '@/design-system'
import smsPermissionService from '@/services/smsPermission.service'
import adminService from '@/services/admin.service'
import { api } from '@/services/api'
import sessionService from '@/services/session.service'
import type { SelectOption } from '@/types/common'
import type { SmsPermissionRole } from '@/types/smsPermission.types'
import type { ScopeAssignmentKind, ScopeAssignmentTarget } from '@/types/smsPermission.types'

const FACILITY_MODULE_OPTIONS: { value: string; label: string }[] = [
  { value: 'sports', label: 'Spor Salonu' },
  { value: 'pool', label: 'Havuz' },
  { value: 'youth-camp', label: 'Gençlik Kampı' },
  { value: 'scout-camp', label: 'İzcilik Kampı' },
  { value: 'science-center', label: 'Bilim Merkezi' },
  { value: 'kasif', label: 'Kaşif Çocuk' },
  { value: 'accessible-life', label: 'Engelsiz Yaşam' },
  { value: 'women-family', label: 'Kadın ve Aile' },
]

const SCOPE_KIND_OPTIONS: { value: ScopeAssignmentKind; label: string }[] = [
  { value: 'facility', label: 'Tesis' },
  { value: 'group', label: 'Grup' },
  { value: 'session', label: 'Seans' },
]

const UserMultiPicker = ({ selected, onChange }: { selected: ComboOption[]; onChange: (v: ComboOption[]) => void }) => {
  const [value, setValue] = useState('')
  const search = useCallback(async (q: string): Promise<ComboOption[]> => {
    if (!q || q.trim().length < 2) return []
    const res = await adminService.getList({ page: 1, limit: 15, search: q })
    return res.items
      .filter((u) => !selected.some((s) => s.value === u.id))
      .map((u) => ({ value: u.id, label: u.fullName, description: u.email }))
  }, [selected])

  return (
    <div className="space-y-2">
      <Combobox
        value={value}
        onSearch={search}
        onChange={(_id, option) => {
          if (option) onChange([...selected, option])
          setValue('')
        }}
        placeholder="Ad veya e-posta ile kullanıcı ara..."
        emptyText="Kullanıcı bulunamadı"
        iconLeft={<UsersIcon className="h-4 w-4" />}
        clearable={false}
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span key={s.value} className="inline-flex items-center gap-1 rounded-pill bg-primary/10 px-2 py-1 text-xs text-primary">
              {s.label}
              <IconButton size="sm" tone="primary" onClick={() => onChange(selected.filter((x) => x.value !== s.value))} aria-label={`${s.label} seçimini kaldır`}>
                <XIcon className="h-3 w-3" />
              </IconButton>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const SmsAccessSection = () => {
  const [roles, setRoles] = useState<SmsPermissionRole[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUsers, setSelectedUsers] = useState<ComboOption[]>([])
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      setRoles(await smsPermissionService.getRoles())
    } catch {
      setRoles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  const toggleRole = (id: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const run = async (action: 'grant' | 'revoke') => {
    const userIds = selectedUsers.map((u) => u.value)
    const roleIds = [...selectedRoleIds]
    if (userIds.length === 0 && roleIds.length === 0) {
      toast.warning('En az bir kullanıcı veya rol seçin.')
      return
    }
    setSubmitting(true)
    try {
      const result = await smsPermissionService.bulkSetAccess({ userIds, roleIds, action })
      toast.success(
        action === 'grant'
          ? `SMS gönderme yetkisi verildi: ${result.usersAffected} kullanıcı, ${result.rolesAffected} rol.`
          : `SMS gönderme yetkisi kaldırıldı: ${result.usersAffected} kullanıcı, ${result.rolesAffected} rol.`,
      )
      setSelectedUsers([])
      setSelectedRoleIds(new Set())
      fetchRoles()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormSection
      title="SMS Gönderme Yetkisi"
      subtitle="Hangi kişilerin veya yetki gruplarının (rollerin) manuel SMS gönderebileceğini belirleyin. Bu yetki olmadan hiçbir modülde (Tesis, Kütüphane, Gezi, SEDA, Anket, Firma, Muhtarlık vb.) SMS gönderilemez."
      icon={SendIcon}
      variant="card"
    >
      <Field label="Roller" hint="Seçili rollere sahip TÜM kullanıcılar etkilenir.">
        {loading ? (
          <div className="flex items-center gap-2 py-3 type-muted"><Loader2Icon className="h-4 w-4 animate-spin" /> Roller yükleniyor...</div>
        ) : roles.length === 0 ? (
          <p className="type-muted">Rol bulunamadı.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={r.isSuperAdmin}
                onClick={() => toggleRole(r.id)}
                className={`flex items-center justify-between gap-2 rounded-card border px-3 py-2 text-left transition-colors ${
                  selectedRoleIds.has(r.id) ? 'border-primary bg-primary/5' : 'border-border bg-surface-1'
                } ${r.isSuperAdmin ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50'}`}
              >
                <div className="min-w-0 flex-1">
                  <RoleBadge name={r.name} color={r.color} />
                  <p className="type-caption mt-1 text-foreground-muted">{r.assignedUserCount} yönetici</p>
                </div>
                <Badge tone={r.hasSmsSendPermission ? 'success' : 'neutral'}>
                  {r.hasSmsSendPermission ? 'Gönderebilir' : 'Gönderemez'}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field label="Belirli Kişiler" hint="Rolünden bağımsız olarak, yalnızca bu kişilere özel istisna (ver/al) uygulanır.">
        <UserMultiPicker selected={selectedUsers} onChange={setSelectedUsers} />
      </Field>

      <div className="flex gap-2 border-t border-border pt-3">
        <Button variant="primary" isLoading={submitting} onClick={() => run('grant')}>
          <ShieldCheckIcon className="h-4 w-4" /> Yetki Ver
        </Button>
        <Button variant="danger" isLoading={submitting} onClick={() => run('revoke')}>
          Yetkiyi Kaldır
        </Button>
      </div>
    </FormSection>
  )
}

const lower = (v: string) => v.toLocaleLowerCase('tr')

const ScopeAssignmentSection = () => {
  const [selectedUsers, setSelectedUsers] = useState<ComboOption[]>([])
  const [roles, setRoles] = useState<SmsPermissionRole[]>([])
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [kinds, setKinds] = useState<string[]>(['facility'])
  const [moduleKeys, setModuleKeys] = useState<string[]>(['sports'])
  const [targetOptions, setTargetOptions] = useState<SelectOption[]>([])
  const [targetValues, setTargetValues] = useState<string[]>([])
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    smsPermissionService.getRoles().then(setRoles).catch(() => setRoles([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    const moduleLabel = (mk: string) => FACILITY_MODULE_OPTIONS.find((o) => o.value === mk)?.label ?? mk
    const kindLabel = (k: string) => SCOPE_KIND_OPTIONS.find((o) => o.value === k)?.label ?? k
    const loaders: Promise<SelectOption[]>[] = []
    for (const k of kinds) {
      if (k === 'session') {
        loaders.push(sessionService.getList({ limit: 100 })
          .then((r) => r.items.map((x) => ({ value: `session||${x.id}`, label: `${kindLabel(k)} · ${x.code}` })))
          .catch(() => []))
        continue
      }
      for (const mk of moduleKeys) {
        const path = k === 'facility' ? 'facilities' : 'groups'
        loaders.push(api.get<{ data: { id: string; name: string }[] }>(`/${mk}/${path}/options`)
          .then((r) => r.data.data.map((x) => ({ value: `${k}|${mk}|${x.id}`, label: `${moduleLabel(mk)} · ${kindLabel(k)} · ${x.name}` })))
          .catch(() => []))
      }
    }
    setLoadingTargets(true)
    Promise.all(loaders).then((lists) => {
      if (cancelled) return
      const opts = lists.flat().sort((x, y) => lower(x.label).localeCompare(lower(y.label), 'tr'))
      setTargetOptions(opts)
      setTargetValues((prev) => prev.filter((v) => opts.some((o) => o.value === v)))
    }).finally(() => { if (!cancelled) setLoadingTargets(false) })
    return () => { cancelled = true }
  }, [kinds, moduleKeys])

  const targets: ScopeAssignmentTarget[] = targetValues.map((v) => {
    const [kind, mk, refId] = v.split('|')
    return { kind: kind as ScopeAssignmentKind, moduleKey: mk || null, refId }
  })
  const noAssignee = selectedUsers.length === 0 && roleIds.length === 0

  const submit = async () => {
    if (noAssignee) {
      toast.warning('En az bir kullanıcı veya rol seçin.')
      return
    }
    if (targets.length === 0) {
      toast.warning('En az bir tesis/grup/seans seçin.')
      return
    }
    setSubmitting(true)
    try {
      const result = await smsPermissionService.bulkAssignScope({
        userIds: selectedUsers.map((u) => u.value), roleIds, targets,
      })
      toast.success(`Toplu kapsam ataması tamamlandı: ${result.usersAffected} kullanıcıya ${result.assignmentsApplied} yeni atama yapıldı.`)
      setSelectedUsers([])
      setRoleIds([])
      setTargetValues([])
    } finally {
      setSubmitting(false)
    }
  }

  const needsModule = kinds.some((k) => k !== 'session')

  return (
    <FormSection
      title="Toplu Kapsam Ataması"
      subtitle="Seçili kişilere veya bir rolün tüm üyelerine; birden fazla tesis, grup veya seansı tek seferde yetki alanı olarak atayın (admins.scoped-staff ile aynı veri modeli — Yöneticiler ekranındaki 'Görebileceği Tesisler' ile tutarlıdır)."
      icon={MapPinIcon}
      variant="card"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Field label="Kişiler">
          <UserMultiPicker selected={selectedUsers} onChange={setSelectedUsers} />
        </Field>
        <Field label="Roller" hint="Seçili rollere sahip TÜM kullanıcılar da dahil edilir.">
          <MultiSelect
            placement="bottom"
            values={roleIds}
            onChange={setRoleIds}
            options={roles.filter((r) => !r.isSuperAdmin).map((r) => ({ value: r.id, label: r.name }))}
            placeholder="Rol seçin..."
            searchPlaceholder="Rol ara..."
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-card border border-border bg-surface-1 p-3 lg:grid-cols-3">
        <Field label="Kapsam Türü">
          <MultiSelect
            placement="bottom"
            values={kinds}
            onChange={setKinds}
            options={SCOPE_KIND_OPTIONS}
            placeholder="Kapsam türü seçin..."
            searchPlaceholder="Tür ara..."
          />
        </Field>
        <Field label="Modül" hint={needsModule ? undefined : 'Seanslar modülden bağımsızdır.'}>
          <MultiSelect
            placement="bottom"
            values={moduleKeys}
            onChange={setModuleKeys}
            options={FACILITY_MODULE_OPTIONS}
            disabled={!needsModule}
            placeholder="Modül seçin..."
            searchPlaceholder="Modül ara..."
          />
        </Field>
        <Field label="Tesis / Grup / Seans" hint={loadingTargets ? 'Seçenekler yükleniyor...' : `${targetOptions.length} seçenek`}>
          <MultiSelect
            placement="bottom"
            values={targetValues}
            onChange={setTargetValues}
            options={targetOptions}
            disabled={loadingTargets && targetOptions.length === 0}
            placeholder="Hedef seçin..."
            searchPlaceholder="Tesis, grup veya seans ara..."
            emptyText="Sonuç bulunamadı"
          />
        </Field>
      </div>

      <div className="border-t border-border pt-3">
        <Button variant="primary" isLoading={submitting} onClick={submit} disabled={targets.length === 0 || noAssignee}>
          <PlusIcon className="h-4 w-4" /> Toplu Ata
        </Button>
      </div>
    </FormSection>
  )
}

export const BulkOperationsTab = () => {
  return (
    <>
      <SectionToolbar
        icon={ShieldCheckIcon}
        title="Toplu İşlemler"
        subtitle="SMS gönderme yetkisini ve tesis/grup/seans yetki alanlarını kişilere veya rollere toplu olarak atayın."
      />
      <div className="space-y-4">
        <SmsAccessSection />
        <ScopeAssignmentSection />
      </div>
    </>
  )
}
