import { useCallback, useEffect, useState } from 'react'
import {
  BellIcon, CheckCheckIcon, MegaphoneIcon, ClipboardListIcon, ShieldCheckIcon,
  ClockIcon, RefreshCwIcon, ChevronDownIcon, ChevronRightIcon,
} from 'lucide-react'
import { Badge, Button, EmptyState, Progress, SkeletonRows } from '@/design-system'
import surveyPlatformService from '@/services/surveyPlatform.service'
import { formatDateTime } from '@/lib/utils'
import type { SurveyNotificationSummary } from '@/types/surveyPlatform.types'

// Kullanıcı isteği (2026-09-02): "gönderilen bildirimlerin mutlaka ekranda okudum demesi
// gerek ve bunu da adminde o bildirimi o kişinin okuduğu görülmeli."
// Bu ekran, anketörlere gönderilen her duyuru/mesajı ve saha görevi bildirimini alıcı
// bazında listeler: kim okumuş, ne zaman okumuş, "Okudum" onayını vermiş mi.

const TYPE_LABEL: Record<string, string> = {
  'survey-field-announcement': 'Duyuru / Mesaj',
  'survey-field-task': 'Saha Görevi',
}

export const SurveyNotificationReceiptsTab = () => {
  const [items, setItems] = useState<SurveyNotificationSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [openKey, setOpenKey] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    surveyPlatformService.getInterviewerNotificationReceipts({ take: 50 })
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading && !items) return <SkeletonRows rows={6} />

  if (!items || items.length === 0) {
    return (
      <EmptyState
        icon={BellIcon}
        title="Gönderilmiş bildirim yok"
        description="Anketörlere duyuru/mesaj gönderdiğinizde okunma ve onay durumu burada listelenir."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="type-section">Bildirim Okunma Takibi</p>
          <p className="type-caption">Gönderilen duyuru ve mesajları kimin okuduğunu, onay verdiğini görün</p>
        </div>
        <Button variant="ghost" size="sm" iconLeft={<RefreshCwIcon className="h-4 w-4" />} onClick={load}>Yenile</Button>
      </div>

      {items.map((n) => {
        const key = `${n.title}-${n.sentAt}`
        const isOpen = openKey === key
        const readPct = n.recipients > 0 ? Math.round((n.readCount / n.recipients) * 100) : 0
        const ackPct = n.recipients > 0 ? Math.round((n.acknowledgedCount / n.recipients) * 100) : 0
        const Icon = n.type === 'survey-field-task' ? ClipboardListIcon : MegaphoneIcon

        return (
          <div key={key} className="overflow-hidden rounded-panel border border-border bg-surface-1">
            <button
              type="button"
              onClick={() => setOpenKey(isOpen ? null : key)}
              className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-surface-2"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                <Icon className="h-4.5 w-4.5" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="type-body-strong">{n.title}</span>
                  <Badge tone="neutral">{TYPE_LABEL[n.type] ?? n.type}</Badge>
                  {n.requiresAck && (
                    <Badge tone={n.acknowledgedCount === n.recipients ? 'success' : 'warning'}>
                      <ShieldCheckIcon className="mr-1 h-3 w-3" />
                      {n.acknowledgedCount === n.recipients ? 'Tümü onayladı' : 'Onay bekliyor'}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 type-caption">
                  <ClockIcon className="h-3 w-3" />
                  {formatDateTime(n.sentAt)} · {n.recipients} anketöre gönderildi
                </p>

                <div className="mt-2 grid max-w-lg gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between type-caption">
                      <span>Okundu</span>
                      <span className="tabular-nums">{n.readCount} / {n.recipients} (%{readPct})</span>
                    </div>
                    <Progress value={readPct} tone={readPct === 100 ? 'success' : 'primary'} />
                  </div>
                  {n.requiresAck && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between type-caption">
                        <span>“Okudum” onayı</span>
                        <span className="tabular-nums">{n.acknowledgedCount} / {n.recipients} (%{ackPct})</span>
                      </div>
                      <Progress value={ackPct} tone={ackPct === 100 ? 'success' : 'warning'} />
                    </div>
                  )}
                </div>
              </div>

              {isOpen
                ? <ChevronDownIcon className="mt-1 h-4 w-4 flex-shrink-0 text-foreground-muted" />
                : <ChevronRightIcon className="mt-1 h-4 w-4 flex-shrink-0 text-foreground-muted" />}
            </button>

            {isOpen && (
              <div className="border-t border-border">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-surface-2 type-caption text-foreground-muted">
                      <th className="px-4 py-2">Anketör</th>
                      <th className="px-3 py-2 text-center">Okundu</th>
                      <th className="px-3 py-2">Okunma Zamanı</th>
                      {n.requiresAck && <th className="px-4 py-2">“Okudum” Onayı</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {n.receipts.map((r) => (
                      <tr key={r.notificationId} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2 type-body-strong">{r.interviewerName}</td>
                        <td className="px-3 py-2 text-center">
                          {r.isRead
                            ? <Badge tone="success"><CheckCheckIcon className="mr-1 h-3 w-3" />Okudu</Badge>
                            : <Badge tone="neutral">Okumadı</Badge>}
                        </td>
                        <td className="px-3 py-2 type-caption">
                          {r.readAt ? formatDateTime(r.readAt) : '—'}
                        </td>
                        {n.requiresAck && (
                          <td className="px-4 py-2 type-caption">
                            {r.acknowledgedAt
                              ? <span className="inline-flex items-center gap-1 text-[hsl(var(--success))]">
                                  <ShieldCheckIcon className="h-3.5 w-3.5" />
                                  {formatDateTime(r.acknowledgedAt)}
                                </span>
                              : <span className="text-[hsl(var(--warning))]">Onay bekleniyor</span>}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
