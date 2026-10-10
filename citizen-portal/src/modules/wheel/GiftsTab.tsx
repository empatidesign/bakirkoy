import { useEffect, useState } from 'react'
import { GiftIcon } from 'lucide-react'
import { EmptyState, Badge, PressableCard, SkeletonRows } from '@/design-system'
import { formatDate } from '@/lib/utils'
import type { CitizenGiftRequest } from '@/types/wheel.types'
import wheelService from '@/services/wheel.service'

const STATUS_TONE: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Beklemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
}

export const GiftsTab = () => {
  const [items, setItems] = useState<CitizenGiftRequest[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    wheelService.gifts({ page: 1, limit: 50 })
      .then((r) => { if (active) setItems(r.items) })
      .catch(() => { if (active) setItems([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <div className="space-y-3 p-4">
      {loading ? (
        <SkeletonRows rows={4} />
      ) : !items || items.length === 0 ? (
        <EmptyState icon={GiftIcon} title="Henüz kazanım yok" description="Çark çevirerek hediye kazanabilirsiniz." />
      ) : (
        items.map((g) => (
          <PressableCard key={g.id} onClick={() => void 0} className="items-start">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="type-body-strong">{g.giftName}</p>
                <Badge tone={STATUS_TONE[g.status] ?? 'neutral'}>
                  {STATUS_LABEL[g.status] ?? g.status}
                </Badge>
              </div>
              <p className="type-caption mt-0.5">Sipariş No: {g.orderNumber}</p>
              <p className="type-caption mt-0.5">{g.giftPoints} puan · {formatDate(g.requestedAt)}</p>
              {g.rejectReason && (
                <p className="type-caption mt-1 text-danger">{g.rejectReason}</p>
              )}
            </div>
          </PressableCard>
        ))
      )}
    </div>
  )
}
