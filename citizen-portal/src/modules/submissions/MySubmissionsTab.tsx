import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardIcon, ChevronRightIcon } from 'lucide-react'
import { Button, EmptyState, Badge, SkeletonRows, Card } from '@/design-system'
import { formatDate } from '@/lib/utils'
import { citizenRealtime } from '@/services/citizenRealtime'
import type { CitizenSubmission } from '@/types/submission.types'
import { SUBMISSION_STATUS_LABELS, SUBMISSION_STATUS_TONE, SUBMISSION_TYPE_LABELS } from '@/types/submission.types'
import submissionService from '@/services/submission.service'
import { SubmissionDetailSheet } from './SubmissionDetailSheet'

// Hata raporu (docs/hata.md #4.3): "Talepler/Şikayetler/Öneriler" sayaçları 0 gösteriyordu —
// kök neden, bu ekranda tür bazlı bir sayaç/gruplama HİÇ olmamasıydı; kayıtlar türe göre
// ayrıştırılmadan tek düz liste halinde gösteriliyordu. Sayaçlar artık listenin kendi
// verisinden türetiliyor, ayrı bir uçla ayrışma ihtimali yok.
const TYPE_FILTERS = ['all', 'request', 'complaint', 'suggestion'] as const
type TypeFilter = (typeof TYPE_FILTERS)[number]

const TYPE_FILTER_LABELS: Record<TypeFilter, string> = {
  all: 'Tümü',
  request: 'Talepler',
  complaint: 'Şikayetler',
  suggestion: 'Öneriler',
}

export const MySubmissionsTab = () => {
  const [items, setItems] = useState<CitizenSubmission[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState<CitizenSubmission | null>(null)
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>({})
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    submissionService.list({ page: 1, limit: 50 })
      .then((r) => setItems(r.items))
      .catch(() => {
        setItems(null)
        setLoadError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const counts = useMemo(() => {
    const base: Record<TypeFilter, number> = { all: 0, request: 0, complaint: 0, suggestion: 0 }
    for (const s of items ?? []) {
      base.all++
      if (s.submissionType in base) base[s.submissionType as TypeFilter]++
    }
    return base
  }, [items])

  const visible = useMemo(
    () => (items ?? []).filter((s) => typeFilter === 'all' || s.submissionType === typeFilter),
    [items, typeFilter],
  )

  useEffect(() => {
    submissionService.options()
      .then((o) => setCategoryLabels(Object.fromEntries(o.categories.map((c) => [c.value, c.label]))))
      .catch(() => setCategoryLabels({}))
  }, [])

  useEffect(() => {
    void citizenRealtime.start()
    return citizenRealtime.onNotification((n) => {
      if (n.referenceType === 'citizen-submission') load()
    })
  }, [load])

  return (
    <div className="p-4">
      {loading ? (
        <SkeletonRows rows={4} />
      ) : loadError ? (
        <EmptyState
          icon={ClipboardIcon}
          title="Başvurular yüklenemedi"
          description="Bağlantınızı kontrol edip tekrar deneyin."
          action={<Button variant="outline" size="sm" onClick={load}>Tekrar Dene</Button>}
        />
      ) : !items || items.length === 0 ? (
        <EmptyState icon={ClipboardIcon} title="Başvuru bulunamadı" description="Yeni bir istek, öneri veya şikayet iletmek için 'Yeni Başvuru' sekmesini kullanın." />
      ) : (
        <>
          <div className="mb-3 flex gap-2 overflow-x-auto">
            {TYPE_FILTERS.map((key) => {
              const active = typeFilter === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTypeFilter(key)}
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'border-primary bg-primary/10 text-foreground-strong'
                      : 'border-border bg-surface-0 text-foreground-muted'
                  }`}
                >
                  {TYPE_FILTER_LABELS[key]}
                  <span className="rounded-pill bg-surface-2 px-1.5 text-[11px] font-bold">{counts[key]}</span>
                </button>
              )
            })}
          </div>

          {visible.length === 0 ? (
            <EmptyState icon={ClipboardIcon} title={`${TYPE_FILTER_LABELS[typeFilter]} bulunamadı`} description="Farklı bir tür seçebilir veya yeni bir başvuru oluşturabilirsiniz." />
          ) : (
          <Card className="overflow-hidden divide-y divide-border">
          {visible.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s)}
              className="flex w-full items-start gap-3 bg-surface-0 px-4 py-3.5 text-left transition-colors hover:bg-surface-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="type-body-strong">{s.title}</p>
                  {/* Hata raporu (docs/hata.md #4.1): tür kullanıcıya hiç gösterilmiyor ya da
                      İngilizce görünüyordu; sunucunun Türkçe etiketi esas alınır. */}
                  <Badge tone="neutral">
                    {s.submissionTypeLabel || SUBMISSION_TYPE_LABELS[s.submissionType] || s.submissionType}
                  </Badge>
                  <Badge tone={SUBMISSION_STATUS_TONE[s.status] ?? 'neutral'}>
                    {s.statusLabel ?? SUBMISSION_STATUS_LABELS[s.status] ?? s.status}
                  </Badge>
                </div>
                {s.trackingNo && (
                  <p className="type-caption mt-0.5">Takip No: {s.trackingNo}</p>
                )}
                <p className="type-caption mt-0.5">
                  {formatDate(s.submittedAt)}
                  {s.categoryLabel ? ` · ${s.categoryLabel}` : ''}
                </p>
              </div>
              <ChevronRightIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground-subtle" />
            </button>
          ))}
          </Card>
          )}
        </>
      )}

      <SubmissionDetailSheet
        submission={selected}
        categoryLabel={selected ? categoryLabels[selected.categoryId] : undefined}
        onClose={() => setSelected(null)}
        onUpdated={load}
      />
    </div>
  )
}
