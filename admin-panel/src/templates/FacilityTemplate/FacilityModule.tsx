import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import './pilot/facility-ui.css'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/framework/auth/AuthContext'
import {
  FileTextIcon, UsersIcon, CalendarIcon, RadioTowerIcon, BarChart3Icon,
  Building2Icon, SettingsIcon, MapPinIcon, LayersIcon, GraduationCapIcon,
  AlertTriangleIcon, ArchiveIcon, PlusIcon, RefreshCwIcon,
} from 'lucide-react'
import { PageHeader, Tabs, Combobox, Button, Badge, Banner, IconButton, Tooltip } from '@/design-system'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { FacilityModuleConfig } from './moduleConfig'
import type { FacilityModuleService } from './types'
import type { FacilityRecord, FacilitySummary } from '@/types/facility.types'
import { FacilityDashboardOverview } from './FacilityDashboardOverview'
import { FacilityManagerDrawer } from './FacilityManagerDrawer'
import { FacilityFormDrawer } from './FacilityFormDrawer'
import { FacilitySettingsModal } from './FacilitySettingsModal'
import { FacilityInstructorsModal } from './FacilityInstructorsModal'
import { FacilityApplicationsTab } from './tabs/FacilityApplicationsTab'
import { FacilityBranchesTab } from './tabs/FacilityBranchesTab'
import { FacilityGroupsTab } from './tabs/FacilityGroupsTab'
import { FacilitySessionsTab } from './tabs/FacilitySessionsTab'
import { FacilityAttendanceTab } from './tabs/FacilityAttendanceTab'
import { FacilityReportsTab } from './tabs/FacilityReportsTab'
import { FacilityArchiveDrawer } from './FacilityArchiveDrawer'
import { StaticQrBulkPrintButton } from '@/components/specialized/StaticQrBulkPrintButton'

const GENDER_OPTION: Record<string, { label: string; color: string }> = {
  mixed: { label: '⚥ Karma', color: '#059669' },
  female: { label: '♀ Bayan', color: '#e11d48' },
  male: { label: '♂ Bay', color: '#0284c7' },
}

const GENDER_TEXT: Record<string, string> = { mixed: 'text-success', female: 'text-danger', male: 'text-info' }

const genderKey = (genders?: string[]) => {
  const g = genders ?? []
  if (g.length === 0) return null
  return g.length > 1 || !GENDER_OPTION[g[0]] ? 'mixed' : g[0]
}

export interface FacilityModuleProps {
  config: FacilityModuleConfig
  service: FacilityModuleService
}

// Kullanıcı isteği (2026-10-01): "spor salonu sayfasındaki tüm style ve yeni özellikleri
// diğer sayfalara uygula" — pilot tasarım artık sports'a özel değil, tüm Hizmetlerimiz
// (tesis tipi) modüllerinde açık. Modül config'i ve servis katmanı zaten jenerik
// (createFacilityService + FacilityRecord), tek değişen terminoloji/ikon/renk.
export const FacilityModule = (props: FacilityModuleProps) => (
  <UiStandardsContext.Provider value={true}>
    <FacilityModuleContent {...props} />
  </UiStandardsContext.Provider>
)

const FacilityModuleContent = ({ config, service }: FacilityModuleProps) => {
  const pilot = true
  const T = config.terminology
  const { can } = useAuth()
  const canManage = can('service-facilities.view')
  const [searchParams, setSearchParams] = useSearchParams()
  const facilityId = searchParams.get('f') ?? ''

  const [facilities, setFacilities] = useState<FacilityRecord[]>([])
  const [summary, setSummary] = useState<FacilitySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [managerOpen, setManagerOpen] = useState(false)
  const [formEditing, setFormEditing] = useState<FacilityRecord | null | undefined>(undefined)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsFacilityId, setSettingsFacilityId] = useState<string | undefined>(undefined)
  const [pickerGender, setPickerGender] = useState('all')
  const [instructorsOpen, setInstructorsOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  // Kullanıcı isteği (2026-10-01): grup/seans başka bir tesise kopyalandığında (bkz.
  // FacilityGroupCopyModal), o tesise geçip yeni kopyanın düzenleme çekmecesini otomatik
  // açmak için geçici state — URL parametresi değil çünkü setFacility zaten 'tab'/'g'
  // parametrelerini temizliyor, bu yalnızca tek seferlik bir UI geçişi.
  const [pendingCopyEdit, setPendingCopyEdit] = useState<{ facilityId: string; groupId: string } | null>(null)
  const [attendanceSmsEnabled, setAttendanceSmsEnabled] = useState(false)
  const [togglingAttendanceSms, setTogglingAttendanceSms] = useState(false)

  const loadAttendanceSmsSetting = useCallback(async () => {
    try {
      const gen = await service.settings.getGeneral()
      setAttendanceSmsEnabled(gen.attendanceSmsEnabled ?? false)
    } catch { /* sessiz geç */ }
  }, [service])

  useEffect(() => { void loadAttendanceSmsSetting() }, [loadAttendanceSmsSetting])

  const toggleAttendanceSms = async () => {
    if (!canManage) return
    setTogglingAttendanceSms(true)
    try {
      const current = await service.settings.getGeneral()
      const nextVal = !attendanceSmsEnabled
      await service.settings.saveGeneral({ ...current, attendanceSmsEnabled: nextVal })
      setAttendanceSmsEnabled(nextVal)
      toast.success(nextVal ? `${config.terminology.facilitySingular} yoklama SMS bildirimleri AKTİF edildi.` : `${config.terminology.facilitySingular} yoklama SMS bildirimleri PASİFE alındı (SMS gönderilmeyecek).`)
    } catch {
      toast.error('Yoklama SMS ayarı güncellenemedi.')
    } finally {
      setTogglingAttendanceSms(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [f, s] = await Promise.all([
        service.facilities.getList({ page: 1, limit: 200 }).then((r) => r.items).catch(() => [] as FacilityRecord[]),
        service.facilities.getSummary().catch(() => null),
      ])
      setFacilities(f)
      setSummary(s)
    } finally {
      setLoading(false)
    }
  }, [service])

  useEffect(() => { load() }, [load])

  const selected = facilities.find((f) => f.id === facilityId) ?? null

  const setFacility = (id: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      if (id) n.set('f', id)
      else n.delete('f')
      n.delete('tab')
      n.delete('g')
      return n
    })

  const setTab = (key: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('tab', key)
      n.delete('g')
      return n
    })

  const allTabs = [
    { key: 'applications', label: 'Başvurular', icon: FileTextIcon, restricted: true },
    { key: 'groups', label: T.groupPlural, icon: UsersIcon, restricted: false, count: pilot ? selected?.groupCount : undefined },
    { key: 'sessions', label: 'Seanslar', icon: CalendarIcon, restricted: false },
    { key: 'branches', label: T.branchPlural, icon: config.icon, restricted: true, count: pilot ? selected?.branches?.length : undefined },
    { key: 'attendance', label: 'Cihazlar', icon: RadioTowerIcon, restricted: true },
    { key: 'reports', label: 'Raporlar', icon: BarChart3Icon, restricted: true },
  ]
  const tabs = allTabs.filter((t) => !t.restricted || canManage)
  const rawTab = searchParams.get('tab') ?? ''
  // Kullanıcı isteği (2026-10-04): bir tesise tıklanınca (ör. üstteki tesis seçiciden) doğrudan
  // Başvurular değil Gruplar sekmesi açılsın — tab parametresi silindiğinde (bkz. setFacility)
  // önceki davranış allTabs dizisindeki ilk sekmeye (Başvurular) düşüyordu.
  const activeTab = tabs.some((t) => t.key === rawTab)
    ? rawTab
    : (tabs.find((t) => t.key === 'groups')?.key ?? tabs[0]?.key ?? 'groups')

  const headerActions = (
          <>
            <span className={pilot ? "sr-only" : "hidden items-center gap-1.5 pr-0.5 text-white/70 text-xs lg:flex"}>
              <LayersIcon className="h-3.5 w-3.5" />
              Tesis
            </span>
            <div className={pilot ? "pilot-facility-select" : "w-full min-w-0 sm:w-64"}>
              {pilot && <span className="sr-only">Tesis seçimi</span>}
              {pilot ? <Combobox
                value={facilityId}
                onChange={setFacility}
                iconLeft={<Building2Icon className="h-4 w-4 text-[hsl(var(--primary))]" />}
                badgePlacement="inline"
                filters={[
                  { value: 'all', label: `Tümü (${facilities.length})`, tone: 'primary' as const },
                  { value: 'female', label: `♀ Kadın (${facilities.filter((f) => genderKey(f.genders) === 'female').length})`, tone: 'danger' as const },
                  { value: 'male', label: `♂ Erkek (${facilities.filter((f) => genderKey(f.genders) === 'male').length})`, tone: 'info' as const },
                  { value: 'mixed', label: `⚥ Karma (${facilities.filter((f) => genderKey(f.genders) === 'mixed').length})`, tone: 'success' as const },
                ]}
                filterValue={pickerGender}
                onFilterChange={setPickerGender}
                options={[
                  {
                    value: '',
                    label: `Tümü (Tüm ${T.facilityPlural})`,
                    description: `${facilities.length} tesisin tümü listelenir`,
                    icon: <Building2Icon className="h-4 w-4 text-[hsl(var(--primary))]" />,
                  },
                  ...facilities.filter((f) => pickerGender === 'all' || genderKey(f.genders) === pickerGender).map((f) => {
                    const quota = f.totalGroupCapacity ?? 0
                    const rate = quota > 0 ? Math.round(((f.registeredCount || 0) / quota) * 100) : 0
                    const key = genderKey(f.genders)
                    const gender = key ? GENDER_OPTION[key] : null
                    return {
                      value: f.id,
                      label: f.name,
                      description: [`%${rate} doluluk`, `${f.capacity || 0} kapasite`, ...(f.branches ?? []).slice(0, 2)].join(' • '),
                      badge: gender ?? undefined,
                      icon: <span className={cn('text-xs font-bold', GENDER_TEXT[key ?? ''] ?? 'text-foreground-subtle')}>{gender ? gender.label.split(' ')[0] : '•'}</span>,
                      actionLabel: 'Tesise Gir',
                    }
                  }),
                ]}
                clearable={false}
                searchInList
                searchPlaceholder="Tesis adı veya branş ara..."
                emptyText="Eşleşen tesis bulunamadı"
              /> : <Combobox
                value={facilityId}
                onChange={setFacility}
                options={[
                  { value: '', label: `Tüm ${T.facilityPlural}` },
                  ...facilities.map((f) => ({ value: f.id, label: f.name })),
                ]}
                clearable={false}
                searchInList
                searchPlaceholder={`${T.facilitySingular} ara...`}
                emptyText="Eşleşen tesis bulunamadı"
              />}
            </div>
            {canManage && (
              <>
                <Tooltip label={attendanceSmsEnabled ? 'Yoklama SMS: Aktif (Gönderim Açık — Kapatmak için tıklayın)' : 'Yoklama SMS: Pasif (SMS Gönderilmez — Açmak için tıklayın)'}>
                  <Button
                    variant="outline"
                    size="md"
                    aria-label="Yoklama SMS Bildirimleri"
                    onClick={toggleAttendanceSms}
                    disabled={togglingAttendanceSms || !canManage}
                    className={cn(
                      'relative transition-all',
                      attendanceSmsEnabled
                        ? 'border-success/50 bg-success/15 text-success hover:bg-success/25'
                        : 'text-gray-400 hover:text-foreground-default'
                    )}
                  >
                    <RadioTowerIcon className={cn('h-4 w-4', attendanceSmsEnabled && 'text-success')} />
                    <span
                      className={cn(
                        'absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900',
                        attendanceSmsEnabled ? 'bg-success' : 'bg-gray-400'
                      )}
                    />
                  </Button>
                </Tooltip>
                {!pilot && <div className="mx-1.5 h-5 w-px bg-white/30" />}
                {pilot ? (
                  <>
                    <Tooltip label="Yönet">
                      <Button variant="outline" size="md" aria-label="Yönet" onClick={() => setManagerOpen(true)}>
                        <Building2Icon className="h-4 w-4 text-gray-500" />
                      </Button>
                    </Tooltip>
                    <Tooltip label="Ayarlar">
                      <Button variant="outline" size="md" aria-label="Ayarlar" data-action="settings" onClick={() => setSettingsOpen(true)}>
                        <SettingsIcon className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    {!facilityId && (
                      <Tooltip label="Yeni Salon Ekle">
                        <Button variant="outline" size="md" aria-label="Yeni Salon Ekle" onClick={() => setFormEditing(null)}>
                          <PlusIcon className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    )}
                    <StaticQrBulkPrintButton
                      iconOnly
                      title={`${T.facilityPlural} QR Kodları`}
                      loadTargets={async () => facilities.map((f) => ({ id: f.id, name: f.name }))}
                      loadQr={(id) => service.facilities.getStaticQr(id)}
                    />
                    <Tooltip label="Arşiv">
                      <Button variant="outline" size="md" aria-label="Arşiv" onClick={() => setArchiveOpen(true)}>
                        <ArchiveIcon className="h-4 w-4 text-gray-500" />
                      </Button>
                    </Tooltip>
                  </>
                ) : (
                  <>
                    <div className="mx-1.5 h-5 w-px bg-white/30" />
                    <Button variant="outline" size="md" className="border-white/40 bg-white text-gray-700 shadow-sm hover:bg-white/90 hover:shadow font-medium" onClick={() => setManagerOpen(true)}>
                      <Building2Icon className="h-4 w-4 text-gray-500" /> Yönet
                    </Button>
                    <Button variant="outline" size="md" className="border-white/40 bg-white text-gray-700 shadow-sm hover:bg-white/90 hover:shadow font-medium" data-action="settings" onClick={() => setSettingsOpen(true)}>
                      <SettingsIcon className="h-4 w-4 text-gray-500" /> Ayarlar
                    </Button>
                    <Button variant="outline" size="md" className="border-white/40 bg-white text-gray-700 shadow-sm hover:bg-white/90 hover:shadow font-medium" onClick={() => setInstructorsOpen(true)}>
                      <GraduationCapIcon className="h-4 w-4 text-gray-500" /> Eğitmenler
                    </Button>
                    <StaticQrBulkPrintButton
                      title={`${T.facilityPlural} QR Kodları`}
                      className="border-white/40 bg-white text-gray-700 shadow-sm hover:bg-white/90 hover:shadow font-medium"
                      loadTargets={async () => facilities.map((f) => ({ id: f.id, name: f.name }))}
                      loadQr={(id) => service.facilities.getStaticQr(id)}
                    />
                    <Button variant="outline" size="md" className="border-white/40 bg-white text-gray-700 shadow-sm hover:bg-white/90 hover:shadow font-medium" onClick={() => setArchiveOpen(true)}>
                      <ArchiveIcon className="h-4 w-4 text-gray-500" /> Arşiv
                    </Button>
                  </>
                )}
              </>
            )}
            {pilot && (
              <IconButton title="Yenile" aria-label="Listeyi yenile" disabled={loading} onClick={load}>
                <RefreshCwIcon className={`h-4 w-4${loading ? ' animate-spin' : ''}`} />
              </IconButton>
            )}
          </>
  )

  return (
    <div className={`flex h-full min-h-0 min-w-0 flex-col bg-surface-0 ${pilot ? 'facility-ui-pilot pilot-page-shell' : ''}`}>
      {pilot ? <header className="pilot-page-header pilot-overview-header">
        <p className="pilot-breadcrumb">Hizmetlerimiz / {T.facilityPlural}</p>
        <div className="pilot-header-row">
          <div className="pilot-header-identity"><span className="pilot-heading-icon"><config.icon aria-hidden="true" /></span>
            <div className="min-w-0"><h1 className="pilot-title">{selected?.name ?? config.pageTitle}</h1>
              <p className="pilot-muted">{selected ? `${selected.district ? selected.district + ' · ' : ''}Kapasite: ${selected.capacity.toLocaleString('tr-TR')}` : 'Tesisleri, kontenjanları ve katılımcıları tek yerden yönetin.'}</p>
            </div>
          </div>
          {selected && <Badge tone={selected.isActive ? 'success' : 'neutral'}>{selected.isActive ? 'Aktif tesis' : 'Pasif tesis'}</Badge>}
        </div>
        <div className="pilot-header-actions pilot-header-toolbar">{headerActions}</div>
      </header> : <PageHeader
        icon={config.icon}
        title={config.pageTitle}
        subtitle={selected ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white break-words">{selected.name}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {selected.district && <span className="inline-flex items-center gap-1"><MapPinIcon className="h-3 w-3 shrink-0" />{selected.district}</span>}
              <span>Kapasite: {selected.capacity.toLocaleString('tr-TR')}</span>
              <Badge tone={selected.isActive ? 'success' : 'neutral'}>{selected.isActive ? 'Aktif' : 'Pasif'}</Badge>
            </div>
          </div>
        ) : config.pageSubtitle}
        gradient={config.headerGradient}
        actions={headerActions}
      />}

      {selected ? (
        <>
          <Tabs value={activeTab} onValueChange={setTab} tabs={tabs} />

          {!selected.isActive && (
            <div className={pilot ? undefined : 'px-5 pt-4'}>
              <Banner tone="warning" variant="soft" icon={AlertTriangleIcon}>
                Bu tesis pasif durumdadır. Yeni başvuru, seans oluşturma ve kayıt işlemleri yapılamaz.
              </Banner>
            </div>
          )}

          <div className={pilot ? 'pilot-overview pilot-detail-content min-w-0' : 'min-h-0 min-w-0 flex-1 space-y-4 overflow-auto px-3 py-4'}>
            {activeTab === 'applications' && <FacilityApplicationsTab key={searchParams.get('q') ?? ''} config={config} service={service} facilityId={selected.id} initialSearch={searchParams.get('q') ?? undefined} />}
            {activeTab === 'branches' && <FacilityBranchesTab config={config} service={service} />}
            {activeTab === 'groups' && (
              <FacilityGroupsTab
                key={searchParams.get('q') ?? ''}
                config={config}
                service={service}
                facilityId={selected.id}
                facilityCapacity={selected.capacity}
                parentGroupId={searchParams.get('g') ?? undefined}
                initialSearch={searchParams.get('q') ?? undefined}
                onNavigateToSubGroups={(group) => setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('g', group.id); return n })}
                onNavigateBack={() => setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('g'); return n })}
                onNavigateToSessions={() => setTab('sessions')}
                onCopiedToOtherFacility={(targetFacilityId, groupId) => {
                  setPendingCopyEdit({ facilityId: targetFacilityId, groupId })
                  setSearchParams((prev) => {
                    const n = new URLSearchParams(prev)
                    n.set('f', targetFacilityId)
                    n.set('tab', 'groups')
                    n.delete('g')
                    n.delete('q')
                    return n
                  })
                }}
                initialEditRequestId={pendingCopyEdit?.facilityId === selected.id ? pendingCopyEdit.groupId : null}
                onInitialEditRequestHandled={() => setPendingCopyEdit(null)}
              />
            )}
            {activeTab === 'sessions' && <FacilitySessionsTab config={config} service={service} facilityId={selected.id} facilityCapacity={selected.capacity} />}
            {activeTab === 'attendance' && <FacilityAttendanceTab config={config} service={service} facilityId={selected.id} />}
            {activeTab === 'reports' && <FacilityReportsTab config={config} service={service} facilityId={selected.id} />}
          </div>
        </>
      ) : (
        <div className={`min-h-0 flex-1 overflow-auto ${pilot ? 'pilot-content' : 'p-5'}`}>
          <FacilityDashboardOverview
            config={config}
            service={service}
            summary={summary}
            facilities={facilities}
            loading={loading}
            onPick={setFacility}
            onRefresh={load}
            onManage={canManage ? (id) => setFormEditing(facilities.find((f) => f.id === id) ?? null) : undefined}
            onOpenTab={(id, tab) => setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('f', id); n.set('tab', tab); n.delete('g'); return n })}
            onOpenSettings={canManage ? (id) => { setSettingsFacilityId(id); setSettingsOpen(true) } : undefined}
          />
        </div>
      )}

      {canManage && (
        <>
          <FacilityFormDrawer
            open={formEditing !== undefined}
            onClose={() => setFormEditing(undefined)}
            config={config}
            service={service}
            editing={formEditing ?? null}
            onSaved={load}
          />

          <FacilityManagerDrawer
            open={managerOpen}
            onClose={() => setManagerOpen(false)}
            config={config}
            service={service}
            onMutated={load}
            onOpenFacility={(id) => { setManagerOpen(false); setFacility(id) }}
          />

          <FacilitySettingsModal
            open={settingsOpen}
            onClose={() => { setSettingsOpen(false); setSettingsFacilityId(undefined) }}
            config={config}
            service={service}
            facilities={facilities}
            initialFacilityId={settingsFacilityId ?? (facilityId || undefined)}
          />

          <FacilityInstructorsModal
            open={instructorsOpen}
            onClose={() => setInstructorsOpen(false)}
            config={config}
            service={service}
          />

          <FacilityArchiveDrawer
            open={archiveOpen}
            onClose={() => { setArchiveOpen(false); load() }}
            config={config}
            service={service}
          />
        </>
      )}
    </div>
  )
}
