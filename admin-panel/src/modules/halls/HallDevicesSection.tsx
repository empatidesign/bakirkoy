import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  DoorOpenIcon, PlusIcon, CopyIcon, RefreshCwIcon, PowerIcon, PowerOffIcon, Trash2Icon,
  ArrowRightToLineIcon, ArrowLeftToLineIcon, ArrowLeftRightIcon, ZapIcon, PencilIcon, LockOpenIcon,
} from 'lucide-react'
import { Button, Input, Label, Select, Switch, Badge, IconButton, ConfirmModal, SegmentedControl } from '@/design-system'
import hallService from '@/services/hall.service'
import { useAuth } from '@/framework/auth/AuthContext'
import type { FacilityDevice, FacilityDeviceForm, DeviceDirection } from '@/types/facility.types'

interface Props { hallId: string }

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
const webhookUrl = `${window.location.origin}/api/v1/device/webaccess`

export const HallDevicesSection = ({ hallId }: Props) => {
  const { can } = useAuth()
  const canManageDevices = can('halls.devices')
  const canManualOpen = can('halls.manual-open')
  const [devices, setDevices] = useState<FacilityDevice[] | undefined>(undefined)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FacilityDeviceForm>(blankForm)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<FacilityDevice | null>(null)
  const [removing, setRemoving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [opening, setOpening] = useState<FacilityDevice | null>(null)
  const [openingBusy, setOpeningBusy] = useState(false)
  // Kod denetimi 2026-08-08: backend artık apiKey'i yalnızca oluşturma/anahtar-yenileme
  // response'unda tam olarak döndürüyor, sonraki GET/list çağrılarında maskeliyor (bkz.
  // FacilityDevicesSection.tsx'teki aynı düzeltme). Az önce oluşturulan/yenilenen anahtarları
  // oturum içinde (sayfa yenilenene kadar) burada saklıyoruz ki admin kopyalayabilsin.
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    hallService.getDevices(hallId).then(setDevices).catch(() => setDevices([]))
  }, [hallId])
  useEffect(() => { load() }, [load])

  const startAdd = () => { setForm(blankForm); setEditingId(null); setAdding(true) }
  const startEdit = (d: FacilityDevice) => {
    setForm({
      name: d.name, direction: d.direction, deviceId: d.deviceId ?? '', ipAddress: d.ipAddress ?? '',
      port: d.port, username: d.username ?? '', password: '', relayNo: d.relayNo, relayMs: d.relayMs,
      workMode: d.workMode, httpPath: d.httpPath ?? '', triggerLockOnSuccess: d.triggerLockOnSuccess, description: d.description ?? '',
    })
    setEditingId(d.id)
    setAdding(true)
  }
  const cancelForm = () => { setAdding(false); setEditingId(null) }

  const save = async () => {
    if (!form.name.trim()) return
    setCreating(true)
    try {
      if (editingId) {
        await hallService.updateDevice(editingId, form)
        toast.success('Cihaz güncellendi.')
      } else {
        const created = await hallService.createDevice(hallId, form)
        if (created.apiKey) setRevealedKeys((p) => ({ ...p, [created.id]: created.apiKey! }))
        toast.success('Cihaz oluşturuldu.')
      }
      setAdding(false); setEditingId(null); load()
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Cihaz kaydedilemedi.')
    } finally { setCreating(false) }
  }

  const toggleDevice = async (d: FacilityDevice) => { await hallService.toggleDevice(d.id); toast.success(d.isActive ? 'Cihaz pasifleştirildi.' : 'Cihaz aktifleştirildi.'); load() }
  const rotate = async (d: FacilityDevice) => {
    const rotated = await hallService.rotateDeviceKey(d.id)
    if (rotated.apiKey) setRevealedKeys((p) => ({ ...p, [d.id]: rotated.apiKey! }))
    toast.success('Cihaz anahtarı yenilendi.')
    load()
  }
  const testLock = async (d: FacilityDevice) => {
    setTesting(d.id)
    try {
      const res = await hallService.testDeviceLock(d.id)
      if (res.ok) toast.success(res.message); else toast.error(res.message)
    } finally { setTesting(null) }
  }
  const confirmDelete = async () => {
    if (!deleting) return
    setRemoving(true)
    try { await hallService.deleteDevice(deleting.id); toast.success('Cihaz silindi.'); setDeleting(null); load() }
    finally { setRemoving(false) }
  }
  const confirmOpen = async () => {
    if (!opening) return
    setOpeningBusy(true)
    try {
      const res = await hallService.openDevice(opening.id)
      if (res.opened) toast.success(res.message); else toast.error(res.message)
      setOpening(null)
    } finally { setOpeningBusy(false) }
  }

  return (
    <div className="rounded-card border border-border bg-surface-1 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-md" style={{ background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)' }}>
            <DoorOpenIcon className="h-5 w-5 text-white" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-bold text-foreground-strong">Cihazlar (Turnike & QR / Manyetik Kapı)</p>
            <p className="mt-0.5 type-caption text-foreground-muted">Salon giriş/çıkış turnike ve kapı kilidi cihazlarını yönetin.</p>
            <p className="type-caption text-foreground-muted">Bu salonda etkinliği olan onaylı katılımcılar geçiş yapabilir.</p>
          </div>
        </div>
        {canManageDevices && !adding && <Button variant="primary" size="sm" className="shrink-0" onClick={startAdd}><PlusIcon className="h-4 w-4" /> Cihaz Ekle</Button>}
      </div>

      {adding && (
        <div className="mt-3 space-y-3 rounded-field border border-primary/40 bg-surface-0 p-3">
          <p className="type-body-strong">{editingId ? 'Cihaz Düzenle' : 'Yeni Cihaz'}</p>
          <div className="space-y-1.5">
            <Label>Cihaz Adı</Label>
            <Input placeholder="Örn: Salon Giriş Turnikesi" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
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
              <Input placeholder="LiderTek Device_Id" value={form.deviceId} onChange={(e) => setForm((p) => ({ ...p, deviceId: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Cihaz IP</Label>
              <Input placeholder="192.168.1.10" value={form.ipAddress} onChange={(e) => setForm((p) => ({ ...p, ipAddress: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Port</Label>
              <Input type="number" value={form.port} onChange={(e) => setForm((p) => ({ ...p, port: Number(e.target.value) || 80 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Çalışma Şekli</Label>
              <Select value={form.workMode} onChange={(e) => setForm((p) => ({ ...p, workMode: e.target.value as 'online' | 'offline' }))}>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kullanıcı Adı</Label>
              <Input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Şifre</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder={editingId ? 'Değiştirmek için yazın' : ''} />
              {editingId && <p className="type-caption">Boş bırakılırsa mevcut şifre korunur.</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Röle No</Label>
              <Input type="number" value={form.relayNo} onChange={(e) => setForm((p) => ({ ...p, relayNo: Number(e.target.value) || 1 }))} />
              <p className="type-caption">Kilidi tetikleyen röle numarası.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Röle Süresi (ms)</Label>
              <Input type="number" value={form.relayMs} onChange={(e) => setForm((p) => ({ ...p, relayMs: Number(e.target.value) || 1000 }))} />
              <p className="type-caption">Kilit elektriği kaç ms kesilsin (örn 3000 = 3 sn açık).</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Kilit Tetikleme Yolu (opsiyonel)</Label>
            <Input placeholder="örn: /relay/trigger — boş bırakılabilir" value={form.httpPath} onChange={(e) => setForm((p) => ({ ...p, httpPath: e.target.value }))} />
            <p className="type-caption">Kapı açılırken Nexora, cihazın IP adresine bu yola istek atıp röleyi tetikler. Boş bırakılırsa varsayılan yol kullanılır.</p>
          </div>

          <div className="flex items-center justify-between rounded-card border border-border bg-surface-0 px-3 py-2.5">
            <div>
              <Label>Kilit Tetikle</Label>
              <p className="type-caption">QR/kart doğrulanınca bu cihazın manyetik kilidini tetikler.</p>
            </div>
            <Switch checked={form.triggerLockOnSuccess} onCheckedChange={(v) => setForm((p) => ({ ...p, triggerLockOnSuccess: v }))} />
          </div>

          <div className="flex gap-2">
            <Button variant="primary" size="sm" disabled={!form.name.trim()} isLoading={creating} onClick={save}>{editingId ? 'Kaydet' : 'Cihazı Oluştur'}</Button>
            <Button variant="outline" size="sm" onClick={cancelForm}>İptal</Button>
          </div>
        </div>
      )}

      <div className="mt-3">
        {devices === undefined ? (
          <p className="type-caption">Yükleniyor...</p>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="flex h-28 w-28 items-center justify-center rounded-full" style={{ background: 'linear-gradient(145deg, #f5f3ff, #ede9fe)' }}>
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg" style={{ background: 'linear-gradient(145deg, #6d28d9, #8b5cf6)' }}>
                <DoorOpenIcon className="h-8 w-8 text-white" />
              </span>
            </span>
            <p className="mt-2 text-base font-bold text-foreground-strong">Cihaz bulunmuyor</p>
            <p className="type-caption text-foreground-muted">Bu salon için herhangi bir giriş/çıkış cihazı eklenmemiş.</p>
            {canManageDevices && <Button variant="outline" size="sm" className="mt-1" onClick={startAdd}><PlusIcon className="h-4 w-4" /> İlk Cihazınızı Ekleyin</Button>}
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((d) => {
              const dir = DIRECTION[d.direction]
              return (
                <div key={d.id} className="space-y-2 rounded-field border border-border bg-surface-0 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono type-caption">{d.deviceCode}</span>
                      <span className="type-body-strong">{d.name}</span>
                      <Badge tone={dir.tone}><dir.icon className="mr-1 inline h-3 w-3" />{dir.label}</Badge>
                      <Badge tone={d.workMode === 'online' ? 'info' : 'neutral'}>{d.workMode === 'online' ? 'Online' : 'Offline'}</Badge>
                      <Badge tone={d.isActive ? 'success' : 'neutral'}>{d.isActive ? 'Aktif' : 'Pasif'}</Badge>
                    </div>
                    <div className="flex flex-shrink-0 items-center">
                      {canManageDevices && (
                        <>
                          <IconButton tone="primary" title="Düzenle" onClick={() => startEdit(d)}><PencilIcon className="h-4 w-4" /></IconButton>
                          <IconButton tone="default" title="Kilidi test et" onClick={() => testLock(d)} disabled={testing === d.id}><ZapIcon className="h-4 w-4" /></IconButton>
                        </>
                      )}
                      {canManualOpen && (
                        <IconButton tone="warning" title="Kapıyı Aç" onClick={() => setOpening(d)}><LockOpenIcon className="h-4 w-4" /></IconButton>
                      )}
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
                      <Input value={d.deviceCode} readOnly size="sm" className="font-mono" />
                      <IconButton tone="default" title="Cihaz kodunu kopyala" onClick={() => copy(d.deviceCode, 'Cihaz kodu')}><CopyIcon className="h-4 w-4" /></IconButton>
                    </div>
                    {(revealedKeys[d.id] ?? d.apiKey) && (
                      <div className="flex items-center gap-2">
                        <Input value={revealedKeys[d.id] ?? d.apiKey} readOnly size="sm" className="font-mono" />
                        <IconButton tone="default" title="API anahtarını kopyala" onClick={() => copy((revealedKeys[d.id] ?? d.apiKey)!, 'API anahtarı')}><CopyIcon className="h-4 w-4" /></IconButton>
                      </div>
                    )}
                    {!revealedKeys[d.id] && d.apiKey && (
                      <p className="type-caption text-warning">API anahtarı maskelendi. Tam değeri görmek için &quot;Anahtarı yenile&quot; kullanın (mevcut anahtarı geçersiz kılar).</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Input value={webhookUrl} readOnly size="sm" className="font-mono" />
                      <IconButton tone="default" title="Webhook adresini kopyala" onClick={() => copy(webhookUrl, 'Webhook adresi')}><CopyIcon className="h-4 w-4" /></IconButton>
                    </div>
                    <p className="type-caption">Cihaz Id&apos;sini cihaza yazın, <span className="font-mono">X-Device-Key</span> header&apos;ında apiKey gönderin.</p>
                  </div>
                  {d.description && <p className="type-caption italic">{d.description}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>

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
    </div>
  )
}
