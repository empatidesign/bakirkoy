import { Building2Icon, HomeIcon, LayersIcon, MapPinIcon, TreesIcon, UsersIcon } from 'lucide-react'
import { Badge, DrilldownCount, type DataTableColumn } from '@/design-system'
import type { ServiceFacility, LocationType } from '@/types/serviceFacility.types'
import {
  FACILITY_STATUS_LABELS,
  LOCATION_TYPE_LABELS, LOCATION_TYPE_TONE,
} from '@/types/serviceFacility.types'
import { REPORTS_MODULE_LABELS } from '@/types/reports.types'
import { FacilityServicesView } from './FacilityServicesView'

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const capacityOrArea = (r: ServiceFacility): string => {
  if (r.locationType === 'Outdoor' && r.areaSizeM2) return `${r.areaSizeM2.toLocaleString('tr-TR')} m²`
  if (r.capacity) return `${r.capacity.toLocaleString('tr-TR')} kişi`
  return '—'
}

const typeColors: Record<string, string> = {
  'Spor Tesisi': '#2563eb',
  'Kültür Merkezi': '#db2777',
  'Eğitim Merkezi': '#7c3aed',
  'Sosyal Tesis': '#d97706',
  'Kütüphane': '#059669',
  'Sağlık Tesisi': '#e11d48',
  'Park / Yeşil Alan': '#16a34a',
  'Diğer': '#64748b',
}

const locationIcon: Record<LocationType, typeof HomeIcon> = {
  Indoor: HomeIcon,
  Outdoor: TreesIcon,
}

const initials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()

export const facilityColumns: DataTableColumn<ServiceFacility>[] = [
  {
    key: 'name', header: 'Tesis', sortable: true, sortKey: 'name', cell: (r) => (
      <div className="flex items-center gap-3">
        {r.primaryImageUrl ? (
          <img src={r.primaryImageUrl} alt="" className="h-12 w-14 shrink-0 rounded-card border border-border object-cover" />
        ) : (
          <span
            className="flex h-12 w-14 shrink-0 items-center justify-center rounded-card text-xs font-bold text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${typeColors[r.type] ?? '#2563eb'}, ${typeColors[r.type] ?? '#2563eb'}cc)` }}
          >
            {initials(r.name)}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold text-foreground-strong">{r.name}</p>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: typeColors[r.type] ?? '#2563eb' }} />
          </div>
          <p className="mt-0.5 flex items-center gap-1 truncate type-caption">
            <MapPinIcon className="h-3 w-3 shrink-0" />
            {[r.district, r.city].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: 'type', header: 'Tür', sortable: true, sortKey: 'type', cell: (r) => {
      const color = typeColors[r.type] ?? '#64748b'
      return (
        <span className="inline-flex items-center gap-1.5 rounded-card px-2.5 py-1 text-[11px] font-semibold" style={{ color, backgroundColor: `${color}16` }}>
          <Building2Icon className="h-3.5 w-3.5" />
          {REPORTS_MODULE_LABELS[r.type] ?? (r.type || '—')}
        </span>
      )
    },
  },
  {
    key: 'locationType', header: 'Konum Tipi', cell: (r) => {
      const Icon = locationIcon[r.locationType] ?? HomeIcon
      return (
        <Badge tone={LOCATION_TYPE_TONE[r.locationType] ?? 'neutral'} className="rounded-card">
          <Icon className="h-3 w-3" />
          {LOCATION_TYPE_LABELS[r.locationType] ?? r.locationType ?? '—'}
        </Badge>
      )
    },
  },
  {
    key: 'services', header: 'Hizmetler', align: 'center', cell: (r) => (
      <DrilldownCount
        count={r.serviceCount}
        icon={LayersIcon}
        title={`${r.name} · Sunulan Hizmetler`}
        subtitle={`${r.serviceCount} hizmet tanımlı`}
        width={880}
      >
        <FacilityServicesView facility={r} />
      </DrilldownCount>
    ),
  },
  {
    key: 'capacity', header: 'Kapasite / Alan', align: 'center', cell: (r) => (
      <span className="inline-flex items-center gap-1.5 rounded-card bg-info-soft px-2.5 py-1 text-[11px] font-semibold text-info">
        <UsersIcon className="h-3.5 w-3.5" />
        {capacityOrArea(r)}
      </span>
    ),
  },
  {
    key: 'status', header: 'Durum', sortable: true, sortKey: 'status', cell: (r) => {
      const active = r.status === 'Active'
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-card px-2.5 py-1 text-[11px] font-semibold ${active ? 'bg-success-soft text-success' : 'bg-surface-2 text-foreground-muted'}`}>
          <span className={`h-1.5 w-1.5 rounded-sm ${active ? 'bg-success' : 'bg-foreground-subtle'}`} />
          {FACILITY_STATUS_LABELS[r.status]}
        </span>
      )
    },
  },
  { key: 'createdAt', header: 'Oluşturma', sortable: true, sortKey: 'createdAt', cell: (r) => <span className="text-foreground-muted">{fmtDate(r.createdAt)}</span> },
]
