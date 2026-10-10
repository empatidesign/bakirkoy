import { LayersIcon } from 'lucide-react'
import { SkeletonRows, EmptyState } from '@/design-system'
import type { ModuleRecordSummary } from '@/types/analytics.types'

interface Props {
  items: ModuleRecordSummary[]
  loading: boolean
}

export const ModuleSummariesPanel = ({ items, loading }: Props) => {
  if (loading) return <SkeletonRows rows={3} />
  if (items.length === 0) {
    return <EmptyState icon={LayersIcon} title="Modül verisi yok" description="Yetkili olduğunuz modüllerin toplam kayıt sayıları burada görünecek." />
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((m) => (
        <div key={m.module} className="rounded-lg border border-border bg-surface-0 px-3 py-2.5">
          <p className="type-caption text-foreground-muted">{m.label}</p>
          <p className="type-heading tabular-nums text-foreground-strong">{m.totalRecords.toLocaleString('tr-TR')}</p>
          {m.todayRecords > 0 && (
            <p className="type-caption font-semibold text-primary">+{m.todayRecords} bugün</p>
          )}
        </div>
      ))}
    </div>
  )
}
