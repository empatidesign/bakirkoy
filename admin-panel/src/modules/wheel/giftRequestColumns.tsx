import { AwardIcon, CircleDotIcon, FileTextIcon } from 'lucide-react'
import { Badge, type DataTableColumn } from '@/design-system'
import type { GiftRequest } from '@/types/giftRequest.types'
import {
  GIFT_REQUEST_STATUS_LABELS, GIFT_REQUEST_STATUS_TONE,
  GIFT_REQUEST_SOURCE_LABELS, GIFT_REQUEST_SOURCE_TONE,
} from '@/types/giftRequest.types'

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export const giftRequestColumns: DataTableColumn<GiftRequest>[] = [
  { key: 'orderNumber', header: 'Sıra', align: 'center', sortable: true, sortKey: 'orderNumber', cell: (r) => <span className="tabular-nums font-medium text-primary">#{r.orderNumber}</span> },
  {
    key: 'citizen', header: 'Ad Soyad', sortable: true, sortKey: 'citizenName', cell: (r) => (
      <div className="leading-tight">
        <span className="type-body-strong">{r.citizenName}</span>
        <span className="block tabular-nums type-caption">{r.citizenTc}</span>
      </div>
    ),
  },
  { key: 'phone', header: 'Telefon', cell: (r) => <span className="tabular-nums text-foreground-muted">{r.citizenPhone || '—'}</span> },
  {
    key: 'gift', header: 'Hediye', sortable: true, sortKey: 'giftName', cell: (r) => (
      <div className="leading-tight">
        <span className="text-foreground-default">{r.giftName}</span>
        <span className="block type-caption">{(r.giftPoints ?? 0).toLocaleString('tr-TR')} Puan</span>
      </div>
    ),
  },
  {
    key: 'source', header: 'Kaynak', align: 'center', cell: (r) => (
      <Badge tone={GIFT_REQUEST_SOURCE_TONE[r.source]}>
        {r.source === 'wheel' ? <CircleDotIcon className="h-3.5 w-3.5" /> : <FileTextIcon className="h-3.5 w-3.5" />}
        {GIFT_REQUEST_SOURCE_LABELS[r.source]}
      </Badge>
    ),
  },
  { key: 'requestedAt', header: 'Talep Tarihi', sortable: true, sortKey: 'requestedAt', cell: (r) => <span className="whitespace-nowrap text-foreground-muted">{fmtDate(r.requestedAt)}</span> },
  { key: 'status', header: 'Durum', align: 'center', cell: (r) => <Badge tone={GIFT_REQUEST_STATUS_TONE[r.status]}>{GIFT_REQUEST_STATUS_LABELS[r.status]}</Badge> },
  {
    key: 'winner', header: 'Kazanan', align: 'center', cell: (r) => (
      r.isWinner ? (
        <span className="inline-flex items-center gap-1">
          <Badge tone="warning"><AwardIcon className="h-3.5 w-3.5" /> Kazanan</Badge>
          {r.status === 'pending' && <Badge tone="warning">Onay Bekliyor</Badge>}
        </span>
      ) : <span className="type-caption">—</span>
    ),
  },
]
