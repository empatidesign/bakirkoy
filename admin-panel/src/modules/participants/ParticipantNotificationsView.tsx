import { useEffect, useState, useCallback } from 'react'
import {
  BellIcon, Loader2Icon, GiftIcon, CalendarDaysIcon, TentIcon, PlaneIcon,
  BookOpenIcon, MegaphoneIcon,
} from 'lucide-react'
import { Card, EmptyState, Badge, Button } from '@/design-system'
import { cn } from '@/lib/utils'
import participantService from '@/services/participant.service'
import type { ParticipantNotification, ParticipantDetail } from '@/types/participant.types'

interface Props {
  participant: ParticipantDetail
}

const LIMIT = 15

const referenceOf = (n: ParticipantNotification) => (n.referenceType ?? n.type ?? '').toLowerCase()

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  event: CalendarDaysIcon,
  application: CalendarDaysIcon,
  facility: TentIcon,
  facilitygroup: TentIcon,
  facilityapplication: TentIcon,
  travel: PlaneIcon,
  library: BookOpenIcon,
  campaign: MegaphoneIcon,
  'gift-request': GiftIcon,
  'gift-result': GiftIcon,
}

const iconFor = (n: ParticipantNotification) => TYPE_ICONS[referenceOf(n)] ?? BellIcon

const formatDateTime = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const ParticipantNotificationsView = ({ participant }: Props) => {
  const [items, setItems] = useState<ParticipantNotification[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async (p: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true)
    try {
      const res = await participantService.getNotifications(participant.id, { page: p, limit: LIMIT })
      setItems((prev) => (append ? [...prev, ...res.items] : res.items))
      setTotal(res.total)
      setPage(res.page)
    } catch {
      if (!append) { setItems([]); setTotal(0) }
    } finally {
      if (append) setLoadingMore(false); else setLoading(false)
    }
  }, [participant.id])

  useEffect(() => { void load(1, false) }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-foreground-muted">
        <Loader2Icon className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Card padded className="py-6 shadow-sm">
        <EmptyState
          icon={BellIcon}
          title="Bildirim yok"
          description="Bu katılımcıya henüz hiç bildirim/mesaj gönderilmemiş."
        />
      </Card>
    )
  }

  const hasMore = items.length < total

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <BellIcon className="h-4 w-4 text-primary" />
          <p className="type-section">Gönderilen Bildirim / Mesajlar ({total})</p>
        </div>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <div className="divide-y divide-border/60">
          {items.map((n) => {
            const Icon = iconFor(n)
            return (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3',
                  !n.isRead && 'bg-primary/[0.03]',
                )}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="type-body-strong truncate">{n.title}</p>
                    {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-0.5 type-body text-foreground-muted">{n.body}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {n.facilityName && <Badge tone="neutral">{n.facilityName}</Badge>}
                    {n.statusInfo && <Badge tone="info">{n.statusInfo}</Badge>}
                    <span className="type-caption">{formatDateTime(n.createdAt)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {hasMore && (
        <div className="flex justify-center pt-1">
          <Button variant="outline" size="sm" isLoading={loadingMore} onClick={() => void load(page + 1, true)}>
            Daha Fazla Göster ({items.length}/{total})
          </Button>
        </div>
      )}
    </div>
  )
}
