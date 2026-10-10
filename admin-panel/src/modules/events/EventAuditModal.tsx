import { useEffect, useState } from 'react'
import { Modal, Badge, SkeletonRows } from '@/design-system'
import eventService from '@/services/event.service'
import type { Event, EventAuditEntry, EventAuditAction } from '@/types/event.types'

const ACTION_LABEL: Record<EventAuditAction, string> = {
  created: 'Oluşturuldu',
  updated: 'Güncellendi',
  deleted: 'Çöp kutusuna taşındı',
  restored: 'Geri yüklendi',
  'permanent-deleted': 'Kalıcı silindi',
  copied: 'Kopyalandı',
  'attendance-config-changed': 'Yoklama ayarı değişti',
}

const ACTION_TONE: Record<EventAuditAction, 'success' | 'info' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  created: 'success',
  updated: 'info',
  deleted: 'warning',
  restored: 'info',
  'permanent-deleted': 'danger',
  copied: 'primary',
  'attendance-config-changed': 'neutral',
}

export const EventAuditModal = ({ event, onClose }: { event: Event | null; onClose: () => void }) => {
  const [entries, setEntries] = useState<EventAuditEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!event) return
    setLoading(true)
    eventService.getAuditLog(event.id).then(setEntries).catch(() => setEntries([])).finally(() => setLoading(false))
  }, [event])

  return (
    <Modal
      open={!!event}
      onClose={onClose}
      title="İşlem Geçmişi"
      subtitle={event ? `#${event.code} · ${event.name}` : ''}
      width={560}
      bodyClassName="px-6 py-5"
    >
      {loading ? (
        <SkeletonRows rows={4} />
      ) : entries.length === 0 ? (
        <p className="type-muted">Bu etkinlik için işlem kaydı bulunamadı.</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
              <Badge tone={ACTION_TONE[e.action] ?? 'neutral'}>{ACTION_LABEL[e.action] ?? e.action}</Badge>
              <div className="min-w-0 flex-1">
                <p className="type-body-strong">{e.actorName}</p>
                {e.note && <p className="type-caption">{e.note}</p>}
              </div>
              <span className="type-caption shrink-0">{new Date(e.at).toLocaleString('tr-TR')}</span>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  )
}
