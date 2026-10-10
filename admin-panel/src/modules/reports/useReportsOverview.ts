import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import reportsService from '@/services/reports.service'
import type { ReportsOverview } from '@/types/reports.types'
import type { DateRangePreset, DateRangeValue } from '@/design-system/DateRangeSelect'

export function useReportsOverview() {
  const [params, setParams] = useSearchParams()
  const preset = (params.get('rPreset') as DateRangePreset) ?? 'month'
  const from = params.get('rFrom') ?? undefined
  const to = params.get('rTo') ?? undefined
  const moduleFilter = params.get('rModule') ?? ''

  const [data, setData] = useState<ReportsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const range: DateRangeValue = { preset, from, to }

  const setRange = useCallback((next: DateRangeValue) => {
    const n = new URLSearchParams(params)
    n.set('rPreset', next.preset)
    if (next.preset === 'custom') {
      if (next.from) n.set('rFrom', next.from); else n.delete('rFrom')
      if (next.to) n.set('rTo', next.to); else n.delete('rTo')
    } else {
      n.delete('rFrom')
      n.delete('rTo')
    }
    setParams(n, { replace: true })
  }, [params, setParams])

  const setModuleFilter = useCallback((value: string) => {
    const n = new URLSearchParams(params)
    if (value) n.set('rModule', value); else n.delete('rModule')
    setParams(n, { replace: true })
  }, [params, setParams])

  const load = useCallback(() => {
    let mounted = true
    setLoading(true)
    setError(false)
    reportsService.getOverview({
      preset,
      from: preset === 'custom' ? from : undefined,
      to: preset === 'custom' ? to : undefined,
      module: moduleFilter || undefined,
    })
      .then((d) => { if (mounted) { setData(d); setLoading(false) } })
      .catch(() => { if (mounted) { setError(true); setLoading(false) } })
    return () => { mounted = false }
  }, [preset, from, to, moduleFilter])

  useEffect(() => load(), [load])

  return { data, loading, error, range, setRange, moduleFilter, setModuleFilter, refresh: load }
}
