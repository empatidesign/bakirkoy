import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardListIcon, PieChartIcon, FileTextIcon, BarChart3Icon, MessageSquareIcon, SettingsIcon, SlidersHorizontalIcon, MapPinnedIcon, BookMarkedIcon, CrownIcon, RadioIcon, TrophyIcon } from 'lucide-react'
import { PageHeader, Tabs } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import surveyService from '@/services/survey.service'
import type { SurveySummary } from '@/types/survey.types'
import { SurveyDashboardTab } from './SurveyDashboardTab'
import { SurveysTab } from './SurveysTab'
import { SurveyAnalyticsTab } from './SurveyAnalyticsTab'
import { SurveyResponsesTab } from './SurveyResponsesTab'
import { SurveyFieldTasksTab } from './SurveyFieldTasksTab'
import { SurveyQuestionBankTab } from './SurveyQuestionBankTab'
import { SurveyNeighborhoodAnalysisTab } from './SurveyNeighborhoodAnalysisTab'
import { SurveyExecutiveDashboardTab } from './SurveyExecutiveDashboardTab'
import { SurveyFieldLiveTab } from './SurveyFieldLiveTab'
import { SurveyInterviewerPerformanceTab } from './SurveyInterviewerPerformanceTab'
import { SurveyGeneralSettingsTab } from './SurveyGeneralSettingsTab'
import { ModuleNotificationSettingsTab } from '@/components/specialized/ModuleNotificationSettingsTab'
import { useAuth } from '@/framework/auth/AuthContext'

type ActiveTab =
  | 'dashboard' | 'anketler' | 'analizler' | 'yanitlar' | 'ayarlar'
  | 'saha-gorevleri' | 'soru-bankasi' | 'mahalle-analizi' | 'baskanlik'
  // Kullanıcı isteği (2026-09-01): saha görevlisi canlı GPS takibi ve anketör performansı.
  | 'canli-takip' | 'performans'
  // Kullanıcı isteği (2026-09-20): günlük opsiyonel anket limiti/bekleme süresi ayarları.
  | 'genel-ayarlar'

export const SurveyPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTabRaw = (searchParams.get('tab') ?? 'dashboard') as string
  // Kullanıcı isteği (2026-09-01): "Anketörler" sekmesi Saha Görevleri'nin aynı verisinin
  // gruplandırılmış görünümüydü; ayrı sekme kaldırıldı ve Saha Görevleri ekranına
  // "Anketör Performansı" görünümü olarak taşındı. Eski bağlantılar bozulmasın diye yönlendirilir.
  const activeTab = (activeTabRaw === 'anketorler' ? 'saha-gorevleri' : activeTabRaw) as ActiveTab
  const [summary, setSummary] = useState<SurveySummary | null>(null)
  const { state } = useAuth()
  const user = state.status === 'authenticated' ? state.user : null
  // Kullanıcı isteği (2026-09-01): "Sadece Anket Oluşturabilir" yetkisindeki kullanıcı
  // saha görevi, kota, soru bankası, mahalle/başkanlık analitiği gibi yönetim ekranlarını
  // görmesin — yalnızca anket oluşturma/düzenleme ve kendi anketlerinin analizlerini görsün.
  const createOnly = !!user?.surveyCreateOnly

  const loadSummary = useCallback(() => {
    surveyService.getSummary({}).then(setSummary).catch(() => setSummary(null))
  }, [])
  useEffect(() => { loadSummary() }, [loadSummary, activeTab])

  const setTab = (tab: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('tab', tab)
      return n
    })

  const allTabs = [
    { key: 'dashboard', label: 'Dashboard', icon: PieChartIcon, managementOnly: false },
    { key: 'baskanlik', label: 'Başkanlık Paneli', icon: CrownIcon, managementOnly: true },
    { key: 'anketler', label: 'Anketler', icon: FileTextIcon, count: summary?.total, managementOnly: false },
    // Kullanıcı isteği (2026-09-02): sekme adı "Saha Görevleri" yerine "Anketör".
    { key: 'saha-gorevleri', label: 'Anketör', icon: MapPinnedIcon, managementOnly: true },
    { key: 'canli-takip', label: 'Canlı Takip', icon: RadioIcon, managementOnly: true },
    { key: 'performans', label: 'Anketör Performansı', icon: TrophyIcon, managementOnly: true },
    { key: 'mahalle-analizi', label: 'Mahalle Analizi', icon: MapPinnedIcon, managementOnly: true },
    { key: 'soru-bankasi', label: 'Soru Bankası', icon: BookMarkedIcon, managementOnly: true },
    { key: 'analizler', label: 'Analizler', icon: BarChart3Icon, managementOnly: false },
    { key: 'yanitlar', label: 'Yanıtlar', icon: MessageSquareIcon, managementOnly: false },
    { key: 'genel-ayarlar', label: 'Genel Ayarlar', icon: SlidersHorizontalIcon, managementOnly: true },
    { key: 'ayarlar', label: 'Ayarlar', icon: SettingsIcon, managementOnly: true },
  ]
  const visibleTabs = createOnly ? allTabs.filter((t) => !t.managementOnly) : allTabs

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={ClipboardListIcon}
          title="Anketler"
          subtitle="Anketleri oluşturun, yönetin ve sonuçları analiz edin"
          breadcrumb="Etkileşim / Anketler"
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={visibleTabs}
        />

        <div className="pilot-content min-h-0 min-w-0 flex-1 space-y-4 overflow-auto">
          {activeTab === 'dashboard' && !createOnly && <SurveyDashboardTab />}
          {activeTab === 'baskanlik' && !createOnly && <SurveyExecutiveDashboardTab />}
          {activeTab === 'anketler' && <SurveysTab />}
          {activeTab === 'saha-gorevleri' && !createOnly && <SurveyFieldTasksTab />}
          {activeTab === 'canli-takip' && !createOnly && <SurveyFieldLiveTab />}
          {activeTab === 'performans' && !createOnly && <SurveyInterviewerPerformanceTab />}
          {activeTab === 'mahalle-analizi' && !createOnly && <SurveyNeighborhoodAnalysisTab />}
          {activeTab === 'soru-bankasi' && !createOnly && <SurveyQuestionBankTab />}
          {activeTab === 'analizler' && <SurveyAnalyticsTab />}
          {activeTab === 'yanitlar' && <SurveyResponsesTab />}
          {activeTab === 'genel-ayarlar' && !createOnly && <SurveyGeneralSettingsTab />}
          {activeTab === 'ayarlar' && !createOnly && <ModuleNotificationSettingsTab module="survey" />}
          {createOnly && (activeTab === 'dashboard' || activeTab === 'baskanlik' || activeTab === 'saha-gorevleri' || activeTab === 'canli-takip' || activeTab === 'performans' || activeTab === 'mahalle-analizi' || activeTab === 'soru-bankasi' || activeTab === 'genel-ayarlar' || activeTab === 'ayarlar') && <SurveysTab />}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
