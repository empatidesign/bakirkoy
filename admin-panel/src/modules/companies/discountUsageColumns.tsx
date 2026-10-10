import { UserIcon, Building2Icon, CalendarIcon } from 'lucide-react'
import { Badge, type DataTableColumn } from '@/design-system'
import { formatDate } from '@/lib/utils'
import type { DiscountUsage } from '@/types/discountUsage.types'
import { DISCOUNT_USAGE_STATUS_LABELS, DISCOUNT_USAGE_STATUS_TONE } from '@/types/discountUsage.types'

const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''

export const discountUsageColumns: DataTableColumn<DiscountUsage>[] = [
  {
    key: 'user', header: 'Kullanıcı', sortable: true, sortKey: 'userName', cell: (r) => (
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-card bg-primary-soft text-primary">
          <UserIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground-strong">{r.userName}</p>
          <p className="truncate type-caption tabular-nums">{r.userPhone || '—'}</p>
        </div>
      </div>
    ),
  },
  { key: 'campaign', header: 'Kampanya', cell: (r) => <span className="truncate text-foreground-default">{r.campaignName || '—'}</span> },
  { key: 'service', header: 'Hizmet', cell: (r) => <span className="truncate text-foreground-muted">{r.serviceName || '—'}</span> },
  {
    key: 'usedAt', header: 'Kullanım Tarihi', sortable: true, sortKey: 'usedAt', cell: (r) => (
      <div className="flex items-center gap-1.5">
        <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0 text-foreground-subtle" />
        <span className="leading-tight">
          <span className="tabular-nums text-foreground-default">{formatDate(r.usedAt)}</span>
          <span className="block type-caption tabular-nums">{fmtTime(r.usedAt)}</span>
        </span>
      </div>
    ),
  },
  {
    key: 'status', header: 'Durum', align: 'center', sortable: true, sortKey: 'status',
    cell: (r) => <Badge tone={DISCOUNT_USAGE_STATUS_TONE[r.status]}>{DISCOUNT_USAGE_STATUS_LABELS[r.status]}</Badge>,
  },
]

export const discountUsageColumnsWithCompany: DataTableColumn<DiscountUsage>[] = [
  discountUsageColumns[0],
  { key: 'company', header: 'Firma', sortable: true, sortKey: 'companyName', cell: (r) => (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-card bg-primary-soft text-primary">
        <Building2Icon className="h-3.5 w-3.5" />
      </span>
      <span className="truncate text-foreground-default">{r.companyName || '—'}</span>
    </div>
  ) },
  ...discountUsageColumns.slice(1),
]
