import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CpuIcon, ChevronDownIcon, ChevronRightIcon, PlusIcon, CopyIcon,
  RefreshCwIcon, PowerIcon, PowerOffIcon, Trash2Icon, Building2Icon, DoorOpenIcon, TicketIcon,
  ArrowRightToLineIcon, ArrowLeftToLineIcon, ArrowLeftRightIcon, ZapIcon, PencilIcon, LockOpenIcon, UsersIcon,
} from 'lucide-react'
import {
  Button, Input, Label, Select, Switch, Badge, IconButton, SegmentedControl, ConfirmModal, EmptyState,
} from '@/design-system'
import { SettingsSection } from './ui'
import hallService from '@/services/hall.service'
import { useAuth } from '@/framework/auth/AuthContext'
import type { Hall } from '@/types/hall.types'
import type { FacilityModuleConfig } from '../moduleConfig'
import type { FacilityModuleService } from '../types'
import type {
  FacilityRecord, FacilityDevice, FacilityDeviceForm, DeviceDirection,
} from '@/types/facility.types'

interface Props {
  config: FacilityModuleConfig
  service: FacilityModuleService
  facilities: FacilityRecord[]
}

const DIRECTION: Record<DeviceDirection, { label: string; tone: 'success' | 'danger' | 'info'; icon: typeof ArrowRightToLineIcon }> = {
  entry: { label: 'Giriş', tone: 'success', icon: ArrowRightToLineIcon },
  exit: { label: 'Çıkış', tone: 'danger', icon: ArrowLeftToLineIcon },
  both: { label: 'Çift Yönlü', tone: 'info', icon: ArrowLeftRightIcon },
}
const blankForm: FacilityDeviceForm = {
  name: '', direction: 'entry', deviceId: '', ipAddress: '', port: 80, username: '', password: '',
  relayNo: 1, relayMs: 3000, workMode: 'online', httpPath: '', triggerLockOnSuccess: true, description: '',
}

const copy = (text: string, label: string) => navigator.clipboard.writeText(text).then(() => toast.success(`${label} kopyalandı.`))
const liderTekUrl = `${window.location.origin}/api/v1/device/webaccess`

type AddTarget =
  | { scope: 'facility_general'; serviceFacilityId: string; label: string }
  | { scope: 'area'; facilityId: string; label: string }
  | { scope: 'event'; hallId: string; label: string }

export const FacilityDevicesSection = ({ config, service, facilities }: Props) => {
  const { can } = useAuth()
  const canManageDevices = can('service-facilities.devices')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [bySf, setBySf] = useState<Record<string, FacilityDevice[]>>({})
  const [byFacility, setByFacility] = useState<Record<string, FacilityDevice[]>>({})
  const [hallsBySf, setHallsBySf] = useState<Record<string, Hall[]>>({})
  const [adding, setAdding] = useState<AddTarget | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FacilityDeviceForm>(blankForm)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<FacilityDevice | null>(null)
  const [removing, setRemoving] = useState(false)
  const [opening, setOpening] = useState<FacilityDevice | null>(null)
  const [openingBusy, setOpeningBusy] = useState(false)
  // Kod denetimi 2026-08-08: backend artık apiKey'i yalnızca oluşturma/anahtar-yenileme
  // response'unda tam olarak döndürüyor, sonraki GET/list çağrılarında maskeliyor. Az önce
  // oluşturulan/yenilenen anahtarları oturum içinde (sayfa yenilenene kadar) burada saklıyoruz
  // ki admin kopyalayabilsin.
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({})

  const { grouped, standalone } = useMemo(() => {
    const map = new Map<string, { sfId: string; sfName: string; areas: FacilityRecord[] }>()
    const solo: FacilityRecord[] = []
    for (const f of facilities) {
      if (f.serviceFacilityId) {
        if (!map.has(f.serviceFacilityId)) map.set(f.serviceFacilityId, { sfId: f.serviceFacilityId, sfName: f.serviceFacilityName ?? 'Tesis', areas: [] })
        map.get(f.serviceFacilityId)!.areas.push(f)
      } else solo.push(f)
    }
    return { grouped: [...map.values()].sort((a, b) => a.sfName.localeCompare(b.sfName, 'tr')), standalone: solo }
  }, [facilities])

  const loadSf = useCallback((sfId: string) => {
    service.devices.getListByServiceFacility(sfId)
      .then((d) => setBySf((p) => ({ ...p, [sfId]: d })))
      .catch(() => setBySf((p) => ({ ...p, [sfId]: [] })))
  }, [service])

  const loadHalls = useCallback((sfId: string) => {
    hallService.getList({ facilityId: sfId, limit: 100 })
      .then((res) => setHallsBySf((p) => ({ ...p, [sfId]: res.items ?? [] })))
      .catch(() => setHallsBySf((p) => ({ ...p, [sfId]: [] })))
  }, [])

  const loadFacility = useCallback((facilityId: string) => {
    service.devices.getList(facilityId)
      .then((d) => setByFacility((p) => ({ ...p, [facilityId]: d })))
      .catch(() => setByFacility((p) => ({ ...p, [facilityId]: [] })))
  }, [service])

  const reloadFor = (d: FacilityDevice) => {
    if (d.serviceFacilityId) loadSf(d.serviceFacilityId)
    else if (d.facilityId) loadFacility(d.facilityId)
  }

  const toggleExpand = (key: string, isStandalone: boolean) => {
    setAdding(null)
    setExpanded((cur) => {
      const next = cur === key ? null : key
      if (next) {
        if (isStandalone) { if (byFacility[key] === undefined) loadFacility(key) }
        else {
          if (bySf[key] === undefined) loadSf(key)
          if (hallsBySf[key] === undefined) loadHalls(key)
        }
      }
      return next
    })
  }

  const startAdd = (target: AddTarget) => {
    setForm(blankForm); setEditingId(null); setAdding(target)
  }

  const deviceToTarget = (d: FacilityDevice): AddTarget => {
    if (d.scope === 'facility_general') return { scope: 'facility_general', serviceFacilityId: d.serviceFacilityId ?? '', label: d.name }
    if (d.scope === 'event') return { scope: 'event', hallId: d.hallId ?? '', label: d.name }
    return { scope: 'area', facilityId: d.facilityId ?? '', label: d.name }
  }

  const startEditDevice = (d: FacilityDevice) => {
    setForm({
      name: d.name, direction: d.direction, deviceId: d.deviceId ?? '', ipAddress: d.ipAddress ?? '',
      port: d.port, username: d.username ?? '', password: '', relayNo: d.relayNo, relayMs: d.relayMs,
      workMode: d.workMode, httpPath: d.httpPath ?? '', triggerLockOnSuccess: d.triggerLockOnSuccess, description: d.description ?? '',
      scope: d.scope, serviceFacilityId: d.serviceFacilityId, facilityId: d.facilityId, hallId: d.hallId,
    })
    setEditingId(d.id)
    setAdding(deviceToTarget(d))
  }

  const saveEdit = async () => {
    if (!editingId || !form.name.trim()) return
    setSaving(true)
    try {
      const editing = [...Object.values(bySf).flat(), ...Object.values(byFacility).flat()].find((x) => x.id === editingId)
      if (editing?.scope === 'event') await hallService.updateDevice(editingId, form)
      else await service.devices.update(editingId, form)
      toast.success('Cihaz güncellendi.')
      if (editing) reloadFor(editing)
      setAdding(null); setEditingId(null)
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Cihaz güncellenemedi.')
    } finally { setSaving(false) }
  }

  const create = async () => {
    if (!adding || !form.name.trim()) return
    setSaving(true)
    try {
      let created: FacilityDevice
      if (adding.scope === 'facility_general') {
        created = await service.devices.createGeneral({ ...form, scope: 'facility_general', serviceFacilityId: adding.serviceFacilityId })
        loadSf(adding.serviceFacilityId)
      } else if (adding.scope === 'event') {
        created = await service.devices.createGeneral({ ...form, scope: 'event', hallId: adding.hallId })
        const sfId = Object.keys(hallsBySf).find((sf) => hallsBySf[sf]?.some((h) => h.id === adding.hallId))
        if (sfId) loadSf(sfId)
      } else {
        created = await service.devices.create(adding.facilityId, { ...form, scope: 'area' })
        const parent = facilities.find((f) => f.id === adding.facilityId)
        if (parent?.serviceFacilityId) loadSf(parent.serviceFacilityId)
        else loadFacility(adding.facilityId)
      }
      if (created.apiKey) setRevealedKeys((p) => ({ ...p, [created.id]: created.apiKey! }))
      toast.success('Cihaz oluşturuldu.')
      setAdding(null)
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Cihaz oluşturulamadı.')
    } finally { setSaving(false) }
  }

  const toggleDevice = async (d: FacilityDevice) => {
    await service.devices.toggleStatus(d.id)
    toast.success(d.isActive ? 'Cihaz pasifleştirildi.' : 'Cihaz aktifleştirildi.')
    reloadFor(d)
  }
  const rotate = async (d: FacilityDevice) => {
    const rotated = await service.devices.rotateKey(d.id)
    if (rotated.apiKey) setRevealedKeys((p) => ({ ...p, [d.id]: rotated.apiKey! }))
    toast.success('Cihaz anahtarı yenilendi.')
    reloadFor(d)
  }
  const testLock = async (d: FacilityDevice) => {
    setTesting(d.id)
    try {
      const res = await service.devices.testLock(d.id)
      if (res.ok) toast.success(res.message); else toast.error(res.message)
    } finally { setTesting(null) }
  }
  const confirmDelete = async () => {
    if (!deleting) return
    setRemoving(true)
    try { await service.devices.remove(deleting.id); toast.success('Cihaz silindi.'); reloadFor(deleting); setDeleting(null) }
    finally { setRemoving(false) }
  }
  const confirmOpen = async () => {
    if (!opening) return
    setOpeningBusy(true)
    try {
      const res = await service.devices.open(opening.id)
      if (res.opened) toast.success(res.message); else toast.error(res.message)
      setOpening(null)
    } finally { setOpeningBusy(false) }
  }

  const renderCard = (d: FacilityDevice, areaLabel?: string) => {
    const dir = DIRECTION[d.direction]
    return (
      <div key={d.id} className="space-y-2 rounded-field border border-border bg-surface-0 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono type-caption">{d.deviceCode}</span>
            <span className="type-body-strong">{d.name}</span>
            {d.scope === 'facility_general' && <Badge tone="warning"><DoorOpenIcon className="mr-1 inline h-3 w-3" />Genel Kapı</Badge>}
            {d.scope === 'event' && <Badge tone="info"><TicketIcon className="mr-1 inline h-3 w-3" />Etkinlik Salonu</Badge>}
            {d.scope === 'area' && areaLabel && <Badge tone="info"><UsersIcon className="mr-1 inline h-3 w-3" />{areaLabel}</Badge>}
            <Badge tone={dir.tone}><dir.icon className="mr-1 inline h-3 w-3" />{dir.label}</Badge>
            <Badge tone={d.workMode === 'online' ? 'info' : 'neutral'}>{d.workMode === 'online' ? 'Online' : 'Offline'}</Badge>
            <Badge tone={d.isActive ? 'success' : 'neutral'}>{d.isActive ? 'Aktif' : 'Pasif'}</Badge>
          </div>
          <div className="flex flex-shrink-0 items-center">
            {canManageDevices && (
              <>
                <IconButton tone="primary" title="Düzenle" onClick={() => startEditDevice(d)}><PencilIcon className="h-4 w-4" /></IconButton>
                <IconButton tone="default" title="Kilidi test et" onClick={() => testLock(d)} disabled={testing === d.id}><ZapIcon className="h-4 w-4" /></IconButton>
              </>
            )}
            <IconButton tone="warning" title="Kapıyı Aç" onClick={() => setOpening(d)}><LockOpenIcon className="h-4 w-4" /></IconButton>
            {canManageDevices && (
              <>
                <IconButton tone="default" title="Anahtarı yenile" onClick={() => rotate(d)}><RefreshCwIcon className="h-4 w-4" /></IconButton>
                <IconButton tone={d.isActive ? 'default' : 'success'} title={d.isActive ? 'Pasifleştir' : 'Aktifleştir'} onClick={() => toggleDevice(d)}>
                  {d.isActive ? <PowerOffIcon className="h-4 w-4" /> : <PowerIcon className="h-4 w-4" />}
                </IconButton>
                <IconButton tone="danger" title="Sil" onClick={() => setDeleting(d)}><Trash2Icon className="h-4 w-4" /></IconButton>
              </>
            )}
          </div>
        </div>

        {d.deviceId && <p className="type-caption">Cihaz Id: <span className="font-mono">{d.deviceId}</span></p>}
        {d.ipAddress && <p className="type-caption">Cihaz IP: <span className="font-mono">{d.ipAddress}:{d.port}</span></p>}

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Input aria-label="Cihaz kodu" value={d.deviceCode} readOnly size="sm" className="font-mono" />
            <IconButton tone="default" title="Cihaz kodunu kopyala" onClick={() => copy(d.deviceCode, 'Cihaz kodu')}><CopyIcon className="h-4 w-4" /></IconButton>
          </div>
          {(revealedKeys[d.id] ?? d.apiKey) && (
            <div className="flex items-center gap-2">
              <Input aria-label="API anahtarı" value={revealedKeys[d.id] ?? d.apiKey} readOnly size="sm" className="font-mono" />
              <IconButton tone="default" title="API anahtarını kopyala" onClick={() => copy((revealedKeys[d.id] ?? d.apiKey)!, 'API anahtarı')}><CopyIcon className="h-4 w-4" /></IconButton>
            </div>
          )}
          {!revealedKeys[d.id] && d.apiKey && (
            <p className="type-caption text-warning">API anahtarı maskelendi. Tam değeri görmek için &quot;Anahtarı yenile&quot; kullanın (mevcut anahtarı geçersiz kılar).</p>
          )}
          <div className="flex items-center gap-2">
            <Input aria-label="Webhook adresi" value={liderTekUrl} readOnly size="sm" className="font-mono" />
            <IconButton tone="default" title="Webhook adresini kopyala" onClick={() => copy(liderTekUrl, 'Turnike webhook adresi')}><CopyIcon className="h-4 w-4" /></IconButton>
          </div>
          <p className="type-caption">Cihaz Id&apos;sini cihaza yazın, <span className="font-mono">X-Device-Key</span> header&apos;ında apiKey gönderin.</p>
        </div>
        {d.description && <p className="type-caption italic">{d.description}</p>}
      </div>
    )
  }

  const renderDeviceForm = (targetBadge: React.ReactNode, label: string) => (
    <div className="space-y-3 rounded-field border border-primary/40 bg-surface-0 p-3">
      <div className="flex items-center gap-2">
        {targetBadge}
        <span className="type-caption">{editingId ? 'Cihaz Düzenle' : label}</span>
      </div>
      <div className="space-y-1.5">
        <Label>Cihaz Adı</Label>
        <Input placeholder="Örn: Ana Giriş Turnikesi" aria-label="Cihaz Adı" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
      </div>

      <div className="space-y-1.5">
        <Label>Yön</Label>
        <SegmentedControl
          value={form.direction}
          onChange={(v) => setForm((p) => ({ ...p, direction: v as DeviceDirection }))}
          columns={3}
          options={[
            { value: 'entry', label: 'Giriş', icon: ArrowRightToLineIcon, tone: 'green' },
            { value: 'exit', label: 'Çıkış', icon: ArrowLeftToLineIcon, tone: 'red' },
            { value: 'both', label: 'Çift Yönlü', icon: ArrowLeftRightIcon, tone: 'blue' },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Cihaz Id</Label>
          <Input placeholder="LiderTek Device_Id" aria-label="Cihaz Id" value={form.deviceId} onChange={(e) => setForm((p) => ({ ...p, deviceId: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Cihaz IP</Label>
          <Input placeholder="192.168.1.10" aria-label="Cihaz IP" value={form.ipAddress} onChange={(e) => setForm((p) => ({ ...p, ipAddress: e.target.value }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Port</Label>
          <Input type="number" aria-label="Port" value={form.port} onChange={(e) => setForm((p) => ({ ...p, port: Number(e.target.value) || 80 }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Çalışma Şekli</Label>
          <Select aria-label="Çalışma Şekli" value={form.workMode} onChange={(e) => setForm((p) => ({ ...p, workMode: e.target.value as 'online' | 'offline' }))}>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Kullanıcı Adı</Label>
          <Input aria-label="Kullanıcı Adı" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Şifre</Label>
          <Input type="password" aria-label="Şifre" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder={editingId ? 'Değiştirmek için yazın' : ''} />
          {editingId && <p className="type-caption">Boş bırakılırsa mevcut şifre korunur.</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Röle No</Label>
          <Input type="number" aria-label="Röle No" value={form.relayNo} onChange={(e) => setForm((p) => ({ ...p, relayNo: Number(e.target.value) || 1 }))} />
          <p className="type-caption">Kilidi tetikleyen röle numarası.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Röle Süresi (ms)</Label>
          <Input type="number" aria-label="Röle Süresi (ms)" value={form.relayMs} onChange={(e) => setForm((p) => ({ ...p, relayMs: Number(e.target.value) || 1000 }))} />
          <p className="type-caption">Kilit elektriği kaç ms kesilsin (örn 3000 = 3 sn açık).</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Kilit Tetikleme Yolu (opsiyonel)</Label>
        <Input placeholder="örn: /relay/trigger — boş bırakılabilir" aria-label="Kilit Tetikleme Yolu" value={form.httpPath} onChange={(e) => setForm((p) => ({ ...p, httpPath: e.target.value }))} />
        <p className="type-caption">Kapı açılırken Nexora, cihazın IP adresine bu yola istek atıp röleyi tetikler. Boş bırakılırsa varsayılan yol kullanılır.</p>
      </div>

      <div className="flex items-center justify-between rounded-card border border-border bg-surface-0 px-3 py-2.5">
        <div>
          <Label>Kilit Tetikle</Label>
          <p className="type-caption">QR/kart doğrulanınca bu cihazın manyetik kilidini tetikler.</p>
        </div>
        <Switch aria-label="Kilit Tetikle" checked={form.triggerLockOnSuccess} onCheckedChange={(v) => setForm((p) => ({ ...p, triggerLockOnSuccess: v }))} />
      </div>

      <Input placeholder="Açıklama (opsiyonel)" aria-label="Açıklama" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
      <div className="flex gap-2">
        <Button variant="primary" size="sm" isLoading={saving} disabled={!form.name.trim()} onClick={editingId ? saveEdit : create}>{editingId ? 'Kaydet' : 'Cihazı Oluştur'}</Button>
        <Button variant="outline" size="sm" onClick={() => { setAdding(null); setEditingId(null) }}>İptal</Button>
      </div>
    </div>
  )

  const renderAddForm = () => renderDeviceForm(
    <Badge tone={adding!.scope === 'facility_general' ? 'warning' : 'info'}>
      {adding!.scope === 'facility_general'
        ? <><DoorOpenIcon className="mr-1 inline h-3 w-3" />Genel Kapı</>
        : adding!.scope === 'event'
          ? <><TicketIcon className="mr-1 inline h-3 w-3" />Etkinlik Salonu</>
          : 'Alan Cihazı'}
    </Badge>,
    adding!.label,
  )

  const isAddingFor = (t: AddTarget) => {
    if (adding === null || adding.scope !== t.scope) return false
    if (adding.scope === 'facility_general' && t.scope === 'facility_general') return adding.serviceFacilityId === t.serviceFacilityId
    if (adding.scope === 'area' && t.scope === 'area') return adding.facilityId === t.facilityId
    if (adding.scope === 'event' && t.scope === 'event') return adding.hallId === t.hallId
    return false
  }

  return (
    <SettingsSection
      icon={CpuIcon}
      tone="violet"
      title="Tesis Cihazları (Turnike & Kiosk)"
      subtitle="Her tesise cihaz (turnike/kiosk) tanıtabilirsiniz. Bir cihaz hangi tesise/alana eklenirse, o tesisteki TÜM grup ve seansların yoklamasını kabul eder — belirli bir gruba özel cihaz kısıtlaması yoktur. Şu an uygun bir seansınız yoksa cihaz bunu net şekilde belirtir."
    >
      {grouped.length === 0 && standalone.length === 0 ? (
        <EmptyState icon={CpuIcon} title="Henüz tesis yok" description={`Önce bir ${config.terminology.facilitySingular.toLowerCase()} ekleyin.`} />
      ) : (
        <div className="space-y-2">
          {grouped.map((g) => {
            const devices = bySf[g.sfId]
            const isOpen = expanded === g.sfId
            const activeCount = devices?.filter((d) => d.isActive).length ?? 0
            const halls = hallsBySf[g.sfId] ?? []
            const areaName = (facilityId?: string) => g.areas.find((a) => a.id === facilityId)?.name
            const hallName = (hallId?: string) => halls.find((h) => h.id === hallId)?.name
            return (
              <div key={g.sfId} className="overflow-hidden rounded-field border border-border">
                <Button variant="ghost" className="w-full justify-between rounded-none px-3 py-2.5" aria-expanded={isOpen} onClick={() => toggleExpand(g.sfId, false)}>
                  <span className="flex items-center gap-2">
                    {isOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                    <Building2Icon className="h-4 w-4 text-muted" />
                    <span className="type-body-strong">{g.sfName}</span>
                    <Badge tone="neutral">{g.areas.length} alan</Badge>
                    {devices && <Badge tone="info">{activeCount} aktif cihaz</Badge>}
                  </span>
                </Button>

                {isOpen && (
                  <div className="space-y-3 border-t border-border bg-surface-1 p-3">
                    {devices === undefined ? (
                      <p className="type-caption">Yükleniyor...</p>
                    ) : devices.length === 0 ? (
                      <p className="type-caption">Bu tesise henüz cihaz tanımlanmamış.</p>
                    ) : (
                      devices
                        .slice()
                        .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, 'tr'))
                        .map((d) => renderCard(
                          d,
                          d.scope === 'area' ? areaName(d.facilityId)
                            : d.scope === 'event' ? hallName(d.hallId)
                              : undefined,
                        ))
                    )}

                    {canManageDevices && (adding !== null
                      ? renderAddForm()
                      : (
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" className="border-dashed" onClick={() => startAdd({ scope: 'facility_general', serviceFacilityId: g.sfId, label: `${g.sfName} — Genel Kapı` })}>
                            <PlusIcon className="h-4 w-4" /> Genel Kapı Ekle
                          </Button>
                          {g.areas.map((area) => (
                            <Button key={area.id} variant="outline" size="sm" className="border-dashed" onClick={() => startAdd({ scope: 'area', facilityId: area.id, label: `${area.name} — Alan Cihazı` })}>
                              <PlusIcon className="h-4 w-4" /> {area.name} İçin Cihaz Ekle
                            </Button>
                          ))}
                          {halls.map((hall) => (
                            <Button key={hall.id} variant="outline" size="sm" className="border-dashed" onClick={() => startAdd({ scope: 'event', hallId: hall.id, label: `${hall.name} — Salon Cihazı` })}>
                              <PlusIcon className="h-4 w-4" /> {hall.name} İçin Cihaz Ekle
                            </Button>
                          ))}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )
          })}

          {standalone.map((f) => {
            const devices = byFacility[f.id]
            const isOpen = expanded === f.id
            const activeCount = devices?.filter((d) => d.isActive).length ?? 0
            return (
              <div key={f.id} className="overflow-hidden rounded-field border border-border">
                <Button variant="ghost" className="w-full justify-between rounded-none px-3 py-2.5" aria-expanded={isOpen} onClick={() => toggleExpand(f.id, true)}>
                  <span className="flex items-center gap-2">
                    {isOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                    <span className="type-body-strong">{f.name}</span>
                    {devices && <Badge tone="info">{activeCount} aktif cihaz</Badge>}
                  </span>
                </Button>
                {isOpen && (
                  <div className="space-y-2 border-t border-border bg-surface-1 p-3">
                    {devices === undefined ? (
                      <p className="type-caption">Yükleniyor...</p>
                    ) : devices.length === 0 ? (
                      <p className="type-caption">Bu alana henüz cihaz tanımlanmamış.</p>
                    ) : (
                      devices
                        .slice()
                        .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, 'tr'))
                        .map((d) => renderCard(d))
                    )}
                    {canManageDevices && (isAddingFor({ scope: 'area', facilityId: f.id, label: '' })
                      ? renderAddForm()
                      : <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => startAdd({ scope: 'area', facilityId: f.id, label: `${f.name} — Alan cihazı` })}><PlusIcon className="h-4 w-4" /> Bu Alana Cihaz Ekle</Button>)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={removing}
        tone="danger"
        title="Cihazı Sil"
        description={`"${deleting?.name}" cihazı silinecek. Devam edilsin mi?`}
        confirmLabel="Sil"
      />

      <ConfirmModal
        open={!!opening}
        onClose={() => setOpening(null)}
        onConfirm={confirmOpen}
        loading={openingBusy}
        tone="primary"
        title="Kapıyı Aç"
        description={`"${opening?.name}" turnikesini/kapısını şimdi açmak istediğinize emin misiniz?`}
        confirmLabel="Aç"
      />
    </SettingsSection>
  )
}
