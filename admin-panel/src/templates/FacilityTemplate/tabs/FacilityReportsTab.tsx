import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3Icon, UsersIcon, LayersIcon, PercentIcon,
  TrendingUpIcon, TrendingDownIcon, MedalIcon, UserCheckIcon,
  ZapIcon, ShieldCheckIcon, AlertTriangleIcon,
} from 'lucide-react'
import { Select, EmptyState, Skeleton } from '@/design-system'
import type { FacilityModuleConfig } from '../moduleConfig'
import type { FacilityModuleService } from '../types'
import type { ReportSummary, ReportTopGroup, ReportInstructor } from '@/types/facility.types'

interface Props {
  config: FacilityModuleConfig
  service: FacilityModuleService
  facilityId: string
}

const RANGES = [
  { value: 'today', label: 'Bugün' },
  { value: 'week', label: 'Bu Hafta' },
  { value: 'month', label: 'Bu Ay' },
  { value: 'year', label: 'Bu Yıl' },
]

function OccupancyBar({ value }: { value: number }) {
  const clamped = Math.min(value, 100)
  const color = value >= 100 ? 'hsl(var(--danger))' : value >= 80 ? 'hsl(var(--warning))' : 'hsl(var(--success))'
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${clamped}%`, background: color }} />
      </div>
      <span className="text-[11px] font-bold tabular-nums w-9 text-right" style={{ color }}>
        %{value}
      </span>
    </div>
  )
}

function AttendanceDot({ rate }: { rate: number }) {
  const color = rate >= 85 ? 'hsl(var(--success))' : rate >= 70 ? 'hsl(var(--warning))' : 'hsl(var(--danger))'
  const Icon = rate >= 85 ? ShieldCheckIcon : rate >= 70 ? AlertTriangleIcon : TrendingDownIcon
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" style={{ color }} />
      <span className="text-[12px] font-bold tabular-nums" style={{ color }}>%{rate}</span>
    </div>
  )
}

const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7c54'] // madalya renkleri (altın/gümüş/bronz) — tema bağımsız sabit kalmalı
const RANK_LABELS = ['1.', '2.', '3.']

export const FacilityReportsTab = ({ config, service, facilityId }: Props) => {
  const T = config.terminology
  const [range, setRange] = useState('month')
  const [data, setData] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await service.reports.getSummary(facilityId, range)) }
    catch { setData(null) }
    finally { setLoading(false) }
  }, [service, facilityId, range])
  useEffect(() => { load() }, [load])

  const attendanceColor = !data ? 'hsl(var(--foreground-subtle))'
    : data.attendanceRate >= 85 ? 'hsl(var(--success))'
    : data.attendanceRate >= 70 ? 'hsl(var(--warning))' : 'hsl(var(--danger))'

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--accent-violet-soft))]">
            <BarChart3Icon className="h-4.5 w-4.5 text-[hsl(var(--accent-violet))]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-foreground-strong">Raporlar</p>
            <p className="text-[11px] text-foreground-subtle">Katılım ve performans özeti</p>
          </div>
        </div>
        <div className="w-36">
          <Select value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="relative overflow-hidden rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--accent-blue)/0.2)] p-5 shadow-sm">
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-[hsl(var(--accent-blue-soft))]" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--accent-blue-soft))]">
                <UsersIcon className="h-4.5 w-4.5 text-[hsl(var(--accent-blue))]" />
              </div>
              <TrendingUpIcon className="h-4 w-4 text-[hsl(var(--accent-blue)/0.5)]" />
            </div>
            {loading ? <Skeleton className="h-9 w-20 mb-1" /> : (
              <p className="text-[32px] font-black text-[hsl(var(--accent-blue))] leading-none mb-1">{data?.totalParticipants ?? 0}</p>
            )}
            <p className="text-[12px] font-semibold text-foreground-muted">Toplam {T.participantSingular}</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--success)/0.2)] p-5 shadow-sm">
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-[hsl(var(--success-soft))]" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--success-soft))]">
                <LayersIcon className="h-4.5 w-4.5 text-[hsl(var(--success))]" />
              </div>
              <ZapIcon className="h-4 w-4 text-[hsl(var(--success)/0.5)]" />
            </div>
            {loading ? <Skeleton className="h-9 w-16 mb-1" /> : (
              <p className="text-[32px] font-black text-[hsl(var(--success))] leading-none mb-1">{data?.activeGroups ?? 0}</p>
            )}
            <p className="text-[12px] font-semibold text-foreground-muted">Aktif {T.groupSingular}</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--accent-violet)/0.2)] p-5 shadow-sm">
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-[hsl(var(--accent-violet-soft))]" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--accent-violet-soft))]">
                <PercentIcon className="h-4.5 w-4.5 text-[hsl(var(--accent-violet))]" />
              </div>
              <ShieldCheckIcon className="h-4 w-4 text-[hsl(var(--accent-violet)/0.5)]" />
            </div>
            {loading ? <Skeleton className="h-9 w-20 mb-1" /> : (
              <p className="text-[32px] font-black leading-none mb-1" style={{ color: attendanceColor }}>
                %{data?.attendanceRate ?? 0}
              </p>
            )}
            <p className="text-[12px] font-semibold text-foreground-muted">Yoklama Oranı</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[hsl(var(--card))] border border-border p-5"><Skeleton className="h-48 w-full" /></div>
          <div className="rounded-2xl bg-[hsl(var(--card))] border border-border p-5"><Skeleton className="h-48 w-full" /></div>
        </div>
      ) : !data ? (
        <div className="rounded-2xl bg-[hsl(var(--card))] border border-border p-8">
          <EmptyState icon={BarChart3Icon} title="Rapor verisi yok" description="Seçili dönem için rapor verisi bulunmuyor." />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">

          <div className="rounded-2xl bg-[hsl(var(--card))] border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--warning-soft))]">
                <MedalIcon className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground-strong">En Popüler {T.groupPlural}</p>
                <p className="text-[10px] text-foreground-subtle">Doluluk oranına göre</p>
              </div>
            </div>

            {data.topGroups.length === 0 ? (
              <div className="p-6"><EmptyState icon={LayersIcon} title="Veri yok" description="" /></div>
            ) : (
              <div className="divide-y divide-border">
                {data.topGroups.map((g: ReportTopGroup, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-1 transition-colors">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black"
                      style={i < 3
                        ? { background: RANK_COLORS[i] + '20', color: RANK_COLORS[i] }
                        : { background: 'hsl(var(--surface-2))', color: 'hsl(var(--foreground-subtle))' }}
                    >
                      {i < 3 ? RANK_LABELS[i] : `${i + 1}.`}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground-default truncate">{g.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-foreground-subtle font-medium">{g.branch}</span>
                        <span className="text-[10px] text-foreground-subtle">·</span>
                        <span className="text-[10px] text-foreground-subtle">{g.participants} {T.participantSingular}</span>
                      </div>
                    </div>

                    <OccupancyBar value={g.occupancy} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-[hsl(var(--card))] border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--info-soft))]">
                <UserCheckIcon className="h-3.5 w-3.5 text-[hsl(var(--info))]" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground-strong">{T.instructorSingular} Performansı</p>
                <p className="text-[10px] text-foreground-subtle">Yoklama başarı oranı</p>
              </div>
            </div>

            {data.instructorPerformance.length === 0 ? (
              <div className="p-6"><EmptyState icon={UsersIcon} title="Veri yok" description="" /></div>
            ) : (
              <div className="divide-y divide-border">
                {data.instructorPerformance.map((p: ReportInstructor, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-1 transition-colors">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--info-soft))] text-[12px] font-bold text-[hsl(var(--info))]">
                      {p.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground-default truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-foreground-subtle">{p.groupCount} {T.groupSingular}</span>
                        <span className="text-[10px] text-foreground-subtle">·</span>
                        <span className="text-[10px] text-foreground-subtle">{p.participants} {T.participantSingular}</span>
                      </div>
                    </div>

                    <AttendanceDot rate={p.attendanceRate} />
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
