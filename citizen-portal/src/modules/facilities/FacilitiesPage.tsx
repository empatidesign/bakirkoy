import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LayoutGridIcon, ClipboardListIcon } from 'lucide-react'
import { ModuleHeader } from '@/design-system'
import { FacilityProgramsTab } from './FacilityProgramsTab'
import { FacilityApplicationsTab } from './FacilityApplicationsTab'
import { FACILITY_MODULES } from './facilityModules'

type FacilityTab = 'programs' | 'apps'

export const FacilitiesPage = () => {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<FacilityTab>('programs')

  const moduleKey = searchParams.get('m')
  const moduleInfo = FACILITY_MODULES.find((m) => m.key === moduleKey)

  const headerGradient = moduleInfo
    ? moduleInfo.gradient
    : 'linear-gradient(135deg, #1486C9 0%, #0E3054 100%)'

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={moduleInfo?.icon ?? LayoutGridIcon}
        title={moduleInfo?.label ?? 'Hizmetler'}
        subtitle="Kurs ve programlara başvurun"
        gradient={headerGradient}
        tabs={[
          { key: 'programs', label: 'Programlar', icon: LayoutGridIcon },
          { key: 'apps', label: 'Başvurularım', icon: ClipboardListIcon },
        ]}
        value={tab}
        onValueChange={(k) => setTab(k as FacilityTab)}
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        {tab === 'programs' ? <FacilityProgramsTab /> : <FacilityApplicationsTab />}
      </div>
    </div>
  )
}
