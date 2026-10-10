import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpenIcon, SlidersHorizontalIcon, SettingsIcon, BriefcaseIcon, ClockIcon, BarChart3Icon } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Tabs, Combobox, Button, Modal, Tooltip } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import type { SelectOption } from '@/types/common'
import libraryService from '@/services/library.service'
import { useAuth } from '@/framework/auth/AuthContext'
import { LibraryOverview } from './LibraryOverview'
import { LibraryDetail } from './LibraryDetail'
import { LibraryManagerDrawer } from './LibraryManagerDrawer'
import { SettingsTab } from './SettingsTab'
import { MesaiTab } from './MesaiTab'
import { MesaiOverviewTab } from './MesaiOverviewTab'
import { MesaiReportsPage } from './MesaiReportsPage'
import { LibraryReportsTab } from './LibraryReportsTab'
import { StaticQrBulkPrintButton } from '@/components/specialized/StaticQrBulkPrintButton'

// 2026-10-05 kullanıcı isteği: "kütüphane sayfasını gezi sistemindeki gibi genel tab
// menülü hale getir" — Gezi Sistemi (TravelsPage) deseniyle birebir: tek sayfa, üstte
// sabit PageHeader + Tabs, sekmeler arası geçiş querystring ile. Önceden "Mesai Yönetimi"
// ayrı bir route'tu (/library-mesai, kendi PageHeader'ı vardı) — artık bu sayfanın
// kardeş üst-sekmeleri (mesai, mesai-aylik, mesai-raporlar).
type TopTab = 'libraries' | 'mesai' | 'mesai-personel' | 'mesai-raporlar'
const TOP_TABS: TopTab[] = ['libraries', 'mesai', 'mesai-personel', 'mesai-raporlar']

export const LibraryPage = () => {
  const { can, isSuperAdmin } = useAuth()
  const isLibraryStaff = !isSuperAdmin && can('library-mesai.door-access') && !can('admins.create')
  const canManage = can('library.view') && !isLibraryStaff
  const canSeeMesai = can('library-mesai.view')
  const [searchParams, setSearchParams] = useSearchParams()
  const libraryId = searchParams.get('library') ?? ''
  const rawTopTab = searchParams.get('topTab') as TopTab | null
  const topTab: TopTab = rawTopTab && TOP_TABS.includes(rawTopTab) ? rawTopTab : 'libraries'
  const [options, setOptions] = useState<SelectOption[]>([])
  const [managerOpen, setManagerOpen] = useState(false)
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [autoStartChecked, setAutoStartChecked] = useState(false)
  const [infoSlot, setInfoSlot] = useState<HTMLSpanElement | null>(null)

  const loadOptions = useCallback(() => {
    const fetcher = canManage ? libraryService.getOptions() : libraryService.staff.getMyLibraries()
    fetcher.then((opts) => {
      setOptions(opts)
      if (!canManage && opts.length === 1 && !libraryId) selectLibrary(opts[0].value)
    }).catch(() => setOptions([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage])
  useEffect(() => { loadOptions() }, [loadOptions, reloadKey])

  useEffect(() => {
    if (canManage || autoStartChecked) return
    setAutoStartChecked(true)
    libraryService.staff.autoStart()
      .then((shift) => {
        if (shift) {
          toast.success(`Mesainiz ${shift.libraryName} için otomatik başlatıldı (ağınız üzerinden tanındı).`)
          selectLibrary(shift.libraryId)
          setReloadKey((k) => k + 1)
        }
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, autoStartChecked])

  const selectLibrary = (id: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      if (id) n.set('library', id)
      else { n.delete('library'); n.delete('tab') }
      return n
    })

  const setTopTab = (tab: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('topTab', tab)
      return n
    })

  const onChanged = () => { setReloadKey((k) => k + 1) }

  const selectedLibraryName = options.find((o) => o.value === libraryId)?.label

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={BookOpenIcon}
          title="Kütüphane Modülü"
          subtitle={topTab === 'mesai-raporlar' ? 'Kullanım istatistikleri ve mesai raporları' : topTab !== 'libraries' ? 'Tüm kütüphanelerde mesai yönetimi' : canManage && libraryId ? <span ref={setInfoSlot} className="block" /> : canManage ? 'Doluluk, sıra, oturma planı ve üyelik yönetimi' : 'Kendi mesai takibiniz'}
          breadcrumb="Hizmetlerimiz / Kütüphane"
          actions={
            topTab === 'libraries' ? (
              <>
                <div className="pilot-facility-select">
                  <Combobox
                    value={libraryId}
                    onChange={(id) => selectLibrary(id)}
                    clearable={false}
                    searchInList
                    searchPlaceholder="Kütüphane ara..."
                    placeholder={canManage ? 'Genel Bakış · Tüm Kütüphaneler' : 'Kütüphane seçin…'}
                    displayValue={libraryId ? undefined : (canManage ? 'Genel Bakış · Tüm Kütüphaneler' : '')}
                    options={[
                      { value: '', label: canManage ? 'Genel Bakış · Tüm Kütüphaneler' : 'Kütüphane seçin…' },
                      ...options,
                    ]}
                  />
                </div>
                {canManage && (
                  <>
                    <Tooltip label="Yönet">
                      <Button variant="outline" size="md" aria-label="Yönet" onClick={() => setManagerOpen(true)}>
                        <SlidersHorizontalIcon className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip label="Genel Ayarlar">
                      <Button variant="outline" size="md" aria-label="Genel Ayarlar" data-action="settings" onClick={() => setGlobalSettingsOpen(true)}>
                        <SettingsIcon className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <StaticQrBulkPrintButton
                      iconOnly
                      title="Kütüphane QR Kodları"
                      loadTargets={async () => (await libraryService.getOptions()).map((o) => ({ id: o.value, name: o.label }))}
                      loadQr={(id) => libraryService.staticQr.get(id)}
                    />
                  </>
                )}
              </>
            ) : undefined
          }
        />

        {canManage && canSeeMesai && !libraryId && (
          <Tabs
            value={topTab}
            onValueChange={setTopTab}
            tabs={[
              { key: 'libraries', label: 'Kütüphaneler', icon: BookOpenIcon },
              { key: 'mesai', label: 'Mesai Yönetimi', icon: BriefcaseIcon },
              { key: 'mesai-personel', label: 'Personel Mesai Raporları', icon: ClockIcon },
              { key: 'mesai-raporlar', label: 'Raporlar', icon: BarChart3Icon },
            ]}
          />
        )}

        <div className="pilot-content flex-1 overflow-auto">
        {topTab === 'mesai' ? (
          <div className="space-y-4 px-2 py-5"><MesaiOverviewTab /></div>
        ) : topTab === 'mesai-personel' ? (
          <div className="space-y-4 px-2 py-5"><MesaiReportsPage embedded /></div>
        ) : topTab === 'mesai-raporlar' ? (
          <div className="space-y-4 px-2 py-5"><LibraryReportsTab onSelectLibrary={selectLibrary} /></div>
        ) : canManage ? (
          libraryId
            ? <LibraryDetail key={`${libraryId}-${reloadKey}`} libraryId={libraryId} infoSlot={infoSlot} onBack={() => selectLibrary('')} />
            : <LibraryOverview key={reloadKey} onSelect={selectLibrary} />
        ) : (
          libraryId ? (
            <div className="flex h-full flex-col">
              <div className="px-2 pt-4">
                <span className="type-page-title">{selectedLibraryName}</span>
              </div>
              <div className="flex-1 overflow-auto px-2 py-5">
                <MesaiTab libraryId={libraryId} />
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="type-label text-secondary">Mesai takibi için yukarıdan kütüphanenizi seçin.</span>
            </div>
          )
        )}
        </div>

        {canManage && (
          <LibraryManagerDrawer
            open={managerOpen}
            onClose={() => setManagerOpen(false)}
            onChanged={onChanged}
            onOpenLibrary={(id) => { setManagerOpen(false); setTopTab('libraries'); selectLibrary(id) }}
          />
        )}

        {canManage && (
          <Modal open={globalSettingsOpen} onClose={() => setGlobalSettingsOpen(false)} title="Genel Varsayılan Ayarlar" width={860} bodyClassName="p-5">
            <SettingsTab libraryId={null} />
          </Modal>
        )}
      </div>
    </UiStandardsContext.Provider>
  )
}
