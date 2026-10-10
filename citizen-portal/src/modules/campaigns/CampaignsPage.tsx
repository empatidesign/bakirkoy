import { useState } from 'react'
import { TagIcon, ListIcon, CheckCircle2Icon, Building2Icon } from 'lucide-react'
import { ModuleHeader } from '@/design-system'
import { CampaignListTab } from './CampaignListTab'
import { MyUsedCampaignsTab } from './MyUsedCampaignsTab'
import { MemberBusinessesTab } from './MemberBusinessesTab'

type Tab = 'list' | 'businesses' | 'used'

export const CampaignsPage = () => {
  const [tab, setTab] = useState<Tab>('list')

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={TagIcon}
        title="Kampanyalar"
        subtitle="Firmalar tarafından sunulan kampanyalar"
        gradient="linear-gradient(160deg, #1e293b 0%, #3730a3 55%, #4f46e5 100%)"
        tabs={[
          { key: 'list', label: 'Kampanyalar', icon: ListIcon },
          { key: 'businesses', label: 'Üye İş Yerleri', icon: Building2Icon },
          { key: 'used', label: 'Kullandıklarım', icon: CheckCircle2Icon },
        ]}
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
      />
      <div className="flex-1 overflow-y-auto">
        {tab === 'list' ? <CampaignListTab /> : tab === 'businesses' ? <MemberBusinessesTab /> : <MyUsedCampaignsTab />}
      </div>
    </div>
  )
}
