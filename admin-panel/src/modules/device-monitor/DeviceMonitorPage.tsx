import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RadioTowerIcon, RefreshCwIcon, WifiIcon, WifiOffIcon, MoveRightIcon, PencilIcon,
  ArrowRightToLineIcon, ArrowLeftToLineIcon, ArrowLeftRightIcon, RepeatIcon,
  Building2Icon, MapPinIcon, ArrowRightIcon, InfoIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  SectionToolbar, StatCard, Select, Badge, Modal, Button, Label, Input, Switch,
  SegmentedControl, IconButton, Combobox, type ComboOption,
} from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { cn } from '@/lib/utils'
import deviceMonitorService, { type DeviceMonitorItem } from '@/services/deviceMonitor.service'
import { deviceMonitorRealtime, type DeviceScanEvent } from '@/services/deviceMonitorRealtime'
import libraryService from '@/services/library.service'
import facilityDeviceService from '@/services/facilityDevice.service'
import type { LibraryDeviceForm, LibraryDeviceDirection, LibraryDeviceOperationMode, LibraryOption } from '@/types/library.types'
import type { FacilityDeviceForm as FullFacilityDeviceForm, DeviceDirection } from '@/types/facility.types'
import { DeviceMonitorCanvas } from './DeviceMonitorCanvas'

const SOURCE_LABELS: Record<string, string> = {
  library: 'Kütüphane',
  sports: 'Spor Salonu',
  pool: 'Havuz',
  'youth-camp': 'Gençlik Kampı',
  'scout-camp': 'İzcilik Kampı',
  'science-center': 'Bilim Merkezi',
  kasif: 'Kaşif Çocuk',
  'accessible-life': 'Engelsiz Yaşam',
  'women-family': 'Kadın ve Aile',
}

const MAX_RECENT_SCANS = 12

const blankLibraryForm: LibraryDeviceForm = {
  name: '', direction: 'entry', deviceId: '', ipAddress: '', port: 80, username: '', password: '',
  relayNo: 1, relayMs: 3000, workMode: 'online', httpPath: '', triggerLockOnSuccess: true,
  operationMode: 'directional', toggleCooldownMinutes: 5,
}

const blankFacilityForm: FullFacilityDeviceForm = {
  name: '', direction: 'entry', deviceId: '', ipAddress: '', port: 80, username: '', password: '',
  relayNo: 1, relayMs: 3000, workMode: 'online', httpPath: '', triggerLockOnSuccess: true, description: '',
}

const FACILITY_DIRECTION: Record<DeviceDirection, { label: string; tone: 'success' | 'danger' | 'info'; icon: typeof ArrowRightToLineIcon }> = {
  entry: { label: 'Giriş', tone: 'success', icon: ArrowRightToLineIcon },
  exit: { label: 'Çıkış', tone: 'danger', icon: ArrowLeftToLineIcon },
  both: { label: 'Çift Yönlü', tone: 'info', icon: ArrowLeftRightIcon },
}

export const DeviceMonitorPage = () => {
  const [snapshot, setSnapshot] = useState<{ devices: DeviceMonitorItem[]; onlineCount: number; offlineCount: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [scanEvents, setScanEvents] = useState<DeviceScanEvent[]>([])
  const [liveConnected, setLiveConnected] = useState(false)

  const [moving, setMoving] = useState<DeviceMonitorItem | null>(null)
  const [moveTargetId, setMoveTargetId] = useState('')
  const [movingBusy, setMovingBusy] = useState(false)
  const [libraryOptions, setLibraryOptions] = useState<LibraryOption[]>([])
  const [libraryOptionsLoading, setLibraryOptionsLoading] = useState(false)

  const [editingItem, setEditingItem] = useState<DeviceMonitorItem | null>(null)
  const [editingLoading, setEditingLoading] = useState(false)
  const [libraryForm, setLibraryForm] = useState<LibraryDeviceForm>(blankLibraryForm)
  const [facilityForm, setFacilityForm] = useState<FullFacilityDeviceForm>(blankFacilityForm)
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const load = useCallback(async () => {
    try {
      const s = await deviceMonitorService.getSnapshot()
      setSnapshot(s)
    } catch {
      setSnapshot(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const id = setInterval(load, 20_000)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    void deviceMonitorRealtime.start().then(() => setLiveConnected(true)).catch(() => setLiveConnected(false))
    const off = deviceMonitorRealtime.onScan((e) => {
      setScanEvents((prev) => [...prev.slice(-(MAX_RECENT_SCANS - 1)), e])
    })
    return () => { off(); void deviceMonitorRealtime.stop() }
  }, [])

  const ensureLibraryOptions = useCallback(() => {
    if (libraryOptions.length > 0) return
    setLibraryOptionsLoading(true)
    libraryService.getOptions()
      .then(setLibraryOptions)
      .catch(() => setLibraryOptions([]))
      .finally(() => setLibraryOptionsLoading(false))
  }, [libraryOptions.length])

  const openMove = (d: DeviceMonitorItem) => {
    setMoveTargetId('')
    setMoving(d)
    ensureLibraryOptions()
  }

  const targetOptions: ComboOption[] = libraryOptions
    .filter((o) => o.value !== moving?.parentId)
    .map((o) => ({
      value: o.value,
      label: o.label,
      description: [o.district, o.city].filter(Boolean).join(', ') || undefined,
    }))
  const selectedMoveTarget = libraryOptions.find((o) => o.value === moveTargetId)

  const confirmMove = async () => {
    if (!moving || !moveTargetId) return
    setMovingBusy(true)
    try {
      await libraryService.devices.move(moving.id, moveTargetId)
      toast.success('Cihaz taşındı.')
      setMoving(null)
      load()
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message || 'Cihaz taşınamadı.')
    } finally {
      setMovingBusy(false)
    }
  }

  const openEdit = async (d: DeviceMonitorItem) => {
    setEditingItem(d)
    setEditingDeviceId(d.id)
    setEditingLoading(true)
    try {
      if (d.source === 'library') {
        const full = await libraryService.devices.getById(d.id)
        setLibraryForm({
          name: full.name, direction: full.direction, deviceId: full.deviceId ?? '', ipAddress: full.ipAddress ?? '',
          port: full.port, username: full.username ?? '', password: '', relayNo: full.relayNo, relayMs: full.relayMs,
          workMode: full.workMode, httpPath: full.httpPath ?? '', triggerLockOnSuccess: full.triggerLockOnSuccess,
          operationMode: full.operationMode, toggleCooldownMinutes: full.toggleCooldownMinutes,
        })
      } else {
        const full = await facilityDeviceService.getById(d.source, d.id)
        setFacilityForm({
          name: full.name, direction: full.direction, deviceId: full.deviceId ?? '', ipAddress: full.ipAddress ?? '',
          port: full.port, username: full.username ?? '', password: '', relayNo: full.relayNo, relayMs: full.relayMs,
          workMode: full.workMode, httpPath: full.httpPath ?? '', triggerLockOnSuccess: full.triggerLockOnSuccess,
          description: full.description ?? '',
        })
      }
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message || 'Cihaz bilgisi alınamadı.')
      setEditingItem(null)
    } finally {
      setEditingLoading(false)
    }
  }

  const saveEdit = async () => {
    if (!editingItem || !editingDeviceId) return
    setSavingEdit(true)
    try {
      if (editingItem.source === 'library') {
        await libraryService.devices.update(editingDeviceId, libraryForm)
      } else {
        await facilityDeviceService.updateFull(editingItem.source, editingDeviceId, facilityForm)
      }
      toast.success('Cihaz ayarları güncellendi.')
      setEditingItem(null)
      load()
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message || 'Cihaz güncellenemedi.')
    } finally {
      setSavingEdit(false)
    }
  }

  const sourceOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const d of snapshot?.devices ?? []) seen.add(d.source)
    return [...seen].sort()
  }, [snapshot])

  const filteredDevices = useMemo(() => {
    if (!snapshot) return []
    return sourceFilter === 'all' ? snapshot.devices : snapshot.devices.filter((d) => d.source === sourceFilter)
  }, [snapshot, sourceFilter])

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <header className="pilot-page-header">
          <div className="pilot-header-row">
            <div className="pilot-header-identity">
              <span className="pilot-heading-icon"><RadioTowerIcon aria-hidden="true" /></span>
              <div className="min-w-0">
                <h1 className="pilot-title flex items-center gap-2">
                  Cihaz Canlı Takip
                  {liveConnected
                    ? <Badge tone="success"><WifiIcon className="mr-1 inline h-3 w-3" />Canlı</Badge>
                    : <Badge tone="warning"><WifiOffIcon className="mr-1 inline h-3 w-3" />Bağlanıyor…</Badge>}
                </h1>
                <p className="pilot-muted">Tüm QR/turnike cihazlarının anlık durumu ve okuma hareketleri</p>
              </div>
            </div>
          </div>
        </header>

        <div className="pilot-content flex flex-1 flex-col gap-4 overflow-hidden">
        <div className="pilot-stat-grid">
          <StatCard label="Çevrimiçi Cihaz" value={snapshot?.onlineCount ?? 0} icon={WifiIcon} accent="green" loading={loading} />
          <StatCard label="Çevrimdışı Cihaz" value={snapshot?.offlineCount ?? 0} icon={WifiOffIcon} accent="orange" loading={loading} />
          <StatCard label="Toplam Cihaz" value={snapshot?.devices.length ?? 0} icon={RadioTowerIcon} accent="blue" loading={loading} />
          <StatCard label="Son Okumalar" value={scanEvents.length} icon={RefreshCwIcon} accent="violet" loading={loading} />
        </div>

        <SectionToolbar
          icon={RadioTowerIcon}
          title="Canlı Cihaz Haritası"
          subtitle="Fare tekerleği ile yakınlaştır/uzaklaştır, sürükleyerek kaydır"
          actions={
            <div className="flex items-center gap-2">
              <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                <option value="all">Tüm Modüller</option>
                {sourceOptions.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s] ?? s}</option>)}
              </Select>
              <button
                type="button"
                onClick={load}
                className="flex items-center gap-1.5 rounded-field border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground-strong hover:bg-surface-1"
              >
                <RefreshCwIcon className="h-3.5 w-3.5" /> Yenile
              </button>
            </div>
          }
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
          <DeviceMonitorCanvas devices={filteredDevices} scanEvents={scanEvents} filter={sourceFilter} />

          <div className="flex flex-col gap-3 overflow-hidden">
            <div className="rounded-card border border-border bg-card p-3">
              <p className="type-caption mb-2 font-semibold uppercase tracking-wide text-foreground-subtle">Renk Anahtarı</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#10b981]" /> Giriş cihazı</div>
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#ef4444]" /> Çıkış cihazı</div>
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#8b5cf6]" /> Tek cihaz (giriş+çıkış)</div>
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#cbd5e1]" /> Çevrimdışı</div>
              </div>
            </div>

            <div className="max-h-[240px] overflow-auto rounded-card border border-border bg-card p-3">
              <p className="type-caption mb-2 font-semibold uppercase tracking-wide text-foreground-subtle">
                Cihazlar ({filteredDevices.length})
              </p>
              {filteredDevices.length === 0 ? (
                <p className="type-caption text-foreground-subtle">Cihaz yok.</p>
              ) : (
                <div className="space-y-1.5">
                  {filteredDevices.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 rounded-field bg-surface-1 px-2 py-1.5 text-xs">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${d.isOnline ? 'bg-success' : 'bg-foreground-subtle'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground-strong">{d.name}</p>
                        <p className="truncate text-[11px] text-foreground-muted">{d.parentName}</p>
                      </div>
                      <IconButton tone="default" title="Cihazı düzenle" onClick={() => openEdit(d)}>
                        <PencilIcon className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        tone="primary"
                        title={d.source === 'library'
                          ? 'Başka kütüphaneye taşı'
                          : 'Bu cihaz türü için taşıma desteklenmiyor'}
                        disabled={d.source !== 'library'}
                        onClick={() => openMove(d)}
                      >
                        <MoveRightIcon className="h-4 w-4" />
                      </IconButton>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto rounded-card border border-border bg-card p-3">
              <p className="type-caption mb-2 font-semibold uppercase tracking-wide text-foreground-subtle">Son Okumalar</p>
              {scanEvents.length === 0 ? (
                <p className="type-caption text-foreground-subtle">Henüz okuma yok.</p>
              ) : (
                <div className="space-y-1.5">
                  {[...scanEvents].reverse().map((e, i) => (
                    <div key={`${e.deviceId}-${e.at}-${i}`} className="flex items-center gap-2 rounded-field bg-surface-1 px-2 py-1.5 text-xs">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${e.success ? 'bg-success' : 'bg-danger'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground-strong">{e.message || (e.success ? 'Onaylandı' : 'Reddedildi')}</p>
                        {e.facilityName && <p className="truncate text-[11px] font-medium text-primary">{e.facilityName}</p>}
                        {e.personName && <p className="truncate text-[11px] text-foreground-muted">{e.personName}</p>}
                        <p className="text-[10px] text-foreground-subtle">{new Date(e.at).toLocaleTimeString('tr-TR')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        </div>

      <Modal
        open={!!moving}
        onClose={() => setMoving(null)}
        width={480}
        header={
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-primary-soft text-primary">
              <MoveRightIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground-strong">Cihazı Başka Kütüphaneye Taşı</h3>
              <p className="mt-0.5 type-caption">Fiziksel ayarlarda hiçbir değişiklik yapılmaz.</p>
            </div>
          </div>
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMoving(null)}>Vazgeç</Button>
            <Button onClick={confirmMove} isLoading={movingBusy} disabled={!moveTargetId}>
              Taşı <ArrowRightIcon className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        <div className="space-y-4 p-6">
          <div className="flex items-center gap-2 rounded-card border border-border bg-surface-0 p-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-surface-2 text-foreground-muted">
                <RadioTowerIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="type-caption">Cihaz</p>
                <p className="truncate type-body-strong">{moving?.name}</p>
              </div>
            </div>
            <ArrowRightIcon className="h-4 w-4 shrink-0 text-foreground-subtle" />
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-field',
                moveTargetId ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-foreground-subtle',
              )}>
                <Building2Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="type-caption">Hedef Kütüphane</p>
                <p className="truncate type-body-strong">{selectedMoveTarget?.label ?? 'Henüz seçilmedi'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Hedef Kütüphane Ara</Label>
            <Combobox
              value={moveTargetId}
              onChange={(v) => setMoveTargetId(v)}
              options={targetOptions}
              searchInList
              searchPlaceholder="Kütüphane, ilçe veya il ara..."
              placeholder={libraryOptionsLoading ? 'Kütüphaneler yükleniyor...' : 'Kütüphane seçiniz...'}
              disabled={libraryOptionsLoading}
              emptyText="Eşleşen kütüphane bulunamadı"
              iconLeft={<Building2Icon className="h-4 w-4" />}
              clearable
            />
          </div>

          {selectedMoveTarget && (
            <div className="flex items-start gap-2.5 rounded-card border border-primary/30 bg-primary-soft/40 p-3">
              <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 text-sm">
                <p className="font-medium text-foreground-strong">{selectedMoveTarget.label}</p>
                {(selectedMoveTarget.district || selectedMoveTarget.city) && (
                  <p className="type-caption">{[selectedMoveTarget.district, selectedMoveTarget.city].filter(Boolean).join(', ')}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-card border border-border bg-surface-1 p-3">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" />
            <p className="type-caption">
              {`"${moving?.name}" cihazı fiziksel ayarlarda hiçbir değişiklik yapmadan (Cihaz Kimliği/Anahtar aynı kalır) seçilen kütüphaneye taşınacak, mevcut kütüphaneden otomatik çıkacaktır.`}
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        width={520}
        header={
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-primary-soft text-primary">
              <PencilIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground-strong">Cihaz Ayarlarını Düzenle</h3>
              <p className="mt-0.5 type-caption">
                {editingItem?.parentName} · {SOURCE_LABELS[editingItem?.source ?? ''] ?? editingItem?.source}
              </p>
            </div>
          </div>
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingItem(null)}>İptal</Button>
            <Button onClick={saveEdit} isLoading={savingEdit} disabled={editingLoading}>Kaydet</Button>
          </div>
        }
      >
        <div className="space-y-4 p-6">
          {editingLoading ? (
            <p className="type-caption">Cihaz bilgisi yükleniyor...</p>
          ) : editingItem?.source === 'library' ? (
            <>
              <div className="space-y-1.5">
                <Label>Cihaz Adı</Label>
                <Input value={libraryForm.name} onChange={(e) => setLibraryForm((p) => ({ ...p, name: e.target.value }))} />
              </div>

              <div className="space-y-1.5">
                <Label>Çalışma Modu</Label>
                <SegmentedControl
                  value={libraryForm.operationMode}
                  onChange={(v) => setLibraryForm((p) => ({ ...p, operationMode: v as LibraryDeviceOperationMode }))}
                  columns={2}
                  options={[
                    { value: 'directional', label: 'Tek Yön (Giriş veya Çıkış)', icon: ArrowRightToLineIcon, tone: 'blue' },
                    { value: 'toggle', label: 'Tek Cihaz, Hem Giriş Hem Çıkış', icon: RepeatIcon, tone: 'violet' },
                  ]}
                />
              </div>

              {libraryForm.operationMode === 'toggle' ? (
                <div className="space-y-1.5">
                  <Label>Tekrar Okutma Süresi (dk)</Label>
                  <Input
                    type="number" min={1}
                    value={libraryForm.toggleCooldownMinutes}
                    onChange={(e) => setLibraryForm((p) => ({ ...p, toggleCooldownMinutes: Number(e.target.value) || 5 }))}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Yön</Label>
                  <SegmentedControl
                    value={libraryForm.direction}
                    onChange={(v) => setLibraryForm((p) => ({ ...p, direction: v as LibraryDeviceDirection }))}
                    columns={2}
                    options={[
                      { value: 'entry', label: 'Giriş', icon: ArrowRightToLineIcon, tone: 'green' },
                      { value: 'exit', label: 'Çıkış', icon: ArrowLeftToLineIcon, tone: 'red' },
                    ]}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cihaz Id</Label>
                  <Input value={libraryForm.deviceId} onChange={(e) => setLibraryForm((p) => ({ ...p, deviceId: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cihaz IP</Label>
                  <Input value={libraryForm.ipAddress} onChange={(e) => setLibraryForm((p) => ({ ...p, ipAddress: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Port</Label>
                  <Input type="number" value={libraryForm.port} onChange={(e) => setLibraryForm((p) => ({ ...p, port: Number(e.target.value) || 80 }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Çalışma Şekli</Label>
                  <Select value={libraryForm.workMode} onChange={(e) => setLibraryForm((p) => ({ ...p, workMode: e.target.value as 'online' | 'offline' }))}>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Röle No</Label>
                  <Input type="number" value={libraryForm.relayNo} onChange={(e) => setLibraryForm((p) => ({ ...p, relayNo: Number(e.target.value) || 1 }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Röle Süresi (ms)</Label>
                  <Input type="number" value={libraryForm.relayMs} onChange={(e) => setLibraryForm((p) => ({ ...p, relayMs: Number(e.target.value) || 1000 }))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Kilit Tetikleme Yolu (opsiyonel)</Label>
                <Input value={libraryForm.httpPath} onChange={(e) => setLibraryForm((p) => ({ ...p, httpPath: e.target.value }))} />
              </div>

              <div className="flex items-center justify-between rounded-card border border-border bg-surface-1 px-3 py-2.5">
                <div>
                  <Label>Kilit Tetikle</Label>
                  <p className="type-caption">QR/kart doğrulanınca bu cihazın manyetik kilidini tetikler.</p>
                </div>
                <Switch checked={libraryForm.triggerLockOnSuccess} onCheckedChange={(v) => setLibraryForm((p) => ({ ...p, triggerLockOnSuccess: v }))} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Cihaz Adı</Label>
                <Input value={facilityForm.name} onChange={(e) => setFacilityForm((p) => ({ ...p, name: e.target.value }))} />
              </div>

              <div className="space-y-1.5">
                <Label>Yön</Label>
                <SegmentedControl
                  value={facilityForm.direction}
                  onChange={(v) => setFacilityForm((p) => ({ ...p, direction: v as DeviceDirection }))}
                  columns={3}
                  options={[
                    { value: 'entry', label: 'Giriş', icon: FACILITY_DIRECTION.entry.icon, tone: 'green' },
                    { value: 'exit', label: 'Çıkış', icon: FACILITY_DIRECTION.exit.icon, tone: 'red' },
                    { value: 'both', label: 'Çift Yönlü', icon: FACILITY_DIRECTION.both.icon, tone: 'blue' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cihaz Id</Label>
                  <Input value={facilityForm.deviceId} onChange={(e) => setFacilityForm((p) => ({ ...p, deviceId: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cihaz IP</Label>
                  <Input value={facilityForm.ipAddress} onChange={(e) => setFacilityForm((p) => ({ ...p, ipAddress: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Port</Label>
                  <Input type="number" value={facilityForm.port} onChange={(e) => setFacilityForm((p) => ({ ...p, port: Number(e.target.value) || 80 }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Çalışma Şekli</Label>
                  <Select value={facilityForm.workMode} onChange={(e) => setFacilityForm((p) => ({ ...p, workMode: e.target.value as 'online' | 'offline' }))}>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Röle No</Label>
                  <Input type="number" value={facilityForm.relayNo} onChange={(e) => setFacilityForm((p) => ({ ...p, relayNo: Number(e.target.value) || 1 }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Röle Süresi (ms)</Label>
                  <Input type="number" value={facilityForm.relayMs} onChange={(e) => setFacilityForm((p) => ({ ...p, relayMs: Number(e.target.value) || 1000 }))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Kilit Tetikleme Yolu (opsiyonel)</Label>
                <Input value={facilityForm.httpPath} onChange={(e) => setFacilityForm((p) => ({ ...p, httpPath: e.target.value }))} />
              </div>

              <div className="flex items-center justify-between rounded-card border border-border bg-surface-1 px-3 py-2.5">
                <div>
                  <Label>Kilit Tetikle</Label>
                  <p className="type-caption">QR/kart doğrulanınca bu cihazın manyetik kilidini tetikler.</p>
                </div>
                <Switch checked={facilityForm.triggerLockOnSuccess} onCheckedChange={(v) => setFacilityForm((p) => ({ ...p, triggerLockOnSuccess: v }))} />
              </div>
            </>
          )}
        </div>
      </Modal>
      </div>
    </UiStandardsContext.Provider>
  )
}
