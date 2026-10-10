import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ListIcon, MapIcon, BarChart3Icon, InboxIcon, BadgeCheckIcon,
  SendIcon, CheckCircle2Icon, SearchIcon, ClockIcon, XCircleIcon, FlameIcon, BellRingIcon,
  LandmarkIcon, UsersIcon, SettingsIcon, LayoutDashboardIcon,
} from 'lucide-react'
import {
  PageHeader, Tabs, StatCard, FilterBar, FilterField, Input, Select, ToggleChip,
} from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { useAuth } from '@/framework/auth/AuthContext'
import type { SelectOption } from '@/types/common'
import muhtarlikService from '@/services/muhtarlik.service'
import { EMPTY_FILTERS, hasActiveFilters } from './muhtarlikHelpers'
import { SubmissionListTab } from './SubmissionListTab'
import { SubmissionMapTab } from './SubmissionMapTab'
import { SubmissionReportsTab } from './SubmissionReportsTab'
import { SubmissionDetailModal } from './SubmissionDetailModal'
import { MuhtarManagementTab } from './MuhtarManagementTab'
import { MyMuhtarPanelTab } from './MyMuhtarPanelTab'
import { NewMuhtarSubmissionModal } from './NewMuhtarSubmissionModal'
import { ModuleNotificationSettingsTab } from '@/components/specialized/ModuleNotificationSettingsTab'
import {
  SUBMISSION_TYPE_OPTIONS, SUBMISSION_TYPE_TONE, PRIORITY_OPTIONS, STATUS_OPTIONS, CATEGORY_OPTIONS,
} from '@/types/muhtarlik.types'
import type {
  CitizenSubmission, SubmissionFilters, SubmissionSummary,
  SubmissionStatus, SubmissionDateRange, SubmissionSort,
} from '@/types/muhtarlik.types'

const STATUS_ACTION_MESSAGE: Partial<Record<SubmissionStatus, string>> = {
  in_review: 'Kayıt incelemeye alındı.',
  resolved: 'Kayıt çözüldü olarak işaretlendi.',
  rejected: 'Kayıt reddedildi.',
}

export const MuhtarlikPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { can, getFacilityScope } = useAuth()
  const isMuhtarScoped = getFacilityScope('muhtarlik') !== null
  const activeTab = searchParams.get('tab') ?? (isMuhtarScoped ? 'panelim' : 'list')
  const setTab = (tab: string) =>
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('tab', tab); return n })

  const [filters, setFilters] = useState<SubmissionFilters>(EMPTY_FILTERS)
  const [summary, setSummary] = useState<SubmissionSummary | null>(null)
  const [neighborhoods, setNeighborhoods] = useState<SelectOption[]>([])
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [selected, setSelected] = useState<CitizenSubmission | null>(null)
  const [busy, setBusy] = useState(false)
  const [newRequestOpen, setNewRequestOpen] = useState(false)
  const canCreateRequest = can('muhtarlik.edit')

  const bumpRefresh = () => setRefreshSignal((x) => x + 1)

  const loadSummary = useCallback(() => {
    muhtarlikService.getSummary({}).then(setSummary).catch(() => setSummary(null))
  }, [])
  useEffect(() => { loadSummary() }, [loadSummary, refreshSignal])

  useEffect(() => {
    muhtarlikService.getNeighborhoodOptions().then(setNeighborhoods).catch(() => setNeighborhoods([]))
  }, [])

  const patchFilter = <K extends keyof SubmissionFilters>(key: K, value: SubmissionFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }))
  const clearFilters = () => setFilters(EMPTY_FILTERS)

  const runOnSelected = async (fn: (id: string) => Promise<CitizenSubmission>, msg: string) => {
    if (!selected) return
    const id = selected.id
    setBusy(true)
    try {
      const updated = await fn(id)
      setSelected(updated)
      toast.success(msg)
      bumpRefresh()
    } catch {
      try { setSelected(await muhtarlikService.getById(id)) } catch { /* durum tazelenemezse yut */ }
      bumpRefresh()
    } finally {
      setBusy(false)
    }
  }

  const handleForward = () => runOnSelected((id) => muhtarlikService.forwardToUlakbel(id), "Kayıt belediyeye iletildi.")
  const handleResetForwardState = (reason: string) =>
    runOnSelected((id) => muhtarlikService.resetForwardState(id, reason), 'İletim durumu sıfırlandı; yeniden gönderilebilir.')
  const handleUpdateStatus = (status: SubmissionStatus) =>
    runOnSelected((id) => muhtarlikService.updateStatus(id, status), STATUS_ACTION_MESSAGE[status] ?? 'Kayıt güncellendi.')
  const handleToggleNotifyModal = () =>
    runOnSelected((id) => muhtarlikService.toggleNotifyMuhtar(id), 'Muhtar bildirimi güncellendi.')

  const handleRowToggleNotify = async (s: CitizenSubmission) => {
    try {
      await muhtarlikService.toggleNotifyMuhtar(s.id)
      toast.success('Muhtar bildirimi güncellendi.')
      bumpRefresh()
    } catch {
    }
  }

  const openById = (id: string) => {
    muhtarlikService.getById(id).then(setSelected).catch(() => undefined)
  }

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={LandmarkIcon}
          title="Muhtarlık Bilgi Sistemi"
          subtitle="Mahallelerden gelen talep, istek/öneri ve şikayetlerin merkezi yönetimi"
          breadcrumb="Vatandaş / Muhtarlık"
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={[
            { key: 'panelim', label: isMuhtarScoped ? 'Panelim' : 'Panel', icon: LayoutDashboardIcon },
            { key: 'list', label: 'Liste', icon: ListIcon, count: summary?.total },
            { key: 'map', label: 'Harita', icon: MapIcon },
            ...(!isMuhtarScoped ? [{ key: 'reports', label: 'Raporlar', icon: BarChart3Icon }] : []),
            ...(!isMuhtarScoped ? [{ key: 'muhtars', label: 'Muhtar Yönetimi', icon: UsersIcon }] : []),
            { key: 'ayarlar', label: 'Ayarlar', icon: SettingsIcon },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          {activeTab === 'panelim' && <MyMuhtarPanelTab scoped={isMuhtarScoped} onNewRequest={canCreateRequest ? () => setNewRequestOpen(true) : undefined} />}

          {activeTab !== 'panelim' && activeTab !== 'reports' && activeTab !== 'muhtars' && activeTab !== 'ayarlar' && (
            <>
              <div className="pilot-stat-grid">
                <StatCard size="compact" label="Toplam" value={summary?.total ?? 0} icon={InboxIcon} accent="primary" loading={!summary} />
                <StatCard size="compact" label="Yeni" value={summary?.new ?? 0} icon={BadgeCheckIcon} accent="blue" loading={!summary} />
                <StatCard size="compact" label="İncelemede" value={summary?.inReview ?? 0} icon={ClockIcon} accent="orange" loading={!summary} />
                <StatCard size="compact" label="Belediyeye İletilen" value={summary?.forwarded ?? 0} icon={SendIcon} accent="violet" loading={!summary} />
                <StatCard size="compact" label="Çözüldü" value={summary?.resolved ?? 0} icon={CheckCircle2Icon} accent="green" loading={!summary} />
                <StatCard size="compact" label="Reddedildi" value={summary?.rejected ?? 0} icon={XCircleIcon} accent="neutral" loading={!summary} />
                <StatCard size="compact" label="Acil" value={summary?.urgent ?? 0} icon={FlameIcon} accent="danger" loading={!summary} />
                <StatCard size="compact" label="Muhtar" value={summary?.notifyMuhtar ?? 0} icon={BellRingIcon} accent="primary" loading={!summary} />
              </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <ToggleChip
                active={filters.notifyMuhtar === 'yes'}
                onClick={() => patchFilter('notifyMuhtar', filters.notifyMuhtar === 'yes' ? 'all' : 'yes')}
                tone="primary"
              >
                Muhtara Bildir{summary ? ` (${summary.notifyMuhtar})` : ''}
              </ToggleChip>
              <ToggleChip
                active={filters.priority === 'urgent'}
                onClick={() => patchFilter('priority', filters.priority === 'urgent' ? '' : 'urgent')}
                tone="danger"
              >
                Sadece Acil{summary ? ` (${summary.urgent})` : ''}
              </ToggleChip>
              <ToggleChip
                active={filters.status === 'new'}
                onClick={() => patchFilter('status', filters.status === 'new' ? '' : 'new')}
                tone="info"
              >
                Sadece Yeni{summary ? ` (${summary.new})` : ''}
              </ToggleChip>
              {SUBMISSION_TYPE_OPTIONS.map((t) => (
                <ToggleChip
                  key={t.value}
                  active={filters.submissionType === t.value}
                  onClick={() => patchFilter('submissionType', filters.submissionType === t.value ? '' : t.value)}
                  tone={SUBMISSION_TYPE_TONE[t.value]}
                >
                  {t.label}
                </ToggleChip>
              ))}
            </div>

            <FilterBar
              columns={4}
              search={
                <Input
                  value={filters.search}
                  onChange={(e) => patchFilter('search', e.target.value)}
                  placeholder="Başlık, vatandaş, adres, mahalle ara..."
                  iconLeft={<SearchIcon className="h-4 w-4" />}
                />
              }
              filterCount={
                [filters.neighborhood, filters.submissionType, filters.categoryId, filters.priority, filters.status].filter(Boolean).length
                + (filters.dateRange !== 'all' ? 1 : 0)
              }
              hasActiveFilters={hasActiveFilters(filters)}
              onClear={clearFilters}
            >
              <FilterField label="Mahalle">
                <Select value={filters.neighborhood} onChange={(e) => patchFilter('neighborhood', e.target.value)} placeholder="Tüm Mahalleler">
                  <option value="">Tüm Mahalleler</option>
                  {neighborhoods.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                </Select>
              </FilterField>
              <FilterField label="Tür">
                <Select value={filters.submissionType} onChange={(e) => patchFilter('submissionType', e.target.value)} placeholder="Tüm Türler">
                  <option value="">Tüm Türler</option>
                  {SUBMISSION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </FilterField>
              <FilterField label="Kategori">
                <Select value={filters.categoryId} onChange={(e) => patchFilter('categoryId', e.target.value)} placeholder="Tüm Kategoriler">
                  <option value="">Tüm Kategoriler</option>
                  {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </FilterField>
              <FilterField label="Öncelik">
                <Select value={filters.priority} onChange={(e) => patchFilter('priority', e.target.value)} placeholder="Tüm Öncelikler">
                  <option value="">Tüm Öncelikler</option>
                  {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </FilterField>
              <FilterField label="Durum">
                <Select value={filters.status} onChange={(e) => patchFilter('status', e.target.value)} placeholder="Tüm Durumlar">
                  <option value="">Tüm Durumlar</option>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </FilterField>
              <FilterField label="Zaman">
                <Select value={filters.dateRange} onChange={(e) => patchFilter('dateRange', e.target.value as SubmissionDateRange)}>
                  <option value="all">Her Zaman</option>
                  <option value="today">Bugün</option>
                  <option value="week">Son 7 Gün</option>
                  <option value="month">Son 30 Gün</option>
                </Select>
              </FilterField>
              <FilterField label="Sıralama">
                <Select value={filters.sort} onChange={(e) => patchFilter('sort', e.target.value as SubmissionSort)}>
                  <option value="newest">En Yeni</option>
                  <option value="oldest">En Eski</option>
                  <option value="priority">Öncelik</option>
                  <option value="neighborhood">Mahalle</option>
                </Select>
              </FilterField>
            </FilterBar>
          </>
        )}

        {activeTab === 'list' && (
          <SubmissionListTab
            filters={filters}
            refreshSignal={refreshSignal}
            onSelect={setSelected}
            onToggleNotify={handleRowToggleNotify}
          />
        )}
        {activeTab === 'map' && (
          <SubmissionMapTab filters={filters} refreshSignal={refreshSignal} onOpenDetail={openById} />
        )}
        {activeTab === 'reports' && !isMuhtarScoped && <SubmissionReportsTab refreshSignal={refreshSignal} />}
        {activeTab === 'muhtars' && <MuhtarManagementTab />}
        {activeTab === 'ayarlar' && <ModuleNotificationSettingsTab module="muhtarlik" />}
        </div>

        <SubmissionDetailModal
          open={!!selected}
          submission={selected}
          busy={busy}
          onClose={() => setSelected(null)}
          onForward={handleForward}
          onResetForwardState={handleResetForwardState}
          onUpdateStatus={handleUpdateStatus}
          onToggleNotify={handleToggleNotifyModal}
        />

        <NewMuhtarSubmissionModal
          open={newRequestOpen}
          onClose={() => setNewRequestOpen(false)}
          onCreated={bumpRefresh}
        />
      </div>
    </UiStandardsContext.Provider>
  )
}
