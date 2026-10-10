import { ListIcon, MapIcon, AlertTriangleIcon } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader, Tabs } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { EmergencyAreasTab } from './EmergencyAreasTab'
import { EmergencyAreaMapView } from './EmergencyAreaMapView'

export const EmergencyAreasPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') === 'map' ? 'map' : 'list'
  const setView = (key: string) =>
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('view', key); return n })

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={AlertTriangleIcon}
          title="Acil Toplanma Alanları"
          subtitle="Afet ve acil durumlarda kullanılacak toplanma alanlarının yönetimi"
          breadcrumb="Acil Toplanma / Alanlar"
        />

        <Tabs
          value={view}
          onValueChange={setView}
          tabs={[
            { key: 'list', label: 'Liste', icon: ListIcon },
            { key: 'map', label: 'Harita', icon: MapIcon },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          {view === 'list' ? <EmergencyAreasTab /> : <EmergencyAreaMapView />}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
