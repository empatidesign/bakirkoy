import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MessageSquareIcon, CheckCircleIcon, AlertCircleIcon, ClockIcon } from 'lucide-react'
import { Button } from '@/design-system'
import { formatDate } from '@/lib/utils'
import type { CitizenReviewsDto, SubmitReviewRequest } from '@/types/review.types'
import eventService from '@/services/event.service'
import travelService from '@/services/travel.service'
import { StarRating } from './StarRating'

type Props = {
  type: 'event' | 'travel'
  id: string
}

export const ReviewSection = ({ type, id }: Props) => {
  const [data, setData] = useState<CitizenReviewsDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    const promise = type === 'event' ? eventService.getReviews(id) : travelService.getReviews(id)
    promise
      .then((d) => { if (active) setData(d) })
      .catch(() => void 0)
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, type, refreshKey])

  const submit = async () => {
    if (rating === 0) { toast.warning('Lütfen bir puan seçin.'); return }
    setSubmitting(true)
    const req: SubmitReviewRequest = { rating, comment: comment.trim() || undefined }
    try {
      if (type === 'event') {
        await eventService.submitReview(id, req)
      } else {
        await travelService.submitReview(id, req)
      }
      toast.success('Değerlendirmeniz kaydedildi.')
      setRating(0)
      setComment('')
      setRefreshKey((k) => k + 1)
    } catch {
      void 0
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !data) return null

  const entityLabel = type === 'event' ? 'etkinliği' : 'geziyi'
  const notCheckedInForEvent = !data.checkedIn

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="type-label">Değerlendirmeler</p>
        {data.reviewCount > 0 && data.averageRating !== null && (
          <span className="inline-flex items-center gap-1">
            <StarRating value={Math.round(data.averageRating)} size="sm" />
            <span className="type-caption font-medium text-foreground ml-1">{data.averageRating.toFixed(1)}</span>
            <span className="type-caption text-foreground-muted">({data.reviewCount})</span>
          </span>
        )}
      </div>

      {notCheckedInForEvent && !data.alreadyReviewed && (
        <div className="flex items-center gap-2 rounded-card bg-warning/10 px-3 py-2.5 text-warning">
          <AlertCircleIcon className="h-4 w-4 flex-shrink-0" />
          <p className="type-caption">
            {type === 'event'
              ? 'Katılım sağlamadığınız için değerlendiremezsiniz.'
              : 'Onaylı katılımınız olmadığı için değerlendiremezsiniz.'}
          </p>
        </div>
      )}

      {!notCheckedInForEvent && !data.canReview && !data.alreadyReviewed && (
        <div className="flex items-center gap-2 rounded-card bg-surface-2 px-3 py-2.5 text-foreground-muted">
          <ClockIcon className="h-4 w-4 flex-shrink-0" />
          <p className="type-caption">Değerlendirme süresi doldu.</p>
        </div>
      )}

      {!notCheckedInForEvent && data.canReview && !data.alreadyReviewed && (
        <div className="space-y-3 rounded-card border border-border p-4">
          <p className="type-caption text-foreground-muted">
            Bu {entityLabel} değerlendirin — bitişinden itibaren {data.windowDays} gün içinde.
          </p>
          <StarRating value={rating} onChange={setRating} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Yorumunuz (opsiyonel)…"
            rows={3}
            maxLength={1000}
            className="w-full resize-none rounded-input border border-input bg-surface-1 px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none"
          />
          <Button variant="primary" size="sm" isLoading={submitting} disabled={rating === 0} onClick={submit}>
            Gönder
          </Button>
        </div>
      )}

      {data.alreadyReviewed && (
        <div className="flex items-center gap-2 rounded-card bg-success/10 px-3 py-2.5 text-success">
          <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
          <p className="type-caption">Bu {entityLabel} zaten değerlendirdiniz.</p>
        </div>
      )}

      {data.reviews.length === 0 ? (
        <p className="type-caption text-foreground-muted inline-flex items-center gap-1.5">
          <MessageSquareIcon className="h-3.5 w-3.5" />
          Henüz değerlendirme yok.
        </p>
      ) : (
        <div className="space-y-2.5">
          {data.reviews.map((r) => (
            <div key={r.id} className="rounded-card border border-border bg-surface-1 p-3 space-y-1.5">
              <div className="flex items-center justify-end">
                <StarRating value={r.rating} size="sm" />
              </div>
              {r.comment && <p className="type-caption text-foreground-muted">{r.comment}</p>}
              <p className="type-caption text-foreground-muted/50">{formatDate(r.submittedAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
