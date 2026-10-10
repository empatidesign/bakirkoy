import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import analyticsService from '@/services/analytics.service'
import type { AnalyticsOverview, TrendGroupBy } from '@/types/analytics.types'

export type DateRangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom'

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const groupByFor = (preset: DateRangePreset, days: number): TrendGroupBy => {
  if (preset === 'today' || preset === 'yesterday') return 'day'
  if (days > 120) return 'month'
  if (days > 31) return 'week'
  return 'day'
}

const daysBetween = (from: string, to: string) => {
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  return Math.max(1, Math.round((b - a) / 86400000))
}

export const resolveDateRange = (preset: DateRangePreset, customFrom?: string, customTo?: string) => {
  const now = new Date()
  switch (preset) {
    case 'today':
      return { from: fmt(now), to: fmt(now) }
    case 'yesterday': {
      const d = new Date(now); d.setDate(d.getDate() - 1)
      return { from: fmt(d), to: fmt(d) }
    }
    case 'week': {
      // Denetim düzeltmesi (2026-09-01): Pazar günü (getDay()===0) "-0+1" hesabı bir sonraki
      // Pazartesi'yi (bugünden 1 gün İLERİ) üretiyordu, bu yüzden Pazar günleri "Bu Hafta"
      // seçildiğinde from > to (ör. from=2026-09-07, to=2026-09-06) — ters/geçersiz bir aralık
      // API'ye gönderiliyordu ve backend'den boş/anlamsız sonuç dönüyordu. ISO Pazartesi
      // başlangıçlı doğru hesap: Pazar için 6 gün geri, diğer günler için (gün-1) gün geri.
      const start = new Date(now)
      const day = now.getDay()
      const diffFromMonday = day === 0 ? 6 : day - 1
      start.setDate(now.getDate() - diffFromMonday)
      return { from: fmt(start), to: fmt(now) }
    }
    case 'month':
      return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: fmt(now) }
    case 'year':
      return { from: `${now.getFullYear()}-01-01`, to: fmt(now) }
    case 'custom':
      return { from: customFrom || fmt(now), to: customTo || fmt(now) }
    default:
      return { from: fmt(now), to: fmt(now) }
  }
}

export function useAnalyticsOverview() {
  const [params, setParams] = useSearchParams()
  const preset = (params.get('range') as DateRangePreset | null) ?? 'month'
  const customFrom = params.get('from') ?? undefined
  const customTo = params.get('to') ?? undefined
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const setPreset = useCallback((value: string, custom?: { from: string; to: string }) => {
    const next = new URLSearchParams(params)
    next.set('range', value)
    if (value === 'custom' && custom) {
      next.set('from', custom.from)
      next.set('to', custom.to)
    } else {
      next.delete('from')
      next.delete('to')
    }
    setParams(next, { replace: true })
  }, [params, setParams])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(false)
    const { from, to } = resolveDateRange(preset, customFrom, customTo)
    const groupBy = groupByFor(preset, daysBetween(from, to))
    analyticsService.getOverview({ from, to, groupBy })
      .then((d) => { if (mounted) { setData(d); setLoading(false) } })
      .catch(() => { if (mounted) { setError(true); setLoading(false) } })
    return () => { mounted = false }
  }, [preset, customFrom, customTo])

  return { data, loading, error, preset, setPreset, customFrom, customTo }
}
