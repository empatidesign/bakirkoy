import { useState } from 'react'
import { BusIcon, CompassIcon, ClipboardListIcon } from 'lucide-react'
import { ModuleHeader } from '@/design-system'
import { TravelDiscoverTab } from './TravelDiscoverTab'
import { TravelApplicationsTab } from './TravelApplicationsTab'

type TravelTab = 'discover' | 'apps'

export const TravelsPage = () => {
  const [tab, setTab] = useState<TravelTab>('discover')

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <ModuleHeader
        icon={BusIcon}
        title="Geziler"
        subtitle="Belediye gezilerini keşfet ve başvur"
        gradient="linear-gradient(160deg, #1e293b 0%, #334155 50%, #475569 100%)"
        tabs={[
          { key: 'discover', label: 'Geziler', icon: CompassIcon },
          { key: 'apps', label: 'Başvurularım', icon: ClipboardListIcon },
        ]}
        value={tab}
        onValueChange={(k) => setTab(k as TravelTab)}
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        {tab === 'discover' ? <TravelDiscoverTab /> : <TravelApplicationsTab />}
      </div>
    </div>
  )
}
