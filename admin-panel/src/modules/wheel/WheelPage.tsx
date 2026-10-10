import { useSearchParams } from 'react-router-dom'
import { CircleDotIcon, GiftIcon, ClipboardListIcon, SettingsIcon } from 'lucide-react'
import { PageHeader, Tabs } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { WheelsTab } from './WheelsTab'
import { GiftsTab } from './GiftsTab'
import { GiftRequestsTab } from './GiftRequestsTab'
import { ModuleNotificationSettingsTab } from '@/components/specialized/ModuleNotificationSettingsTab'

type ActiveTab = 'cark' | 'hediye' | 'talepler' | 'ayarlar'

export const WheelPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') ?? 'cark') as ActiveTab

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
          icon={GiftIcon}
          title="Hediye Çarkı"
          subtitle="Çarkları, hediyeleri ve hediye taleplerini tek yerden yönetin"
          breadcrumb="Sadakat / Hediye Çarkı"
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={[
            { key: 'cark', label: 'Çark Yönetimi', icon: CircleDotIcon },
            { key: 'hediye', label: 'Hediye Yönetimi', icon: GiftIcon },
            { key: 'talepler', label: 'Hediye Talepleri', icon: ClipboardListIcon },
            { key: 'ayarlar', label: 'Ayarlar', icon: SettingsIcon },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          {activeTab === 'cark' && <WheelsTab />}
          {activeTab === 'hediye' && <GiftsTab />}
          {activeTab === 'talepler' && <GiftRequestsTab />}
          {activeTab === 'ayarlar' && <ModuleNotificationSettingsTab module="wheel" />}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
