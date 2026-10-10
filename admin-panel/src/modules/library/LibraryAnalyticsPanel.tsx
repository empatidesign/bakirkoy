import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  BookOpenIcon, CalendarIcon, TrendingUpIcon, BarChart2Icon, StarIcon,
  ActivityIcon, TrophyIcon, UserIcon, HistoryIcon, MapPinIcon, PieChartIcon, CakeIcon, SlidersHorizontalIcon, type LucideIcon,
} from 'lucide-react'
import { SkeletonRows, Select } from '@/design-system'
import { DonutChart, GroupedBarChart } from '@/design-system/charts'
import libraryService from '@/services/library.service'
import type { LibraryAnalytics } from '@/types/library.types'

const FEMALE_COLOR = 'hsl(var(--accent-pink))'
const MALE_COLOR = 'hsl(var(--accent-blue))'

export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'year' | 'custom'
export type LiveTileKey = 'occupancy' | 'onBreak' | 'waiting'

const fmtDuration = (minutes: number) => {
  if (minutes < 60) return `${Math.round(minutes)} dk`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h} sa ${m} dk` : `${h} sa`
}

const fmtLegacyDate = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' })
}

const periodRanges = (period: AnalyticsPeriod, customFrom?: string, customTo?: string) => {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (period === 'today') return { from: fmt(now), to: fmt(now) }
  if (period === 'week') {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1)
    return { from: fmt(start), to: fmt(now) }
  }
  if (period === 'month') return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: fmt(now) }
  if (period === 'year') return { from: `${now.getFullYear()}-01-01`, to: fmt(now) }
  return { from: customFrom ?? fmt(now), to: customTo ?? fmt(now) }
}

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'today', label: 'Bugün' },
  { value: 'week', label: 'Bu Hafta' },
  { value: 'month', label: 'Bu Ay' },
  { value: 'year', label: 'Bu Yıl' },
  { value: 'custom', label: 'Özel Aralık' },
]

const ACCENT_TOKENS: Record<string, { color: string; bg: string }> = {
  blue:   { color: '#2563eb', bg: '#eff6ff' },
  green:  { color: '#059669', bg: '#f0fdf4' },
  orange: { color: '#d97706', bg: '#fffbeb' },
  violet: { color: '#7c3aed', bg: '#f5f3ff' },
  teal:   { color: '#0d9488', bg: '#f0fdfa' },
  pink:   { color: '#db2777', bg: '#fdf2f8' },
  indigo: { color: '#6366f1', bg: '#eef2ff' },
  slate:  { color: '#475569', bg: '#f8fafc' },
}

interface SectionCardProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  accent: keyof typeof ACCENT_TOKENS
  children: ReactNode
  className?: string
}

export const SectionCard = ({ icon: Icon, title, subtitle, accent, children, className = '' }: SectionCardProps) => {
  const t = ACCENT_TOKENS[accent]
  return (
    <div className={`overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-card shadow-sm ${className}`}>
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-5 py-3.5" style={{ background: t.bg }}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${t.color}22` }}>
          <Icon className="h-4 w-4" style={{ color: t.color }} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold" style={{ color: t.color }}>{title}</p>
          {subtitle && <p className="text-[11px] text-[hsl(var(--foreground-muted))] truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--surface-1))] px-3.5 py-2.5">
    <span className="text-[13px] text-[hsl(var(--foreground-muted))]">{label}</span>
    <span className="text-[13px] font-semibold tabular-nums text-[hsl(var(--foreground-strong))]">{value}</span>
  </div>
)

export const MedalBadge = ({ rank }: { rank: number }) => {
  const bg = rank === 0 ? '#f59e0b' : rank === 1 ? '#94a3b8' : rank === 2 ? '#cd7c2f' : '#e2e8f0'
  const fg = rank < 3 ? '#fff' : '#64748b'
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: bg, color: fg }}>
      {rank + 1}
    </span>
  )
}

interface LibraryAnalyticsPanelProps {
  libraryId?: string
  onLibraryChange?: (id: string) => void
  libraryOptions?: Array<{ value: string; label: string }>
  showTopLibraries?: boolean
  onLiveTileClick?: (key: LiveTileKey) => void
}

export const LibraryAnalyticsPanel = ({
  libraryId,
  onLibraryChange,
  libraryOptions,
  showTopLibraries = false,
  onLiveTileClick,
}: LibraryAnalyticsPanelProps) => {
  const [analytics, setAnalytics] = useState<LibraryAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const load = useCallback(async () => {
    if (period === 'custom' && (!customFrom || !customTo)) return
    setLoading(true)
    try {
      const { from, to } = periodRanges(period, customFrom, customTo)
      const data = await libraryService.getAnalytics({ from, to, libraryId: libraryId || undefined })
      setAnalytics(data)
    } catch { setAnalytics(null) }
    finally { setLoading(false) }
  }, [period, customFrom, customTo, libraryId])

  useEffect(() => { void load() }, [load])

  const ageGroups = analytics ? [
    { label: '<18', count: analytics.under18Count },
    { label: '18–25', count: analytics.age18to25Count },
    { label: '26–35', count: analytics.age26to35Count },
    { label: '36–50', count: analytics.age36to50Count },
    { label: '>50', count: analytics.over50Count },
  ] : []
  const maxAgeCount = Math.max(1, ...ageGroups.map(g => g.count))
  const maxHourly = Math.max(1, ...(analytics?.hourlyLoad.map(h => h.visitCount) ?? [0]))
  const peakHour = analytics?.hourlyLoad.reduce((a, b) => b.visitCount > a.visitCount ? b : a, { hour: -1, visitCount: 0 })
  const genderTotal = (analytics?.maleCount ?? 0) + (analytics?.femaleCount ?? 0)
  const malePct = genderTotal > 0 ? Math.round(((analytics?.maleCount ?? 0) / genderTotal) * 100) : 0
  const femalePct = genderTotal > 0 ? 100 - malePct : 0
  const maxTopHours = Math.max(1, ...(analytics?.topUsersByHours?.map(u => u.totalHours) ?? [0]))

  const liveTiles: { label: string; value: string | number; color: string; key: LiveTileKey | null }[] = analytics ? [
    { label: 'İçeride', value: analytics.activeNow, color: '#059669', key: 'occupancy' },
    { label: 'Molada', value: analytics.onBreakNow, color: '#d97706', key: 'onBreak' },
    { label: 'Sırada', value: analytics.waitingNow, color: '#7c3aed', key: 'waiting' },
    { label: 'Doluluk', value: `%${analytics.occupancyRateNow.toFixed(1)}`, color: '#2563eb', key: null },
  ] : []

  return (
    <div className="space-y-5">

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-card p-3 shadow-sm">
        {/* Sol Taraf: Kütüphane Filtresi (varsa) */}
        {libraryOptions && libraryOptions.length > 0 ? (
          <div className="flex items-center gap-2">
            <SlidersHorizontalIcon className="h-4 w-4 text-[hsl(var(--foreground-muted))]" />
            <div className="w-60">
              <Select
                value={libraryId ?? ''}
                onChange={(e) => onLibraryChange?.(e.target.value)}
              >
                <option value="">Tüm Kütüphaneler</option>
                {libraryOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
          </div>
        ) : <div />}

        {/* Sağ Taraf: Bugün / Bu Hafta / Bu Ay / Bu Yıl / Özel Aralık */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-1">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all ${
                  period === p.value
                    ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                    : 'text-[hsl(var(--foreground-muted))] hover:text-[hsl(var(--foreground-default))]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-[hsl(var(--foreground-muted))]" />
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-1.5 text-[13px]" />
              <span className="text-[hsl(var(--foreground-muted))]">—</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-1.5 text-[13px]" />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-card p-6 shadow-sm">
          <SkeletonRows rows={6} />
        </div>
      ) : analytics ? (
        <>
          <SectionCard icon={ActivityIcon} title="Anlık Durum" subtitle="Gerçek zamanlı doluluk bilgisi" accent="green">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {liveTiles.map(s => {
                const clickable = !!s.key && !!onLiveTileClick
                const Tag = clickable ? 'button' : 'div'
                return (
                  <Tag
                    key={s.label}
                    type={clickable ? 'button' : undefined}
                    onClick={clickable ? () => onLiveTileClick!(s.key as LiveTileKey) : undefined}
                    className={`rounded-xl border border-[hsl(var(--border))] py-5 text-center w-full ${clickable ? 'cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md' : ''}`}
                    style={{ background: `${s.color}0d` }}
                  >
                    <p className="text-[28px] font-black tabular-nums leading-none" style={{ color: s.color }}>{s.value}</p>
                    <p className="mt-1.5 text-[11px] font-semibold text-[hsl(var(--foreground-muted))]">{s.label}</p>
                  </Tag>
                )
              })}
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            <SectionCard icon={TrendingUpIcon} title="Ziyaret İstatistikleri" subtitle="Seçilen dönem özeti" accent="blue">
              <div className="space-y-2">
                <StatRow label="Toplam Ziyaret" value={analytics.totalVisits.toLocaleString('tr-TR')} />
                <StatRow label="Günlük Ort. Ziyaret" value={analytics.avgDailyVisits.toFixed(1)} />
                <StatRow label="Ort. Oturum Süresi" value={fmtDuration(analytics.avgSessionMinutes)} />
                <StatRow label="Ort. Mola / Oturum" value={analytics.avgBreaksPerSession.toFixed(2)} />
                <StatRow label="Toplam Mola" value={analytics.totalBreaks.toLocaleString('tr-TR')} />
                <StatRow label="Mola Oranı" value={`%${analytics.breakRatePct.toFixed(1)}`} />
              </div>
            </SectionCard>

            <SectionCard icon={UserIcon} title="Cinsiyet & Yaş Dağılımı"
              subtitle={analytics.avgAge !== null ? `Ortalama yaş: ${analytics.avgAge.toFixed(1)}` : 'Yaş verisi eksik'}
              accent="violet">
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[hsl(var(--foreground-muted))]">Cinsiyet Dağılımı</span>
                  {genderTotal > 0 && (
                    <div className="flex items-center gap-3 text-[12px] font-semibold">
                      <span className="text-[#3b82f6]">♂ Erkek %{malePct}</span>
                      <span className="text-[#ec4899]">♀ Kadın %{femalePct}</span>
                    </div>
                  )}
                </div>
                {genderTotal > 0 ? (
                  <>
                    <div className="flex h-4 overflow-hidden rounded-full">
                      <div style={{ width: `${malePct}%`, background: '#3b82f6' }} />
                      <div style={{ width: `${femalePct}%`, background: '#ec4899' }} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] text-[hsl(var(--foreground-muted))]">
                      <span>{analytics.maleCount.toLocaleString('tr-TR')} erkek</span>
                      <span>{analytics.femaleCount.toLocaleString('tr-TR')} kadın</span>
                    </div>
                  </>
                ) : (
                  <div className="flex h-4 items-center justify-center rounded-full bg-[hsl(var(--surface-2))]">
                    <span className="text-[10px] text-[hsl(var(--foreground-muted))]">Veri yok</span>
                  </div>
                )}
              </div>
              <div className="flex h-24 items-end gap-1.5">
                {ageGroups.map(g => {
                  const pct = (g.count / maxAgeCount) * 100
                  return (
                    <div key={g.label} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold tabular-nums text-[hsl(var(--foreground-muted))]">{g.count}</span>
                      <div className="w-full rounded-t-md" style={{ height: `${Math.max(pct, 4)}%`, background: '#7c3aed', opacity: 0.55 + (pct / 100) * 0.45 }} />
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 flex gap-1.5">
                {ageGroups.map(g => (
                  <div key={g.label} className="flex-1 text-center text-[10px] text-[hsl(var(--foreground-muted))]">{g.label}</div>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard icon={BarChart2Icon} title="Saatlik Yoğunluk"
            subtitle={peakHour && peakHour.visitCount > 0 ? `En yoğun saat: ${peakHour.hour}:00 — ${peakHour.visitCount.toLocaleString('tr-TR')} giriş` : 'Saatsel giriş dağılımı'}
            accent="orange">
            <div className="flex h-20 items-end gap-px">
              {(analytics.hourlyLoad ?? []).map(h => {
                const pct = maxHourly > 0 ? (h.visitCount / maxHourly) * 100 : 0
                const isPeak = h.hour === peakHour?.hour && h.visitCount > 0
                return (
                  <div
                    key={h.hour}
                    className="relative flex-1 rounded-t-sm"
                    style={{ height: `${Math.max(pct, h.visitCount > 0 ? 4 : 1)}%`, background: isPeak ? '#d97706' : '#d9770650' }}
                    title={`${h.hour}:00 — ${h.visitCount.toLocaleString('tr-TR')} giriş`}
                  >
                    {isPeak && (
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-amber-500 px-1 py-0.5 text-[9px] font-bold text-white">
                        {h.hour}:00
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex justify-between">
              {[0, 4, 8, 12, 16, 20, 23].map(h => (
                <span key={h} className="text-[10px] text-[hsl(var(--foreground-muted))]">{h}:00</span>
              ))}
            </div>
          </SectionCard>

          <div className={`grid grid-cols-1 gap-4 ${showTopLibraries ? 'md:grid-cols-2' : ''}`}>

            {showTopLibraries && (
              <SectionCard icon={BookOpenIcon} title="En Yoğun Kütüphaneler" subtitle="Ziyaret sayısına göre sıralı top 5" accent="teal">
                {analytics.topLibraries.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-[hsl(var(--foreground-muted))]">Bu dönemde veri yok</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.topLibraries.map((lib, i) => (
                      <div key={lib.libraryId} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <MedalBadge rank={i} />
                            <span className="truncate text-[13px] font-medium text-[hsl(var(--foreground-strong))]">{lib.libraryName}</span>
                          </div>
                          <span className="shrink-0 text-[12px] tabular-nums text-[hsl(var(--foreground-muted))]">{lib.visitCount.toLocaleString('tr-TR')} ziyaret</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(var(--surface-2))]">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, lib.avgOccupancyPct)}%`, background: '#0d9488' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            )}

            <SectionCard icon={StarIcon} title="En Aktif Üyeler" subtitle="Dönem içinde en çok ziyaret eden 10 üye" accent="pink">
              {analytics.topUsers.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[hsl(var(--foreground-muted))]">Bu dönemde veri yok</p>
              ) : (
                <div className="space-y-1.5">
                  {analytics.topUsers.map((u, i) => (
                    <div key={`${u.maskedTckn}-${i}`} className="flex items-center justify-between rounded-lg bg-[hsl(var(--surface-1))] px-2.5 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <MedalBadge rank={i} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[hsl(var(--foreground-strong))]">{u.memberName}</p>
                          <p className="text-[10px] tabular-nums text-[hsl(var(--foreground-muted))]">{u.maskedTckn}</p>
                        </div>
                      </div>
                      <div className="ml-2 shrink-0 text-right">
                        <p className="text-[13px] font-bold tabular-nums" style={{ color: '#db2777' }}>{u.visitCount.toLocaleString('tr-TR')} ziyaret</p>
                        <p className="text-[10px] tabular-nums text-[hsl(var(--foreground-muted))]">{fmtDuration(u.avgSessionMinutes)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard icon={TrophyIcon}
            title="Yılın En Çok Saat Kullananları"
            subtitle={`${new Date().getFullYear()} yılı boyunca toplam kullanım saatine göre sıralama (dönem filtresinden bağımsız)`}
            accent="indigo">
            {!analytics.topUsersByHours || analytics.topUsersByHours.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[hsl(var(--foreground-muted))]">Bu yıl için veri yok</p>
            ) : (
              <div className="space-y-3">
                {analytics.topUsersByHours.map((u, i) => (
                  <div key={`${u.maskedTckn}-${i}`} className="flex items-center gap-3">
                    <MedalBadge rank={i} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-[hsl(var(--foreground-strong))]">{u.memberName}</span>
                        <span className="shrink-0 text-[14px] font-black tabular-nums" style={{ color: '#6366f1' }}>{u.totalHours.toFixed(1)} sa</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--surface-2))]">
                        <div className="h-full rounded-full" style={{ width: `${(u.totalHours / maxTopHours) * 100}%`, background: 'linear-gradient(90deg, #6366f1, #818cf8)' }} />
                      </div>
                      <p className="mt-0.5 text-[10px] tabular-nums text-[hsl(var(--foreground-muted))]">{u.visitCount.toLocaleString('tr-TR')} oturum · {u.maskedTckn}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {!!analytics.legacyTopUsers?.length && (
            <SectionCard icon={HistoryIcon}
              title="Tüm Zamanlar Kullanım Geçmişi (2019'dan Bugüne)"
              subtitle="Eski Millet Kıraathanesi sisteminden içe aktarılmış arşiv veri — dönem filtresinden bağımsız"
              accent="slate">
              <div className="space-y-2">
                {analytics.legacyTopUsers.map((u, i) => (
                  <div key={`${u.maskedTckn}-${i}`} className="flex items-center gap-3 rounded-lg bg-[hsl(var(--surface-1))] px-3 py-2.5">
                    <MedalBadge rank={i} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-[hsl(var(--foreground-strong))]">
                          {u.memberName}
                          {!u.matchedToParticipant && (
                            <span className="ml-1.5 text-[10px] font-normal text-[hsl(var(--foreground-subtle))]">(güncel sistemde eşleşmedi)</span>
                          )}
                        </span>
                        <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#475569]">{u.totalVisits.toLocaleString('tr-TR')} ziyaret</span>
                      </div>
                      <p className="mt-0.5 text-[10px] tabular-nums text-[hsl(var(--foreground-muted))]">
                        {u.totalHours.toLocaleString('tr-TR')} saat toplam · {u.maskedTckn} · {fmtLegacyDate(u.firstVisitAt)} – {fmtLegacyDate(u.lastVisitAt)}
                        {u.primaryLocationName ? ` · ${u.primaryLocationName}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {!!analytics.legacyUserDemographics && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SectionCard icon={PieChartIcon} title="Kullanıcı Cinsiyet Dağılımı (Tüm Zamanlar)"
                  subtitle={`${analytics.legacyUserDemographics.total.toLocaleString('tr-TR')} eşleşen kullanıcı · %${analytics.legacyUserDemographics.gender.femalePercent} kadın · %${analytics.legacyUserDemographics.gender.malePercent} erkek`}
                  accent="pink">
                  <DonutChart
                    data={[
                      { label: 'Kadın', value: analytics.legacyUserDemographics.gender.female },
                      { label: 'Erkek', value: analytics.legacyUserDemographics.gender.male },
                    ]}
                    centerValue={analytics.legacyUserDemographics.total.toLocaleString('tr-TR')}
                    centerLabel="kullanıcı"
                  />
                </SectionCard>
                <SectionCard icon={CakeIcon} title="Yaş Grupları × Cinsiyet (Tüm Zamanlar)"
                  subtitle={`Ortalama yaş: ${analytics.legacyUserDemographics.averageAge.toFixed(1)} · ${analytics.legacyUserDemographics.minors.toLocaleString('tr-TR')} kişi 18 yaş altı`}
                  accent="orange">
                  <GroupedBarChart
                    data={analytics.legacyUserDemographics.ageBands.map((b) => ({ label: b.band, Kadın: b.female, Erkek: b.male }))}
                    xKey="label"
                    height={240}
                    series={[{ key: 'Kadın', label: 'Kadın', color: FEMALE_COLOR }, { key: 'Erkek', label: 'Erkek', color: MALE_COLOR }]}
                  />
                </SectionCard>
              </div>

              <SectionCard icon={MapPinIcon} title="Mahalle Bazlı Kullanıcı Dağılımı (Tüm Zamanlar)"
                subtitle="Kütüphaneleri şimdiye kadar kullanmış kişilerin ikamet mahallesine göre dağılımı"
                accent="teal">
                {analytics.legacyUserDemographics.neighborhoods.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-[hsl(var(--foreground-muted))]">Mahalle verisi yok</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.legacyUserDemographics.neighborhoods.map((n, i) => {
                      const max = analytics.legacyUserDemographics!.neighborhoods[0]?.total || 1
                      return (
                        <div key={n.name} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <MedalBadge rank={i} />
                              <span className="truncate text-[13px] font-medium text-[hsl(var(--foreground-strong))]">{n.name}</span>
                            </div>
                            <span className="shrink-0 text-[12px] tabular-nums text-[hsl(var(--foreground-muted))]">
                              {n.total.toLocaleString('tr-TR')} kişi · %{n.percentOfTotal} · ♀{n.female.toLocaleString('tr-TR')} ♂{n.male.toLocaleString('tr-TR')}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(var(--surface-2))]">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (n.total / max) * 100)}%`, background: '#0d9488' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
