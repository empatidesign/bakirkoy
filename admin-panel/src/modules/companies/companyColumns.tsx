import { useState } from 'react'
import { MapPinIcon, PhoneIcon } from 'lucide-react'
import { Badge, type DataTableColumn } from '@/design-system'
import type { Company } from '@/types/company.types'
import { COMPANY_STATUS_LABELS } from '@/types/company.types'

const COMPANY_STATUS_COLORS: Record<string, string> = {
  Active: '#16a34a',
  Passive: '#64748b',
  Suspended: '#dc2626',
  Pending: '#d97706',
}

const initials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()

const CompanyAvatar = ({ logo, name }: { logo?: string | null; name: string }) => {
  const [hasError, setHasError] = useState(false)
  if (logo && !hasError) {
    return (
      <img
        src={logo}
        alt=""
        onError={() => setHasError(true)}
        className="h-10 w-10 shrink-0 rounded-card border border-border object-cover"
      />
    )
  }
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-xs font-bold text-white shadow-sm"
      style={{ background: 'linear-gradient(135deg, #2563eb, #2563ebcc)' }}
    >
      {initials(name)}
    </span>
  )
}

export const buildCompanyColumns = (onNameClick: (row: Company) => void): DataTableColumn<Company>[] => [
  {
    key: 'name', header: 'Firma', sortable: true, sortKey: 'name', cell: (r) => (
      <button
        type="button"
        onClick={() => onNameClick(r)}
        className="flex w-full items-center gap-3 text-left"
      >
        <CompanyAvatar logo={r.logo} name={r.name} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground-strong hover:text-primary hover:underline">{r.name}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate type-caption">
            <MapPinIcon className="h-3 w-3 shrink-0" />
            {r.district || '—'}
          </p>
        </div>
      </button>
    ),
  },
  { key: 'taxNumber', header: 'Vergi No', sortable: true, sortKey: 'taxNumber', cell: (r) => <span className="tabular-nums text-foreground-muted">{r.taxNumber}</span> },
  {
    key: 'serviceCategory', header: 'Kategori', cell: (r) => (
      r.serviceCategory
        ? <Badge color={r.serviceCategory.color}>{r.serviceCategory.name}</Badge>
        : <span className="text-foreground-subtle">—</span>
    ),
  },
  { key: 'phone', header: 'Telefon', cell: (r) => (
    <span className="inline-flex items-center gap-1.5 type-caption text-foreground-muted">
      <PhoneIcon className="h-3 w-3 shrink-0" />
      {r.phone}
    </span>
  ) },
  {
    key: 'totalServices', header: 'Hizmet', align: 'center', sortable: true, sortKey: 'totalServices', cell: (r) => (
      <span className="inline-flex items-center gap-1 rounded-card bg-info-soft px-2.5 py-1 text-[11px] font-semibold text-info">
        {r.totalServices ?? 0}
      </span>
    ),
  },
  {
    key: 'totalCampaigns', header: 'Kampanya', align: 'center', sortable: true, sortKey: 'totalCampaigns', cell: (r) => (
      <span className="inline-flex items-center gap-1 rounded-card bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning">
        {r.totalCampaigns ?? 0}
      </span>
    ),
  },
  {
    key: 'status', header: 'Durum', align: 'center', sortable: true, sortKey: 'status', cell: (r) => {
      const color = COMPANY_STATUS_COLORS[r.status] ?? '#64748b'
      return (
        <span className="inline-flex items-center gap-1.5 rounded-card px-2.5 py-1 text-[11px] font-semibold"
          style={{ color, backgroundColor: `${color}16` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          {COMPANY_STATUS_LABELS[r.status] ?? r.status}
        </span>
      )
    },
  },
]
