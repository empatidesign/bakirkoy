import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import {
  CalendarIcon, ImageIcon, FileTextIcon, ShieldCheckIcon, TrophyIcon,
  Building2Icon, TreePineIcon, XIcon, LogInIcon, InfoIcon, AlertTriangleIcon,
} from 'lucide-react'
import {
  Input, Textarea, Select, Combobox, SegmentedControl, DatePicker, TimePicker,
  Field, ToggleRow, NumberInput, IconButton, Banner,
} from '@/design-system'
import { EventImageUploader } from '@/components/specialized/EventImageUploader'
import { HallDevicesSection } from '@/modules/halls/HallDevicesSection'
import { EventStaticQrSection } from './EventStaticQrSection'
import { ImageGallery } from '@/components/specialized/ImageGallery'
import { RichTextEditor } from '@/components/specialized/RichTextEditor'
import { MapPicker } from '@/components/specialized/MapPicker'
import { ServiceFacilitySelect } from '@/components/specialized/ServiceFacilitySelect'
import { ResponsiblePersonField, type ResponsiblePersonValue } from '@/components/specialized/ResponsiblePersonField'
import eventCategoryService from '@/services/eventCategory.service'
import eventService from '@/services/event.service'
import eventSettingsService from '@/services/eventSettings.service'
import hallService from '@/services/hall.service'
import { todayIso } from '@/lib/utils'
import { FULL_RESIDENCY_MODE_OPTIONS, type FullResidencyMode } from '@/lib/residency'
import { GENDER_OPTIONS, PARTICIPATION_PERIOD_OPTIONS, EVENT_IMAGE_RATIOS, LEGACY_EVENT_IMAGE_RATIOS, RATIO_LABELS } from './eventFormDefaults'
import { deriveSingleDay, applicationEndMax } from './eventDateRules'
import { EVENT_NOTIFICATION_META } from '@/types/eventSettings.types'
import type { EventFormData, EventImageVariant, EventImageRatio } from '@/types/event.types'
import type { EventCategoryOption } from '@/types/eventCategory.types'

interface HallOption { value: string; label: string; capacity: number; available: number; floorCount: number }

interface EventFormProps {
  form: EventFormData
  setForm: Dispatch<SetStateAction<EventFormData>>
  readOnly?: boolean
  eventStarted?: boolean
  // Kullanıcı isteği (2026-10-06): sabit QR yönetimi mevcut (kaydedilmiş) bir etkinlik
  // gerektirir — yeni oluşturma sırasında henüz id yok, bu durumda bölüm gizlenir.
  eventId?: string
  eventName?: string
}

export const EventForm = ({ form, setForm, readOnly, eventStarted, eventId, eventName }: EventFormProps) => {
  const [categories, setCategories] = useState<EventCategoryOption[]>([])
  const [halls, setHalls] = useState<HallOption[]>([])
  const [hallsError, setHallsError] = useState(false)
  const [hallsLoading, setHallsLoading] = useState(false)
  const [staffLabels, setStaffLabels] = useState<Record<string, string>>({})

  useEffect(() => {
    eventCategoryService.getOptions().then(setCategories).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    setHalls([])
    setHallsError(false)
    if (form.venueType === 'indoor' && form.facilityId) {
      let ignore = false
      setHallsLoading(true)
      hallService.getHallOptions(form.facilityId)
        .then((h) => { if (!ignore) { setHalls(h); setHallsError(false) } })
        .catch(() => { if (!ignore) { setHalls([]); setHallsError(true) } })
        .finally(() => { if (!ignore) setHallsLoading(false) })
      return () => { ignore = true }
    }
    setHallsLoading(false)
  }, [form.venueType, form.facilityId])

  const patch = (p: Partial<EventFormData>) => setForm((f) => ({ ...f, ...p }))
  const patchAccess = (p: Partial<EventFormData['access']>) => setForm((f) => ({ ...f, access: { ...f.access, ...p } }))
  const registrationRequired = form.access.registrationMode === 'required'

  // Kullanıcı isteği (2026-09-20): Gezi modülündeki Sorumlu/Rehber atama deseninin Etkinlik
  // Takvimi karşılığı — TravelForm.tsx'teki toRPVResp/setGuideResponsible ile birebir aynı.
  const toRPVResponsible = (r: EventFormData['responsible']): ResponsiblePersonValue => ({
    managerId: r.id, manager: r.name, managerRoleKey: r.roleKey, managerRoleName: r.role,
    managerPhone: r.phone, managerEmail: r.email, grantAccess: r.grantAccess, tckn: r.tckn,
  })
  const setResponsible = (p: Partial<ResponsiblePersonValue>) =>
    setForm((f) => ({ ...f, responsible: {
      id: p.managerId !== undefined ? p.managerId : f.responsible.id,
      name: p.manager !== undefined ? p.manager : f.responsible.name,
      role: p.managerRoleName !== undefined ? p.managerRoleName : f.responsible.role,
      roleKey: p.managerRoleKey !== undefined ? p.managerRoleKey : f.responsible.roleKey,
      phone: p.managerPhone !== undefined ? p.managerPhone : f.responsible.phone,
      email: p.managerEmail !== undefined ? p.managerEmail : f.responsible.email,
      grantAccess: p.grantAccess !== undefined ? p.grantAccess : f.responsible.grantAccess,
      tckn: p.tckn !== undefined ? p.tckn : f.responsible.tckn,
    } }))
  const [globalTpls, setGlobalTpls] = useState<{ event: string; smsBody: string }[]>([])
  const [imageSettings, setImageSettings] = useState<{ cropEnabled: boolean; autoCompress: boolean }>({ cropEnabled: true, autoCompress: true })
  const [waitingListRatio, setWaitingListRatio] = useState<number>(20)
  const [activeRatios, setActiveRatios] = useState<EventImageRatio[]>(EVENT_IMAGE_RATIOS)
  const [ratioLabels, setRatioLabels] = useState<Record<string, string>>(RATIO_LABELS)
  useEffect(() => {
    eventSettingsService.get()
      .then((s) => {
        setGlobalTpls(s.notificationTemplates ?? [])
        setImageSettings({ cropEnabled: s.images.cropEnabled, autoCompress: s.images.autoCompress })
        setWaitingListRatio(s.general.waitingListRatio)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    eventSettingsService.getImageRatios()
      .then((c) => {
        if (!c?.active?.length) return
        setActiveRatios(c.active.map((r) => r.ratio as EventImageRatio))
        setRatioLabels(Object.fromEntries([...c.active, ...(c.legacy ?? [])].map((r) => [r.ratio, r.label])))
      })
      .catch(() => undefined)
  }, [])
  const globalBody = (event: string) => globalTpls.find((t) => t.event === event)?.smsBody ?? ''
  const getTpl = (event: string) => form.access.notificationTemplates?.find((t) => t.event === event)?.smsBody ?? globalBody(event)
  const setTpl = (event: string, smsBody: string) => {
    const rest = (form.access.notificationTemplates ?? []).filter((t) => t.event !== event)
    const isOverride = smsBody.trim().length > 0 && smsBody.trim() !== globalBody(event).trim()
    patchAccess({ notificationTemplates: isOverride ? [...rest, { event, smsEnabled: true, smsBody }] : rest })
  }
  const patchPoints = (p: Partial<EventFormData['points']>) => setForm((f) => ({ ...f, points: { ...f.points, ...p } }))

  const selectCategory = (id: string) => {
    const cat = categories.find((c) => c.value === id)
    setForm((f) => ({ ...f, categoryId: id, points: { ...f.points, basePoints: cat ? cat.defaultPoints : f.points.basePoints } }))
  }

  const togglePoints = (enabled: boolean) => {
    const cat = categories.find((c) => c.value === form.categoryId)
    patchPoints(enabled ? { enabled: true, basePoints: form.points.basePoints || (cat?.defaultPoints ?? 0) } : { enabled: false })
  }

  const setRatioImage = (ratio: EventImageRatio, v: EventImageVariant) =>
    setForm((f) => ({ ...f, images: { ...f.images, ratios: { ...f.images.ratios, [ratio]: v } } }))

  const selectedHall = halls.find((h) => h.value === form.hallId)

  const addStaff = (id: string, label?: string) => {
    if (!id || form.access.staffIds.includes(id)) return
    if (label) setStaffLabels((m) => ({ ...m, [id]: label }))
    patchAccess({ staffIds: [...form.access.staffIds, id] })
  }
  const removeStaff = (id: string) => patchAccess({ staffIds: form.access.staffIds.filter((s) => s !== id) })

  const onUpload = (file: File) => eventService.uploadImage(file)

  return (
    <>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <CalendarIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Temel Bilgiler</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <Field label="Etkinlik Kategorisi" required>
              <Select value={form.categoryId} onChange={(e) => selectCategory(e.target.value)} disabled={readOnly} placeholder="Kategori seçin">
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </Field>

            <Field label="Mekan Türü">
              <SegmentedControl
                value={form.venueType}
                onChange={(v) => patch({ venueType: v as EventFormData['venueType'], facilityId: '', hallId: '' })}
                disabled={readOnly}
                columns={2}
                options={[
                  { value: 'indoor', label: 'Kapalı Alan', description: 'Hizmet tesisi / salon', icon: Building2Icon },
                  { value: 'outdoor', label: 'Açık Alan', description: 'Park, meydan, bahçe', icon: TreePineIcon },
                ]}
              />
            </Field>

            {form.venueType === 'indoor' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Hizmet Tesisi" hint="Kapalı alan tesisleri">
                  <ServiceFacilitySelect value={form.facilityId} kind="indoor" onChange={(v) => patch({ facilityId: v, hallId: '' })} disabled={readOnly} placeholder="Tesis seçin" />
                </Field>
                <Field label="Salon" error={hallsError ? 'Salonlar yüklenemedi (erişim yetkisi veya sunucu hatası). Lütfen tekrar deneyin.' : undefined}>
                  <Select
                    value={form.hallId}
                    onChange={(e) => {
                      const hall = halls.find((h) => h.value === e.target.value)
                      patch(hall ? { hallId: hall.value, capacity: hall.available } : { hallId: e.target.value })
                    }}
                    disabled={readOnly || !form.facilityId || hallsLoading}
                    placeholder={!form.facilityId ? 'Önce tesis seçin' : (hallsLoading ? 'Salonlar yükleniyor…' : 'Salon seçin')}
                  >
                    {halls.map((h) => <option key={h.value} value={h.value}>{h.label} ({h.capacity.toLocaleString('tr-TR')} kişi)</option>)}
                  </Select>
                </Field>
                {selectedHall && (
                  <div className="rounded-card border border-border bg-surface-1 p-3 sm:col-span-2">
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      <span className="type-caption">Kullanılabilir: <span className="type-body-strong">{selectedHall.available.toLocaleString('tr-TR')} / {selectedHall.capacity.toLocaleString('tr-TR')}</span> koltuk</span>
                      <span className="type-caption">Kat sayısı: <span className="type-body-strong">{selectedHall.floorCount}</span></span>
                    </div>
                  </div>
                )}
                {selectedHall && !readOnly && (
                  <div className="sm:col-span-2">
                    <HallDevicesSection hallId={selectedHall.value} />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <Banner tone="info" variant="soft" icon={InfoIcon}>
                    Kontenjan, seçilen salonun koltuk kapasitesini aşamaz. Salon seçilince kontenjan otomatik olarak salonun kapasitesine ayarlanır; salon kapasitesi sonradan değişirse kontenjan bunu izler. Daha küçük bir sayı girerseniz kontenjan sabit kalır.
                  </Banner>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Field label="Hizmet Tesisi" hint="Açık alan tesisleri">
                  <ServiceFacilitySelect value={form.facilityId} kind="outdoor" onChange={(v) => patch({ facilityId: v })} disabled={readOnly} placeholder="Açık alan tesisi seçin" />
                </Field>
                <Field label="Konum Adı">
                  <Input value={form.location.name} onChange={(e) => patch({ location: { ...form.location, name: e.target.value } })} disabled={readOnly} placeholder="Örn. Cebeci Parkı Açık Sahne" />
                </Field>
                <MapPicker
                  value={{ latitude: form.location.latitude, longitude: form.location.longitude }}
                  onChange={(c) => patch({ location: { ...form.location, latitude: c.latitude, longitude: c.longitude } })}
                  readOnly={readOnly}
                />
              </div>
            )}

            <Field label="Etkinlik Adı" required>
              <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} disabled={readOnly} placeholder="Örn. Bahar Tiyatro Şenliği" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={form.isSingleDay ? 'Etkinlik Tarihi' : 'Başlangıç Tarihi'} required hint={eventStarted ? 'Etkinlik başladı — başlangıç değiştirilemez, yalnız bitiş güncellenebilir' : 'Bitiş boş bırakılırsa etkinlik tek gün sürer'}>
                <DatePicker
                  value={form.startDate}
                  onChange={(v) => patch({ startDate: v, isSingleDay: deriveSingleDay(v, form.endDate) })}
                  min={todayIso()}
                  disabled={readOnly || eventStarted}
                  clearable
                />
              </Field>
              <Field label="Bitiş Tarihi" hint={form.isSingleDay ? 'Boş bırakılırsa tek günlük etkinlik' : 'Çok günlük — seanslar bu tarih aralığında planlanır'}>
                <DatePicker
                  value={form.endDate}
                  onChange={(v) => patch({ endDate: v, isSingleDay: deriveSingleDay(form.startDate, v) })}
                  min={form.startDate || undefined}
                  disabled={readOnly}
                  clearable
                />
              </Field>
            </div>

            {!form.access.hasSessions && (
              <div className="space-y-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Başlangıç Saati" hint="Seanssız etkinlikte etkinliğin başlama saati">
                    <TimePicker value={form.startTime} onChange={(v) => patch({ startTime: v })} disabled={readOnly} />
                  </Field>
                  <Field label="Bitiş Saati" hint="Seanssız etkinlikte etkinliğin bitiş saati">
                    <TimePicker value={form.endTime} onChange={(v) => patch({ endTime: v })} disabled={readOnly} />
                  </Field>
                </div>
                {form.startTime && form.endTime && form.endTime <= form.startTime && (
                  <p className="flex items-center gap-1.5 type-caption text-[hsl(var(--danger))]">
                    <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" /> Bitiş saati başlangıç saatinden sonra olmalıdır.
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Cinsiyet">
                <Select value={form.gender} onChange={(e) => patch({ gender: e.target.value as EventFormData['gender'] })} disabled={readOnly}>
                  {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </Select>
              </Field>
              <Field label="Kontenjan" hint={form.venueType === 'indoor' && selectedHall ? `Kullanılabilir koltuk: ${selectedHall.available.toLocaleString('tr-TR')} / ${selectedHall.capacity.toLocaleString('tr-TR')}` : undefined}>
                <NumberInput value={form.capacity} onChange={(n) => patch({ capacity: n })} disabled={readOnly} suffix="kişi" max={form.venueType === 'indoor' && selectedHall ? selectedHall.available : undefined} />
              </Field>
              <Field label="Yedek Kontenjan" hint={form.capacity > 0 ? `Önerilen (%${waitingListRatio} oranı): ${Math.round(form.capacity * waitingListRatio / 100)} kişi` : undefined}>
                <NumberInput value={form.reserveCapacity} onChange={(n) => patch({ reserveCapacity: n })} disabled={readOnly} suffix="kişi" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="En Küçük Yaş">
                <NumberInput value={form.minAge} onChange={(n) => patch({ minAge: n })} disabled={readOnly} />
              </Field>
              <Field label="En Büyük Yaş">
                <NumberInput value={form.maxAge} onChange={(n) => patch({ maxAge: n })} disabled={readOnly} />
              </Field>
            </div>

            <Field label="Katılım Bölgesi (İkamet / Uyruk)" hint="Bu etkinliğe kimlerin başvurabileceğini ikamet adresine (NVI/KPS) ve uyruğa (T.C./yabancı) göre belirler">
              <Select
                value={form.residencyMode}
                onChange={(e) => patch({ residencyMode: e.target.value as FullResidencyMode, sultangaziResidentOnly: e.target.value === 'sultangazi_only' })}
                disabled={readOnly}
              >
                {FULL_RESIDENCY_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Katılım Sınırı">
                <Select value={form.participationPeriod} onChange={(e) => {
                  const period = e.target.value as EventFormData['participationPeriod']
                  patch(period !== 'none' && form.participationLimit < 1 ? { participationPeriod: period, participationLimit: 1 } : { participationPeriod: period })
                }} disabled={readOnly}>
                  {PARTICIPATION_PERIOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </Select>
              </Field>
              {form.participationPeriod !== 'none' && (
                <Field label="Sınır Adedi" hint={form.participationLimit < 1 ? 'Periyot seçildiğinde en az 1 olmalıdır.' : 'Belirtilen periyotta en fazla kaç kez katılınabilir'}>
                  <NumberInput value={form.participationLimit} onChange={(n) => patch({ participationLimit: n })} min={1} disabled={readOnly} suffix="kez" />
                </Field>
              )}
            </div>

            <Field label="İptal Süresi" hint="Katılımcı, etkinlik başlangıcından en geç bu kadar saat önce onaylı/beklemede başvurusunu iptal edebilir. 0 = etkinlik başlayana kadar iptal edilebilir.">
              <NumberInput value={form.access.cancellationDeadlineHours ?? 72} onChange={(n) => patchAccess({ cancellationDeadlineHours: n })} disabled={readOnly} suffix="saat" />
            </Field>

            <div className="space-y-2 rounded-card border border-border bg-surface-1 p-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Başvuru Başlangıcı"
                  required={registrationRequired}
                  hint={registrationRequired ? 'Kayıt zorunlu — başvuruların açılacağı tarih' : 'Boş ise başvurular her zaman açık kabul edilir'}
                >
                  <DatePicker value={form.applicationStartDate} onChange={(v) => patch({ applicationStartDate: v })} max={form.endDate || form.startDate || undefined} disabled={readOnly} clearable={!registrationRequired} />
                </Field>
                <Field
                  label="Başvuru Bitişi"
                  required={registrationRequired}
                  hint={registrationRequired ? 'Kayıt zorunlu — başvuruların kapanacağı tarih' : 'Boş ise başvurular süresiz açık kalır'}
                >
                  <DatePicker value={form.applicationEndDate} onChange={(v) => patch({ applicationEndDate: v })} min={form.applicationStartDate || undefined} max={applicationEndMax(form.endDate || form.startDate, form.applicationStartDate)} disabled={readOnly} clearable={!registrationRequired} />
                </Field>
              </div>
              <p className="type-caption text-foreground-muted">
                Nasıl çalışır: <strong>Kayıt Zorunlu</strong> etkinliklerde başvuru başlangıç ve bitiş tarihleri <strong>zorunludur</strong> — başvurular yalnızca bu tarih aralığında alınır. <strong>Onaysız Katılım</strong>'da bu alanlar boş bırakılabilir; boş bırakılırsa başvurular <strong>etkinlik başlayana kadar</strong> açık kalır. Başvuru bitişi en geç <strong>etkinlik bitiş günü</strong> olabilir.
              </p>
              {form.applicationStartDate && form.applicationEndDate && form.applicationEndDate < form.applicationStartDate && (
                <p className="flex items-center gap-1.5 type-caption text-[hsl(var(--danger))]">
                  <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" /> Başvuru bitiş tarihi, başlangıç tarihinden önce olamaz.
                </p>
              )}
              {form.applicationEndDate && form.startDate && form.applicationEndDate.slice(0, 10) > (form.endDate || form.startDate).slice(0, 10) && (
                <p className="flex items-center gap-1.5 type-caption text-[hsl(var(--danger))]">
                  <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" /> Başvuru bitişi, etkinlik bitiş tarihinden sonra olamaz.
                </p>
              )}
            </div>

            <Field label="İç Notlar" hint="Yalnızca yöneticiler görür">
              <Textarea value={form.internalNote} onChange={(e) => patch({ internalNote: e.target.value })} rows={2} disabled={readOnly} placeholder="Organizasyona dair iç notlar" />
            </Field>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <ImageIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Görseller</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <div className="space-y-2">
              <p className="type-body-strong">Kapak Görselleri (orana göre)</p>
              <p className="type-caption text-foreground-muted">İhtiyaca göre bir veya birden fazla oran yükleyebilirsiniz; her alan kendi oranındaki görseli kullanır, olmayan oran için diğerlerinden en uygunu gösterilir.</p>
              <div className="grid gap-5 sm:grid-cols-2">
                {activeRatios.map((ratio) => (
                  <EventImageUploader
                    key={ratio}
                    label={ratioLabels[ratio] ?? RATIO_LABELS[ratio]}
                    value={form.images.ratios[ratio]}
                    onChange={(v) => setRatioImage(ratio, v)}
                    onUpload={onUpload}
                    readOnly={readOnly}
                    cropEnabled={imageSettings.cropEnabled}
                    autoCompress={imageSettings.autoCompress}
                  />
                ))}
              </div>
            </div>

            {LEGACY_EVENT_IMAGE_RATIOS.some((r) => form.images.ratios[r]?.url) && (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="type-body-strong">Eski Oran Görselleri</p>
                <p className="type-caption text-foreground-muted">
                  Bu oran artık yeni etkinliklerde kullanılmıyor. Mevcut görsel korunuyor; kaldırmak isterseniz aşağıdan silebilirsiniz.
                </p>
                <div className="grid gap-5 sm:grid-cols-2">
                  {LEGACY_EVENT_IMAGE_RATIOS.filter((r) => form.images.ratios[r]?.url).map((ratio) => (
                    <EventImageUploader
                      key={ratio}
                      label={ratioLabels[ratio] ?? RATIO_LABELS[ratio]}
                      value={form.images.ratios[ratio]}
                      onChange={(v) => setRatioImage(ratio, v)}
                      onUpload={onUpload}
                      readOnly={readOnly}
                      cropEnabled={imageSettings.cropEnabled}
                      autoCompress={imageSettings.autoCompress}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 border-t border-border pt-4">
              <p className="type-body-strong">Fotoğraf Galerisi</p>
              <ImageGallery
                value={form.images.photos ?? []}
                onChange={(imgs) => patch({ images: { ...form.images, photos: imgs } })}
                onUpload={(f) => eventService.uploadGalleryPhoto(f)}
                readOnly={readOnly}
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <FileTextIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Açıklama</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <RichTextEditor value={form.description} onChange={(html) => patch({ description: html })} readOnly={readOnly} />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <ShieldCheckIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Erişim ve Yoklama</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <ResponsiblePersonField
              label="Etkinlik Sorumlusu"
              allowCreate
              allowAccessGrant
              roleTemplate={{ name: 'Etkinlik Sorumlusu', scopeHint: 'yalnız bu etkinlik' }}
              hint="Mevcut yöneticiden seçin ya da yeni bir kişi ekleyin (opsiyonel)."
              value={toRPVResponsible(form.responsible)}
              onChange={setResponsible}
              disabled={readOnly}
              showEmergency={false}
            />

            <ToggleRow label="Seans Yapısı" description="Etkinlik birden fazla seansa bölünecek" checked={form.access.hasSessions} onChange={(v) => patchAccess({ hasSessions: v })} disabled={readOnly} />

            <ToggleRow label="Salon ve Koltuk Düzeni" description="Koltuk/sıra planı uygulanacak" checked={form.access.hasSeating} onChange={(v) => patchAccess({ hasSeating: v })} disabled={readOnly} />
            {form.access.hasSeating && (
              <Field label="Rezervasyon Türü">
                <SegmentedControl
                  value={form.access.reservationType}
                  onChange={(v) => patchAccess({ reservationType: v as EventFormData['access']['reservationType'] })}
                  disabled={readOnly}
                  columns={3}
                  options={[
                    { value: 'none', label: 'Rezervasyon Yok' },
                    { value: 'row', label: 'Sıra Rezervasyonu' },
                    { value: 'seat', label: 'Koltuk Rezervasyonu' },
                  ]}
                />
              </Field>
            )}

            <Field label="Kayıt Modu">
              <SegmentedControl
                value={form.access.registrationMode}
                onChange={(v) => patchAccess({ registrationMode: v as EventFormData['access']['registrationMode'] })}
                disabled={readOnly}
                columns={2}
                options={[
                  { value: 'required', label: 'Kayıt Zorunlu', description: 'Başvuru admin onayı bekler' },
                  { value: 'none', label: 'Onaysız Katılım', description: 'Kontenjana göre anında kabul' },
                ]}
              />
            </Field>

            <div className="space-y-3 rounded-card border border-border bg-surface-1 p-3">
              <div>
                <p className="type-body-strong">SMS Şablonları</p>
                <p className="type-caption">Değişkenler: {'{{ad}} {{soyad}} {{etkinlik}} {{tarih}} {{seans}} {{red_nedeni}}'}</p>
              </div>
              <Banner tone="info" variant="soft">Bu şablonlar genel ayarlardan gelir. Burada değiştirirseniz yalnızca bu etkinlik etkilenir; genel ayarlar değişmez.</Banner>
              {EVENT_NOTIFICATION_META.map((m) => (
                <Field key={m.event} label={m.label} hint={m.hint}>
                  <Textarea value={getTpl(m.event)} onChange={(e) => setTpl(m.event, e.target.value)} rows={2} maxLength={320} disabled={readOnly} />
                </Field>
              ))}
            </div>

            <ToggleRow label="Yoklama Alınacak" description="Kapalıyken QR/kiosk/turnike gizlenir" checked={form.access.attendanceEnabled} onChange={(v) => patchAccess({ attendanceEnabled: v })} disabled={readOnly} />

            {form.access.attendanceEnabled && (
              <div className="space-y-4 rounded-card border border-border bg-surface-1 p-3">
                <Field label="Giriş Yöntemi">
                  <SegmentedControl
                    value={form.access.entryMethod}
                    onChange={(v) => patchAccess({ entryMethod: v as EventFormData['access']['entryMethod'] })}
                    disabled={readOnly}
                    columns={2}
                    options={[
                      { value: 'checkin', label: 'Sadece Giriş', icon: LogInIcon },
                      { value: 'checkin-checkout', label: 'Giriş + Çıkış', icon: LogInIcon },
                    ]}
                  />
                </Field>

                <ToggleRow label="QR Linki Kullanılsın" description="Katılımcılar kişisel kimlik QR'ı ile giriş yapar (cihazlı turnike)" checked={form.access.qrEnabled} onChange={(v) => patchAccess({ qrEnabled: v })} disabled={readOnly} />

                <ToggleRow label="Kiosk / Ekran Var" description="Salonda QR ekranı veya görevli bilgisayarı" checked={form.access.kioskEnabled} onChange={(v) => patchAccess({ kioskEnabled: v })} disabled={readOnly} />
                <ToggleRow label="Turnike Sistemi" description="Fiziksel turnike entegrasyonu (Salon Cihazları bölümünden cihaz eklenmelidir)" checked={form.access.turnstileEnabled} onChange={(v) => patchAccess({ turnstileEnabled: v })} disabled={readOnly} />

                {eventId ? (
                  <EventStaticQrSection eventId={eventId} eventName={eventName ?? form.name} />
                ) : (
                  <Banner tone="info" variant="soft" icon={InfoIcon}>
                    Sabit (cihazsız) QR yönetimi, etkinlik kaydedildikten sonra bu ekranda görünür.
                  </Banner>
                )}

                <ToggleRow
                  label="Konum Doğrulaması"
                  description="Katılımcı sadece etkinlik alanındayken telefonundan giriş yapabilir"
                  checked={form.access.geofenceEnabled ?? false}
                  onChange={(v) => patchAccess({ geofenceEnabled: v })}
                  disabled={readOnly}
                />
                {form.access.geofenceEnabled && (
                  <Field label="İzinli Yarıçap" hint="Etkinlik konumundan bu mesafeye kadar giriş kabul edilir">
                    <NumberInput
                      value={form.access.geofenceRadiusMeters ?? 150}
                      onChange={(n) => patchAccess({ geofenceRadiusMeters: n })}
                      disabled={readOnly}
                      min={10}
                      suffix="m"
                    />
                  </Field>
                )}

                <ToggleRow label="Görevli Paylaşım Linki" description="Şifresiz link ile QR ekranı dışarıdan açılır" checked={form.access.publicLinkEnabled} onChange={(v) => patchAccess({ publicLinkEnabled: v })} disabled={readOnly} />
                {form.access.publicLinkEnabled && (
                  <ToggleRow label="Paylaşım Linki için PIN İste" description="Görevli linke girince 4 haneli PIN gerekir" checked={form.access.publicLinkRequiresPin} onChange={(v) => patchAccess({ publicLinkRequiresPin: v })} disabled={readOnly} />
                )}

                <Field label="Görevli Personel" hint="Yoklama/kiosk için atanan görevliler">
                  {!readOnly && (
                    <Combobox
                      value=""
                      onChange={(v, opt) => addStaff(v, opt?.label)}
                      onSearch={(q) => eventService.getStaffOptions(q)}
                      placeholder="Görevli ara ve ekle..."
                      clearable={false}
                      emptyText="Görevli bulunamadı"
                    />
                  )}
                  {form.access.staffIds.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {form.access.staffIds.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1 rounded-pill bg-surface-2 py-0.5 pl-2.5 pr-1 text-xs text-foreground-default">
                          {staffLabels[id] ?? 'Görevli'}
                          {!readOnly && (
                            <IconButton tone="danger" title="Kaldır" className="h-5 w-5" onClick={() => removeStaff(id)}>
                              <XIcon className="h-3 w-3" />
                            </IconButton>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </Field>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <TrophyIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Puan ve Ödüller</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <ToggleRow label="Puan Kazandırılacak" description="Kapalıyken etkinlik puan kazandırmaz" checked={form.points.enabled} onChange={togglePoints} disabled={readOnly} />

            {form.points.enabled && (
              <div className="space-y-4">
                <Field label="Katılım Başına Puan" hint="Seçili kategorinin varsayılan puanı gelir; bu etkinlik için değiştirebilirsiniz.">
                  <NumberInput value={form.points.basePoints} onChange={(n) => patchPoints({ basePoints: n })} disabled={readOnly} suffix="puan" />
                </Field>

                <ToggleRow label="Başvurusuz Katılan da Puan Kazansın" description="QR okutarak gelen misafirler de puan alır" checked={form.points.walkInEarnsPoints} onChange={(v) => patchPoints({ walkInEarnsPoints: v })} disabled={readOnly} />
              </div>
            )}
          </div>
        </div>
    </>
  )
}
