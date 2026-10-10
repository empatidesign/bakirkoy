import { MailIcon, PhoneIcon, ShieldIcon, LockIcon } from 'lucide-react'
import { RoleBadge, type DataTableColumn } from '@/design-system'
import type { AdminUser } from '@/types/admin.types'

const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const initials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()

export const adminColumns: DataTableColumn<AdminUser>[] = [
  {
    key: 'adSoyad', header: 'Ad Soyad', sortable: true, sortKey: 'fullName', cell: (r) => (
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-xs font-bold text-white shadow-sm"
          style={{ background: `linear-gradient(135deg, ${r.roleColor ?? '#2563eb'}, ${r.roleColor ?? '#2563eb'}cc)` }}
        >
          {initials(r.fullName)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground-strong">{r.fullName}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate type-caption">
            <MailIcon className="h-3 w-3 shrink-0" />
            {r.email}
          </p>
        </div>
      </div>
    ),
  },
  { key: 'telefon', header: 'Telefon', cell: (r) => (
    <span className="inline-flex items-center gap-1.5 type-caption text-foreground-muted">
      <PhoneIcon className="h-3 w-3 shrink-0" />
      {r.phone ?? '—'}
    </span>
  ) },
  { key: 'rol', header: 'Rol', sortable: true, sortKey: 'role', cell: (r) => <RoleBadge name={r.roleName} color={r.roleColor} /> },
  { key: 'departman', header: 'Departman', sortable: true, sortKey: 'department', cell: (r) => (
    r.department
      ? <span className="inline-flex items-center gap-1.5 rounded-card px-2.5 py-1 text-[11px] font-semibold" style={{ color: '#7c3aed', backgroundColor: '#7c3aed16' }}>
          <ShieldIcon className="h-3.5 w-3.5" />
          {r.department}
        </span>
      : <span className="text-foreground-subtle">—</span>
  ) },
  { key: 'durum', header: 'Durum', sortable: true, sortKey: 'isActive', cell: (r) => (
    <div className="flex flex-col items-start gap-1">
      <span className={`inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1 text-[11px] font-semibold ${r.isActive ? 'bg-success-soft text-success' : 'bg-surface-2 text-foreground-muted'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${r.isActive ? 'bg-success' : 'bg-foreground-subtle'}`} />
        {r.isActive ? 'Aktif' : 'Pasif'}
      </span>
      {r.isLocked && (
        <span
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-danger-soft px-2.5 py-1 text-[11px] font-semibold text-danger"
          title={r.lockedUntil ? `Kilit açılış: ${fmtDateTime(r.lockedUntil)}` : undefined}
        >
          <LockIcon className="h-3 w-3" />
          Kilitli
        </span>
      )}
    </div>
  ) },
  { key: 'sonGiris', header: 'Son Giriş', sortable: true, sortKey: 'lastLoginAt', cell: (r) => <span className="text-foreground-muted">{fmtDateTime(r.lastLoginAt)}</span> },
  { key: 'olusturma', header: 'Oluşturma', sortable: true, sortKey: 'createdAt', cell: (r) => <span className="text-foreground-muted">{fmtDate(r.createdAt)}</span> },
]
