import { useEffect, useState } from 'react'
import { PillIcon, ListIcon, MapIcon } from 'lucide-react'
import { ModuleHeader } from '@/design-system'
import type { CitizenDutyPharmacy } from '@/types/duty-pharmacy.types'
import dutyPharmacyService from '@/services/duty-pharmacy.service'
import { DutyPharmacyListTab } from './DutyPharmacyListTab'
import { DutyPharmacyMapTab } from './DutyPharmacyMapTab'

type PharmacyTab = 'list' | 'map'

export const DutyPharmacyPage = () => {
  const [tab, setTab] = useState<PharmacyTab>('list')
  const [pharmacies, setPharmacies] = useState<CitizenDutyPharmacy[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    dutyPharmacyService.list()
      .then((r) => { if (active) setPharmacies(r) })
      .catch(() => { if (active) setPharmacies([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={PillIcon}
        title="Nöbetçi Eczane"
        subtitle="Bakırköy bölgesindeki bugünkü nöbetçi eczaneler"
        gradient="linear-gradient(160deg, #14532d 0%, #16a34a 55%, #22c55e 100%)"
        tabs={[
          { key: 'list', label: 'Liste', icon: ListIcon },
          { key: 'map', label: 'Harita', icon: MapIcon },
        ]}
        value={tab}
        onValueChange={(k) => setTab(k as PharmacyTab)}
      />
      <div className="flex-1 overflow-y-auto">
        {tab === 'list' ? (
          <DutyPharmacyListTab pharmacies={pharmacies} loading={loading} />
        ) : (
          <DutyPharmacyMapTab pharmacies={pharmacies ?? []} />
        )}
      </div>
    </div>
  )
}
