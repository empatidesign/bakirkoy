import { useMemo, useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon, ShieldIcon, MailIcon, PhoneIcon, PencilIcon, Building2Icon } from 'lucide-react'
import { Badge, Card, EmptyState, IconButton, Skeleton } from '@/design-system'
import type { AdminUser } from '@/types/admin.types'

interface Props {
  admins: AdminUser[]
  loading?: boolean
  onEdit: (admin: AdminUser) => void
}

interface RoleBucket {
  roleKey: string
  roleName: string
  roleColor?: string
  admins: AdminUser[]
}

const UNASSIGNED_ROLE = 'Rol Atanmamış'

const initials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()

// Kullanıcı isteği (2026-09-20): "/admin sayfasında yöneticileri gruplu göster: muhtarlar,
// süper yöneticiler vs gibi" — önceki sürüm önce departmana, sonra role göre gruplayıp iki
// seviyeli bir hiyerarşi kuruyordu; kullanıcı doğrudan rol bazlı gruplama istedi (SuperAdmin
// rolü her zaman en üstte, gerisi Türkçe alfabetik). Departman bilgisi artık satır içinde
// gösteriliyor ama ayrı bir gruplama seviyesi değil.
export const AdminDepartmentHierarchy = ({ admins, loading, onEdit }: Props) => {
  const buckets = useMemo<RoleBucket[]>(() => {
    const map = new Map<string, RoleBucket>()
    for (const a of admins) {
      const roleKey = a.roleKey ?? '__unknown'
      if (!map.has(roleKey)) {
        map.set(roleKey, { roleKey, roleName: a.roleName || UNASSIGNED_ROLE, roleColor: a.roleColor, admins: [] })
      }
      map.get(roleKey)!.admins.push(a)
    }
    const arr = Array.from(map.values())
    arr.sort((a, b) => {
      if (a.roleKey === 'SuperAdmin') return -1
      if (b.roleKey === 'SuperAdmin') return 1
      if (a.roleKey === '__unknown') return 1
      if (b.roleKey === '__unknown') return -1
      return a.roleName.localeCompare(b.roleName, 'tr')
    })
    return arr
  }, [admins])

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (key: string) => setCollapsed((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })

  if (loading) return <Skeleton className="h-64 w-full" />

  if (buckets.length === 0) {
    return (
      <Card className="py-4">
        <EmptyState
          icon={ShieldIcon}
          title="Henüz yönetici yok"
          description="Role göre gruplama için önce yönetici ekleyin."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {buckets.map((b) => {
        const open = !collapsed.has(b.roleKey)
        const activeCount = b.admins.filter((a) => a.isActive).length
        const tone = activeCount === 0 ? 'neutral' : activeCount === b.admins.length ? 'success' : 'warning'
        return (
          <div key={b.roleKey} className="overflow-hidden rounded-card border border-border">
            <button
              type="button"
              onClick={() => toggle(b.roleKey)}
              className="flex w-full items-center gap-3 bg-surface-1 px-4 py-3 text-left transition-colors hover:bg-surface-2"
            >
              {open ? <ChevronDownIcon className="h-4 w-4 text-foreground-muted" /> : <ChevronRightIcon className="h-4 w-4 text-foreground-muted" />}
              <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: b.roleColor || 'hsl(var(--foreground-subtle))' }} />
              <span className="type-section flex-1 truncate">{b.roleName}</span>
              {b.roleKey === 'SuperAdmin' && <Badge tone="danger">Süper Yönetici</Badge>}
              <span className="type-caption whitespace-nowrap">{b.admins.length} yönetici</span>
              <Badge tone={tone}>{activeCount}/{b.admins.length} aktif</Badge>
            </button>
            {open && (
              <div className="divide-y divide-border">
                {b.admins.map((a) => (
                  <AdminRow key={a.id} admin={a} onEdit={onEdit} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const AdminRow = ({ admin, onEdit }: { admin: AdminUser; onEdit: (a: AdminUser) => void }) => (
  <div className="flex items-center gap-3 pl-10 pr-4 py-2.5 transition-colors hover:bg-surface-1">
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-card text-[10px] font-bold text-white shadow-sm"
      style={{ background: `linear-gradient(135deg, ${admin.roleColor ?? '#2563eb'}, ${admin.roleColor ?? '#2563eb'}cc)` }}
    >
      {initials(admin.fullName)}
    </span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-body-strong">{admin.fullName}</span>
        <Badge tone={admin.isActive ? 'success' : 'neutral'}>{admin.isActive ? 'Aktif' : 'Pasif'}</Badge>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="inline-flex items-center gap-1 type-caption">
          <MailIcon className="h-3 w-3 shrink-0" />{admin.email}
        </span>
        <span className="inline-flex items-center gap-1 type-caption">
          <PhoneIcon className="h-3 w-3 shrink-0" />{admin.phone ?? '—'}
        </span>
        {admin.department && (
          <span className="inline-flex items-center gap-1 type-caption">
            <Building2Icon className="h-3 w-3 shrink-0" />{admin.department}
          </span>
        )}
      </div>
    </div>
    <IconButton title="Düzenle" onClick={() => onEdit(admin)}>
      <PencilIcon className="h-4 w-4" />
    </IconButton>
  </div>
)
