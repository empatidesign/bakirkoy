import { UserIcon, Building2Icon, CalendarIcon, QrCodeIcon } from 'lucide-react'
import { Badge, type DataTableColumn } from '@/design-system'
import { formatDate } from '@/lib/utils'
import type { CampaignRedemption } from '@/types/campaignRedemption.types'
import { CAMPAIGN_REDEMPTION_TYPE_LABELS } from '@/types/campaignRedemption.types'

const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''

export const campaignRedemptionColumns: DataTableColumn<CampaignRedemption>[] = [
  {
    key: 'participant', header: 'Vatandaş', sortable: true, sortKey: 'participantName', cell: (r) => (
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-card bg-primary-soft text-primary">
          <UserIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground-strong">{r.participantName}</p>
          <p className="truncate type-caption tabular-nums">{r.participantPhone || '—'}</p>
        </div>
      </div>
    ),
  },
  { key: 'campaign', header: 'Kampanya', cell: (r) => <span className="truncate text-foreground-default">{r.campaignName || '—'}</span> },
  {
    key: 'code', header: 'Kod', cell: (r) => (
      <span className="flex items-center gap-1.5 font-mono tabular-nums text-foreground-muted">
        <QrCodeIcon className="h-3.5 w-3.5 flex-shrink-0" />{r.redemptionCode}
      </span>
    ),
  },
  {
    key: 'redeemedAt', header: 'Kullanım Tarihi', sortable: true, sortKey: 'redeemedAt', cell: (r) => (
      <div className="flex items-center gap-1.5">
        <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0 text-foreground-subtle" />
        <span className="leading-tight">
          <span className="tabular-nums text-foreground-default">{formatDate(r.redeemedAt)}</span>
          <span className="block type-caption tabular-nums">{fmtTime(r.redeemedAt)}</span>
        </span>
      </div>
    ),
  },
  {
    key: 'redemptionType', header: 'Tür', align: 'center',
    cell: (r) => <Badge tone={r.redemptionType === 'QrScan' ? 'primary' : 'info'}>{CAMPAIGN_REDEMPTION_TYPE_LABELS[r.redemptionType]}</Badge>,
  },
]

export const campaignRedemptionColumnsWithCompany: DataTableColumn<CampaignRedemption>[] = [
  campaignRedemptionColumns[0],
  { key: 'company', header: 'Firma', sortable: true, sortKey: 'companyName', cell: (r) => (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-card bg-primary-soft text-primary">
        <Building2Icon className="h-3.5 w-3.5" />
      </span>
      <span className="truncate text-foreground-default">{r.companyName || '—'}</span>
    </div>
  ) },
  ...campaignRedemptionColumns.slice(1),
]
