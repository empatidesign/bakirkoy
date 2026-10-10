import { CircleDotIcon, GiftIcon } from 'lucide-react'
import { type DataTableColumn } from '@/design-system'
import type { Wheel } from '@/types/wheel.types'
import { WHEEL_STATUS_LABELS } from '@/types/wheel.types'

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const STATUS_COLORS: Record<string, string> = {
  Active: '#16a34a',
  Passive: '#64748b',
  Draft: '#d97706',
  Ended: '#dc2626',
}

export const wheelColumns: DataTableColumn<Wheel>[] = [
  {
    key: 'title', header: 'Çark', sortable: true, sortKey: 'title', cell: (r) => (
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-xs font-bold text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #7c3aedcc)' }}
        >
          <CircleDotIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground-strong">{r.title}</p>
          <p className="mt-0.5 truncate type-caption">{r.description || '—'}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'slices', header: 'Dilimler', align: 'center', cell: (r) => (
      <div className="flex items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-card bg-info-soft px-2.5 py-1 text-[11px] font-semibold text-info">
          <GiftIcon className="h-3.5 w-3.5" />
          {r.slices.length} dilim
        </span>
        <span className="flex items-center gap-0.5">
          {r.slices.slice(0, 6).map((s, i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
          ))}
        </span>
      </div>
    ),
  },
  {
    key: 'totalSpins', header: 'Çevirme', align: 'center', sortable: true, sortKey: 'totalSpins', cell: (r) => (
      <span className="inline-flex items-center gap-1.5 rounded-card bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary">
        {(r.totalSpins ?? 0).toLocaleString('tr-TR')}
      </span>
    ),
  },
  {
    key: 'status', header: 'Durum', align: 'center', sortable: true, sortKey: 'status', cell: (r) => {
      const color = STATUS_COLORS[r.status] ?? '#64748b'
      return (
        <span className="inline-flex items-center gap-1.5 rounded-card px-2.5 py-1 text-[11px] font-semibold"
          style={{ color, backgroundColor: `${color}16` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          {WHEEL_STATUS_LABELS[r.status] ?? r.status}
        </span>
      )
    },
  },
  { key: 'createdAt', header: 'Oluşturma', sortable: true, sortKey: 'createdAt', cell: (r) => <span className="text-foreground-muted">{fmtDate(r.createdAt)}</span> },
]
