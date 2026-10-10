import { ArmchairIcon, BuildingIcon, LayersIcon } from 'lucide-react'
import { type DataTableColumn } from '@/design-system'
import type { Hall } from '@/types/hall.types'
import { HALL_TYPE_LABELS, SEATING_MODE_LABELS } from '@/types/hall.types'

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const HALL_TYPE_COLORS: Record<string, string> = {
  Conference: '#2563eb',
  Sports: '#16a34a',
  Multipurpose: '#7c3aed',
  Theater: '#db2777',
  Classroom: '#d97706',
  Exhibition: '#0891b2',
}

const initials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()

export const makeHallColumns = (featureName: (id: string) => string): DataTableColumn<Hall>[] => [
  {
    key: 'name', header: 'Salon', sortable: true, sortKey: 'name', cell: (r) => {
      const color = HALL_TYPE_COLORS[r.type] ?? '#2563eb'
      return (
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-xs font-bold text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
          >
            {initials(r.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground-strong">{r.name}</p>
            {r.facilityName && (
              <p className="mt-0.5 flex items-center gap-1 truncate type-caption">
                <BuildingIcon className="h-3 w-3 shrink-0" />
                {r.facilityName}
              </p>
            )}
          </div>
        </div>
      )
    },
  },
  {
    key: 'type', header: 'Tür', sortable: true, sortKey: 'type', cell: (r) => {
      const color = HALL_TYPE_COLORS[r.type] ?? '#64748b'
      return (
        <span className="inline-flex items-center gap-1.5 rounded-card px-2.5 py-1 text-[11px] font-semibold"
          style={{ color, backgroundColor: `${color}16` }}>
          <BuildingIcon className="h-3.5 w-3.5" />
          {HALL_TYPE_LABELS[r.type] ?? r.type}
        </span>
      )
    },
  },
  {
    key: 'mode', header: 'Oturma', cell: (r) => {
      const seated = r.seatingMode === 'seated'
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-card px-2.5 py-1 text-[11px] font-semibold ${seated ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-foreground-muted'}`}>
          <ArmchairIcon className="h-3.5 w-3.5" />
          {SEATING_MODE_LABELS[r.seatingMode]}
        </span>
      )
    },
  },
  {
    key: 'capacity', header: 'Kapasite', align: 'center', sortable: true, sortKey: 'capacity', cell: (r) => (
      <span className="inline-flex items-center gap-1.5 rounded-card bg-info-soft px-2.5 py-1 text-[11px] font-semibold text-info">
        <ArmchairIcon className="h-3.5 w-3.5" />
        {r.availableCapacity.toLocaleString('tr-TR')}
        {r.availableCapacity !== r.capacity && <span className="opacity-60">/ {r.capacity.toLocaleString('tr-TR')}</span>}
      </span>
    ),
  },
  {
    key: 'layout', header: 'Kat', align: 'center', cell: (r) => r.seatingMode === 'seated' ? (
      <span className="inline-flex items-center gap-1.5 type-caption text-foreground-muted">
        <LayersIcon className="h-3 w-3" />{r.floorCount} kat
      </span>
    ) : <span className="text-foreground-subtle">—</span>,
  },
  {
    key: 'features', header: 'Özellikler', cell: (r) => {
      if (!r.featureIds.length) return <span className="text-foreground-subtle">—</span>
      const shown = r.featureIds.slice(0, 2)
      const extra = r.featureIds.length - shown.length
      return (
        <div className="flex flex-wrap items-center gap-1">
          {shown.map((id) => (
            <span key={id} className="inline-flex items-center rounded-card bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-foreground-muted">
              {featureName(id)}
            </span>
          ))}
          {extra > 0 && <span className="inline-flex items-center rounded-card bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-foreground-muted">+{extra}</span>}
        </div>
      )
    },
  },
  {
    key: 'durum', header: 'Durum', sortable: true, sortKey: 'isActive', cell: (r) => (
      <span className={`inline-flex items-center gap-1.5 rounded-card px-2.5 py-1 text-[11px] font-semibold ${r.isActive ? 'bg-success-soft text-success' : 'bg-surface-2 text-foreground-muted'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${r.isActive ? 'bg-success' : 'bg-foreground-subtle'}`} />
        {r.isActive ? 'Aktif' : 'Pasif'}
      </span>
    ),
  },
  { key: 'olusturma', header: 'Oluşturma', sortable: true, sortKey: 'createdAt', cell: (r) => <span className="text-foreground-muted">{fmtDate(r.createdAt)}</span> },
]
