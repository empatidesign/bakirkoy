import { BuildingIcon, LayersIcon, ListIcon, MapIcon } from 'lucide-react'

import { useSearchParams } from 'react-router-dom'
import { PageHeader, Tabs } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { ServiceFacilitiesTab } from './ServiceFacilitiesTab'
import { FacilityMapView } from './FacilityMapView'
import { BulkModuleAssignView } from './BulkModuleAssignView'

const VIEWS = ['list', 'map', 'assignment']

export const ServiceFacilitiesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = VIEWS.find((v) => v === searchParams.get('view')) ?? 'list'
  const setView = (key: string) =>
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('view', key); return n })

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={BuildingIcon}
          title="Hizmet Tesislerimiz"
          subtitle="Belediye tesislerini, açık alanları ve sunulan hizmetleri modern bir arayüz ile tek merkezden yönetin."
          breadcrumb="Tesislerimiz / Hizmet Tesislerimiz"
        />

        <Tabs
          value={view}
          onValueChange={setView}
          tabs={[
            { key: 'list', label: 'Liste Görünümü', icon: ListIcon },
            { key: 'map', label: 'Harita Görünümü', icon: MapIcon },
            { key: 'assignment', label: 'Modül Ataması', icon: LayersIcon },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          {view === 'list' && <ServiceFacilitiesTab />}
          {view === 'map' && <FacilityMapView />}
          {view === 'assignment' && <BulkModuleAssignView />}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
