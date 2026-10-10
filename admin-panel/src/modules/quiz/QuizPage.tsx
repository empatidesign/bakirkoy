import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  TrophyIcon, ListIcon, CalendarIcon, CheckCircle2Icon, BarChart3Icon, ArchiveIcon, SettingsIcon, TagIcon, BrainIcon, UsersIcon,
} from 'lucide-react'
import { PageHeader, Tabs } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import quizService from '@/services/quiz.service'
import type { QuizSummary } from '@/types/quiz.types'
import { QuizBrowseTab } from './QuizBrowseTab'
import { LeaderboardTab } from './LeaderboardTab'
import { ArchiveTab } from './ArchiveTab'
import { QuizzesTab } from './QuizzesTab'
import { CategoriesTab } from './CategoriesTab'
import { AgeGroupsTab } from './AgeGroupsTab'
import { ModuleNotificationSettingsTab } from '@/components/specialized/ModuleNotificationSettingsTab'

type ActiveTab = 'tumu' | 'aktif' | 'yakinda' | 'tamamlanan' | 'liderlik' | 'arsiv' | 'yonetim' | 'kategoriler' | 'yasgruplari' | 'ayarlar'

export const QuizPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') ?? 'tumu') as ActiveTab
  const [summary, setSummary] = useState<QuizSummary | null>(null)

  const loadSummary = useCallback(() => {
    quizService.getSummary({}).then(setSummary).catch(() => setSummary(null))
  }, [])
  useEffect(() => { loadSummary() }, [loadSummary, activeTab])

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
          icon={BrainIcon}
          title="Bilgi Yarışması"
          subtitle="Bilgi yarışmalarını, sorularını, katılımları ve liderlik tablosunu yönetin"
          breadcrumb="Etkileşim / Bilgi Yarışması"
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={[
            { key: 'tumu', label: 'Tümü', icon: ListIcon, count: summary?.total },
            { key: 'aktif', label: 'Aktif', icon: TrophyIcon, count: summary?.ongoing },
            { key: 'yakinda', label: 'Yakında', icon: CalendarIcon, count: summary?.upcoming },
            { key: 'tamamlanan', label: 'Tamamlanan', icon: CheckCircle2Icon, count: summary?.completed },
            { key: 'liderlik', label: 'Yarışma', icon: BarChart3Icon },
            { key: 'arsiv', label: 'Arşiv', icon: ArchiveIcon },
            { key: 'yonetim', label: 'Yönetim', icon: SettingsIcon },
            { key: 'kategoriler', label: 'Kategoriler', icon: TagIcon },
            { key: 'yasgruplari', label: 'Yaş Grupları', icon: UsersIcon },
            { key: 'ayarlar', label: 'Ayarlar', icon: SettingsIcon },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          {activeTab === 'tumu' && <QuizBrowseTab />}
          {activeTab === 'aktif' && <QuizBrowseTab status="ongoing" />}
          {activeTab === 'yakinda' && <QuizBrowseTab status="upcoming" />}
          {activeTab === 'tamamlanan' && <QuizBrowseTab status="completed" />}
          {activeTab === 'liderlik' && <LeaderboardTab />}
          {activeTab === 'arsiv' && <ArchiveTab />}
          {activeTab === 'yonetim' && <QuizzesTab />}
          {activeTab === 'kategoriler' && <CategoriesTab />}
          {activeTab === 'yasgruplari' && <AgeGroupsTab />}
          {activeTab === 'ayarlar' && <ModuleNotificationSettingsTab module="quiz" />}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
