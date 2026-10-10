import { useEffect, useRef } from 'react'
import { BellIcon, InboxIcon, Loader2Icon, GiftIcon } from 'lucide-react'
import { Badge } from '@/design-system'
import { cn } from '@/lib/utils'
import type { TeamNotification } from '@/types/team.types'

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
  items: TeamNotification[]
  loading: boolean
  onItemClick: (item: TeamNotification) => void
}

const referenceOf = (n: TeamNotification) => n.referenceType ?? n.type

const isGiftRequest = (n: TeamNotification) => referenceOf(n) === 'gift-request'

const formatRelative = (iso: string) => {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'az önce'
  if (min < 60) return `${min} dk önce`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} sa önce`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} gün önce`
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const NotificationPanel = ({ open, onClose, items, loading, onItemClick }: NotificationPanelProps) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 w-80 rounded-card border border-border bg-card shadow-pop z-50 overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <BellIcon className="h-4 w-4 text-foreground-muted shrink-0" />
        <span className="type-body-strong">Bildirimler</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-foreground-muted">
          <Loader2Icon className="h-4 w-4 animate-spin" />
          <span className="type-muted">Yükleniyor…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-4">
          <InboxIcon className="h-10 w-10 text-foreground-subtle" />
          <p className="type-muted">Henüz bildiriminiz yok.</p>
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onItemClick(n)}
              className={cn(
                'flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors border-b border-border last:border-b-0 hover:bg-[hsl(var(--surface-0))]',
                !n.isRead && 'bg-[hsl(var(--primary)/0.05)]'
              )}
            >
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                {isGiftRequest(n) ? <GiftIcon className="h-4 w-4" /> : <BellIcon className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="type-body-strong truncate">{n.title}</span>
                  {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </span>
                <span className="mt-0.5 block line-clamp-2 type-muted">{n.body}</span>
                <span className="mt-1 flex items-center gap-2">
                  {isGiftRequest(n) && <Badge tone="primary">Hediye Talebi</Badge>}
                  <span className="type-caption">{formatRelative(n.createdAt)}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
