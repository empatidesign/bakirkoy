import { useSearchParams } from 'react-router-dom'
import {
  LayoutDashboardIcon, Building2Icon, TicketPercentIcon, ReceiptTextIcon, TagsIcon, GiftIcon, SettingsIcon,
  CreditCardIcon,
} from 'lucide-react'
import { PageHeader, Tabs } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { OverviewTab } from './OverviewTab'
import { CompaniesTab } from './CompaniesTab'
import { CampaignsTab } from './CampaignsTab'
import { UsagesTab } from './UsagesTab'
import { CampaignRedemptionsTab } from './CampaignRedemptionsTab'
import { ServiceCategoriesTab } from './ServiceCategoriesTab'
import { CompanySettingsTab } from './CompanySettingsTab'
import { BakkartBasvurulariTab } from './BakkartBasvurulariTab'

type ActiveTab = 'genel' | 'bakkart-basvurulari' | 'firmalar' | 'kampanyalar' | 'kullanimlar' | 'cark-kullanimlari' | 'kategoriler' | 'ayarlar'

export const CompaniesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') ?? 'bakkart-basvurulari') as ActiveTab

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
          icon={CreditCardIcon}
          title="Firma & Bakkart Kampanya Yönetimi"
          subtitle="Vatandaş Bakkart kart başvuruları, anlaşmalı ilçe esnafı ve indirim kampanyaları"
          breadcrumb="Sadakat / Firma & Bakkart"
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={[
            { key: 'bakkart-basvurulari', label: 'Bakkart Başvuruları & Kartlar', icon: CreditCardIcon },
            { key: 'firmalar', label: 'Anlaşmalı Firmalar', icon: Building2Icon },
            { key: 'kampanyalar', label: 'İndirim Kampanyaları', icon: TicketPercentIcon },
            { key: 'kullanimlar', label: 'İndirim Kullanımları', icon: ReceiptTextIcon },
            { key: 'cark-kullanimlari', label: 'Çark/QR Kullanımları', icon: GiftIcon },
            { key: 'kategoriler', label: 'Sektör Kategorileri', icon: TagsIcon },
            { key: 'genel', label: 'İstatistik Özeti', icon: LayoutDashboardIcon },
            { key: 'ayarlar', label: 'Ayarlar', icon: SettingsIcon },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          {activeTab === 'bakkart-basvurulari' && <BakkartBasvurulariTab />}
          {activeTab === 'firmalar' && <CompaniesTab />}
          {activeTab === 'kampanyalar' && <CampaignsTab />}
          {activeTab === 'kullanimlar' && <UsagesTab />}
          {activeTab === 'cark-kullanimlari' && <CampaignRedemptionsTab />}
          {activeTab === 'kategoriler' && <ServiceCategoriesTab />}
          {activeTab === 'genel' && <OverviewTab />}
          {activeTab === 'ayarlar' && <CompanySettingsTab />}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
