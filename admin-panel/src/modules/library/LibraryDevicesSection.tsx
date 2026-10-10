import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  DoorOpenIcon, PlusIcon, CopyIcon, RefreshCwIcon, PowerIcon, PowerOffIcon, Trash2Icon,
  ArrowRightToLineIcon, ArrowLeftToLineIcon, ZapIcon, PencilIcon, RepeatIcon, ArrowRightLeftIcon,
  Building2Icon, MapPinIcon, ArrowRightIcon, InfoIcon,
} from 'lucide-react'
import {
  Button, Input, Label, Select, Switch, Badge, IconButton, ConfirmModal, Modal, EmptyState, SegmentedControl, SectionToolbar,
  Combobox, type ComboOption,
} from '@/design-system'
import libraryService from '@/services/library.service'
import { useAuth } from '@/framework/auth/AuthContext'
import { cn } from '@/lib/utils'
import type { LibraryDeviceRecord, LibraryDeviceForm, LibraryDeviceDirection, LibraryDeviceOperationMode, LibraryOption } from '@/types/library.types'

interface Props {
  libraryId: string
  embedded?: boolean
}

const DIRECTION: Record<LibraryDeviceDirection, { label: string; tone: 'success' | 'danger'; icon: typeof ArrowRightToLineIcon }> = {
  entry: { label: 'Giriş', tone: 'success', icon: ArrowRightToLineIcon },
  exit: { label: 'Çıkış', tone: 'danger', icon: ArrowLeftToLineIcon },
}

const blankForm: LibraryDeviceForm = {
  name: '', direction: 'entry', deviceId: '', ipAddress: '', port: 80, username: '', password: '',
  relayNo: 1, relayMs: 3000, workMode: 'online', httpPath: '', triggerLockOnSuccess: true,
  operationMode: 'directional', toggleCooldownMinutes: 5,
}

const copy = (text: string, label: string) => navigator.clipboard.writeText(text).then(() => toast.success(`${label} kopyalandı.`))

const webhookUrl = `${import.meta.env.VITE_DEVICE_WEBHOOK_BASE || import.meta.env.VITE_API_URL || window.location.origin}/api/v1/library-device/webaccess`

export const LibraryDevicesSection = ({ libraryId, embedded }: Props) => {
  const { can } = useAuth()
  const canManageDevices = can('library.devices')
  const [devices, setDevices] = useState<LibraryDeviceRecord[] | undefined>(undefined)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<LibraryDeviceForm>(blankForm)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<LibraryDeviceRecord | null>(null)
  const [removing, setRemoving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({})
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const [moving, setMoving] = useState<LibraryDeviceRecord | null>(null)
  const [libraryOptions, setLibraryOptions] = useState<LibraryOption[]>([])
  const [libraryOptionsLoading, setLibraryOptionsLoading] = useState(false)
  const [moveTargetId, setMoveTargetId] = useState('')
  const [movingBusy, setMovingBusy] = useState(false)

  const load = useCallback(() => {
    libraryService.devices.getList(libraryId).then(setDevices).catch(() => setDevices([]))
  }, [libraryId])

  const revealKey = async (id: string) => {
    if (revealingId) return
    setRevealingId(id)
    try {
      const key = await libraryService.devices.revealApiKey(id)
      if (key) setRevealedKeys((m) => ({ ...m, [id]: key }))
    } finally {
      setRevealingId(null)
    }
  }
  useEffect(() => { load() }, [load])

  const startAdd = () => { setForm(blankForm); setEditingId(null); setAdding(true) }

  const startEdit = (d: LibraryDeviceRecord) => {
    setForm({
      name: d.name, direction: d.direction, deviceId: d.deviceId ?? '', ipAddress: d.ipAddress ?? '',
      port: d.port, username: d.username ?? '', password: '', relayNo: d.relayNo, relayMs: d.relayMs,
      workMode: d.workMode, httpPath: d.httpPath ?? '', triggerLockOnSuccess: d.triggerLockOnSuccess,
      operationMode: d.operationMode, toggleCooldownMinutes: d.toggleCooldownMinutes,
    })
    setEditingId(d.id)
    setAdding(true)
  }

  const cancelForm = () => { setAdding(false); setEditingId(null) }

  const create = async () => {
    if (!form.name.trim()) return
    setCreating(true)
    try {
      if (editingId) {
        await libraryService.devices.update(editingId, form)
        toast.success('Cihaz güncellendi.')
      } else {
        await libraryService.devices.create(libraryId, form)
        toast.success('Cihaz oluşturuldu.')
      }
      setAdding(false)
      setEditingId(null)
      load()
    } finally {
      setCreating(false)
    }
  }

  const toggleDevice = async (d: LibraryDeviceRecord) => {
    await libraryService.devices.toggleStatus(d.id)
    toast.success(d.isActive ? 'Cihaz pasifleştirildi.' : 'Cihaz aktifleştirildi.')
    load()
  }

  const rotate = async (d: LibraryDeviceRecord) => {
    await libraryService.devices.rotateKey(d.id)
    toast.success('Cihaz anahtarı yenilendi.')
    load()
  }

  const testLock = async (d: LibraryDeviceRecord) => {
    setTesting(d.id)
    try {
      const res = await libraryService.devices.testLock(d.id)
      if (res.ok) toast.success(res.message)
      else toast.error(res.message)
    } finally {
      setTesting(null)
    }
  }

  const targetOptions: ComboOption[] = libraryOptions
    .filter((o) => o.value !== libraryId)
    .map((o) => ({
      value: o.value,
      label: o.label,
      description: [o.district, o.city].filter(Boolean).join(', ') || undefined,
    }))
  const selectedTarget = libraryOptions.find((o) => o.value === moveTargetId)

  const startMove = (d: LibraryDeviceRecord) => {
    setMoving(d)
    setMoveTargetId('')
    if (libraryOptions.length === 0) {
      setLibraryOptionsLoading(true)
      libraryService.getOptions()
        .then(setLibraryOptions)
        .catch(() => setLibraryOptions([]))
        .finally(() => setLibraryOptionsLoading(false))
    }
  }

  const confirmMove = async () => {
    if (!moving || !moveTargetId) return
    setMovingBusy(true)
    try {
      await libraryService.devices.move(moving.id, moveTargetId)
      toast.success('Cihaz başka kütüphaneye taşındı. Fiziksel cihaz ayarlarında hiçbir değişiklik gerekmez.')
      setMoving(null)
      setMoveTargetId('')
      load()
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message || 'Cihaz taşınamadı.')
    } finally {
      setMovingBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setRemoving(true)
    try {
      await libraryService.devices.remove(deleting.id)
      toast.success('Cihaz silindi.')
      setDeleting(null)
      load()
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="space-y-4">
      {embedded ? (
        <div className="flex items-center justify-between">
          <p className="type-caption">Kütüphane giriş/çıkış turnike ve kapı kilidi cihazlarını yönetin.</p>
          {canManageDevices && !adding && (
            <Button variant="primary" size="sm" onClick={startAdd}><PlusIcon className="h-4 w-4" /> Cihaz Ekle</Button>
          )}
        </div>
      ) : (
        <SectionToolbar
          icon={DoorOpenIcon}
          title="Kapı Cihazları"
          subtitle="Kütüphane giriş/çıkış turnike ve kapı kilidi cihazlarını yönetin"
          actions={
            canManageDevices && !adding && (
              <Button variant="primary" size="sm" onClick={startAdd}><PlusIcon className="h-4 w-4" /> Cihaz Ekle</Button>
            )
          }
        />
      )}

      {adding && (
        <div className="space-y-3 rounded-field border border-primary/40 bg-surface-0 p-3">
          <p className="type-body-strong">{editingId ? 'Cihaz Düzenle' : 'Yeni Cihaz'}</p>
          <div className="space-y-1.5">
            <Label>Cihaz Adı</Label>
            <Input placeholder="Örn: Ana Giriş Turnikesi" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Çalışma Modu</Label>
            <SegmentedControl
              value={form.operationMode}
              onChange={(v) => setForm((p) => ({ ...p, operationMode: v as LibraryDeviceOperationMode }))}
              columns={2}
              options={[
                { value: 'directional', label: 'Tek Yön (Giriş veya Çıkış)', icon: ArrowRightToLineIcon, tone: 'blue' },
                { value: 'toggle', label: 'Tek Cihaz, Hem Giriş Hem Çıkış', icon: RepeatIcon, tone: 'violet' },
              ]}
            />
            <p className="type-caption">
              {form.operationMode === 'toggle'
                ? 'Bu cihazdan rezervasyon/sıra şartı olmadan doğrudan okutulur. Kişi içeride değilse GİRİŞ, içerideyse (ve aşağıdaki süre dolmuşsa) ÇIKIŞ olarak işlenir.'
                : 'Bu cihaz sabit bir yöne (Giriş veya Çıkış) atanır; giriş cihazında rezervasyon/sıra kuralları geçerlidir.'}
            </p>
          </div>

          {form.operationMode === 'toggle' ? (
            <div className="space-y-1.5">
              <Label>Tekrar Okutma Süresi (dk)</Label>
              <Input
                type="number" min={1}
                value={form.toggleCooldownMinutes}
                onChange={(e) => setForm((p) => ({ ...p, toggleCooldownMinutes: Number(e.target.value) || 5 }))}
              />
              <p className="type-caption">
                Kişi ilk okutmadan sonra bu süre dolmadan tekrar okutursa reddedilir (kapı açılmaz). Süre dolduktan sonra
                okutursa çıkış olarak işlenir. Örn: 5 girilirse, ilk 5 dakika içinde tekrar okutma denemesi reddedilir;
                5 dakikadan sonraki okutma çıkıştır.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Yön</Label>
              <SegmentedControl
                value={form.direction}
                onChange={(v) => setForm((p) => ({ ...p, direction: v as LibraryDeviceDirection }))}
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
            <p className="type-caption">Kapı açılırken Nexora, cihazın IP adresine bu yola istek atıp röleyi tetikler (kilit elektriğini keser). Boş bırakılırsa varsayılan yol kullanılır.</p>
          </div>

          <div className="flex items-center justify-between rounded-card border border-border bg-surface-0 px-3 py-2.5">
            <div>
              <Label>Kilit Tetikle</Label>
              <p className="type-caption">QR/kart doğrulanınca bu cihazın manyetik kilidini tetikler.</p>
            </div>
            <Switch checked={form.triggerLockOnSuccess} onCheckedChange={(v) => setForm((p) => ({ ...p, triggerLockOnSuccess: v }))} />
          </div>

          <div className="flex gap-2">
            <Button variant="primary" size="sm" disabled={!form.name.trim()} isLoading={creating} onClick={create}>{editingId ? 'Kaydet' : 'Cihazı Oluştur'}</Button>
            <Button variant="outline" size="sm" onClick={cancelForm}>İptal</Button>
          </div>
        </div>
      )}

      {devices === undefined ? (
        <p className="type-caption">Yükleniyor...</p>
      ) : devices.length === 0 ? (
        <EmptyState icon={DoorOpenIcon} title="Henüz cihaz yok" description="Bu kütüphaneye kapı/turnike cihazı ekleyin." />
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
                    {d.operationMode === 'toggle' ? (
                      <Badge tone="info"><RepeatIcon className="mr-1 inline h-3 w-3" />Hem Giriş Hem Çıkış ({d.toggleCooldownMinutes} dk)</Badge>
                    ) : (
                      <Badge tone={dir.tone}><dir.icon className="mr-1 inline h-3 w-3" />{dir.label}</Badge>
                    )}
                    <Badge tone={d.workMode === 'online' ? 'info' : 'neutral'}>{d.workMode === 'online' ? 'Online' : 'Offline'}</Badge>
                    <Badge tone={d.isActive ? 'success' : 'neutral'}>{d.isActive ? 'Aktif' : 'Pasif'}</Badge>
                    {d.isOnline ? (
                      <Badge tone="success">● Çevrim İçi</Badge>
                    ) : (
                      <Badge tone="danger">○ Bağlantı Yok</Badge>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center">
                    {canManageDevices && (
                      <>
                        <IconButton tone="primary" title="Düzenle" onClick={() => startEdit(d)}><PencilIcon className="h-4 w-4" /></IconButton>
                        <IconButton tone="default" title="Kilidi test et" onClick={() => testLock(d)} disabled={testing === d.id}>
                          <ZapIcon className="h-4 w-4" />
                        </IconButton>
                        <IconButton tone="default" title="Anahtarı yenile" onClick={() => rotate(d)}><RefreshCwIcon className="h-4 w-4" /></IconButton>
                        <IconButton tone="default" title="Başka kütüphaneye taşı" onClick={() => startMove(d)}><ArrowRightLeftIcon className="h-4 w-4" /></IconButton>
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
                  {canManageDevices && (
                    <div className="flex items-center gap-2">
                      <Input
                        value={revealedKeys[d.id] ?? d.apiKey ?? '••••••••••••••••'}
                        readOnly size="sm" className="font-mono"
                      />
                      {(revealedKeys[d.id] ?? d.apiKey)
                        ? <IconButton tone="default" title="API anahtarını kopyala" onClick={() => copy((revealedKeys[d.id] ?? d.apiKey)!, 'API anahtarı')}><CopyIcon className="h-4 w-4" /></IconButton>
                        : <Button variant="outline" size="sm" disabled={revealingId === d.id} onClick={() => revealKey(d.id)}>Göster</Button>}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input value={webhookUrl} readOnly size="sm" className="font-mono" />
                    <IconButton tone="default" title="Webhook adresini kopyala" onClick={() => copy(webhookUrl, 'Webhook adresi')}><CopyIcon className="h-4 w-4" /></IconButton>
                  </div>
                  <p className="type-caption">Cihaz Id&apos;sini cihaza yazın, <span className="font-mono">X-Device-Key</span> header&apos;ında apiKey gönderin.</p>
                </div>
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

      <Modal
        open={!!moving}
        onClose={() => setMoving(null)}
        width={480}
        header={
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-primary-soft text-primary">
              <ArrowRightLeftIcon className="h-5 w-5" />
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
                <DoorOpenIcon className="h-4 w-4" />
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
                <p className="truncate type-body-strong">
                  {selectedTarget?.label ?? 'Henüz seçilmedi'}
                </p>
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

          {selectedTarget && (
            <div className="flex items-start gap-2.5 rounded-card border border-primary/30 bg-primary-soft/40 p-3">
              <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 text-sm">
                <p className="font-medium text-foreground-strong">{selectedTarget.label}</p>
                {(selectedTarget.district || selectedTarget.city) && (
                  <p className="type-caption">{[selectedTarget.district, selectedTarget.city].filter(Boolean).join(', ')}</p>
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
    </div>
  )
}
