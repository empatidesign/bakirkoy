import { BarChart3Icon } from 'lucide-react'
import { SectionToolbar } from '@/design-system'
import { LibraryAnalyticsPanel } from './LibraryAnalyticsPanel'

export const StatisticsTab = ({ libraryId }: { libraryId: string }) => (
  <div className="space-y-4">
    <SectionToolbar icon={BarChart3Icon} title="İstatistikler" subtitle="Bu kütüphaneye ait doluluk, yoğunluk ve oturum analizleri" />
    <LibraryAnalyticsPanel libraryId={libraryId} />
  </div>
)
