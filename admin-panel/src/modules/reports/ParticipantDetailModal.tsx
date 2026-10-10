import { useEffect, useState } from 'react'
import { UserIcon, ActivityIcon, ClockIcon } from 'lucide-react'
import { Modal, Badge, Skeleton, EmptyState, ToggleChip } from '@/design-system'
import reportsService from '@/services/reports.service'
import { maskTC } from '@/lib/utils'
import { REPORTS_MODULE_LABELS } from '@/types/reports.types'
import type { ReportsTopParticipant, ReportsParticipantDetail } from '@/types/reports.types'
import type { DateRangeValue } from '@/design-system/DateRangeSelect'

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  approved: 'success', active: 'success', confirmed: 'success', resolved: 'success', completed: 'success', used: 'success',
  pending: 'warning', new: 'warning', reviewing: 'warning',
  waitlist: 'info',
  rejected: 'danger', cancelled: 'danger',
}

const formatDateTime = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const formatDate = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface Props {
  participant: ReportsTopParticipant | null
  range: DateRangeValue
  onClose: () => void
}

type ViewMode = 'summary' | 'log'

export const ParticipantDetailModal = ({ participant, range, onClose }: Props) => {
  const [detail, setDetail] = useState<ReportsParticipantDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<ViewMode>('summary')

  useEffect(() => {
    if (!participant) { setDetail(null); return }
    setView('summary')
    setLoading(true)
    reportsService.getParticipantDetail(
      { participantId: participant.participantId ?? undefined, tckn: participant.tckn ?? undefined, fullName: participant.fullName },
      { preset: range.preset, from: range.preset === 'custom' ? range.from : undefined, to: range.preset === 'custom' ? range.to : undefined },
    )
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [participant, range])

  const summaryCount = detail?.activitySummary.length ?? 0
  const logCount = detail?.activities.length ?? 0

  return (
    <Modal
      open={!!participant}
      onClose={onClose}
      width={720}
      className="max-w-[95vw]"
      bodyClassName="p-0"
    >
      {participant && (
        <div className="flex flex-col">
          <div className="relative overflow-hidden ds-hero">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
            <div className="relative flex items-center gap-4 px-6 py-5">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white shadow-lg"
                style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.35)' }}>
                {participant.fullName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-white">{participant.fullName}</p>
                {participant.tckn && <p className="mt-0.5 text-[12px] text-white/70 tabular-nums">{maskTC(participant.tckn)}</p>}
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">
                    <ActivityIcon className="h-3 w-3" /> {detail?.totalParticipations ?? participant.totalParticipations} toplam katılım
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            {loading ? (
              <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
            ) : (
              <>
                <div>
                  <p className="mb-2 type-caption font-semibold uppercase tracking-wide text-foreground-subtle">Modül Dağılımı</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(detail?.moduleBreakdown ?? participant.moduleBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([m, c]) => (
                        <Badge key={m} tone="neutral">{REPORTS_MODULE_LABELS[m] ?? m} · {c}</Badge>
                      ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-2 border-b border-border bg-[#eef3f8]/60 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#eef3f8]">
                        <ClockIcon className="h-3.5 w-3.5 text-[#0f4c81]" />
                      </div>
                      <p className="text-sm font-semibold text-foreground-strong">Katılım Geçmişi</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ToggleChip active={view === 'summary'} onClick={() => setView('summary')} tone="primary">
                        Etkinlik Bazında ({summaryCount})
                      </ToggleChip>
                      <ToggleChip active={view === 'log'} onClick={() => setView('log')} tone="primary">
                        Tüm Kayıtlar ({logCount})
                      </ToggleChip>
                    </div>
                  </div>

                  {view === 'summary' ? (
                    !detail || detail.activitySummary.length === 0 ? (
                      <div className="p-4">
                        <EmptyState icon={UserIcon} title="Kayıt yok" description="Seçili dönemde başka katılım kaydı bulunamadı." />
                      </div>
                    ) : (
                      <div className="max-h-[360px] divide-y divide-border/60 overflow-y-auto">
                        {detail.activitySummary.map((s, i) => (
                          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="type-body-strong truncate">{s.itemName}</p>
                              <p className="type-caption">
                                {s.moduleLabel} · İlk: {formatDate(s.firstAt)} · Son: {formatDate(s.lastAt)}
                              </p>
                            </div>
                            <Badge tone="info">{s.count} kez</Badge>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    !detail || detail.activities.length === 0 ? (
                      <div className="p-4">
                        <EmptyState icon={UserIcon} title="Kayıt yok" description="Seçili dönemde başka katılım kaydı bulunamadı." />
                      </div>
                    ) : (
                      <div className="max-h-[360px] divide-y divide-border/60 overflow-y-auto">
                        {detail.activities.map((a, i) => (
                          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="type-body-strong truncate">{a.itemName}</p>
                              <p className="type-caption">{a.moduleLabel} · {formatDateTime(a.date)}</p>
                            </div>
                            <Badge tone={STATUS_TONE[a.status] ?? 'neutral'}>{a.statusLabel}</Badge>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
