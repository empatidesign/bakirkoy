import { useEffect, useState } from 'react'
import { LogInIcon, LogOutIcon, ClockIcon, CalendarIcon, CalendarDaysIcon, SunIcon, CoffeeIcon, HourglassIcon, AlertTriangleIcon, GaugeIcon } from 'lucide-react'
import { SkeletonRows } from '@/design-system'
import libraryService from '@/services/library.service'
import type { CitizenLibraryMyStats } from '@/types/library.types'

const fmtHm = (minutes: number): string => {
  const total = Math.max(0, Math.round(minutes))
  if (total === 0) return '—'
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

const fmtMin = (minutes: number): string => {
  const total = Math.max(0, Math.round(minutes))
  if (total === 0) return '—'
  return `${total}dk`
}

const StatCard = ({ icon: Icon, value, label, tone }: {
  icon: typeof LogInIcon
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

export const LibraryMyStatsPanel = () => {
  const [stats, setStats] = useState<CitizenLibraryMyStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    libraryService.getMyStats()
      .then((s) => { if (active) setStats(s) })
      .catch(() => { if (active) setStats(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) return <SkeletonRows rows={4} />
  if (!stats) return <p className="py-8 text-center type-muted">İstatistikler yüklenemedi.</p>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={LogInIcon} value={`${stats.totalVisits}`} label="Toplam Ziyaret" tone="primary" />
        <StatCard icon={LogOutIcon} value={`${stats.totalExits}`} label="Toplam Çıkış" tone="success" />
        <StatCard icon={ClockIcon} value={fmtHm(stats.totalMinutes)} label="Toplam Süre" tone="neutral" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={CalendarIcon} value={fmtHm(stats.monthMinutes)} label="Bu Ay" tone="primary" />
        <StatCard icon={CalendarDaysIcon} value={fmtHm(stats.weekMinutes)} label="Bu Hafta" tone="primary" />
        <StatCard icon={SunIcon} value={fmtHm(stats.todayMinutes)} label="Bugün" tone="primary" />
      </div>

      <div className="grid grid-cols-4 gap-2">
        <StatCard icon={CoffeeIcon} value={`${stats.shortBreaks}`} label="Kısa Mola" tone="neutral" />
        <StatCard icon={HourglassIcon} value={`${stats.longBreaks}`} label="Uzun Mola" tone="neutral" />
        <StatCard icon={AlertTriangleIcon} value={`${stats.noShowExits}`} label="İhlal" tone="danger" />
        <StatCard icon={GaugeIcon} value={fmtMin(stats.avgSessionMinutes)} label="Ort. Oturum" tone="success" />
      </div>
    </div>
  )
}

export default LibraryMyStatsPanel
