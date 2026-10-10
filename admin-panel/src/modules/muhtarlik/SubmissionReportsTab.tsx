import { useCallback, useEffect, useState, Fragment } from 'react'
import {
  TimerIcon, SendIcon, CheckCircle2Icon, ClockIcon,
  TrendingUpIcon, MapPinIcon, MegaphoneIcon, LightbulbIcon, HandshakeIcon,
  FlameIcon, CheckIcon, BarChart3Icon, RadioTowerIcon, AlarmClockIcon, TrophyIcon, CalendarClockIcon,
} from 'lucide-react'
import { StatCard, Progress, EmptyState, FormSection, Badge } from '@/design-system'
import muhtarlikService from '@/services/muhtarlik.service'
import type { SubmissionDistributionItem, SubmissionReportsSummary, NeighborhoodBreakdownItem } from '@/types/muhtarlik.types'

const DAY_NAMES_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']


interface SubmissionReportsTabProps {
  refreshSignal: number
}

const DistributionCard = ({ title, items }: { title: string; items: SubmissionDistributionItem[] }) => {
  const max = Math.max(1, ...items.map((i) => i.count))
  const totalCount = items.reduce((sum, i) => sum + i.count, 0)
  return (
    <FormSection variant="card" title={title}>
      {items.length === 0 ? (
        <p className="type-muted">Veri yok.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((i) => {
            const pct = totalCount > 0 ? (i.count / totalCount) * 100 : 0
            return (
              <div key={i.key}>
                <div className="mb-1 flex items-center justify-between type-body">
                  <span className="truncate">{i.label}</span>
                  <span className="type-muted tabular-nums">{i.count.toLocaleString('tr-TR')} · %{Math.round(pct)}</span>
                </div>
                <Progress value={(i.count / max) * 100} />
              </div>
            )
          })}
        </div>
      )}
    </FormSection>
  )
}

const TypeBar = ({ complaints, requests, suggestions, total }: {
  complaints: number; requests: number; suggestions: number; total: number
}) => {
  if (total === 0) return <div className="h-2 rounded-full bg-surface-2" />
  const cPct = (complaints / total) * 100
  const rPct = (requests / total) * 100
  const sPct = (suggestions / total) * 100
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full">
      {cPct > 0 && <div style={{ width: `${cPct}%`, background: '#dc2626' }} />}
      {rPct > 0 && <div style={{ width: `${rPct}%`, background: '#2563eb' }} />}
      {sPct > 0 && <div style={{ width: `${sPct}%`, background: '#16a34a' }} />}
    </div>
  )
}

const MuhtarPerformanceTable = ({ items }: { items: SubmissionReportsSummary['muhtarPerformance'] }) => {
  if (items.length === 0) return <EmptyState icon={TrophyIcon} title="Veri yok" description="Henüz mahalle bazlı performans verisi bulunmuyor." />
  const sorted = items.slice().sort((a, b) => b.resolutionRate - a.resolutionRate)
  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-1">
            <th className="px-3 py-2.5 text-left type-table-head">Mahalle</th>
            <th className="px-3 py-2.5 text-right type-table-head">Toplam</th>
            <th className="px-3 py-2.5 text-right type-table-head">Çözülen</th>
            <th className="px-3 py-2.5 text-right type-table-head">Ort. Çözüm (gün)</th>
            <th className="px-3 py-2.5 text-right type-table-head">Bekleyen</th>
            <th className="px-3 py-2.5 text-right type-table-head">Çözüm %</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr key={item.neighborhood} className="border-b border-border last:border-0 hover:bg-surface-1 transition-colors">
              <td className="px-3 py-2.5 type-body-strong whitespace-nowrap">{item.neighborhood}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{item.total}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{item.resolvedCount}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{item.avgResolutionDays > 0 ? item.avgResolutionDays.toFixed(1) : '—'}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {item.pendingCount > 0 ? <Badge tone={item.pendingCount > 5 ? 'warning' : 'neutral'}>{item.pendingCount}</Badge> : '—'}
              </td>
              <td className="px-3 py-2.5 text-right">
                <span className={`tabular-nums text-[12px] font-semibold ${item.resolutionRate >= 70 ? 'text-success' : item.resolutionRate >= 40 ? 'text-warning' : 'text-danger'}`}>
                  %{Math.round(item.resolutionRate)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const Heatmap = ({ points }: { points: SubmissionReportsSummary['heatmap'] }) => {
  if (points.length === 0) return <p className="type-muted">Henüz veri yok.</p>
  const max = Math.max(1, ...points.map((p) => p.count))
  const lookup = new Map(points.map((p) => [`${p.dayOfWeek}-${p.hour}`, p.count]))
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: 'auto repeat(24, minmax(14px, 1fr))' }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center text-[9px] text-foreground-subtle">{h % 3 === 0 ? h : ''}</div>
        ))}
        {DAY_NAMES_SHORT.map((day, dow) => (
          <Fragment key={dow}>
            <div className="pr-1.5 text-[10px] text-foreground-subtle flex items-center">{day}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const count = lookup.get(`${dow}-${h}`) ?? 0
              const intensity = count / max
              return (
                <div
                  key={`${dow}-${h}`}
                  title={`${day} ${h}:00 — ${count} başvuru`}
                  className="h-3.5 rounded-[2px]"
                  style={{ background: count === 0 ? 'hsl(var(--surface-2))' : `hsla(217, 91%, 55%, ${0.15 + intensity * 0.85})` }}
                />
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

const NeighborhoodCard = ({ item, rank, max }: { item: NeighborhoodBreakdownItem; rank: number; max: number }) => {
  const resolutionRate = item.total > 0 ? Math.round((item.resolved / item.total) * 100) : 0
  return (
    <div className="rounded-card border border-border bg-surface-0 p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${rank === 1 ? 'bg-warning-soft text-warning' : rank <= 3 ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-foreground-muted'}`}>
            {rank}
          </span>
          <div className="min-w-0">
            <p className="type-body-strong truncate">{item.neighborhood}</p>
            <p className="type-muted">{item.total.toLocaleString('tr-TR')} başvuru</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="tabular-nums text-[13px] font-bold text-foreground-strong">{item.total.toLocaleString('tr-TR')}</span>
          <span className="text-[10px] text-foreground-subtle">
            %{Math.round((item.total / max) * 100)} of max
          </span>
        </div>
      </div>

      <div className="mt-3">
        <Progress value={(item.total / max) * 100} className="h-1.5" />
      </div>

      <div className="mt-3">
        <TypeBar complaints={item.complaints} requests={item.requests} suggestions={item.suggestions} total={item.total} />
        <div className="mt-1.5 flex items-center gap-3">
          {item.complaints > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-danger">
              <MegaphoneIcon className="h-3 w-3" />{item.complaints}
            </span>
          )}
          {item.requests > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-primary">
              <HandshakeIcon className="h-3 w-3" />{item.requests}
            </span>
          )}
          {item.suggestions > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-success">
              <LightbulbIcon className="h-3 w-3" />{item.suggestions}
            </span>
          )}
          {item.urgent > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-danger ml-auto">
              <FlameIcon className="h-3 w-3" />{item.urgent} acil
            </span>
          )}
        </div>
      </div>

      {item.topCategories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.topCategories.slice(0, 3).map((cat) => (
            <span
              key={cat.key}
              className="inline-flex items-center gap-1 rounded-md bg-surface-1 px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted"
            >
              {cat.label}
              <span className="text-foreground-subtle">·{cat.count}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-foreground-subtle">Çözüm oranı</span>
        <div className="flex items-center gap-1.5">
          <Progress value={resolutionRate} className="w-20 h-1" />
          <span className="tabular-nums text-[11px] font-semibold text-foreground-default">%{resolutionRate}</span>
        </div>
      </div>
    </div>
  )
}

const NeighborhoodTypeTable = ({ breakdown }: { breakdown: NeighborhoodBreakdownItem[] }) => {
  if (breakdown.length === 0) {
    return <EmptyState icon={MapPinIcon} title="Veri yok" description="Henüz mahalle bazlı başvuru bulunmuyor." />
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-1">
            <th className="px-3 py-2.5 text-left type-table-head">#</th>
            <th className="px-3 py-2.5 text-left type-table-head">Mahalle</th>
            <th className="px-3 py-2.5 text-right type-table-head text-danger">Şikayet</th>
            <th className="px-3 py-2.5 text-right type-table-head text-primary">Talep</th>
            <th className="px-3 py-2.5 text-right type-table-head text-success">Öneri</th>
            <th className="px-3 py-2.5 text-right type-table-head text-warning">Acil</th>
            <th className="px-3 py-2.5 text-right type-table-head">Toplam</th>
            <th className="px-3 py-2.5 text-center type-table-head">Tür Dağılımı</th>
            <th className="px-3 py-2.5 text-right type-table-head">Çözüm %</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((item, idx) => {
            const resolutionRate = item.total > 0 ? Math.round((item.resolved / item.total) * 100) : 0
            return (
              <tr key={item.neighborhood} className="border-b border-border last:border-0 hover:bg-surface-1 transition-colors">
                <td className="px-3 py-2.5">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${idx === 0 ? 'bg-warning-soft text-warning' : idx < 3 ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-foreground-muted'}`}>
                    {idx + 1}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <p className="type-body-strong whitespace-nowrap">{item.neighborhood}</p>
                  <p className="type-muted text-[11px]">{item.topCategories[0]?.label ?? '—'}</p>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="tabular-nums text-[12px] font-semibold text-danger">{item.complaints}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="tabular-nums text-[12px] font-semibold text-primary">{item.requests}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="tabular-nums text-[12px] font-semibold text-success">{item.suggestions}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {item.urgent > 0
                    ? <Badge tone="danger"><FlameIcon className="h-3 w-3 mr-0.5" />{item.urgent}</Badge>
                    : <span className="type-muted">—</span>
                  }
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="tabular-nums text-[13px] font-bold text-foreground-strong">{item.total.toLocaleString('tr-TR')}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5 min-w-[80px]">
                    <TypeBar complaints={item.complaints} requests={item.requests} suggestions={item.suggestions} total={item.total} />
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {resolutionRate >= 70
                      ? <CheckIcon className="h-3.5 w-3.5 text-success" />
                      : null
                    }
                    <span className={`tabular-nums text-[12px] font-semibold ${resolutionRate >= 70 ? 'text-success' : resolutionRate >= 40 ? 'text-warning' : 'text-danger'}`}>
                      %{resolutionRate}
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export const SubmissionReportsTab = ({ refreshSignal }: SubmissionReportsTabProps) => {
  const [data, setData] = useState<SubmissionReportsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await muhtarlikService.getReportsSummary({}))
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshSignal])

  const trend = data?.trend ?? []
  const maxTrend = Math.max(1, ...trend.map((t) => t.count))
  const trend30d = data?.trend30d ?? []
  const maxTrend30d = Math.max(1, ...trend30d.map((t) => t.count))
  const breakdown = data?.neighborhoodBreakdown ?? []
  const maxTotal = Math.max(1, ...breakdown.map((b) => b.total))

  const topComplaint = breakdown[0]
  const mostUrgent = breakdown.slice().sort((a, b) => b.urgent - a.urgent)[0]
  const leastResolved = breakdown.slice().sort((a, b) => {
    const ra = a.total > 0 ? a.resolved / a.total : 1
    const rb = b.total > 0 ? b.resolved / b.total : 1
    return ra - rb
  })[0]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Ort. Çözüm Süresi"
          value={`${(data?.avgResolutionDays ?? 0).toFixed(1)} gün`}
          icon={TimerIcon}
          accent="primary"
          loading={loading}
          hint={`${data?.resolvedCount ?? 0} çözülmüş kayıt`}
        />
        <StatCard
          label="Belediyeye İletim Oranı"
          value={`%${Math.round(data?.ulakbelRate ?? 0)}`}
          icon={SendIcon}
          accent="violet"
          loading={loading}
          hint={`${data?.ulakbelForwarded ?? 0}/${data?.ulakbelEligible ?? 0} kayıt`}
        />
        <StatCard
          label="Çözüm Oranı"
          value={`%${Math.round(data?.resolutionRate ?? 0)}`}
          icon={CheckCircle2Icon}
          accent="green"
          loading={loading}
          hint={`${data?.resolvedCount ?? 0} kayıt çözüldü`}
        />
        <StatCard
          label="Bekleyen"
          value={data?.pending ?? 0}
          icon={ClockIcon}
          accent="orange"
          loading={loading}
          hint="Yeni + İncelemede"
        />
        <StatCard
          label="Ort. İletim Süresi"
          value={data && data.avgForwardHours > 0 ? `${data.avgForwardHours.toFixed(1)} sa` : '—'}
          icon={AlarmClockIcon}
          accent="blue"
          loading={loading}
          hint="Başvurudan belediyeye iletilmesine kadar"
        />
      </div>

      {breakdown.length > 0 && !loading && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-card border border-border bg-surface-0 px-4 py-3 shadow-card">
            <p className="type-muted mb-1">En Çok Başvuran Mahalle</p>
            <p className="type-body-strong text-foreground-strong">{topComplaint?.neighborhood ?? '—'}</p>
            <p className="type-muted">{topComplaint?.total ?? 0} başvuru</p>
          </div>
          <div className="rounded-card border border-border bg-surface-0 px-4 py-3 shadow-card">
            <p className="type-muted mb-1">En Çok Acil Başvuru</p>
            <p className="type-body-strong text-foreground-strong">{mostUrgent?.neighborhood ?? '—'}</p>
            <p className="type-muted">{mostUrgent?.urgent ?? 0} acil başvuru</p>
          </div>
          <div className="rounded-card border border-border bg-surface-0 px-4 py-3 shadow-card">
            <p className="type-muted mb-1">En Düşük Çözüm Oranı</p>
            <p className="type-body-strong text-foreground-strong">{leastResolved?.neighborhood ?? '—'}</p>
            <p className="type-muted">
              %{leastResolved && leastResolved.total > 0 ? Math.round((leastResolved.resolved / leastResolved.total) * 100) : 0} çözüm
            </p>
          </div>
        </div>
      )}

      {/* Kullanıcı isteği (2026-09-07): "genel talepler bölümünde de detaylı bir dashboard'da
          muhtarlıkların tüm sorunları, en çok talep, en çok şikayet edilen konular vs gibi
          genel bir dashboard olsun". */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DistributionCard title="En Çok Şikayet Edilen Konular" items={(data?.byCategoryComplaint ?? []).slice(0, 8)} />
        <DistributionCard title="En Çok Talep / Öneri Alan Konular" items={(data?.byCategoryRequest ?? []).slice(0, 8)} />
      </div>

      <FormSection
        variant="card"
        icon={TrendingUpIcon}
        title="Son 7 Gün Trendi"
        action={<span className="type-caption">Günlük başvuru sayısı</span>}
      >
        {trend.length === 0 ? (
          <p className="type-muted">Henüz veri yok.</p>
        ) : (
          <div className="flex h-32 items-end gap-2">
            {trend.map((t) => {
              const pct = (t.count / maxTrend) * 100
              const label = new Date(t.date).toLocaleDateString('tr-TR', { weekday: 'short', day: '2-digit' })
              return (
                <div key={t.date} className="flex flex-1 flex-col items-center gap-1">
                  <span className="type-caption tabular-nums text-foreground-default">{t.count.toLocaleString('tr-TR')}</span>
                  <div className="flex w-full flex-1 items-end overflow-hidden rounded-t-field bg-surface-2">
                    <div className="w-full rounded-t-field bg-primary transition-all" style={{ height: `${Math.max(pct, t.count > 0 ? 4 : 0)}%` }} />
                  </div>
                  <span className="type-caption">{label}</span>
                </div>
              )
            })}
          </div>
        )}
      </FormSection>

      <FormSection
        variant="card"
        icon={MapPinIcon}
        title="Mahalle Bazlı Şikayet & Talep Analizi"
        action={
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-danger"><span className="h-2 w-2 rounded-sm bg-danger inline-block" />Şikayet</span>
            <span className="flex items-center gap-1 text-primary"><span className="h-2 w-2 rounded-sm bg-primary inline-block" />Talep</span>
            <span className="flex items-center gap-1 text-success"><span className="h-2 w-2 rounded-sm bg-success inline-block" />Öneri</span>
          </div>
        }
      >
        {loading ? (
          <p className="type-muted">Yükleniyor…</p>
        ) : (
          <NeighborhoodTypeTable breakdown={breakdown} />
        )}
      </FormSection>

      <FormSection
        variant="card"
        icon={BarChart3Icon}
        title="Mahalle Kartları"
      >
        {loading ? (
          <p className="type-muted">Yükleniyor…</p>
        ) : breakdown.length === 0 ? (
          <EmptyState icon={MapPinIcon} title="Veri yok" description="Henüz mahalle bazlı başvuru bulunmuyor." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {breakdown.map((item, idx) => (
              <NeighborhoodCard key={item.neighborhood} item={item} rank={idx + 1} max={maxTotal} />
            ))}
          </div>
        )}
      </FormSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DistributionCard title="Kategori Dağılımı" items={(data?.byCategory ?? []).slice(0, 8)} />
        <div className="space-y-4">
          <DistributionCard title="Başvuru Tipi" items={data?.byType ?? []} />
          <DistributionCard title="Öncelik" items={data?.byPriority ?? []} />
        </div>
      </div>

      <DistributionCard title="Durum Dağılımı" items={data?.byStatus ?? []} />

      <FormSection
        variant="card"
        icon={TrophyIcon}
        title="Muhtar / Mahalle Performansı"
        subtitle="Hangi mahalle ne kadar hızlı çözüyor, kaç başvuru bekliyor"
      >
        {loading ? <p className="type-muted">Yükleniyor…</p> : <MuhtarPerformanceTable items={data?.muhtarPerformance ?? []} />}
      </FormSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DistributionCard title="Kanal Dağılımı" items={data?.byChannel ?? []} />
        <DistributionCard title="Şikayet Nedeni" items={data?.byComplaintReason ?? []} />
      </div>

      <FormSection
        variant="card"
        icon={CalendarClockIcon}
        title="Yoğunluk Isı Haritası"
        subtitle="Haftanın günü / saatine göre başvuru yoğunluğu (Türkiye saatiyle)"
      >
        {loading ? <p className="type-muted">Yükleniyor…</p> : <Heatmap points={data?.heatmap ?? []} />}
      </FormSection>

      <FormSection
        variant="card"
        icon={RadioTowerIcon}
        title="30 Günlük Trend"
        action={<span className="type-caption">Günlük başvuru sayısı</span>}
      >
        {trend30d.length === 0 ? (
          <p className="type-muted">Henüz veri yok.</p>
        ) : (
          <div className="flex h-24 items-end gap-0.5">
            {trend30d.map((t) => {
              const pct = (t.count / maxTrend30d) * 100
              return (
                <div key={t.date} className="group relative flex flex-1 flex-col items-center justify-end">
                  <div className="w-full overflow-hidden rounded-t-[2px] bg-surface-2" style={{ height: '100%' }}>
                    <div
                      className="w-full rounded-t-[2px] bg-primary/70 transition-all group-hover:bg-primary"
                      style={{ height: `${Math.max(pct, t.count > 0 ? 4 : 0)}%`, marginTop: `${100 - Math.max(pct, t.count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <span className="pointer-events-none absolute -top-6 hidden whitespace-nowrap rounded bg-foreground-strong px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                    {new Date(t.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}: {t.count}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </FormSection>
    </div>
  )
}
