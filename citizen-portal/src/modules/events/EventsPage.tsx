import { useState } from 'react'
import { CalendarDaysIcon, CompassIcon, ClipboardListIcon } from 'lucide-react'
import { ModuleHeader } from '@/design-system'
import { DiscoverTab } from './DiscoverTab'
import { ApplicationsTab } from './ApplicationsTab'

type EventTab = 'discover' | 'apps'

export const EventsPage = () => {
  const [tab, setTab] = useState<EventTab>('discover')

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <ModuleHeader
        icon={CalendarDaysIcon}
        title="Etkinlikler"
        subtitle="Belediye etkinliklerini keşfet ve başvur"
        gradient="linear-gradient(160deg, #1e1b4b 0%, #4338ca 55%, #6366f1 100%)"
        tabs={[
          { key: 'discover', label: 'Etkinlikler', icon: CompassIcon },
          { key: 'apps', label: 'Başvurularım', icon: ClipboardListIcon },
        ]}
        value={tab}
        onValueChange={(k) => setTab(k as EventTab)}
      />

      <div className="flex-1 overflow-y-auto">
        {tab === 'discover' ? <DiscoverTab /> : <ApplicationsTab />}
      </div>
    </div>
  )
}
