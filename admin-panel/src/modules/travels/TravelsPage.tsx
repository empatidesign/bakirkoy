import { useSearchParams } from 'react-router-dom'
import {
  ClipboardListIcon, MapPinIcon, BusIcon,
  TagIcon, BarChart3Icon, SettingsIcon,
} from 'lucide-react'
import { PageHeader, Tabs } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { RoutesTab } from './RoutesTab'
import { CategoriesTab } from './CategoriesTab'
import { ApplicationsTab } from './ApplicationsTab'
import { BusManagementTab } from './BusManagementTab'
import { ReportsTab } from './ReportsTab'
import { TravelSettingsTab } from './TravelSettingsTab'

type ActiveTab =
  | 'applications' | 'travels' | 'buses'
  | 'categories' | 'reports' | 'settings'

export const TravelsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') ?? 'travels') as ActiveTab
  const setTab = (tab: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('tab', tab)
      return n
    })

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={BusIcon}
          title="Gezi Sistemi"
          subtitle="Geziler, başvurular ve araç yönetimi"
          breadcrumb="Etkileşim / Gezi Sistemi"
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={[
            { key: 'applications', label: 'Başvurular', icon: ClipboardListIcon },
            { key: 'travels', label: 'Geziler', icon: MapPinIcon },
            { key: 'buses', label: 'Araç Yönetimi', icon: BusIcon },
            { key: 'categories', label: 'Kategoriler', icon: TagIcon },
            { key: 'reports', label: 'Raporlar', icon: BarChart3Icon },
            { key: 'settings', label: 'Genel Ayarlar', icon: SettingsIcon },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          {activeTab === 'applications' && <ApplicationsTab />}
          {activeTab === 'travels' && <RoutesTab />}
          {activeTab === 'buses' && <BusManagementTab />}
          {activeTab === 'categories' && <CategoriesTab />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'settings' && <TravelSettingsTab />}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
