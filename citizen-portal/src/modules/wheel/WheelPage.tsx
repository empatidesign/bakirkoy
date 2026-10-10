import { useSearchParams } from 'react-router-dom'
import { CircleDotIcon, GiftIcon, ShoppingBagIcon } from 'lucide-react'
import { ModuleHeader } from '@/design-system'
import { WheelSpinTab } from './WheelSpinTab'
import { GiftsTab } from './GiftsTab'
import { GiftCatalogTab } from './GiftCatalogTab'

type WheelTab = 'spin' | 'catalog' | 'gifts'

const VALID_TABS: WheelTab[] = ['spin', 'catalog', 'gifts']

export const WheelPage = () => {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: WheelTab = VALID_TABS.includes(raw as WheelTab) ? (raw as WheelTab) : 'spin'

  const setTab = (k: string) => {
    setParams({ tab: k }, { replace: true })
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={CircleDotIcon}
        title="Çarkım"
        subtitle="Şansını dene, hediye kazan"
        gradient="linear-gradient(160deg, #1e293b 0%, #334155 55%, #475569 100%)"
        tabs={[
          { key: 'spin', label: 'Çark', icon: CircleDotIcon },
          { key: 'catalog', label: 'Puanla Hediyeler', icon: ShoppingBagIcon },
          { key: 'gifts', label: 'Kazandıklarım', icon: GiftIcon },
        ]}
        value={tab}
        onValueChange={setTab}
      />
      <div className="flex-1 overflow-y-auto">
        {tab === 'spin' ? <WheelSpinTab /> : tab === 'catalog' ? <GiftCatalogTab /> : <GiftsTab />}
      </div>
    </div>
  )
}
