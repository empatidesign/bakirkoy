import { useEffect, useState } from 'react'
import { ActivityIcon, UsersRoundIcon, ClockIcon, TrendingUpIcon, LogInIcon, LogOutIcon, HourglassIcon } from 'lucide-react'
import { SkeletonRows } from '@/design-system'
import libraryService from '@/services/library.service'
import type { CitizenLibraryStats } from '@/types/library.types'

const VISIBLE_HOURS = [8, 10, 12, 14, 16, 18, 20]

const fmtStay = (minutes: number): string => {
  const total = Math.max(0, Math.round(minutes))
  if (total === 0) return '—'
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h > 0 && m > 0) return `${h}s ${m}dk`
  if (h > 0) return `${h}s`
  return `${m}dk`
}

const fmtHour = (h?: number | null): string => (h == null ? '—' : `${String(h).padStart(2, '0')}:00`)

const StatCard = ({ icon: Icon, value, label, tone }: {
  icon: typeof ActivityIcon
  value: string
  label: string
  tone: 'primary' | 'success' | 'danger' | 'neutral'
}) => {
  const toneMap = {
    primary: 'bg-primary/5 text-primary',
    success: 'bg-success/5 text-success',
    danger: 'bg-danger/5 text-danger',
    neutral: 'bg-surface-1 text-foreground-strong',
  }
  return (
    <div className={`flex flex-col items-center gap-1 rounded-card px-2 py-3 text-center ${toneMap[tone]}`}>
      <Icon className="h-4 w-4" />
      <span className="text-lg font-black leading-none">{value}</span>
      <span className="type-caption text-foreground-muted">{label}</span>
    </div>
  )
}

export const LibraryStatsPanel = ({ libraryId }: { libraryId: string }) => {
  const [stats, setStats] = useState<CitizenLibraryStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    libraryService.stats(libraryId)
      .then((s) => { if (active) setStats(s) })
      .catch(() => { if (active) setStats(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [libraryId])

  if (loading) return <SkeletonRows rows={4} />
  if (!stats) return <p className="py-8 text-center type-muted">İstatistikler yüklenemedi.</p>

  const maxCount = Math.max(1, ...stats.hourlyLoad.map((h) => h.count))
  const byHour = new Map(stats.hourlyLoad.map((h) => [h.hour, h.count]))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={ActivityIcon} value={`%${stats.occupancyRate}`} label="Doluluk Oranı" tone="primary" />
        <StatCard icon={UsersRoundIcon} value={`${stats.activeNow}/${stats.capacity}`} label="Anlık Kullanım" tone="success" />
        <StatCard icon={ClockIcon} value={fmtHour(stats.peakHour)} label="En Yoğun Saat" tone="danger" />
      </div>

      <div>
        <p className="type-label mb-2 inline-flex items-center gap-1.5">
          <TrendingUpIcon className="h-3.5 w-3.5 text-primary" /> Saatlik Yoğunluk
        </p>
        <div className="flex items-end justify-between gap-2 rounded-card bg-surface-1 px-3 pt-3 pb-2" style={{ height: 132 }}>
          {VISIBLE_HOURS.map((h) => {
            const count = byHour.get(h) ?? 0
            const heightPct = Math.round((count / maxCount) * 100)
            const isPeak = stats.peakHour === h && count > 0
            return (
              <div key={h} className="flex flex-1 flex-col items-center justify-end gap-1.5" style={{ height: '100%' }}>
                <div className="flex w-full flex-1 items-end justify-center">
                  <div
                    className="w-2.5 rounded-full transition-all"
                    style={{
                      height: `${Math.max(6, heightPct)}%`,
                      backgroundColor: isPeak ? 'hsl(var(--primary))' : 'hsl(var(--primary)/0.25)',
                    }}
                    title={`${fmtHour(h)} — ${count} giriş`}
                  />
                </div>
                <span className={`type-caption ${isPeak ? 'font-bold text-primary' : 'text-foreground-muted'}`}>{h}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <p className="type-label mb-2 inline-flex items-center gap-1.5">
          <ActivityIcon className="h-3.5 w-3.5 text-primary" /> Bugünkü Hareketler
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-0.5 rounded-card bg-success/5 px-2 py-3 text-center">
            <LogInIcon className="h-4 w-4 text-success" />
            <span className="text-lg font-black text-success">{stats.todayEntries}</span>
            <span className="type-caption text-foreground-muted">Giriş</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-card bg-danger/5 px-2 py-3 text-center">
            <LogOutIcon className="h-4 w-4 text-danger" />
            <span className="text-lg font-black text-danger">{stats.todayExits}</span>
            <span className="type-caption text-foreground-muted">Çıkış</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-card bg-surface-1 px-2 py-3 text-center">
            <HourglassIcon className="h-4 w-4 text-foreground-muted" />
            <span className="text-lg font-black text-foreground-strong">{fmtStay(stats.avgStayMinutes)}</span>
            <span className="type-caption text-foreground-muted">Ort. Kalış</span>
          </div>
        </div>
      </div>
    </div>
  )
}
