import { TrophyIcon } from 'lucide-react'
import { Badge, DataTable, EmptyState, type DataTableColumn } from '@/design-system'
import { REPORTS_MODULE_LABELS } from '@/types/reports.types'
import type { ReportsOverview, ReportsTopParticipant } from '@/types/reports.types'

const formatDateTime = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface Props {
  data: ReportsOverview
  onPick: (r: ReportsTopParticipant) => void
}

export const ReportsParticipantsTab = ({ data, onPick }: Props) => {
  const columns: DataTableColumn<ReportsTopParticipant>[] = [
    { key: 'rank', header: '#', align: 'center', cell: (_r, i) => <span className="type-caption tabular-nums font-bold text-foreground-muted">{i + 1}</span> },
    {
      key: 'fullName', header: 'Ad Soyad',
      cell: (r) => (
        <button type="button" className="text-left hover:text-primary" title="Katılım detayını gör" onClick={() => onPick(r)}>
          <span className="type-body-strong block">{r.fullName}</span>
          {r.tckn && <span className="type-caption tabular-nums">{r.tckn}</span>}
        </button>
      ),
    },
    {
      key: 'modules', header: 'Katıldığı Modüller',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {Object.entries(r.moduleBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m, c]) => (
            <Badge key={m} tone="neutral">{REPORTS_MODULE_LABELS[m] ?? m} · {c}</Badge>
          ))}
          {Object.keys(r.moduleBreakdown).length > 4 && <Badge tone="neutral">+{Object.keys(r.moduleBreakdown).length - 4}</Badge>}
        </div>
      ),
    },
    { key: 'total', header: 'Toplam Katılım', align: 'center', sortable: true, cell: (r) => <span className="type-body-strong tabular-nums">{r.totalParticipations.toLocaleString('tr-TR')}</span> },
    {
      key: 'last', header: 'Son Aktivite', hideable: true,
      cell: (r) => (
        <div className="min-w-0">
          {r.lastActivityName && (
            <p className="type-body-strong truncate max-w-[220px]" title={r.lastActivityName}>
              {r.lastActivityName}
              {r.lastActivityModuleLabel && <span className="ml-1.5 type-caption text-foreground-muted">({r.lastActivityModuleLabel})</span>}
            </p>
          )}
          <p className="type-muted whitespace-nowrap">{formatDateTime(r.lastActivityAt)}</p>
        </div>
      ),
    },
  ]

  return (
    <DataTable<ReportsTopParticipant>
      title="En Aktif Katılımcılar"
      columns={columns}
      rows={data.topParticipants}
      rowKey={(r) => r.participantId ?? r.tckn ?? r.fullName}
      empty={<EmptyState icon={TrophyIcon} title="Veri yok" description="Seçili dönemde katılım kaydı bulunamadı." />}
    />
  )
}
