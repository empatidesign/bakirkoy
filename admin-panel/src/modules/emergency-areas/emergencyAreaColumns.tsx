import { MapPinIcon, UsersIcon } from 'lucide-react'
import { Badge, type DataTableColumn } from '@/design-system'
import type { EmergencyArea } from '@/types/emergencyArea.types'
import { EMERGENCY_STATUS_LABELS, enabledEquipment } from '@/types/emergencyArea.types'

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const STATUS_COLORS: Record<string, string> = {
  Active: '#16a34a',
  Inactive: '#64748b',
  UnderMaintenance: '#d97706',
  Full: '#dc2626',
}

const initials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()

export const emergencyAreaColumns: DataTableColumn<EmergencyArea>[] = [
  {
    key: 'name', header: 'Toplanma Alanı', sortable: true, sortKey: 'name', cell: (r) => (
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-xs font-bold text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, #dc2626, #dc2626cc)' }}
        >
          {initials(r.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground-strong">{r.name}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate type-caption">
            <MapPinIcon className="h-3 w-3 shrink-0" />
            {r.neighborhood || '—'}
            {r.externalSource === 'AFAD_GIS' && (
              <span title={`AFAD GIS kaydı #${r.externalId ?? ''}`} className="ml-1 rounded bg-info-soft px-1.5 py-px text-[10px] font-semibold text-info">AFAD</span>
            )}
          </p>
        </div>
      </div>
    ),
  },
  { key: 'neighborhood', header: 'Mahalle', sortable: true, sortKey: 'neighborhood', cell: (r) => <span className="text-foreground-muted">{r.neighborhood || '—'}</span> },
  {
    key: 'capacity', header: 'Kapasite', align: 'center', sortable: true, sortKey: 'capacity', cell: (r) => (
      r.capacity
        ? <span className="inline-flex items-center gap-1.5 rounded-card bg-info-soft px-2.5 py-1 text-[11px] font-semibold text-info">
            <UsersIcon className="h-3.5 w-3.5" />
            {r.capacity.toLocaleString('tr-TR')} kişi
          </span>
        : <span className="text-foreground-subtle">—</span>
    ),
  },
  {
    key: 'areaSizeM2', header: 'Alan', align: 'center', sortable: true, sortKey: 'areaSizeM2', cell: (r) => (
      r.areaSizeM2
        ? <span className="inline-flex items-center gap-1.5 rounded-card bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">
            {r.areaSizeM2.toLocaleString('tr-TR')} m²
          </span>
        : <span className="text-foreground-subtle">—</span>
    ),
  },
  {
    key: 'equipment', header: 'Donanım', align: 'center', cell: (r) => {
      const items = enabledEquipment(r.equipment)
      if (items.length === 0) return <span className="type-caption text-foreground-subtle">—</span>
      return (
        <div className="flex flex-wrap items-center justify-center gap-1">
          {items.map((m) => (
            <span key={m.key} title={m.label} className="inline-flex">
              <Badge color={m.color}><m.icon className="h-3.5 w-3.5" /></Badge>
            </span>
          ))}
        </div>
      )
    },
  },
  {
    key: 'status', header: 'Durum', sortable: true, sortKey: 'status', cell: (r) => {
      const color = STATUS_COLORS[r.status] ?? '#64748b'
      return (
        <span className="inline-flex items-center gap-1.5 rounded-card px-2.5 py-1 text-[11px] font-semibold"
          style={{ color, backgroundColor: `${color}16` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          {EMERGENCY_STATUS_LABELS[r.status] ?? r.status}
        </span>
      )
    },
  },
  { key: 'createdAt', header: 'Oluşturma', sortable: true, sortKey: 'createdAt', cell: (r) => <span className="text-foreground-muted">{fmtDate(r.createdAt)}</span> },
]
