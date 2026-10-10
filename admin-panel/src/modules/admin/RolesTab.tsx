import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ShieldCheckIcon, ShieldIcon, Users2Icon, LayersIcon,
  SearchIcon, EyeIcon, PencilIcon, Trash2Icon, PowerIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Button, IconButton, Input, Badge, StatCard, EmptyState, SectionToolbar, ConfirmModal, DrilldownCount,
  DataTable, type DataTableColumn, type SortState,
} from '@/design-system'
import permissionService from '@/services/permission.service'
import { useAuth } from '@/framework/auth/AuthContext'
import type { CatalogModule, PermissionRole, PermissionRoleDetail } from '@/types/permission.types'
import { RolePermissionModal } from './RolePermissionModal'
import { AdminsTab } from './AdminsTab'

export const RolesTab = () => {
  const { can } = useAuth()
  const [catalog, setCatalog] = useState<CatalogModule[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [roles, setRoles] = useState<PermissionRole[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [sort, setSort] = useState<SortState | null>({ key: 'name', dir: 'asc' })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PermissionRoleDetail | null>(null)
  const [viewMode, setViewMode] = useState(false)
  const [opening, setOpening] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<PermissionRole | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggleTarget, setToggleTarget] = useState<PermissionRole | null>(null)
  const [toggling, setToggling] = useState(false)

  const fetchCatalog = useCallback(async () => {
    setCatalogLoading(true)
    try {
      setCatalog(await permissionService.getCatalog())
    } catch {
      setCatalog([])
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await permissionService.getRoles({
        page: 1,
        limit: 100,
        search: search || undefined,
        sort: 'name',
        order: 'asc',
      })
      setRoles(res.items)
      setTotal(res.total)
    } catch {
      setRoles([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchCatalog()
  }, [fetchCatalog])

  useEffect(() => {
    const t = setTimeout(fetchRoles, 250)
    return () => clearTimeout(t)
  }, [fetchRoles])

  const catalogReady = !catalogLoading && catalog.length > 0

  const openAdd = () => {
    setViewMode(false)
    setEditing(null)
    setModalOpen(true)
  }

  const openDetail = async (role: PermissionRole, view: boolean) => {
    setOpening(true)
    try {
      const detail = await permissionService.getRole(role.id)
      setViewMode(view)
      setEditing(detail)
      setModalOpen(true)
    } finally {
      setOpening(false)
    }
  }
  const openEdit = (role: PermissionRole) => openDetail(role, false)
  const openView = (role: PermissionRole) => openDetail(role, true)

  const requestDelete = (role: PermissionRole) => {
    if (role.assignedUserCount > 0) {
      toast.warning(`"${role.name}" rolü ${role.assignedUserCount} yöneticiye atanmış olduğu için silinemez. Önce bu yöneticilerin rolünü değiştirin.`)
      return
    }
    setDeleteTarget(role)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await permissionService.remove(deleteTarget.id)
      toast.success('Rol silindi.')
      setDeleteTarget(null)
      fetchRoles()
    } finally {
      setDeleting(false)
    }
  }

  const selectedRoles = roles.filter((r) => selected.has(r.id))
  const deletableSelected = selectedRoles.filter((r) => !r.isSuperAdmin && r.assignedUserCount === 0)
  const blockedSelectedCount = selectedRoles.length - deletableSelected.length

  const confirmBulkDelete = async () => {
    setBulkDeleting(true)
    try {
      const results = await Promise.allSettled(deletableSelected.map((r) => permissionService.remove(r.id)))
      const ok = results.filter((r) => r.status === 'fulfilled').length
      if (ok > 0) toast.success(`${ok} rol silindi.`)
      setBulkDeleteOpen(false)
      setSelected(new Set())
      fetchRoles()
    } finally {
      setBulkDeleting(false)
    }
  }

  const requestToggle = (role: PermissionRole) => {
    if (role.isActive && role.assignedUserCount > 0) {
      toast.warning(`"${role.name}" rolü ${role.assignedUserCount} yöneticiye atanmış olduğu için pasife alınamaz. Önce bu yöneticilerin rolünü değiştirin.`)
      return
    }
    setToggleTarget(role)
  }

  const confirmToggle = async () => {
    if (!toggleTarget) return
    setToggling(true)
    try {
      await permissionService.toggleStatus(toggleTarget.id)
      toast.success(toggleTarget.isActive ? 'Rol pasife alındı.' : 'Rol aktifleştirildi.')
      setToggleTarget(null)
      fetchRoles()
    } finally {
      setToggling(false)
    }
  }

  const sortedRoles = useMemo(() => {
    if (!sort) return roles
    const dir = sort.dir === 'asc' ? 1 : -1
    const val = (r: PermissionRole): string | number => {
      switch (sort.key) {
        case 'permissions': return r.isSuperAdmin ? Number.MAX_SAFE_INTEGER : r.permissionCount ?? 0
        case 'admins': return r.assignedUserCount
        case 'status': return r.isActive ? 1 : 0
        case 'createdAt': return r.createdAt
        default: return r.name.toLocaleLowerCase('tr')
      }
    }
    return [...roles].sort((a, b) => {
      const x = val(a), y = val(b)
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'tr')) * dir
    })
  }, [roles, sort])

  const renderActions = (role: PermissionRole) => (
    <div className="flex flex-shrink-0 items-center justify-end gap-0.5">
      <IconButton tone="default" disabled={opening} onClick={() => openView(role)} aria-label="Görüntüle" title="Görüntüle">
        <EyeIcon className="h-4 w-4" />
      </IconButton>
      {can('permissions.edit') && (
        <IconButton tone="primary" disabled={opening} onClick={() => openEdit(role)} aria-label="Düzenle" title="Düzenle">
          <PencilIcon className="h-4 w-4" />
        </IconButton>
      )}
      {can('permissions.edit') && !role.isSuperAdmin && (
        <IconButton tone="default" onClick={() => requestToggle(role)} aria-label={role.isActive ? 'Pasife Al' : 'Aktif Et'} title={role.isActive ? 'Pasife Al' : 'Aktif Et'}>
          <PowerIcon className="h-4 w-4" />
        </IconButton>
      )}
      {can('permissions.delete') && !role.isSuperAdmin && (
        <IconButton tone="danger" onClick={() => requestDelete(role)} aria-label="Sil" title="Sil">
          <Trash2Icon className="h-4 w-4" />
        </IconButton>
      )}
    </div>
  )

  const renderPermissionCount = (role: PermissionRole) => (
    <button
      type="button"
      disabled={opening}
      onClick={() => openView(role)}
      title="Yetkileri görüntüle"
      className="type-caption inline-flex items-center gap-1.5 hover:text-primary hover:underline"
    >
      <ShieldCheckIcon className="h-3.5 w-3.5 text-success" />
      {role.isSuperAdmin ? 'Tüm yetkiler' : `${role.permissionCount ?? 0} yetki`}
    </button>
  )

  const renderAdminCount = (role: PermissionRole) => (
    <DrilldownCount
      count={role.assignedUserCount}
      icon={Users2Icon}
      title={`${role.name} · Atanmış Yöneticiler`}
      subtitle={`Bu role atanmış ${role.assignedUserCount} yönetici`}
      triggerLabel={`${role.assignedUserCount} yönetici`}
      triggerClassName="text-xs"
      zeroContent={
        <span className="type-caption inline-flex items-center gap-1.5">
          <Users2Icon className="h-3.5 w-3.5 text-foreground-muted" />
          0 yönetici
        </span>
      }
    >
      <AdminsTab embedded scope={{ roleId: role.id, roleName: role.name }} />
    </DrilldownCount>
  )

  const renderBadges = (role: PermissionRole) => (
    <>
      {role.isSuperAdmin && <Badge tone="danger">Süper Yönetici</Badge>}
      {role.isSystem && !role.isSuperAdmin && <Badge tone="neutral">Sistem</Badge>}
    </>
  )

  const columns: DataTableColumn<PermissionRole>[] = [
    {
      key: 'name', header: 'Rol', sortable: true, hideable: false,
      cell: (role) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: role.color || 'hsl(var(--foreground-subtle))' }} />
          <button type="button" disabled={opening} onClick={() => openView(role)} className="truncate font-medium text-foreground-strong hover:text-primary hover:underline">
            {role.name}
          </button>
          {renderBadges(role)}
        </div>
      ),
    },
    { key: 'key', header: 'Anahtar', defaultHidden: true, cell: (role) => <span className="type-caption font-mono">{role.key}</span> },
    { key: 'description', header: 'Açıklama', cell: (role) => <span className="type-muted line-clamp-1">{role.description || '—'}</span> },
    { key: 'permissions', header: 'Yetki', sortable: true, cell: renderPermissionCount },
    { key: 'admins', header: 'Yönetici', sortable: true, cell: renderAdminCount },
    { key: 'status', header: 'Durum', sortable: true, cell: (role) => <Badge tone={role.isActive ? 'success' : 'neutral'}>{role.isActive ? 'Aktif' : 'Pasif'}</Badge> },
    { key: 'createdAt', header: 'Oluşturulma', sortable: true, defaultHidden: true, cell: (role) => <span className="type-caption">{new Date(role.createdAt).toLocaleDateString('tr-TR')}</span> },
  ]

  return (
    <>
      <SectionToolbar
        icon={ShieldCheckIcon}
        title="Roller"
        subtitle="Rol = ad + içerdiği yetkiler (modül × aksiyon). Yöneticilere doğrudan bu roller atanır."
        actions={
          can('permissions.create') ? (
            <Button variant="primary" size="sm" disabled={!catalogReady || opening} onClick={openAdd}>
              + Yeni Rol
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Toplam Rol" value={total} icon={ShieldIcon} accent="blue" loading={loading} />
        <StatCard label="Aktif Rol" value={roles.filter((r) => r.isActive).length} icon={ShieldCheckIcon} accent="green" loading={loading} />
        <StatCard label="Atanmış Yönetici" value={roles.reduce((s, r) => s + r.assignedUserCount, 0)} icon={Users2Icon} accent="violet" loading={loading} />
        <StatCard label="Tanımlı Modül" value={catalog.length} icon={LayersIcon} accent="orange" loading={catalogLoading} />
      </div>

      <DataTable<PermissionRole>
        columns={columns}
        rows={sortedRoles}
        rowKey={(r) => r.id}
        loading={loading}
        sort={sort}
        onSortChange={setSort}
        rowActions={renderActions}
        actionsHeader="İşlemler"
        showRowNumbers
        selectable={can('permissions.delete')}
        selected={selected}
        onSelectedChange={setSelected}
        selectionActions={
          <Button variant="danger" size="sm" disabled={deletableSelected.length === 0} onClick={() => setBulkDeleteOpen(true)}>
            <Trash2Icon className="h-3.5 w-3.5" />
            Seçilenleri Sil
          </Button>
        }
        toolbarExtra={
          <div className="w-[28rem] max-w-full">
            <Input
              placeholder="Rol adı veya açıklama ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
              size="sm"
            />
          </div>
        }
        empty={
          <EmptyState
            icon={ShieldCheckIcon}
            title={search ? 'Eşleşen rol bulunamadı' : 'Henüz rol yok'}
            description={
              search
                ? 'Arama kriterinize uygun bir rol bulunamadı.'
                : 'İlk rolü oluşturmak için "+ Yeni Rol" butonunu kullanın.'
            }
            action={
              !search && catalogReady && can('permissions.create') ? (
                <Button variant="primary" size="sm" onClick={openAdd}>
                  + Yeni Rol
                </Button>
              ) : undefined
            }
          />
        }
      />

      <RolePermissionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setViewMode(false) }}
        catalog={catalog}
        role={editing}
        readOnlyMode={viewMode}
        onSaved={fetchRoles}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        icon={Trash2Icon}
        tone="danger"
        title="Rolü Sil"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" rolünü silmek istediğinizden emin misiniz? Bir yöneticiye atanmışsa silinemez.`
            : ''
        }
        confirmLabel="Evet, Sil"
        loading={deleting}
      />

      <ConfirmModal
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={confirmBulkDelete}
        icon={Trash2Icon}
        tone="danger"
        title="Seçili Rolleri Sil"
        description={`${deletableSelected.length} rol silinecek.${blockedSelectedCount > 0 ? ` Yöneticiye atanmış veya süper yönetici olan ${blockedSelectedCount} rol silinmeyecek.` : ''}`}
        confirmLabel="Evet, Sil"
        loading={bulkDeleting}
      />

      <ConfirmModal
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={confirmToggle}
        icon={PowerIcon}
        tone={toggleTarget?.isActive ? 'danger' : 'primary'}
        title={toggleTarget?.isActive ? 'Rolü Pasife Al' : 'Rolü Aktif Et'}
        description={
          toggleTarget
            ? toggleTarget.isActive
              ? `"${toggleTarget.name}" rolü pasife alınacak; pasif rol yeni yöneticilere atanamaz.`
              : `"${toggleTarget.name}" rolü aktif edilecek.`
            : ''
        }
        confirmLabel={toggleTarget?.isActive ? 'Evet, Pasife Al' : 'Evet, Aktif Et'}
        loading={toggling}
      />
    </>
  )
}
