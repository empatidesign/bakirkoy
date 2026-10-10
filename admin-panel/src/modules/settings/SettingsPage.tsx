import { useSearchParams } from 'react-router-dom'
import { PaletteIcon, LayoutGridIcon, SchoolIcon, LinkIcon, PlugZapIcon, SmartphoneIcon, ImageIcon, RadioTowerIcon } from 'lucide-react'
import { PageHeader, Tabs } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { ThemeSettingsTab } from './ThemeSettingsTab'
import { MenuManagementTab } from './MenuManagementTab'
import { EducationInstitutionsTab } from './EducationInstitutionsTab'
import { TopMenuTab } from './TopMenuTab'
import { IntegrationSettingsTab } from './IntegrationSettingsTab'
import { MobileMenuTab } from './MobileMenuTab'
import { BrandingSettingsTab } from './BrandingSettingsTab'
import { AttendanceControlSettingsTab } from './AttendanceControlSettingsTab'

const TABS = [
  { key: 'branding', label: 'Logo / Kurumsal Kimlik', icon: ImageIcon },
  { key: 'theme', label: 'Tema Ayarları', icon: PaletteIcon },
  { key: 'attendance-control', label: 'Yoklama & SMS Kontrolü', icon: RadioTowerIcon },
  { key: 'menu-management', label: 'Menü Yönetimi', icon: LayoutGridIcon },
  { key: 'top-menu', label: 'Üst Menü', icon: LinkIcon },
  { key: 'mobile-menu', label: 'Mobil Menü', icon: SmartphoneIcon },
  { key: 'education', label: 'Eğitim Kurumları', icon: SchoolIcon },
  { key: 'integrations', label: 'Entegrasyonlar', icon: PlugZapIcon },
]

export const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'branding'

  const setTab = (key: string) => {
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('tab', key); return n })
  }

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={PaletteIcon}
          title="Ayarlar"
          subtitle="Panel görünümü, menü yapısı ve kurumsal kişiselleştirme"
          breadcrumb="Sistem / Ayarlar"
        />

        <Tabs
          value={tab}
          onValueChange={setTab}
          tabs={TABS}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          {tab === 'branding' && <BrandingSettingsTab />}
          {tab === 'theme' && <ThemeSettingsTab />}
          {tab === 'attendance-control' && <AttendanceControlSettingsTab />}
          {tab === 'menu-management' && <MenuManagementTab />}
          {tab === 'top-menu' && <TopMenuTab />}
          {tab === 'mobile-menu' && <MobileMenuTab />}
          {tab === 'education' && <EducationInstitutionsTab />}
          {tab === 'integrations' && <IntegrationSettingsTab />}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}

