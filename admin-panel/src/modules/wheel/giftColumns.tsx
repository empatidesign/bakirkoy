import { GiftIcon } from 'lucide-react'
import { Badge, type DataTableColumn } from '@/design-system'
import type { Gift } from '@/types/gift.types'
import { GIFT_STATUS_LABELS, GIFT_STATUS_TONE } from '@/types/gift.types'

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export const giftColumns: DataTableColumn<Gift>[] = [
  {
    key: 'image', header: '', width: 'w-14', hideable: false, cell: (r) => (
      r.imageUrl ? (
        <span className="block h-10 w-10 overflow-hidden rounded-card border border-border">
          <img src={r.imageUrl} alt={r.name} className="h-full w-full object-cover" />
        </span>
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-card bg-primary-soft text-primary">
          <GiftIcon className="h-4 w-4" />
        </span>
      )
    ),
  },
  {
    key: 'name', header: 'Hediye', sortable: true, sortKey: 'name', cell: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground-strong">{r.name}</p>
        <p className="truncate type-caption">{r.description || '—'}</p>
      </div>
    ),
  },
  { key: 'points', header: 'Puan', align: 'center', sortable: true, sortKey: 'points', cell: (r) => <Badge tone="info">{(r.points ?? 0).toLocaleString('tr-TR')} Puan</Badge> },
  { key: 'stockLimit', header: 'Stok', align: 'center', sortable: true, sortKey: 'stockLimit', cell: (r) => <span className="tabular-nums text-foreground-muted">{(r.stockLimit ?? 0).toLocaleString('tr-TR')}</span> },
  { key: 'awardedCount', header: 'Kazanılan', align: 'center', cell: (r) => <span className="tabular-nums text-foreground-muted">{(r.awardedCount ?? 0).toLocaleString('tr-TR')}</span> },
  {
    key: 'remaining', header: 'Kalan', align: 'center', cell: (r) => {
      const rem = r.remaining ?? ((r.stockLimit ?? 0) - (r.awardedCount ?? 0))
      return <Badge tone={rem > 0 ? 'success' : 'danger'}>{rem.toLocaleString('tr-TR')}</Badge>
    },
  },
  { key: 'winnerPattern', header: 'Kazanan Sırası', cell: (r) => (r.winnerPattern?.length ? <span className="tabular-nums type-muted">{r.winnerPattern.join(', ')}</span> : <span className="type-caption">Tanımsız</span>) },
  {
    key: 'status', header: 'Durum', align: 'center', sortable: true, sortKey: 'status', cell: (r) => {
      const rem = r.remaining ?? ((r.stockLimit ?? 0) - (r.awardedCount ?? 0))
      if (rem <= 0) return <Badge tone="warning">Tükendi</Badge>
      return <Badge tone={GIFT_STATUS_TONE[r.status]}>{GIFT_STATUS_LABELS[r.status]}</Badge>
    },
  },
  { key: 'createdAt', header: 'Oluşturma', sortable: true, sortKey: 'createdAt', cell: (r) => <span className="text-foreground-muted">{fmtDate(r.createdAt)}</span> },
]
