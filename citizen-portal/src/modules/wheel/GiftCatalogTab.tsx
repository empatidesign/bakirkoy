import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { GiftIcon, CoinsIcon, StarIcon, PackageIcon } from 'lucide-react'
import { Button, Badge, EmptyState, ConfirmModal } from '@/design-system'
import type { AvailableGift } from '@/types/wheel.types'
import wheelService from '@/services/wheel.service'

type DisabledReason = 'pending' | 'out_of_stock' | 'insufficient' | null

const reasonLabel = (reason: DisabledReason): string => {
  if (reason === 'pending') return 'Talebiniz beklemede'
  if (reason === 'out_of_stock') return 'Stok tükendi'
  if (reason === 'insufficient') return 'Yetersiz puan'
  return ''
}

const resolveReason = (gift: AvailableGift, balance: number): DisabledReason => {
  if (gift.hasPendingRequest) return 'pending'
  if (gift.remaining <= 0) return 'out_of_stock'
  if (balance < gift.points) return 'insufficient'
  return null
}

type GiftCardProps = {
  gift: AvailableGift
  balance: number
  onApply: (gift: AvailableGift) => void
}

const GiftCard = ({ gift, balance, onApply }: GiftCardProps) => {
  const reason = resolveReason(gift, balance)
  const disabled = reason !== null

  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-border bg-surface-0 shadow-sm">
      {gift.imageUrl ? (
        <img src={gift.imageUrl} alt={gift.name} className="h-32 w-full object-cover" />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-primary-soft">
          <GiftIcon className="h-10 w-10 text-primary" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-3">
        <p className="type-body-strong line-clamp-2">{gift.name}</p>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CoinsIcon className="h-4 w-4 text-warning" />
            <span className="type-body-strong">{gift.points.toLocaleString('tr-TR')} puan</span>
          </div>
          {gift.remaining <= 0 ? (
            <Badge tone="neutral">Tükendi</Badge>
          ) : (
            <Badge tone={gift.remaining <= 5 ? 'warning' : 'success'}>{gift.remaining} adet</Badge>
          )}
        </div>

        <div className="mt-auto pt-3">
          <Button
            size="sm"
            className="w-full"
            disabled={disabled}
            onClick={() => onApply(gift)}
          >
            Başvur
          </Button>
          {disabled && (
            <p className="mt-1.5 type-caption text-center text-foreground-muted">{reasonLabel(reason)}</p>
          )}
        </div>
      </div>
    </div>
  )
}

const GiftCardSkeleton = () => (
  <div className="overflow-hidden rounded-card border border-border bg-surface-0">
    <div className="h-32 w-full animate-pulse bg-surface-2" />
    <div className="space-y-2 p-3">
      <div className="h-4 animate-pulse rounded-field bg-surface-2" />
      <div className="h-4 w-2/3 animate-pulse rounded-field bg-surface-2" />
      <div className="h-8 animate-pulse rounded-field bg-surface-2" />
    </div>
  </div>
)

export const GiftCatalogTab = () => {
  const [gifts, setGifts] = useState<AvailableGift[] | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmGift, setConfirmGift] = useState<AvailableGift | null>(null)
  const [applying, setApplying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await wheelService.getAvailableGifts()
      setGifts(data.gifts)
      setBalance(data.balance)
    } catch {
      setGifts([])
      setBalance(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleConfirm = async () => {
    if (!confirmGift) return
    setApplying(true)
    try {
      await wheelService.applyForGift(confirmGift.id)
      toast.success('Hediye başvurunuz alındı.')
      setConfirmGift(null)
      await load()
    } catch {
      setConfirmGift(confirmGift)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3 rounded-card border border-border bg-primary-soft p-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-surface-0">
          <StarIcon className="h-5 w-5 fill-warning text-warning" />
        </div>
        <div>
          <p className="type-caption text-foreground-muted">Mevcut Bakiyem</p>
          <p className="type-kpi-value text-primary">{(balance ?? 0).toLocaleString('tr-TR')} puan</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <GiftCardSkeleton key={i} />)}
        </div>
      ) : !gifts || gifts.length === 0 ? (
        <EmptyState icon={GiftIcon} title="Hediye yok" description="Şu anda puanla başvurabileceğiniz hediye bulunmuyor." />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {gifts.map((g) => (
            <GiftCard key={g.id} gift={g} balance={balance ?? 0} onApply={setConfirmGift} />
          ))}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-card border border-border bg-surface-1 p-4">
        <PackageIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground-muted" />
        <p className="type-caption text-foreground-muted">
          Başvurunuz "Hediye Talepleri" listesine düşer. Onaylandığında bildirim alır, hediyenizi belediye ofisinden teslim alabilirsiniz.
        </p>
      </div>

      <ConfirmModal
        open={!!confirmGift}
        onClose={() => setConfirmGift(null)}
        onConfirm={() => void handleConfirm()}
        tone="primary"
        icon={GiftIcon}
        title="Hediye Başvurusu"
        description={confirmGift ? `${confirmGift.points.toLocaleString('tr-TR')} puan karşılığında ${confirmGift.name} için başvuru yapılsın mı?` : ''}
        confirmLabel="Başvur"
        loading={applying}
      />
    </div>
  )
}
