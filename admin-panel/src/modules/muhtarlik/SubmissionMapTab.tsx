import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, SkeletonRows, FormSection } from '@/design-system'
import { SubmissionMap } from '@/components/specialized/SubmissionMap'
import muhtarlikService from '@/services/muhtarlik.service'
import { filtersToParams } from './muhtarlikHelpers'
import { SUBMISSION_TYPE_LABELS, PRIORITY_LABELS } from '@/types/muhtarlik.types'
import type { SubmissionFilters, SubmissionMapPoint, SubmissionPriority, SubmissionType } from '@/types/muhtarlik.types'

interface SubmissionMapTabProps {
  filters: SubmissionFilters
  refreshSignal: number
  onOpenDetail: (id: string) => void
}

const TYPE_DOT: Record<SubmissionType, string> = {
  request: 'bg-info',
  suggestion: 'bg-success',
  complaint: 'bg-danger',
}

const PRIORITY_ORDER: SubmissionPriority[] = ['urgent', 'high', 'normal', 'low']

export const SubmissionMapTab = ({ filters, refreshSignal, onOpenDetail }: SubmissionMapTabProps) => {
  const [points, setPoints] = useState<SubmissionMapPoint[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPoints = useCallback(async () => {
    setLoading(true)
    try {
      setPoints(await muhtarlikService.getMapPoints(filtersToParams(filters)))
    } catch {
      setPoints([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchPoints() }, [fetchPoints, refreshSignal])

  const priorityCounts = useMemo(
    () => PRIORITY_ORDER
      .map((p) => ({ priority: p, count: points.filter((x) => x.priority === p).length }))
      .filter((x) => x.count > 0),
    [points],
  )

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="overflow-hidden">
        <SubmissionMap points={points} onOpenDetail={onOpenDetail} height={560} />
      </Card>

      <Card padded>
        <FormSection variant="card" title="Harita Açıklaması">
          <div className="space-y-2">
            {(['request', 'suggestion', 'complaint'] as SubmissionType[]).map((t) => (
              <div key={t} className="flex items-center gap-2 type-body">
                <span className={`h-3 w-3 flex-shrink-0 rounded-pill ${TYPE_DOT[t]} ring-2 ring-[hsl(var(--surface-0))]`} />
                {SUBMISSION_TYPE_LABELS[t]}
              </div>
            ))}
            <div className="flex items-center gap-2 type-body">
              <span className="relative h-3 w-3 flex-shrink-0 rounded-pill bg-danger ring-2 ring-[hsl(var(--surface-0))]">
                <span className="absolute -inset-1 rounded-pill border-2 border-danger" />
              </span>
              Acil (kırmızı halka)
            </div>
            <div className="flex items-center gap-2 type-body">
              <span className="relative h-3 w-3 flex-shrink-0 rounded-pill bg-foreground-muted ring-2 ring-[hsl(var(--surface-0))]">
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-pill bg-primary ring-1 ring-[hsl(var(--surface-0))]" />
              </span>
              Muhtara Bildir
            </div>
          </div>
        </FormSection>

        <FormSection variant="card" title={`Bu Filtrede (${points.length})`}>
          {loading ? (
            <SkeletonRows rows={3} />
          ) : priorityCounts.length === 0 ? (
            <p className="type-muted">Gösterilecek konumlu kayıt yok.</p>
          ) : (
            <div className="space-y-1.5">
              {priorityCounts.map(({ priority, count }) => (
                <div key={priority} className="flex items-center justify-between type-body">
                  <span>{PRIORITY_LABELS[priority]}</span>
                  <span className="type-muted tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          )}
        </FormSection>
      </Card>
    </div>
  )
}
