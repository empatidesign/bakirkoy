import { useEffect, useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/design-system'
import muhtarlikService from '@/services/muhtarlik.service'
import { MuhtarDashboardView } from './MuhtarDashboardView'
import type { MuhtarDashboard } from '@/types/muhtarlik.types'

export const MyMuhtarPanelTab = ({ scoped = true, onNewRequest }: { scoped?: boolean; onNewRequest?: () => void }) => {
  const [data, setData] = useState<MuhtarDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    muhtarlikService.getMuhtarDashboard()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const neighborhoods = data?.neighborhoods ?? []
  const title = !scoped
    ? 'Tüm Mahalleler — Genel Görünüm'
    : neighborhoods.length === 0
      ? undefined
      : neighborhoods.length === 1
        ? `${neighborhoods[0]} — Mahallenizin Genel Görünümü`
        : `${neighborhoods.join(', ')} — Mahallelerinizin Genel Görünümü`

  return (
    <div className="space-y-4">
      {scoped && onNewRequest && (
        <div className="flex justify-end">
          <Button variant="primary" iconLeft={<PlusIcon className="h-4 w-4" />} onClick={onNewRequest}>
            Yeni Talep Oluştur
          </Button>
        </div>
      )}
      <MuhtarDashboardView data={data} loading={loading} title={title} />
    </div>
  )
}
