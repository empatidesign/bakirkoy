import { useSearchParams } from 'react-router-dom'
import { Building2Icon, SettingsIcon, DoorOpenIcon } from 'lucide-react'
import { PageHeader, Tabs } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { HallsTab } from './HallsTab'
import { HallSettingsTab } from './HallSettingsTab'

type ActiveTab = 'halls' | 'settings'

export const HallsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') ?? 'halls') as ActiveTab
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
          icon={DoorOpenIcon}
          title="Salon Yönetimi"
          subtitle="Etkinlik ve programların yapıldığı salonlar"
          breadcrumb="Tesislerimiz / Salonlar"
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={[
            { key: 'halls', label: 'Salon Listesi', icon: Building2Icon },
            { key: 'settings', label: 'Genel Ayarlar', icon: SettingsIcon },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          {activeTab === 'halls' && <HallsTab />}
          {activeTab === 'settings' && <HallSettingsTab />}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
