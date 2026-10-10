import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UsersIcon, BarChart3Icon } from 'lucide-react'
import { PageHeader, Tabs } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { ParticipantsTab } from './ParticipantsTab'
import { ParticipantsReportsTab } from './ParticipantsReportsTab'

type ActiveTab = 'katilimcilar' | 'raporlar'

export const ParticipantsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTabState] = useState<ActiveTab>((searchParams.get('tab') as ActiveTab) ?? 'katilimcilar')

  const setTab = (tab: string) => {
    setActiveTabState(tab as ActiveTab)
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('tab', tab)
      return n
    })
  }

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={UsersIcon}
          title="Katılımcılar"
          subtitle="Sisteme kayıtlı vatandaşları, aile üyelerini ve demografik raporları tek merkezden yönetin"
          breadcrumb="Vatandaş / Katılımcılar"
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={[
            { key: 'katilimcilar', label: 'Katılımcılar', icon: UsersIcon },
            { key: 'raporlar', label: 'Raporlar', icon: BarChart3Icon },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          {activeTab === 'katilimcilar' && <ParticipantsTab key={searchParams.get('pid') ?? ''} initialSearch={searchParams.get('q') ?? undefined} initialDetailId={searchParams.get('pid') ?? undefined} />}
          {activeTab === 'raporlar' && <ParticipantsReportsTab />}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
