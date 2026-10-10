import { ClipboardListIcon } from 'lucide-react'
import { SkeletonRows, EmptyState, Badge } from '@/design-system'
import { formatDateTime } from '@/lib/utils'
import type { RecentApplication } from '@/types/analytics.types'

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'

interface Props {
  items: RecentApplication[]
  loading: boolean
}

const STATUS_TONE_MAP: Record<string, BadgeTone> = {
  pending: 'warning', new: 'warning', waitlist: 'warning', beklemede: 'warning',
  approved: 'success', active: 'success', confirmed: 'success', resolved: 'success', completed: 'success',
  rejected: 'danger', cancelled: 'danger', canceled: 'danger', reddedildi: 'danger',
}
const toneFor = (status: string): BadgeTone => STATUS_TONE_MAP[status.toLowerCase()] ?? 'neutral'

export const RecentApplicationsPanel = ({ items, loading }: Props) => {
  if (loading) return <SkeletonRows rows={6} />
  if (items.length === 0) {
    return <EmptyState icon={ClipboardListIcon} title="Başvuru yok" description="Yetkili olduğunuz modüllerden en son başvurular burada görünecek." />
  }
  return (
    <div className="space-y-2">
      {items.map((a) => (
        <div key={`${a.module}-${a.id}`} className="flex items-center gap-3 rounded-lg border border-border bg-surface-0 px-3 py-2">
          <Badge tone="primary">{a.moduleLabel}</Badge>
          <div className="min-w-0 flex-1">
            <p className="truncate type-body-strong text-foreground-strong">{a.applicantName}</p>
            {a.targetName && <p className="truncate type-caption text-foreground-muted">{a.targetName}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge tone={toneFor(a.status)}>{a.status}</Badge>
            <span className="type-caption tabular-nums text-foreground-subtle">{formatDateTime(a.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
