import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  HourglassIcon, PhoneCallIcon, CheckCircle2Icon, XCircleIcon, UserCheckIcon,
  UsersIcon, ZapIcon, ClockIcon,
} from 'lucide-react'
import {
  Card, Badge, Button, SkeletonRows, StatCard, SectionToolbar, EmptyState, Pagination,
} from '@/design-system'
import { useClock } from '@/framework/hooks/useClock'
import { cn, maskTC } from '@/lib/utils'
import libraryService from '@/services/library.service'
import { QUEUE_METHOD_LABELS, QUEUE_METHOD_TONE } from '@/types/library.types'
import type { QueueEntry } from '@/types/library.types'
import { fmtTime, fmtCountdown, fmtRelative, secondsUntil } from './libraryHelpers'

const WAITING_PAGE_SIZE = 20

export const QueueTab = ({ libraryId, onChanged, refreshKey }: { libraryId: string; onChanged?: () => void; refreshKey?: number }) => {
  const now = useClock().getTime()
  const [entries, setEntries] = useState<QueueEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [windowMinutes, setWindowMinutes] = useState(5)
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [waitingPage, setWaitingPage] = useState(1)
  const entriesRef = useRef<QueueEntry[]>([])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await libraryService.queue.getList(libraryId, { page: 1, limit: 500 })
      setEntries(res.items)
      setTotal(res.total)
    } catch { setEntries([]); setTotal(0) } finally { setLoading(false) }
  }, [libraryId])
  useEffect(() => { fetchList() }, [fetchList])
  useEffect(() => { if (refreshKey) fetchList() }, [refreshKey, fetchList])

  useEffect(() => { entriesRef.current = entries }, [entries])

  useEffect(() => {
    libraryService.settings.get(libraryId)
      .then((s) => {
        setWindowMinutes(s.queueCallWindowMinutes || 5)
        setAutoEnabled(s.autoQueueCallEnabled ?? false)
      })
      .catch(() => setWindowMinutes(5))
  }, [libraryId])

  useEffect(() => {
    if (!autoEnabled) return
    const id = setInterval(async () => {
      const current = entriesRef.current
      const calledCount = current.filter((e) => e.status === 'called').length
      const waitingCount = current.filter((e) => e.status === 'waiting').length
      if (calledCount === 0 && waitingCount > 0) {
        try {
          await libraryService.queue.callNext(libraryId)
          fetchList()
          onChanged?.()
        } catch {}
      }
    }, 30_000)
    return () => clearInterval(id)
  }, [autoEnabled, libraryId, fetchList, onChanged])

  const act = async (fn: () => Promise<void>, msg: string) => {
    setBusy(true)
    try { await fn(); toast.success(msg); fetchList(); onChanged?.() } finally { setBusy(false) }
  }

  const called = entries.filter((e) => e.status === 'called')
  const waiting = entries.filter((e) => e.status === 'waiting')
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
  const waitingTotalPages = Math.max(1, Math.ceil(waiting.length / WAITING_PAGE_SIZE))
  const waitingVisible = waiting.slice((waitingPage - 1) * WAITING_PAGE_SIZE, waitingPage * WAITING_PAGE_SIZE)

  useEffect(() => { if (waitingPage > waitingTotalPages) setWaitingPage(waitingTotalPages) }, [waitingPage, waitingTotalPages])

  const totalSeconds = windowMinutes * 60
  const truncated = total > entries.length

  return (
    <div className="space-y-6">
      <SectionToolbar
        icon={HourglassIcon}
        title="Sıra Sistemi"
        subtitle="Salon dolduğunda gelen ziyaretçiler kuyruğa alınır"
        actions={
          <div className="flex items-center gap-2">
            {autoEnabled && (
              <Badge tone="success"><ZapIcon className="mr-1 inline h-3 w-3" />Otomatik aktif</Badge>
            )}
            <Button
              variant="primary" size="md"
              disabled={busy || called.length > 0 || waiting.length === 0}
              title={called.length > 0 ? 'Önce çağrılan kişiyi sonlandırın' : waiting.length === 0 ? 'Bekleyen yok' : 'Sıra başını çağır'}
              onClick={() => act(() => libraryService.queue.callNext(libraryId), 'Sıra başı çağrıldı.')}
            >
              <PhoneCallIcon className="h-4 w-4" /> Sıra Başını Çağır
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Çağrılmış · giriş bekliyor" value={called.length} icon={PhoneCallIcon} accent="orange" loading={loading} />
        <StatCard label="Sırada bekliyor" value={waiting.length} icon={UsersIcon} accent="primary" loading={loading}
          hint={truncated ? `Toplam ${total} kayıttan ilk ${entries.length} gösteriliyor` : undefined} />
      </div>

      {loading ? (
        <Card padded><SkeletonRows rows={4} /></Card>
      ) : (
        <>
          <section>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-1 w-4 rounded-full bg-warning" />
              <p className="type-body-strong text-foreground-strong">Sırası Gelenler</p>
              <Badge tone="warning">{called.length}</Badge>
              <span className="type-caption text-foreground-muted">{windowMinutes} dakika içinde giriş yapılmalı</span>
            </div>

            {called.length === 0 ? (
              <Card>
                <EmptyState icon={PhoneCallIcon} title="Çağrılan yok" description="Koltuk boşaldığında sıra başı çağrılır." />
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {called.map((e) => {
                  const remain = secondsUntil(e.countdownExpiresAt, now)
                  const pct = Math.max(0, Math.min(100, (remain / totalSeconds) * 100))
                  const expired = remain <= 0
                  const isUrgent = !expired && pct < 30
                  const urgentTone = expired || isUrgent

                  return (
                    <Card key={e.id} className="overflow-hidden">
                      <div className={cn('h-1 w-full', urgentTone ? 'bg-danger' : 'bg-warning')} />

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black text-white',
                                urgentTone ? 'bg-danger' : 'bg-warning',
                              )}
                            >
                              {e.queueNumber.replace(/^Q-?/, '')}
                            </div>
                            <div>
                              <p className="type-body-strong text-foreground-strong">{e.memberName}</p>
                              <p className="type-caption text-foreground-muted">{e.phone} · Çağrıldı: {fmtTime(e.calledAt)}</p>
                            </div>
                          </div>
                          <div
                            className={cn(
                              'shrink-0 rounded-field px-3 py-1.5 text-center',
                              urgentTone ? 'bg-danger-soft' : 'bg-warning-soft',
                            )}
                          >
                            <p className={cn('tabular-nums text-sm font-black leading-none', urgentTone ? 'text-danger' : 'text-warning')}>
                              {expired ? '0:00' : fmtCountdown(remain)}
                            </p>
                            <p className={cn('mt-0.5 text-[10px] font-medium', urgentTone ? 'text-danger' : 'text-warning')}>
                              {expired ? 'Süre doldu' : 'kaldı'}
                            </p>
                          </div>
                        </div>

                        <div className="mb-4 overflow-hidden rounded-full bg-surface-2 h-2">
                          <div
                            className={cn('h-2 rounded-full transition-all duration-1000', urgentTone ? 'bg-danger' : 'bg-warning')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="primary" size="sm" className="flex-1"
                            disabled={busy}
                            onClick={() => act(() => libraryService.queue.markEntered(e.id), `${e.memberName} giriş yaptı.`)}
                          >
                            <CheckCircle2Icon className="h-4 w-4" /> Girişi Onayla
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            disabled={busy}
                            onClick={() => act(() => libraryService.queue.expire(e.id), 'Kuyruktan düşürüldü.')}
                          >
                            <XCircleIcon className="h-4 w-4" /> Düşür
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-1 w-4 rounded-full bg-primary" />
              <p className="type-body-strong text-foreground-strong">Sırada Bekleyenler</p>
              <Badge tone="neutral">{waiting.length}</Badge>
              <span className="type-caption text-foreground-muted">FIFO sırasına göre listelenir</span>
            </div>

            {waiting.length === 0 ? (
              <Card>
                <EmptyState icon={UserCheckIcon} title="Bekleyen yok" description="Kuyrukta bekleyen ziyaretçi bulunmuyor." />
              </Card>
            ) : (
              <Card className="overflow-hidden">
                {waitingVisible.map((e, idx) => {
                  const rank = (waitingPage - 1) * WAITING_PAGE_SIZE + idx + 1
                  const isFirst = rank === 1
                  return (
                    <div
                      key={e.id}
                      className={cn(
                        'flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-1',
                        idx < waitingVisible.length - 1 && 'border-b border-border',
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black tabular-nums',
                          isFirst ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-foreground-muted',
                        )}
                      >
                        {rank}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="type-body-strong truncate text-foreground-strong">{e.memberName}</p>
                        <p className="type-caption text-foreground-muted">{maskTC(e.tckn)} · {e.phone}</p>
                      </div>

                      <Badge tone={QUEUE_METHOD_TONE[e.method]}>{QUEUE_METHOD_LABELS[e.method]}</Badge>

                      <div className="hidden shrink-0 text-right sm:block">
                        <div className="flex items-center gap-1 justify-end">
                          <ClockIcon className="h-3 w-3 text-foreground-subtle" />
                          <span className="type-caption tabular-nums text-foreground-muted">{fmtTime(e.joinedAt)}</span>
                        </div>
                        <p className="type-caption text-foreground-subtle">{fmtRelative(e.joinedAt, now)}</p>
                      </div>
                    </div>
                  )
                })}
                {waitingTotalPages > 1 && (
                  <div className="border-t border-border px-4 py-2">
                    <Pagination page={waitingPage} totalPages={waitingTotalPages} total={waiting.length} limit={WAITING_PAGE_SIZE} onPageChange={setWaitingPage} />
                  </div>
                )}
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  )
}
