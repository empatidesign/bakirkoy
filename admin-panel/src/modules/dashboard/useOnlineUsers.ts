import { useEffect, useState, useCallback } from 'react'
import analyticsService from '@/services/analytics.service'
import type { OnlineUsers } from '@/types/analytics.types'

// Online sayısı 5 dakikalık pencereyle hesaplanır; 1 dakikada bir tazelemek
// gösterge için fazlasıyla yeterli ve sunucuya yük bindirmez.
const REFRESH_INTERVAL_MS = 60_000

export function useOnlineUsers(trendHours = 24) {
  const [data, setData] = useState<OnlineUsers | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setData(await analyticsService.getOnlineUsers(trendHours))
    } catch {
      // Gösterge amaçlı; hata durumunda sessizce eski değer korunur.
    } finally {
      setLoading(false)
    }
  }, [trendHours])

  useEffect(() => {
    setLoading(true)
    void load()
    const interval = setInterval(load, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load])

  return { data, loading, reload: load }
}
