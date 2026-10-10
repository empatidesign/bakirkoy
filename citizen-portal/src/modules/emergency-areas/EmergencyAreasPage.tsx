import { useEffect, useState } from 'react'
import { ShieldAlertIcon, ListIcon, MapIcon } from 'lucide-react'
import { ModuleHeader } from '@/design-system'
import type { CitizenEmergencyArea } from '@/types/emergency-area.types'
import emergencyAreaService from '@/services/emergency-area.service'
import { EmergencyAreaListTab } from './EmergencyAreaListTab'
import { EmergencyAreaMapTab } from './EmergencyAreaMapTab'

type AreaTab = 'list' | 'map'

export const EmergencyAreasPage = () => {
  const [tab, setTab] = useState<AreaTab>('list')
  const [areas, setAreas] = useState<CitizenEmergencyArea[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    emergencyAreaService.list()
      .then((r) => { if (active) { setAreas(r); setError(false) } })
      .catch(() => { if (active) { setAreas(null); setError(true) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  const retry = () => setReloadKey((k) => k + 1)

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={ShieldAlertIcon}
        title="Acil Toplanma Alanları"
        subtitle="Bakırköy bölgesindeki acil toplanma noktaları"
        gradient="linear-gradient(160deg, #7f1d1d 0%, #b91c1c 55%, #ef4444 100%)"
        tabs={[
          { key: 'list', label: 'Liste', icon: ListIcon },
          { key: 'map', label: 'Harita', icon: MapIcon },
        ]}
        value={tab}
        onValueChange={(k) => setTab(k as AreaTab)}
      />
      <div className="flex-1 overflow-y-auto">
        {tab === 'list' ? (
          <EmergencyAreaListTab areas={areas} loading={loading} error={error} onRetry={retry} />
        ) : (
          <EmergencyAreaMapTab areas={areas ?? []} loading={loading} error={error} onRetry={retry} />
        )}
      </div>
    </div>
  )
}
