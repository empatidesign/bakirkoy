import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import {
  ArmchairIcon, UsersRoundIcon, HourglassIcon, LogOutIcon, CoffeeIcon,
  BarChart3Icon, FileTextIcon, SettingsIcon, MapPinIcon,
  GaugeIcon, AlertTriangleIcon, BriefcaseIcon, BookOpenIcon,
} from 'lucide-react'
import { Tabs, StatCard, Badge } from '@/design-system'
import libraryService from '@/services/library.service'
import { teamRealtime } from '@/services/teamRealtime'
import type { Library, LibraryDetailSummary } from '@/types/library.types'
import { occupancyTone, occupancyLabel } from './libraryHelpers'
import { InsideTab } from './InsideTab'
import { QueueTab } from './QueueTab'
import { OnBreakTab } from './OnBreakTab'
import { ExitedTab } from './ExitedTab'
import { RulesTab } from './RulesTab'
import { SeatingTab } from './SeatingTab'
import { StatisticsTab } from './StatisticsTab'
import { SettingsTab } from './SettingsTab'
import { MesaiTab } from './MesaiTab'
import { OverdueBooksTab } from './OverdueBooksTab'
type ActiveTab =
  | 'libraries' | 'inside' | 'queue' | 'onbreak' | 'exited' | 'seating'
  | 'rules' | 'statistics' | 'mesai' | 'overdue' | 'settings'

export const LibraryDetail = ({
  libraryId,
  infoSlot,
  onBack,
}: {
  libraryId: string
  infoSlot?: HTMLElement | null
  onBack?: () => void
}) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab = ((rawTab && rawTab !== 'libraries') ? rawTab : 'inside') as ActiveTab
  const [library, setLibrary] = useState<Library | null>(null)
  const [summary, setSummary] = useState<LibraryDetailSummary | null>(null)
  const [overdueCount, setOverdueCount] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleReturnToLibraries = useCallback(() => {
    if (onBack) {
      onBack()
    } else {
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev)
        n.delete('library')
        n.delete('tab')
        return n
      })
    }
  }, [onBack, setSearchParams])

  const setTab = (tab: string) => {
    if (tab === 'libraries') {
      handleReturnToLibraries()
      return
    }
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('tab', tab); return n })
  }

  useEffect(() => {
    if (rawTab === 'libraries') {
      handleReturnToLibraries()
    }
  }, [rawTab, handleReturnToLibraries])

  const loadHeader = useCallback(async () => {
    setLoading(true)
    try {
      const [lib, sum, overdue] = await Promise.all([
        libraryService.getById(libraryId),
        libraryService.getDetailSummary(libraryId),
        libraryService.overdue.getAll({ page: 1, limit: 1, libraryId }).catch(() => null),
      ])
      setLibrary(lib)
      setSummary(sum)
      setOverdueCount(overdue?.total)
    } catch {
      setLibrary(null)
      setSummary(null)
      setOverdueCount(undefined)
    } finally {
      setLoading(false)
    }
  }, [libraryId])
  useEffect(() => { loadHeader() }, [loadHeader])

  useEffect(() => {
    void teamRealtime.joinLibrary(libraryId)
    const off = teamRealtime.onLibrarySession((e) => {
      if (e.libraryId !== libraryId) return
      setRefreshKey((k) => k + 1)
      void loadHeader()
    })
    return () => {
      off()
      void teamRealtime.leaveLibrary(libraryId)
    }
  }, [libraryId, loadHeader])

  const occText = summary ? `${summary.currentOccupancy.toLocaleString('tr-TR')}/${summary.capacity.toLocaleString('tr-TR')}` : '—'
  const location = [library?.serviceFacilityName, library?.district].filter(Boolean).join(' · ')

  const tabItems = [
    { key: 'libraries', label: 'Kütüphaneler', icon: BookOpenIcon },
    { key: 'inside', label: 'İçeridekiler', icon: UsersRoundIcon, count: summary?.currentOccupancy },
    { key: 'queue', label: 'Sıra', icon: HourglassIcon, count: summary?.waitingCount },
    { key: 'onbreak', label: 'Molada', icon: CoffeeIcon, count: summary?.onBreakCount },
    { key: 'exited', label: 'Çıkanlar', icon: LogOutIcon },
    { key: 'seating', label: 'Oturma Planı', icon: ArmchairIcon },
    { key: 'rules', label: 'Kurallar', icon: FileTextIcon },
    { key: 'statistics', label: 'İstatistikler', icon: BarChart3Icon },
    { key: 'overdue', label: 'Gecikmiş Kitaplar', icon: AlertTriangleIcon, count: overdueCount },
    { key: 'mesai', label: 'Mesai', icon: BriefcaseIcon },
    { key: 'settings', label: 'Ayarlar', icon: SettingsIcon },
  ]
  const activeTabItem = tabItems.find((t) => t.key === activeTab)

  const tabsBar = (
    <div className="bg-surface-1">
      <Tabs
        value={activeTab}
        onValueChange={setTab}
        tabs={tabItems}
      />
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      {tabsBar}
      {infoSlot && createPortal(
        <span className="flex flex-wrap items-center gap-2">
          <span className="type-body-strong text-white">{library?.name ?? 'Kütüphane'}</span>
          {summary && <Badge tone={occupancyTone(summary.occupancyRate)}>{occupancyLabel(summary.occupancyRate)}</Badge>}
          {summary && <Badge tone="neutral">{occText} kişi</Badge>}
          {activeTabItem && (
            <Badge tone="primary">
              <activeTabItem.icon className="h-3 w-3" /> {activeTabItem.label}
            </Badge>
          )}
          {location && (
            <span className="flex items-center gap-1">
              <MapPinIcon className="h-3 w-3 shrink-0" /> {location}
            </span>
          )}
        </span>,
        infoSlot,
      )}
      <div className="grid grid-cols-2 gap-3 px-2 pt-4 lg:grid-cols-4">
        <StatCard label="Mevcut Doluluk" value={occText} icon={GaugeIcon} accent="blue" loading={loading}
          hint={summary ? `%${summary.occupancyRate} doluluk` : undefined} />
        <StatCard label="Sıra Bekleyenler" value={summary?.waitingCount ?? 0} icon={HourglassIcon} accent="violet" loading={loading}
          hint="kişi bekliyor" />
        <StatCard label="Molada Olanlar" value={summary?.onBreakCount ?? 0} icon={CoffeeIcon} accent="orange" loading={loading}
          hint="aktif mola" />
        <StatCard label="İhlal Uyarıları" value={summary?.violationsCount ?? 0} icon={AlertTriangleIcon} accent="danger" loading={loading}
          hint="aktif uyarı" />
      </div>

      <div className="flex-1 space-y-4 overflow-auto px-2 py-5">
        {activeTab === 'inside' && <InsideTab libraryId={libraryId} floors={library?.floors ?? []} entryControlMode={library?.entryControlMode} onChanged={loadHeader} refreshKey={refreshKey} />}
        {activeTab === 'queue' && <QueueTab libraryId={libraryId} onChanged={loadHeader} refreshKey={refreshKey} />}
        {activeTab === 'onbreak' && <OnBreakTab libraryId={libraryId} floors={library?.floors ?? []} onChanged={loadHeader} refreshKey={refreshKey} />}
        {activeTab === 'exited' && <ExitedTab libraryId={libraryId} floors={library?.floors ?? []} refreshKey={refreshKey} />}
        {activeTab === 'seating' && <SeatingTab libraryId={libraryId} refreshKey={refreshKey} />}
        {activeTab === 'rules' && <RulesTab libraryId={libraryId} />}
        {activeTab === 'statistics' && <StatisticsTab libraryId={libraryId} />}
        {activeTab === 'mesai' && <MesaiTab libraryId={libraryId} />}
        {activeTab === 'overdue' && <OverdueBooksTab libraryId={libraryId} refreshKey={refreshKey} />}
        {activeTab === 'settings' && <SettingsTab libraryId={libraryId} libraryName={library?.name} />}
      </div>
    </div>
  )
}
