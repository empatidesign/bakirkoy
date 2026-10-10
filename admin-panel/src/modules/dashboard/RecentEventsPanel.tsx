import { CalendarDaysIcon } from 'lucide-react'
import { SkeletonRows, EmptyState, Badge } from '@/design-system'
import { formatDate } from '@/lib/utils'
import type { RecentEvent } from '@/types/analytics.types'

interface Props {
  items: RecentEvent[]
  loading: boolean
}

export const RecentEventsPanel = ({ items, loading }: Props) => {
  if (loading) return <SkeletonRows rows={5} />
  if (items.length === 0) {
    return <EmptyState icon={CalendarDaysIcon} title="Etkinlik yok" description="Son oluşturulan etkinlikler burada görünecek." />
  }
  return (
    <div className="space-y-2">
      {items.map((e) => {
        const fillRate = e.capacity > 0 ? Math.round((e.applicationCount / e.capacity) * 100) : 0
        return (
          <div key={e.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-0 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate type-body-strong text-foreground-strong">{e.name}</p>
              <p className="type-caption text-foreground-muted">{e.categoryLabel} · {formatDate(e.startDate)}</p>
            </div>
            <Badge tone={fillRate >= 90 ? 'danger' : fillRate >= 60 ? 'warning' : 'success'}>
              {e.applicationCount}/{e.capacity || '∞'}
            </Badge>
          </div>
        )
      })}
    </div>
  )
}
