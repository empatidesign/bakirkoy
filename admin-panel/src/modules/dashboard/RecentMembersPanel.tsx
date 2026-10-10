import { UserPlusIcon, MapPinIcon } from 'lucide-react'
import { SkeletonRows, EmptyState } from '@/design-system'
import { formatDateTime } from '@/lib/utils'
import type { RecentMember } from '@/types/analytics.types'

interface Props {
  items: RecentMember[]
  loading: boolean
}

export const RecentMembersPanel = ({ items, loading }: Props) => {
  if (loading) return <SkeletonRows rows={5} />
  if (items.length === 0) {
    return <EmptyState icon={UserPlusIcon} title="Yeni üye yok" description="Son kayıt olan vatandaş burada görünecek." />
  }
  return (
    <div className="space-y-2">
      {items.map((m) => (
        <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-0 px-3 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft type-caption font-bold text-primary">
            {m.fullName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate type-body-strong text-foreground-strong">{m.fullName}</p>
            <p className="flex items-center gap-1 type-caption text-foreground-muted">
              {m.district && (<><MapPinIcon className="h-3 w-3" />{m.district}</>)}
            </p>
          </div>
          <span className="shrink-0 type-caption tabular-nums text-foreground-subtle">{formatDateTime(m.registeredAt)}</span>
        </div>
      ))}
    </div>
  )
}
