import { useState } from 'react'
import { BookOpenIcon, LibraryIcon, ArmchairIcon } from 'lucide-react'
import { ModuleHeader } from '@/design-system'
import { LibraryDirectoryTab } from './LibraryDirectoryTab'
import { LibraryReservationsTab } from './LibraryReservationsTab'

type LibraryTab = 'directory' | 'reservations'

export const LibrariesPage = () => {
  const [tab, setTab] = useState<LibraryTab>('directory')

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <ModuleHeader
        icon={BookOpenIcon}
        title="Kıraathaneler"
        subtitle="Millet kıraathanelerini keşfet ve yer ayırt"
        gradient="linear-gradient(160deg, #1e3a5f 0%, #1d4ed8 55%, #3b82f6 100%)"
        tabs={[
          { key: 'directory', label: 'Kıraathaneler', icon: LibraryIcon },
          { key: 'reservations', label: 'Rezervasyonlarım', icon: ArmchairIcon },
        ]}
        value={tab}
        onValueChange={(k) => setTab(k as LibraryTab)}
      />

      <div className="flex-1 overflow-y-auto">
        {tab === 'directory' ? <LibraryDirectoryTab /> : <LibraryReservationsTab />}
      </div>
    </div>
  )
}
