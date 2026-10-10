import { useState } from 'react'
import { ClipboardIcon, PlusCircleIcon, ListIcon } from 'lucide-react'
import { ModuleHeader } from '@/design-system'
import { MySubmissionsTab } from './MySubmissionsTab'
import { NewSubmissionTab } from './NewSubmissionTab'

type SubmissionTab = 'list' | 'new'

export const SubmissionsPage = () => {
  const [tab, setTab] = useState<SubmissionTab>('list')

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={ClipboardIcon}
        title="İstek, Öneri ve Şikayet"
        subtitle="Mahalleniz için başvuru oluşturun, sürecini adım adım takip edin"
        gradient="linear-gradient(160deg, #1e3a5f 0%, #1e40af 55%, #3b82f6 100%)"
        tabs={[
          { key: 'list', label: 'Başvurularım', icon: ListIcon },
          { key: 'new', label: 'Yeni Başvuru', icon: PlusCircleIcon },
        ]}
        value={tab}
        onValueChange={(k) => setTab(k as SubmissionTab)}
      />
      <div className="flex-1 overflow-y-auto">
        {tab === 'list' ? (
          <MySubmissionsTab />
        ) : (
          <NewSubmissionTab onCreated={() => setTab('list')} />
        )}
      </div>
    </div>
  )
}
