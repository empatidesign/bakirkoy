import { useSearchParams } from 'react-router-dom'
import {
  CalendarDaysIcon, ClipboardListIcon, CalendarIcon, LayersIcon,
  ActivityIcon, TagIcon, BarChart3Icon, SettingsIcon, ArchiveIcon
} from 'lucide-react'
import { PageHeader, Tabs } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { CategoriesTab } from './CategoriesTab'
import { EventsTab } from './EventsTab'
import { ApplicationsTab } from './ApplicationsTab'
import { SessionsTab } from './SessionsTab'
import { ControlTab } from './ControlTab'
import { ReportsTab } from './ReportsTab'
import { SettingsTab } from './SettingsTab'
import { ArchiveTab } from './ArchiveTab'

type ActiveTab =
  | 'applications' | 'events' | 'sessions' | 'control'
  | 'categories' | 'reports' | 'settings' | 'archive'

export const EventsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') ?? 'events') as ActiveTab
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
          icon={CalendarDaysIcon}
          title="Etkinlik Programı"
          subtitle="Etkinlikler, başvurular, seanslar ve yoklama yönetimi"
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={[
            { key: 'applications', label: 'Başvurular', icon: ClipboardListIcon },
            { key: 'events', label: 'Etkinlikler', icon: CalendarIcon },
            { key: 'sessions', label: 'Seanslar', icon: LayersIcon },
            { key: 'control', label: 'Kontrol', icon: ActivityIcon },
            { key: 'categories', label: 'Kategoriler', icon: TagIcon },
            { key: 'reports', label: 'Raporlar', icon: BarChart3Icon },
            { key: 'settings', label: 'Ayarlar', icon: SettingsIcon },
            { key: 'archive', label: 'Arşiv', icon: ArchiveIcon },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          {activeTab === 'categories' && <CategoriesTab />}

          {activeTab === 'applications' && <ApplicationsTab />}
          {activeTab === 'events' && <EventsTab />}
          {activeTab === 'sessions' && <SessionsTab />}
          {activeTab === 'control' && <ControlTab />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'archive' && <ArchiveTab />}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
