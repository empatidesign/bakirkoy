import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  BookOpenIcon, UsersIcon, Building2Icon, QrCodeIcon, MonitorIcon, HandIcon, BanIcon,
  LayersIcon, SlidersHorizontalIcon, InfoIcon, DoorOpenIcon, MapPinIcon,
  BadgeCheckIcon, CheckCircle2Icon, AlertTriangleIcon, ArmchairIcon, ListOrderedIcon, BriefcaseIcon,
} from 'lucide-react'
import {
  Drawer, Button, Input, Textarea, Label, Switch, SegmentedControl, ToggleChip, Select,
  FormSection, Field, NumberInput, Banner, AdminFormShell, Badge,
} from '@/design-system'
import { ResponsiblePersonField, isResponsiblePersonValid } from '@/components/specialized/ResponsiblePersonField'
import { ServiceFacilitySelect } from '@/components/specialized/ServiceFacilitySelect'
import { EventImageUploader } from '@/components/specialized/EventImageUploader'
import { LibraryDevicesSection } from './LibraryDevicesSection'
import { LibraryStaticQrSection } from './LibraryStaticQrSection'
import { MapPicker } from '@/components/specialized/MapPicker'
import libraryService from '@/services/library.service'
import { AMENITY_OPTIONS, OPERATION_TEMPLATE_LABELS, SYSTEM_TYPE_LABELS } from '@/types/library.types'
import type { Library, LibraryForm, EntryControlMode, HardwareVerificationResult, LibrarySystemType } from '@/types/library.types'
import { FULL_RESIDENCY_MODE_OPTIONS } from '@/lib/residency'

interface Props {
  open: boolean
  onClose: () => void
  editing: Library | null
  onSaved: () => void
}

const deriveSystemType = (seatingMode: string, breakSystemEnabled: boolean): LibrarySystemType => {
  if (seatingMode !== 'masali') return 'giris_cikis'
  return breakSystemEnabled ? 'millet' : 'masa_secimli'
}

const blank = (): LibraryForm => ({
  name: '',
  description: '',
  imageUrl: '',
  serviceFacilityId: '',
  managerId: '', manager: '', managerRoleKey: '', managerRoleName: '', managerPhone: '', managerEmail: '', emergencyPhone: '',
  systemType: 'millet',
  isMultiFloor: false,
  floors: [],
  amenities: [],
  queueEnabled: true,
  reservationEnabled: false,
  deviceControlEnabled: false,
  entryControlMode: 'qr',
  exitControlMode: 'qr',
  autoCheckOutAfterMinutes: '0',
  useCustomBreakSettings: false,
  breakDurationMinutes: '30',
  maxDailyBreaks: '3',
  longBreakDurationMinutes: '60',
  maxStudyHoursPerDay: '9',
  requireBreakAfterHours: '3',
  ipRestrictionEnabled: false,
  allowedIps: [],
  isActive: true,
  grantAccess: false,
  tckn: '',
  geofenceEnabled: true,
  geofenceLatitude: '',
  geofenceLongitude: '',
  geofenceRadiusMeters: '150',
  residencyMode: 'anyone',
})

const ENTRY_OPTIONS = [
  { value: 'qr', label: 'QR Okuyucu', description: 'Turnike/okuyucu ile otomatik', icon: QrCodeIcon },
  { value: 'kiosk', label: 'Kiosk', description: 'Kapıda ekrandan TC/QR', icon: MonitorIcon },
  { value: 'manual', label: 'Manuel', description: 'Görevli elle kayıt', icon: HandIcon },
  { value: 'none', label: 'Kontrol Yok', description: 'Serbest giriş, sayım yok', icon: BanIcon },
]

const NumberField = ({ label, value, onChange, suffix }: {
  label: string; value: string; onChange: (v: string) => void; suffix?: string
}) => (
  <Field label={label}>
    <NumberInput value={Number(value || 0)} onChange={(n) => onChange(String(n))} min={0} suffix={suffix} />
  </Field>
)

export const LibraryFormDrawer = ({ open, onClose, editing, onSaved }: Props) => {
  const [form, setForm] = useState<LibraryForm>(blank())
  const [saving, setSaving] = useState(false)
  const [templateCheck, setTemplateCheck] = useState<HardwareVerificationResult | null>(null)
  const [templateCheckLoading, setTemplateCheckLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        ...blank(),
        name: editing.name,
        description: editing.description ?? '',
        imageUrl: editing.imageUrl ?? '',
        serviceFacilityId: editing.serviceFacilityId ?? '',
        managerId: editing.managerId ?? '',
        manager: editing.managerName ?? '',
        managerRoleKey: editing.managerRoleKey ?? '',
        managerRoleName: editing.managerRoleName ?? '',
        managerPhone: editing.managerPhone ?? '',
        systemType: deriveSystemType(editing.seatingMode, editing.breakSystemEnabled),
        queueEnabled: editing.queueEnabled,
        reservationEnabled: editing.reservationEnabled,
        deviceControlEnabled: editing.deviceControlEnabled ?? false,
        entryControlMode: editing.entryControlMode,
        exitControlMode: editing.exitControlMode ?? editing.entryControlMode,
        autoCheckOutAfterMinutes: String(editing.autoCheckOutAfterMinutes ?? 0),
        isActive: editing.isActive,
        isMultiFloor: editing.isMultiFloor ?? false,
        floors: [],
        amenities: editing.amenities ?? [],
        grantAccess: false,
        tckn: '',
        ipRestrictionEnabled: editing.ipRestrictionEnabled ?? false,
        allowedIps: editing.allowedIps ?? [],
        geofenceEnabled: true,
        geofenceLatitude: editing.geofenceLatitude != null ? String(editing.geofenceLatitude) : '',
        geofenceLongitude: editing.geofenceLongitude != null ? String(editing.geofenceLongitude) : '',
        geofenceRadiusMeters: editing.geofenceRadiusMeters != null ? String(editing.geofenceRadiusMeters) : '150',
        residencyMode: editing.residencyMode ?? 'anyone',
      })
    } else {
      setForm(blank())
    }
  }, [open, editing])

  const toggleAmenity = (value: string) =>
    setForm((p) => ({ ...p, amenities: p.amenities.includes(value) ? p.amenities.filter((a) => a !== value) : [...p.amenities, value] }))

  useEffect(() => {
    if (form.systemType !== 'millet' && form.reservationEnabled) {
      setForm((p) => ({ ...p, reservationEnabled: false }))
    }
  }, [form.systemType, form.reservationEnabled])

  const guessedTemplateId = useMemo(() => {
    if (form.systemType === 'giris_cikis') return 'QR_ENTRY_EXIT_ONLY'
    if (form.systemType === 'masa_secimli') return 'ENTRY_EXIT_AND_SEAT'
    if (form.systemType === 'millet' && form.reservationEnabled) return 'FULL_BUSY_LIBRARY'
    return 'SEQUENTIAL_SEAT'
  }, [form.systemType, form.reservationEnabled])

  useEffect(() => {
    if (!open || editing) { setTemplateCheck(null); return }
    setTemplateCheckLoading(true)
    const timer = setTimeout(() => {
      libraryService.validateTemplate({
        requestedTemplateId: guessedTemplateId,
        seatingMode: form.systemType === 'giris_cikis' ? 'sirali' : 'masali',
        queueEnabled: form.queueEnabled,
        reservationEnabled: form.reservationEnabled,
        breakSystemEnabled: form.systemType === 'millet',
        accessType: 'qr',
        plannedDevices: [],
      })
        .then(setTemplateCheck)
        .catch(() => setTemplateCheck(null))
        .finally(() => setTemplateCheckLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [open, editing, guessedTemplateId, form.systemType, form.queueEnabled, form.reservationEnabled])

  const geofenceValid = !!form.geofenceLatitude.trim() && !!form.geofenceLongitude.trim()
    && Number.isFinite(Number(form.geofenceLatitude)) && Math.abs(Number(form.geofenceLatitude)) <= 90
    && Number.isFinite(Number(form.geofenceLongitude)) && Math.abs(Number(form.geofenceLongitude)) <= 180
    && Number(form.geofenceRadiusMeters) > 0
  const valid = !!form.name.trim() && !!form.serviceFacilityId && isResponsiblePersonValid(form) && geofenceValid

  const submit = async () => {
    if (!valid) return
    setSaving(true)
    try {
      if (editing) {
        await libraryService.update(editing.id, form)
        toast.success('Değişiklikler kaydedildi.')
      } else {
        await libraryService.create(form)
        toast.success('Kütüphane oluşturuldu.')
      }
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      icon={BookOpenIcon}
      title={editing ? 'Kütüphane Düzenle' : 'Yeni Kütüphane Ekle'}
      subtitle={editing?.name}
      width={620}
      footer={
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
          <Button variant="primary" className="flex-1" disabled={!valid} isLoading={saving} onClick={submit}>
            {editing ? 'Güncelle' : 'Ekle'}
          </Button>
        </div>
      }
    >
      <AdminFormShell
        icon={BookOpenIcon}
        title={editing ? 'Kütüphane Düzenle' : 'Yeni Kütüphane Ekle'}
        subtitle="Temel bilgiler, tesis bağlantısı, sorumlu, imkanlar ve operasyon ayarlarını yönetin"
        badge={editing?.isActive === false ? 'Pasif' : 'Kütüphane'}
        tone="green"
      >
        <FormSection variant="card" icon={BookOpenIcon} title="Temel Bilgiler">
          <Field label="Kütüphane Adı" required>
            <Input placeholder="Örn. Cemil Meriç Millet Kütüphanesi" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Tanıtım / Açıklama">
            <Textarea rows={2} placeholder="Öğrenciler tarafından görünür kısa açıklama" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </Field>
          <EventImageUploader
            label="Kütüphane Fotoğrafı (4:3)"
            value={{ url: form.imageUrl || undefined, width: 800, height: 600, maxSizeKb: 2048 }}
            onChange={(v) => setForm((p) => ({ ...p, imageUrl: v.url ?? '' }))}
            onUpload={(file) => libraryService.uploadImage(file)}
          />
        </FormSection>

        <FormSection variant="card" icon={Building2Icon} title="Hizmet Tesisi & Sorumlu" subtitle="Konum, ilçe ve adres seçilen hizmet tesisinden alınır.">
          <Field label="Hizmet Tesisi" required>
            <ServiceFacilitySelect value={form.serviceFacilityId} onChange={(v) => setForm((p) => ({ ...p, serviceFacilityId: v }))} currentLabel={editing?.serviceFacilityName} />
          </Field>
          <div className="pt-1">
            <div className="mb-2 flex items-center gap-2"><UsersIcon className="h-4 w-4 text-primary" /><p className="type-section">Sorumlu & İletişim</p></div>
            <ResponsiblePersonField
              value={form}
              onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
              allowCreate
              allowAccessGrant
              requireTckn={false}
              roleTemplate={{ name: 'Kütüphane Sorumlusu', scopeHint: 'yalnız bu kütüphane' }}
            />
          </div>
        </FormSection>

        <FormSection variant="card" icon={ArmchairIcon} title="Sistem Türü" subtitle="Kütüphanenin çalışma modelini seçin — bu seçim masa seçimi, mola/rezervasyon davranışını belirler.">
          <SegmentedControl
            value={form.systemType}
            onChange={(v) => setForm((p) => ({ ...p, systemType: v as LibrarySystemType }))}
            columns={3}
            options={[
              { value: 'millet', label: SYSTEM_TYPE_LABELS.millet, description: 'Masa, mola, rezervasyon — hepsi aktif', icon: BriefcaseIcon, tone: 'primary' },
              { value: 'giris_cikis', label: SYSTEM_TYPE_LABELS.giris_cikis, description: 'Masa/mola yok, sadece giriş-çıkış', icon: ListOrderedIcon, tone: 'blue' },
              { value: 'masa_secimli', label: SYSTEM_TYPE_LABELS.masa_secimli, description: 'Masa seçimi var, mola yok', icon: ArmchairIcon, tone: 'violet' },
            ]}
          />
          <p className="type-caption">
            {form.systemType === 'millet' && 'Kütüphane tam/profesyonel sistem: masa/koltuk seçimi, kısa-uzun mola ve aynı gün rezervasyon dahil tüm özellikler aktiftir. Oturma Planı sekmesinden kat/bölüm/masa tanımlanır.'}
            {form.systemType === 'giris_cikis' && 'Yalnızca giriş-çıkış takibi: masa seçimi, mola ve rezervasyon YOKTUR. Tek cihaz yeterlidir; manyetik kilit istenirse Kapı Cihazları bölümünden ilgili cihazda ayrıca açılabilir (kilit sistem türüne değil, cihaza bağlıdır).'}
            {form.systemType === 'masa_secimli' && 'Masa/koltuk seçimi vardır (üye kalan süresini görmek için masa seçer) ancak mola ve rezervasyon YOKTUR. Manyetik kilit istenirse Kapı Cihazları bölümünden ilgili cihazda ayrıca açılabilir.'}
          </p>
        </FormSection>

        {form.systemType !== 'giris_cikis' && (
          <FormSection variant="card" icon={LayersIcon} title="Kat & Oturma Düzeni" subtitle="Kat, bölüm, masa ve koltuk düzeni Oturma Planı sekmesinden kurulur.">
            <div className="flex items-center justify-between">
              <div>
                <Label>Çoklu kat (binada birden fazla kat var)</Label>
                <p className="type-caption">Açık olunca Oturma Planı'nda birden fazla kat eklenebilir.</p>
              </div>
              <Switch checked={form.isMultiFloor} onCheckedChange={(v) => setForm((p) => ({ ...p, isMultiFloor: v }))} />
            </div>
            <Banner tone="info" variant="soft" icon={InfoIcon}>
              Kapasite ve koltuk düzeni burada girilmez. Kütüphaneyi kaydedip <strong>Oturma Planı</strong> sekmesindeki <strong>Yönetim Modu</strong>'ndan kat, bölüm ve masaları tanımlayın.
            </Banner>
          </FormSection>
        )}

        <FormSection variant="card" icon={SlidersHorizontalIcon} title="İmkanlar / Olanaklar">
          <div className="flex flex-wrap gap-2">
            {AMENITY_OPTIONS.map((a) => (
              <ToggleChip key={a.value} active={form.amenities.includes(a.value)} onClick={() => toggleAmenity(a.value)}>
                {a.label}
              </ToggleChip>
            ))}
          </div>
        </FormSection>

        <FormSection variant="card" icon={SlidersHorizontalIcon} title="Operasyon Ayarları">
          {!editing && (
            <div className="rounded-card border border-border bg-surface-0 px-3 py-2.5">
              <div className="mb-1.5 flex items-center gap-1.5">
                <BadgeCheckIcon className="h-3.5 w-3.5 text-primary" />
                <span className="type-caption font-semibold text-foreground-strong">Şablon Önizlemesi (bilgi amaçlı)</span>
              </div>
              {templateCheckLoading ? (
                <p className="type-caption">Hesaplanıyor…</p>
              ) : templateCheck ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Badge tone={templateCheck.isSatisfied ? 'success' : 'warning'}>
                      {OPERATION_TEMPLATE_LABELS[templateCheck.requestedTemplateId] ?? templateCheck.requestedTemplateId}
                    </Badge>
                    {templateCheck.isSatisfied ? (
                      <CheckCircle2Icon className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <AlertTriangleIcon className="h-3.5 w-3.5 text-orange-500" />
                    )}
                  </div>
                  {!templateCheck.isSatisfied && templateCheck.missingRequirements.length > 0 && (
                    <ul className="list-inside list-disc space-y-0.5 type-caption text-orange-700">
                      {templateCheck.missingRequirements.map((m) => <li key={m}>{m}</li>)}
                    </ul>
                  )}
                  {templateCheck.fallbackTemplateId && (
                    <p className="type-caption">
                      Şimdilik uygun alternatif: <strong>{OPERATION_TEMPLATE_LABELS[templateCheck.fallbackTemplateId] ?? templateCheck.fallbackTemplateId}</strong>
                    </p>
                  )}
                  <p className="type-caption text-foreground-muted">
                    Bu bir ön izlemedir; masa planı ve cihazlar kaydedildikten sonra kesinleşir.
                  </p>
                </div>
              ) : null}
            </div>
          )}
          <div className="flex items-center justify-between rounded-card border border-border bg-surface-0 px-3 py-2.5">
            <div><Label>Sıra sistemi (kuyruk)</Label><p className="type-caption">Salon dolunca gelen ziyaretçi kuyruğa alınır.</p></div>
            <Switch checked={form.queueEnabled} onCheckedChange={(v) => setForm((p) => ({ ...p, queueEnabled: v }))} />
          </div>
          {form.systemType === 'millet' && (
            <div className="rounded-card border border-border bg-surface-0 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div><Label>Aynı gün rezervasyon</Label><p className="type-caption">Üyeler aynı gün için yer ayırtır; ileri tarih yok.</p></div>
                <Switch checked={form.reservationEnabled} onCheckedChange={(v) => setForm((p) => ({ ...p, reservationEnabled: v }))} />
              </div>
              {form.reservationEnabled && (
                <p className="mt-2 type-caption">
                  Rezervasyon giriş süresi (üye kaç saat/dk içinde giriş yapmalı) ve günlük rezervasyon limiti, kütüphane kaydedildikten sonra <span className="text-foreground-strong">Ayarlar</span> sekmesinden belirlenir.
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Giriş Kontrol Modu</Label>
            <SegmentedControl value={form.entryControlMode} onChange={(v) => setForm((p) => ({ ...p, entryControlMode: v as EntryControlMode }))} columns={2} options={ENTRY_OPTIONS} />
          </div>
          <div className="space-y-1.5">
            <Label>Çıkış Kontrol Modu</Label>
            <SegmentedControl value={form.exitControlMode} onChange={(v) => setForm((p) => ({ ...p, exitControlMode: v as EntryControlMode }))} columns={2} options={ENTRY_OPTIONS} />
          </div>
          <NumberField label="Otomatik çıkış süresi (0 = pasif)" value={form.autoCheckOutAfterMinutes} onChange={(v) => setForm((p) => ({ ...p, autoCheckOutAfterMinutes: v }))} suffix="dakika" />
          <Field label="Katılım Bölgesi (İkamet / Uyruk)" hint="Bu kıraathaneye kimlerin giriş/rezervasyon yapabileceğini ikamet adresine (NVI/KPS) ve uyruğa (T.C./yabancı) göre belirler">
            <Select value={form.residencyMode} onChange={(e) => setForm((p) => ({ ...p, residencyMode: e.target.value as LibraryForm['residencyMode'] }))}>
              {FULL_RESIDENCY_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        </FormSection>

        <FormSection variant="card" icon={DoorOpenIcon} title="Kapı Cihazları" subtitle="Giriş ve çıkış için ayrı QR cihaz + manyetik kilit tanımlayın.">
          {editing ? (
            <LibraryDevicesSection libraryId={editing.id} embedded />
          ) : (
            <Banner tone="info" icon={InfoIcon}>
              Kapı cihazlarını eklemek için önce kütüphaneyi kaydedin. Kaydettikten sonra bu formu tekrar açtığınızda giriş ve çıkış cihazlarını buradan tanımlayabilirsiniz.
            </Banner>
          )}
        </FormSection>

        {editing && <LibraryStaticQrSection libraryId={editing.id} libraryName={editing.name} />}

        <FormSection variant="card" icon={Building2Icon} title="Güvenlik · Ağ (IP) Kısıtlaması">
          <div className="flex items-center justify-between">
            <div><Label>Yalnızca kurum ağından mesai başlatılabilsin</Label><p className="type-caption">Personel mesaisini yalnızca aşağıda tanımlı IP/ağdan (self girişte) başlatabilir. Yönetici tarafından manuel başlatılan mesailer bu kısıttan muaftır. 5G modem/mobil ağ kullanılan yerlerde bu ayarı kapalı bırakın veya modemin sabit IP'sini tanımlayın.</p></div>
            <Switch checked={form.ipRestrictionEnabled} onCheckedChange={(v) => setForm((p) => ({ ...p, ipRestrictionEnabled: v }))} />
          </div>
          {form.ipRestrictionEnabled && (
            <Field label="İzinli IP Adresleri / Ağlar" hint="Her satıra bir IP (örn. 85.34.12.10) veya CIDR ağ aralığı (örn. 10.0.0.0/24) yazın. Boşsa kısıtlama devre dışı kalır.">
              <Textarea
                rows={3}
                placeholder={'85.34.12.10\n10.0.0.0/24'}
                value={form.allowedIps.join('\n')}
                onChange={(e) => setForm((p) => ({ ...p, allowedIps: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) }))}
              />
            </Field>
          )}
        </FormSection>

        <FormSection variant="card" icon={MapPinIcon} title="Güvenlik · Konum (GPS) Kısıtlaması">
          <div className="flex items-center justify-between">
            <div><Label>QR işlemlerinde konum doğrulaması zorunlu</Label><p className="type-caption">Personel mesaisini (self girişte) ve üyelerin sabit QR ile giriş/çıkışını yalnızca bina konumuna yakınken yapabilir. Yönetici tarafından manuel başlatılan mesailer bu kısıttan muaftır.</p></div>
            <span className="type-caption">Zorunlu</span>
          </div>
          {form.geofenceEnabled && (
            <div className="space-y-[15px]">
              <p className="type-caption">Adres arayın, haritaya tıklayın ya da işaretçiyi sürükleyin; koordinatları elle de girebilirsiniz. Mavi daire izinli alanı gösterir.</p>
              <MapPicker
                value={{
                  latitude: form.geofenceLatitude.trim() === '' ? undefined : Number(form.geofenceLatitude.replace(',', '.')),
                  longitude: form.geofenceLongitude.trim() === '' ? undefined : Number(form.geofenceLongitude.replace(',', '.')),
                }}
                onChange={(c) => setForm((p) => ({
                  ...p,
                  geofenceLatitude: c.latitude === undefined ? '' : String(c.latitude),
                  geofenceLongitude: c.longitude === undefined ? '' : String(c.longitude),
                }))}
                radiusMeters={Number(form.geofenceRadiusMeters || 150)}
                height={300}
              />
              <Field label="İzinli Yarıçap">
                <NumberInput value={Number(form.geofenceRadiusMeters || 150)} onChange={(n) => setForm((p) => ({ ...p, geofenceRadiusMeters: String(n) }))} min={10} suffix="m" />
              </Field>
            </div>
          )}
        </FormSection>

        <div className="flex items-center justify-between rounded-card border border-border bg-surface-1 px-4 py-3">
          <div><Label>Durum</Label><p className="type-caption">Pasif kütüphane kullanıcı girişine kapalıdır.</p></div>
          <Switch checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))} />
        </div>
      </AdminFormShell>
    </Drawer>
  )
}
