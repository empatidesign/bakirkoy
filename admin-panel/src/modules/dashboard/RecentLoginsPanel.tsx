import { LogInIcon, LogOutIcon, UserIcon, ShieldIcon } from 'lucide-react'
import { SkeletonRows, EmptyState, Badge } from '@/design-system'
import { formatDateTime } from '@/lib/utils'
import type { RecentLogin } from '@/types/analytics.types'

interface Props {
  items: RecentLogin[]
  loading: boolean
}

export const RecentLoginsPanel = ({ items, loading }: Props) => {
  if (loading) return <SkeletonRows rows={5} />
  if (items.length === 0) {
    return <EmptyState icon={LogInIcon} title="Giriş/çıkış kaydı yok" description="Son oturum açma/kapatma işlemleri burada görünecek." />
  }
  return (
    <div className="space-y-2">
      {items.map((l, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-surface-0 px-3 py-2">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${l.action === 'login' ? 'bg-success-soft text-success' : 'bg-surface-2 text-foreground-muted'}`}>
            {l.action === 'login' ? <LogInIcon className="h-4 w-4" /> : <LogOutIcon className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate type-body-strong text-foreground-strong">{l.userName}</p>
            <p className="flex items-center gap-1 type-caption text-foreground-muted">
              {l.userType === 'admin' ? <ShieldIcon className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
              {l.userType === 'admin' ? 'Personel' : 'Vatandaş'}
              {l.ipAddress && ` · ${l.ipAddress}`}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge tone={l.action === 'login' ? 'success' : 'neutral'}>{l.action === 'login' ? 'Giriş' : 'Çıkış'}</Badge>
            <span className="type-caption tabular-nums text-foreground-subtle">{formatDateTime(l.occurredAt)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
