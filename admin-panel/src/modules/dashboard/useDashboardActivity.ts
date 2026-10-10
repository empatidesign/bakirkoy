import { useEffect, useState, useCallback } from 'react'
import analyticsService from '@/services/analytics.service'
import type { DashboardActivity } from '@/types/analytics.types'

const REFRESH_INTERVAL_MS = 60_000

export function useDashboardActivity() {
  const [data, setData] = useState<DashboardActivity | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const result = await analyticsService.getDashboardActivity()
      setData(result)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    void load()
    const interval = setInterval(load, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load])

  return { data, loading, reload: load }
}
