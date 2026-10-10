import { Building2Icon, CalendarRangeIcon, PercentIcon, TagIcon } from 'lucide-react'
import { Badge, type DataTableColumn } from '@/design-system'
import { formatDate } from '@/lib/utils'
import type { Campaign } from '@/types/campaign.types'
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_CATEGORY_LABELS,
  formatDiscount,
} from '@/types/campaign.types'

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  Active: '#16a34a',
  Scheduled: '#2563eb',
  Expired: '#64748b',
  Paused: '#d97706',
  Draft: '#7c3aed',
}

const DISCOUNT_TYPE_COLORS: Record<string, string> = {
  Percentage: '#db2777',
  Fixed: '#2563eb',
  FreeItem: '#059669',
}

const initials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()

export const campaignColumns: DataTableColumn<Campaign>[] = [
  {
    key: 'name', header: 'Kampanya', sortable: true, sortKey: 'name',
    cell: (r) => {
      const color = CAMPAIGN_STATUS_COLORS[r.status] ?? '#2563eb'
      return (
        <div className="flex items-center gap-3">
          {r.imageUrl ? (
            <img
              src={r.imageUrl}
              alt={r.name}
              className="h-10 w-[52px] shrink-0 rounded-card object-cover shadow-sm"
            />
          ) : (
            <span
              className="flex h-10 w-[52px] shrink-0 items-center justify-center rounded-card text-xs font-bold text-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
            >
              {initials(r.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground-strong">{r.name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 type-caption">
              <span className="rounded-pill bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-foreground-muted">
                {CAMPAIGN_CATEGORY_LABELS[r.category] ?? 'Diğer'}
              </span>
              {(r.products?.length ?? 0) > 0 && <span className="text-[10px] text-foreground-subtle">{r.products.length} ürün</span>}
              {r.serviceCategory && (
                <span className="flex items-center gap-1 truncate">
                  <TagIcon className="h-3 w-3 shrink-0" />
                  {r.serviceCategory.name}
                </span>
              )}
            </div>
          </div>
        </div>
      )
    },
  },
  {
    key: 'discount', header: 'İndirim', align: 'center', cell: (r) => {
      const color = DISCOUNT_TYPE_COLORS[r.discountType] ?? '#2563eb'
      return (
        <div className="flex flex-col items-center gap-1">
          <span className="inline-flex items-center gap-1.5 rounded-card px-2.5 py-1 text-[11px] font-semibold"
            style={{ color, backgroundColor: `${color}16` }}>
            <PercentIcon className="h-3.5 w-3.5" />
            {formatDiscount(r.discountType, r.discountValue)}
          </span>
          {r.minOrderAmount ? (
            <span className="type-caption text-foreground-subtle">Min. Harcama: {r.minOrderAmount.toLocaleString('tr-TR')} TL</span>
          ) : null}
        </div>
      )
    },
  },
  {
    key: 'usageCount', header: 'Kullanım', align: 'center', sortable: true, sortKey: 'usageCount',
    cell: (r) => (
      <span className="inline-flex items-center gap-1.5 rounded-card bg-info-soft px-2.5 py-1 text-[11px] font-semibold text-info">
        {(r.usageCount ?? 0).toLocaleString('tr-TR')}
        {r.totalUsageLimit != null && <span className="opacity-60">/ {r.totalUsageLimit.toLocaleString('tr-TR')}</span>}
      </span>
    ),
  },
  {
    key: 'validity', header: 'Geçerlilik', cell: (r) => (
      <div className="flex items-center gap-1.5 type-caption">
        <CalendarRangeIcon className="h-3.5 w-3.5 shrink-0 text-foreground-subtle" />
        <span className="tabular-nums">{formatDate(r.startDate)} – {formatDate(r.endDate)}</span>
      </div>
    ),
  },
  {
    key: 'status', header: 'Durum', align: 'center', sortable: true, sortKey: 'status',
    cell: (r) => {
      const color = CAMPAIGN_STATUS_COLORS[r.status] ?? '#64748b'
      return (
        <div className="flex flex-col items-center gap-1">
          <span className="inline-flex items-center gap-1.5 rounded-card px-2.5 py-1 text-[11px] font-semibold"
            style={{ color, backgroundColor: `${color}16` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            {CAMPAIGN_STATUS_LABELS[r.status] ?? r.status}
          </span>
          {r.isExhausted && <Badge tone="danger">Tükendi</Badge>}
        </div>
      )
    },
  },
]

export const campaignColumnsWithCompany: DataTableColumn<Campaign>[] = [
  {
    key: 'company', header: 'Firma', sortable: true, sortKey: 'companyName', cell: (r) => (
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-card bg-primary-soft text-primary">
          <Building2Icon className="h-3.5 w-3.5" />
        </span>
        <span className="truncate text-foreground-default">{r.companyName || '—'}</span>
      </div>
    ),
  },
  ...campaignColumns,
]
