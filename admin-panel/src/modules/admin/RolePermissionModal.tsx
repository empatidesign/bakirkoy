import { useEffect, useMemo, useState } from 'react'
import {
  ShieldCheckIcon, SearchIcon, CheckCheckIcon, EraserIcon, EyeIcon,
  MapPinIcon, LockIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, Input, Textarea, Label, Badge, ToggleChip, Modal } from '@/design-system'
import { cn } from '@/lib/utils'
import permissionService from '@/services/permission.service'
import type { CatalogModule, PermissionRoleDetail } from '@/types/permission.types'
import { actionLabel, actionShort, permKey, orderActions } from '@/types/permission.types'

interface RolePermissionModalProps {
  open: boolean
  onClose: () => void
  catalog: CatalogModule[]
  role: PermissionRoleDetail | null
  onSaved: () => void
  readOnlyMode?: boolean
}

export const RolePermissionModal = ({ open, onClose, catalog, role, onSaved, readOnlyMode }: RolePermissionModalProps) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [granted, setGranted] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [showError, setShowError] = useState(false)

  const isEdit = !!role
  const readOnly = readOnlyMode || (role?.isSuperAdmin ?? false)

  useEffect(() => {
    if (!open) return
    setName(role?.name ?? '')
    setDescription(role?.description ?? '')
    setGranted(new Set(role?.permissionKeys ?? []))
    setSearch('')
    setShowError(false)
    setSaving(false)
  }, [open, role])

  const actionCols = useMemo(() => {
    const set = new Set<string>()
    catalog.forEach((m) => m.actions.forEach((a) => set.add(a)))
    return orderActions([...set])
  }, [catalog])

  const allKeys = useMemo(
    () => catalog.flatMap((m) => m.actions.map((a) => permKey(m.key, a))),
    [catalog],
  )

  const groups = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    const sorted = [...catalog].sort((a, b) => a.displayOrder - b.displayOrder)
    const filtered = q
      ? sorted.filter(
          (m) =>
            m.name.toLocaleLowerCase('tr').includes(q) || m.group.toLocaleLowerCase('tr').includes(q),
        )
      : sorted
    const map = new Map<string, CatalogModule[]>()
    filtered.forEach((m) => {
      if (!map.has(m.group)) map.set(m.group, [])
      map.get(m.group)!.push(m)
    })
    return [...map.entries()]
  }, [catalog, search])

  const toggle = (key: string) => {
    if (readOnly) return
    setGranted((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const grantAll = () => !readOnly && setGranted(new Set(allKeys))
  const clearAll = () => !readOnly && setGranted(new Set())
  const viewOnly = () =>
    !readOnly &&
    setGranted(
      new Set(catalog.filter((m) => m.actions.includes('view')).map((m) => permKey(m.key, 'view'))),
    )

  const save = async () => {
    if (!name.trim()) {
      setShowError(true)
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        permissionKeys: [...granted],
      }
      if (role) {
        await permissionService.update(role.id, payload)
        toast.success('Rol güncellendi.')
      } else {
        await permissionService.create(payload)
        toast.success('Rol oluşturuldu.')
      }
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const gridTemplate = `220px repeat(${actionCols.length}, minmax(116px, 1fr))`
  const matrixMinWidth = 220 + actionCols.length * 116

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={1360}
      className="flex max-h-[94vh] w-[96vw] max-w-[96vw] flex-col overflow-hidden"
    >
      <div className="relative flex flex-shrink-0 items-center justify-between overflow-hidden border-b border-blue-900/20 bg-gradient-to-r from-slate-900 via-blue-900 to-blue-600 px-6 py-5 text-white">
        <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/20 bg-white/15 shadow-lg backdrop-blur">
            <ShieldCheckIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold tracking-tight text-white">{readOnlyMode ? 'Rol Detayı' : isEdit ? 'Rolü Düzenle' : 'Yeni Rol'}</h3>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold text-blue-50">
                {granted.size} / {allKeys.length} yetki
              </span>
            </div>
            <p className="mt-0.5 text-sm text-blue-100">
              {isEdit ? role!.name : 'Rol adını gir ve içerdiği yetkileri (modül × aksiyon) seç'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-surface-2/60 px-6 py-5">
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
              <ShieldCheckIcon className="h-4 w-4" />
            </div>
            <div>
              <h4 className="type-body-strong">Temel Bilgiler</h4>
              <p className="type-caption text-foreground-subtle">Rol adı ve kullanım açıklamasını düzenleyin.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="space-y-1.5 lg:col-span-2">
              <Label required>Rol Adı</Label>
              <Input
                placeholder="Rol adını girin (örn. Havuz Personeli)"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (showError) setShowError(false)
                }}
                error={showError && !name.trim() ? 'Rol adı zorunludur.' : undefined}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-1.5 lg:col-span-3">
              <Label>Açıklama</Label>
              <Textarea
                placeholder="Bu rolün ne işe yaradığını kısaca açıklayın (opsiyonel)"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-success-soft text-success">
                <ShieldCheckIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="type-body-strong">Yetki Matrisi</h4>
                  <Badge tone="primary">{granted.size} seçili</Badge>
                </div>
                <p className="type-caption text-foreground-subtle">Modül bazında işlem izinlerini yönetin.</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {!readOnly && catalog.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" className="text-success hover:bg-success-soft" onClick={grantAll}>
                    <CheckCheckIcon className="h-3.5 w-3.5" /> Tümünü Seç
                  </Button>
                  <Button variant="outline" size="sm" className="text-primary hover:bg-primary-soft" onClick={viewOnly}>
                    <EyeIcon className="h-3.5 w-3.5" /> Sadece Görüntüleme
                  </Button>
                  <Button variant="outline" size="sm" className="text-danger hover:bg-danger-soft" onClick={clearAll}>
                    <EraserIcon className="h-3.5 w-3.5" /> Temizle
                  </Button>
                </div>
              )}
              <div className="w-full sm:w-64">
                <Input
                  placeholder="Modül veya grup ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
                  size="sm"
                />
              </div>
            </div>
          </div>

          {readOnly && (
            <div className="flex items-center gap-2 rounded-card border border-border bg-info-soft px-3 py-2">
              <LockIcon className="h-4 w-4 text-info" />
              <p className="type-caption">
                {role?.isSuperAdmin
                  ? 'Bu bir süper yönetici rolüdür; tüm modüllerde tam yetkiye sahiptir ve matris düzenlenemez.'
                  : 'Görüntüleme modu — yalnızca okunur. Düzenlemek için kartdaki kalem (Düzenle) butonunu kullanın.'}
              </p>
            </div>
          )}

          {catalog.length === 0 ? (
            <div className="rounded-card border border-border bg-surface-1 px-4 py-8 text-center">
              <p className="type-muted">Yetki kataloğu yüklenemedi.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
              <div
                className="grid text-left"
                style={{ gridTemplateColumns: gridTemplate, minWidth: `${matrixMinWidth}px` }}
              >
                <div className="sticky left-0 z-20 border-b border-r border-border bg-surface-2 px-4 py-3">
                  <span className="type-table-head">Modül</span>
                </div>
                {actionCols.map((a, i) => (
                  <div key={a} className={cn('border-b border-border bg-surface-2 px-2 py-3 text-center', i < actionCols.length - 1 && 'border-r')}>
                    <span className="type-table-head">{actionLabel(a)}</span>
                  </div>
                ))}

                {groups.map(([groupName, modules]) => (
                  <div key={groupName} className="contents">
                    <div className="col-span-full border-b border-border bg-info-soft/80 px-4 py-2">
                      <span className="type-caption font-bold uppercase tracking-wider text-info">{groupName}</span>
                    </div>
                    {modules.map((m, moduleIndex) => {
                      const moduleKeys = m.actions.map((a) => permKey(m.key, a))
                      const rowAll = moduleKeys.length > 0 && moduleKeys.every((k) => granted.has(k))
                      const rowBg = moduleIndex % 2 === 0 ? 'bg-card' : 'bg-surface-1/60'
                      return (
                        <div key={m.key} className="contents">
                          <div className={cn('sticky left-0 z-10 flex min-h-[52px] items-center justify-between gap-2 border-b border-r border-border px-4 py-2', rowBg)}>
                            <span className={cn('type-table-cell min-w-0 truncate', (role?.isSuperAdmin || rowAll) && 'text-primary')}>
                              {m.name}
                            </span>
                            {m.scopable && (
                              <span title="Bu modül kaynak bazlı kısıtlanabilir (tesis/salon/grup)">
                                <MapPinIcon className="h-3.5 w-3.5 flex-shrink-0 text-foreground-subtle" />
                              </span>
                            )}
                          </div>
                          {actionCols.map((a, i) => {
                            const supported = m.actions.includes(a)
                            const key = permKey(m.key, a)
                            return (
                              <div
                                key={a}
                                className={cn(
                                  'flex min-h-[52px] min-w-0 items-center justify-center border-b border-border px-2 py-1.5',
                                  i < actionCols.length - 1 && 'border-r',
                                  rowBg,
                                  supported && (role?.isSuperAdmin || granted.has(key)) && 'bg-blue-50/70',
                                )}
                              >
                                {supported ? (
                                  <ToggleChip
                                    active={role?.isSuperAdmin || granted.has(key)}
                                    disabled={readOnly}
                                    onClick={() => toggle(key)}
                                    className="w-full justify-center whitespace-nowrap px-2"
                                  >
                                    {actionShort(a)}
                                  </ToggleChip>
                                ) : (
                                  <span className="type-caption text-foreground-subtle">—</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="flex-shrink-0 space-y-3 border-t border-border bg-card px-6 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.04)]">
        {showError && !name.trim() && (
          <div className="rounded-field border border-danger/30 bg-danger-soft px-3 py-2">
            <p className="type-caption text-danger">Rol adı zorunludur.</p>
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="type-caption text-foreground-subtle">
            <span className="font-bold text-foreground">{granted.size}</span> yetki seçildi
          </p>
          <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            İptal
          </Button>
          <Button variant="primary" isLoading={saving} disabled={saving || readOnly} onClick={save}>
            {isEdit ? 'Değişiklikleri Kaydet' : 'Kaydet'}
          </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
