import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import {
  InfoIcon, MapPinIcon, LayersIcon, ImagesIcon, SlidersHorizontalIcon, Loader2Icon, LinkIcon,
} from 'lucide-react'
import {
  Tabs, Input, Textarea, Select, ToggleChip, Combobox, TimePicker,
  Field, FormSection, CheckboxRow,
} from '@/design-system'
import { MapPicker } from '@/components/specialized/MapPicker'
import { ImageGallery } from '@/components/specialized/ImageGallery'
import { ResponsiblePersonField } from '@/components/specialized/ResponsiblePersonField'
import { RichTextEditor } from '@/components/specialized/RichTextEditor'
import serviceFacilityService from '@/services/serviceFacility.service'
import type { FacilityServiceCatalogItem, ServiceModule, ServiceOffering } from '@/types/serviceFacility.types'
import {
  FACILITY_TYPE_OPTIONS, LOCATION_TYPE_OPTIONS, OUTDOOR_CATEGORY_OPTIONS, PARKING_TYPE_OPTIONS,
  FACILITY_FEATURE_OPTIONS, ACCESSIBILITY_OPTIONS, SERVICE_MODULE_LABELS, SERVICE_MODULE_COLOR,
} from '@/types/serviceFacility.types'
import { provinceOptions, districtOptions } from '@/lib/turkeyLocations'
import { ModuleAssignmentTab } from './ModuleAssignmentTab'
import { FACILITY_MODULES } from '@/templates/FacilityTemplate/moduleConfig'
import type { FacilityForm } from './facilityForm'

type SetForm = Dispatch<SetStateAction<FacilityForm>>
interface TabProps { form: FacilityForm; setForm: SetForm }

const BASE_TAB_LIST = [
  { key: 'basic', label: 'Temel', icon: InfoIcon },
  { key: 'location', label: 'Konum', icon: MapPinIcon },
  { key: 'services', label: 'Hizmetler', icon: LayersIcon },
  { key: 'gallery', label: 'Galeri', icon: ImagesIcon },
  { key: 'features', label: 'Özellikler', icon: SlidersHorizontalIcon },
]

const featureColors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2']

const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

const BasicTab = ({ form, setForm }: TabProps) => (
  <div className="space-y-[15px]">
    <FormSection title="Temel Bilgiler" icon={InfoIcon} variant="card">
      <Field label="Tesis Adı" required>
        <Input placeholder="Örn. Ataköy Spor Kompleksi" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
      </Field>

      <div className="grid grid-cols-2 gap-[15px]">
        <Field label="Tür" required>
          <Select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
            <option value="">Seçiniz...</option>
            {FACILITY_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Konum Tipi" required>
          <div className="flex gap-2 pt-0.5">
            {LOCATION_TYPE_OPTIONS.map((o) => (
              <ToggleChip key={o.value} active={form.locationType === o.value} onClick={() => setForm((p) => ({ ...p, locationType: o.value }))}>{o.label}</ToggleChip>
            ))}
          </div>
        </Field>
      </div>

      {form.locationType === 'Outdoor' && (
        <div className="grid grid-cols-2 gap-[15px]">
          <Field label="Açık Alan Kategorisi">
            <Select value={form.outdoorCategory} onChange={(e) => setForm((p) => ({ ...p, outdoorCategory: e.target.value as FacilityForm['outdoorCategory'] }))}>
              <option value="">Seçiniz...</option>
              {OUTDOOR_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Toplam Alan (m²)">
            <Input sanitize="digits" inputMode="numeric" placeholder="Örn. 12000" value={form.areaSizeM2} onChange={(e) => setForm((p) => ({ ...p, areaSizeM2: e.target.value }))} />
          </Field>
        </div>
      )}

      <Field
        label="Tesis Açıklaması"
        hint={form.description.length > 500 ? undefined : `Önerilen: 500 karaktere kadar (biçimlendirme etiketleri dahil) — ${form.description.length}/500`}
        error={form.description.length > 500 ? `500 karakter sınırı aşıldı (${form.description.length}/500) — kaydetmeden önce kısaltın.` : undefined}
      >
        <RichTextEditor
          value={form.description}
          onChange={(html) => setForm((p) => ({ ...p, description: html }))}
          placeholder="Tesisin kısa tanımı (liste/kartlarda görünür)"
        />
      </Field>
    </FormSection>

    <FormSection title="Yönetici & İletişim" icon={SlidersHorizontalIcon} variant="card">
      <ResponsiblePersonField
        value={form}
        onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
        allowCreate
        allowAccessGrant
        requireTckn={false}
        roleTemplate={{ name: 'Tesis Sorumlusu', scopeHint: 'yalnız bu hizmet tesisi ve alt birimleri' }}
      />
    </FormSection>

    <FormSection title="Çalışma Saatleri" icon={LayersIcon} variant="card">
      <div className="grid grid-cols-2 gap-[15px]">
        <Field label="Hafta İçi Açılış"><TimePicker value={form.weekdayOpen} onChange={(v) => setForm((p) => ({ ...p, weekdayOpen: v }))} /></Field>
        <Field label="Hafta İçi Kapanış"><TimePicker value={form.weekdayClose} onChange={(v) => setForm((p) => ({ ...p, weekdayClose: v }))} /></Field>
        <Field label="Hafta Sonu Açılış"><TimePicker value={form.weekendOpen} onChange={(v) => setForm((p) => ({ ...p, weekendOpen: v }))} /></Field>
        <Field label="Hafta Sonu Kapanış"><TimePicker value={form.weekendClose} onChange={(v) => setForm((p) => ({ ...p, weekendClose: v }))} /></Field>
      </div>
    </FormSection>
  </div>
)

const LocationTab = ({ form, setForm }: TabProps) => (
  <div className="space-y-[15px]">
    <FormSection title="Adres" icon={MapPinIcon} variant="card">
      <div className="grid grid-cols-2 gap-[15px]">
        <Field label="İl" required>
          <Combobox
            value={form.city}
            options={provinceOptions()}
            onChange={(v) => setForm((p) => ({ ...p, city: v, district: '' }))}
            allowCustom
            placeholder="İl seçin..."
          />
        </Field>
        <Field label="İlçe">
          <Combobox
            value={form.district}
            options={districtOptions(form.city)}
            onChange={(v) => setForm((p) => ({ ...p, district: v }))}
            allowCustom
            placeholder="İlçe seçin..."
            emptyText="Bu il için ilçe listesi yok — yazıp ekleyin"
          />
        </Field>
      </div>
      <Field label="Açık Adres" required>
        <Textarea rows={2} placeholder="Mahalle, cadde, no..." value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
      </Field>
    </FormSection>

    <FormSection title="Konum Seçimi" icon={MapPinIcon} subtitle="Adres arayıp sonuçtan seçin ya da koordinatları elle girin." variant="card">
      <MapPicker
        value={{ latitude: form.latitude, longitude: form.longitude }}
        onChange={(c) => setForm((p) => ({ ...p, latitude: c.latitude, longitude: c.longitude }))}
        onAddressPick={(address) => setForm((p) => ({ ...p, address }))}
        height={320}
      />
    </FormSection>
  </div>
)

const ServicesTab = ({ form, setForm }: TabProps) => {
  const [catalog, setCatalog] = useState<FacilityServiceCatalogItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const data = await serviceFacilityService.getServiceCatalog()
        if (active) setCatalog(data)
      } catch {
        if (active) setCatalog([])
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const isSelected = (catalogId: string) => form.offeredServices.some((s) => s.catalogId === catalogId)

  const toggleService = (item: FacilityServiceCatalogItem) => {
    setForm((p) => {
      const exists = p.offeredServices.some((s) => s.catalogId === item.id)
      const offeredServices = exists
        ? p.offeredServices.filter((s) => s.catalogId !== item.id)
        : [...p.offeredServices, { id: item.id, catalogId: item.id, name: item.name, module: item.module, active: true } as ServiceOffering]
      return { ...p, offeredServices }
    })
  }

  const modules = Array.from(new Set(catalog.map((c) => c.module))) as ServiceModule[]

  if (loading) {
    return <div className="flex items-center gap-2 py-8 type-muted"><Loader2Icon className="h-4 w-4 animate-spin" /> Hizmet kataloğu yükleniyor...</div>
  }

  return (
    <div className="space-y-[15px]">
      <FormSection title="Hizmet Kataloğu" icon={LayersIcon} subtitle="Bu tesiste sunulan hizmetleri seçin." variant="card">
        {modules.length === 0 && <p className="type-caption">Hizmet kataloğu bulunamadı.</p>}
        {modules.map((mod) => (
          <div key={mod} className="space-y-2">
            <p className="flex items-center gap-1.5 type-label font-semibold text-foreground-strong">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: SERVICE_MODULE_COLOR[mod] }} />
              {SERVICE_MODULE_LABELS[mod]}
            </p>
            <div className="flex flex-wrap gap-2">
              {catalog.filter((c) => c.module === mod).map((item) => (
                <ToggleChip key={item.id} active={isSelected(item.id)} color={SERVICE_MODULE_COLOR[item.module]} onClick={() => toggleService(item)}>{item.name}</ToggleChip>
              ))}
            </div>
          </div>
        ))}
      </FormSection>
    </div>
  )
}

const GalleryTab = ({ form, setForm }: TabProps) => (
  <div className="space-y-[15px]">
    <FormSection title="Fotoğraf Galerisi" icon={ImagesIcon} subtitle="Yıldız ile ana fotoğrafı seçin; sürükleyerek sıralayın." variant="card">
      <ImageGallery
        value={form.images}
        onChange={(images) => setForm((p) => ({ ...p, images }))}
        onUpload={(file) => serviceFacilityService.uploadImage(file)}
      />
    </FormSection>
  </div>
)

const FeaturesTab = ({ form, setForm }: TabProps) => (
  <div className="space-y-[15px]">
    <FormSection title="Tesis İmkanları" variant="card">
      <div className="flex flex-wrap gap-2">
        {FACILITY_FEATURE_OPTIONS.map((f) => (
          <ToggleChip
            key={f}
            active={form.facilities.includes(f)}
            color={featureColors[f.length % featureColors.length]}
            onClick={() => setForm((p) => ({ ...p, facilities: toggleIn(p.facilities, f) }))}
          >
            {f}
          </ToggleChip>
        ))}
      </div>
    </FormSection>

    <FormSection title="Erişilebilirlik" variant="card">
      <div className="flex flex-wrap gap-2">
        {ACCESSIBILITY_OPTIONS.map((f) => (
          <ToggleChip
            key={f}
            active={form.accessibilityFeatures.includes(f)}
            color="#059669"
            onClick={() => setForm((p) => ({ ...p, accessibilityFeatures: toggleIn(p.accessibilityFeatures, f) }))}
          >
            {f}
          </ToggleChip>
        ))}
      </div>
    </FormSection>

    <FormSection title="Kapasite & Otopark" variant="card">
      <Field label="Toplam Kapasite (kişi)">
        <Input sanitize="digits" inputMode="numeric" placeholder="Örn. 500" value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))} />
      </Field>
      <Field label="Otopark">
        <div className="flex gap-2">
          <ToggleChip active={form.hasParking} color="#059669" onClick={() => setForm((p) => ({ ...p, hasParking: true }))}>Var</ToggleChip>
          {/* Otopark yok seçilince kapasite/tür alanları gizlenir ve kayıtta sıfırlanır. */}
          <ToggleChip active={!form.hasParking} color="#dc2626" onClick={() => setForm((p) => ({ ...p, hasParking: false, parkingCapacity: '' }))}>Yok</ToggleChip>
        </div>
      </Field>
      {form.hasParking && (
        <div className="grid grid-cols-2 gap-[15px]">
          <Field label="Otopark Kapasitesi">
            <Input sanitize="digits" inputMode="numeric" placeholder="Örn. 80" value={form.parkingCapacity} onChange={(e) => setForm((p) => ({ ...p, parkingCapacity: e.target.value }))} />
          </Field>
          <Field label="Otopark Türü">
            <Select value={form.parkingType} onChange={(e) => setForm((p) => ({ ...p, parkingType: e.target.value as FacilityForm['parkingType'] }))}>
              {PARKING_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        </div>
      )}
    </FormSection>
  </div>
)

const ModuleSelectTab = ({ form, setForm }: TabProps) => {
  const toggle = (module: string) => setForm((p) => ({
    ...p,
    modules: p.modules.includes(module) ? p.modules.filter((m) => m !== module) : [...p.modules, module],
  }))
  return (
    <FormSection title="Modül Ataması" icon={LayersIcon} variant="card">
      <div className="space-y-2">
        {Object.values(FACILITY_MODULES).map((c) => (
          <CheckboxRow
            key={c.routeId}
            label={c.pageTitle}
            description={`Seçilirse "${c.terminology.facilitySingular}" olarak eklenecek.`}
            checked={form.modules.includes(c.routeId)}
            onChange={() => toggle(c.routeId)}
          />
        ))}
      </div>
      <p className="type-caption">Tesis kaydedildiğinde seçilen modüllerde otomatik oluşturulur.</p>
    </FormSection>
  )
}

export const FacilityFormTabs = ({ form, setForm, editingId }: TabProps & { editingId?: string | null }) => {
  const [tab, setTab] = useState('basic')
  const tabs = [...BASE_TAB_LIST, { key: 'assignment', label: 'Atama', icon: LinkIcon }]
  return (
    <div className="space-y-[15px]">
      <Tabs tabs={tabs} value={tab} onValueChange={setTab} />
      {tab === 'basic' && <BasicTab form={form} setForm={setForm} />}
      {tab === 'location' && <LocationTab form={form} setForm={setForm} />}
      {tab === 'services' && <ServicesTab form={form} setForm={setForm} />}
      {tab === 'gallery' && <GalleryTab form={form} setForm={setForm} />}
      {tab === 'features' && <FeaturesTab form={form} setForm={setForm} />}
      {tab === 'assignment' && (editingId ? <ModuleAssignmentTab serviceFacilityId={editingId} /> : <ModuleSelectTab form={form} setForm={setForm} />)}
    </div>
  )
}
