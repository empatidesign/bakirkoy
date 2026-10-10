import { useSearchParams } from 'react-router-dom'
import { GraduationCapIcon, FileTextIcon, TagsIcon, School2Icon, CalendarRangeIcon, SettingsIcon, BarChart3Icon } from 'lucide-react'
import { PageHeader, Tabs } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { SedaApplicationsTab } from './SedaApplicationsTab'
import { SedaEducationTab } from './SedaEducationTab'
import { SedaDefinitionsTab } from './SedaDefinitionsTab'
import { SedaSchoolsTab } from './SedaSchoolsTab'
import { SedaPeriodsTab } from './SedaPeriodsTab'
import { SedaSettingsTab } from './SedaSettingsTab'
import { SedaYearlyReportTab } from './SedaYearlyReportTab'

type ActiveTab = 'basvurular' | 'rapor' | 'kazananlar' | 'tanimlar' | 'okullar' | 'donemler' | 'sistem'

export const SedaPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') ?? 'basvurular') as ActiveTab

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
          icon={GraduationCapIcon}
          title="Seda Eğitim Yönetimi"
          subtitle="Öğrenci başvurularını, okulları, tanımları ve başvuru dönemlerini yönetin"
          breadcrumb="Hizmetlerimiz / Seda Eğitim"
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={[
            { key: 'basvurular', label: 'Başvurular', icon: FileTextIcon },
            { key: 'rapor', label: 'Yıllara Göre Rapor', icon: BarChart3Icon },
            { key: 'kazananlar', label: 'Sınavı Kazananlar', icon: GraduationCapIcon },
            { key: 'tanimlar', label: 'Tanımlar', icon: TagsIcon },
            { key: 'okullar', label: 'Okullar', icon: School2Icon },
            { key: 'donemler', label: 'Dönemler', icon: CalendarRangeIcon },
            { key: 'sistem', label: 'Sistem Ayarları', icon: SettingsIcon },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          {activeTab === 'basvurular' && <SedaApplicationsTab />}
          {activeTab === 'rapor' && <SedaYearlyReportTab />}
          {activeTab === 'kazananlar' && <SedaEducationTab />}
          {activeTab === 'tanimlar' && <SedaDefinitionsTab />}
          {activeTab === 'okullar' && <SedaSchoolsTab />}
          {activeTab === 'donemler' && <SedaPeriodsTab />}
          {activeTab === 'sistem' && <SedaSettingsTab />}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
