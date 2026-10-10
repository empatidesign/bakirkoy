import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import { Building2Icon, ImageIcon, ShareIcon, TagsIcon } from 'lucide-react'
import {
  Field, FormSection, Input, EmailInput, PhoneInput, Textarea, Combobox,
} from '@/design-system'
import { EventImageUploader } from '@/components/specialized/EventImageUploader'
import { MapPicker } from '@/components/specialized/MapPicker'
import companyService from '@/services/company.service'
import serviceCategoryService from '@/services/serviceCategory.service'
import { COMPANY_LOGO_SPEC, COMPANY_BANNER_SPEC, COMPANY_BANNER_MOBILE_SPEC } from '@/types/company.types'
import { SERVICE_CATEGORY_PALETTE } from '@/types/serviceCategory.types'
import type { ServiceCategoryRef } from '@/types/serviceCategory.types'
import type { CompanyForm } from './companyForm'

type SetForm = Dispatch<SetStateAction<CompanyForm>>

interface Props {
  form: CompanyForm
  setForm: SetForm
}

export const CompanyFormSections = ({ form, setForm }: Props) => {
  const [categoryOptions, setCategoryOptions] = useState<ServiceCategoryRef[]>([])

  useEffect(() => {
    let active = true
    serviceCategoryService.getOptions()
      .then((o) => { if (active) setCategoryOptions(o) })
      .catch(() => { if (active) setCategoryOptions([]) })
    return () => { active = false }
  }, [])

  const createCategory = async (name: string): Promise<ServiceCategoryRef> => {
    const color = SERVICE_CATEGORY_PALETTE[categoryOptions.length % SERVICE_CATEGORY_PALETTE.length]
    const created = await serviceCategoryService.create({ name, description: '', color })
    const ref: ServiceCategoryRef = { id: created.id, name: created.name, color: created.color }
    setCategoryOptions((p) => [...p, ref])
    return ref
  }

  return (
  <div className="space-y-[15px]">
    <FormSection title="Temel Bilgiler" icon={Building2Icon} variant="card">
      <div className="space-y-[15px]">
        <Field label="Firma Adı" required>
          <Input
            placeholder="Firma adını giriniz"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-[15px]">
          <Field label="Vergi Numarası" required hint="10 haneli vergi numarası">
            <Input
              sanitize="digits"
              inputMode="numeric"
              maxLength={10}
              placeholder="0000000000"
              value={form.taxNumber}
              onChange={(e) => setForm((p) => ({ ...p, taxNumber: e.target.value }))}
            />
          </Field>
          <Field label="İlçe">
            <Input
              value={form.district}
              onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-[15px]">
          <Field label="Telefon" required>
            <PhoneInput value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />
          </Field>
          <Field label="E-posta (opsiyonel)">
            <EmailInput value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </Field>
        </div>

        <Field label="Adres" required>
          <Textarea
            rows={2}
            placeholder="Firma açık adresi"
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          />
        </Field>

        <Field label="Harita Konumu" hint="Adres arayıp haritadan seçin veya koordinatları elle girin. Seçilen nokta vatandaş portalındaki firma haritasında gösterilir.">
          <MapPicker
            value={{ latitude: form.latitude, longitude: form.longitude }}
            onChange={(c) => setForm((p) => ({ ...p, latitude: c.latitude, longitude: c.longitude }))}
            onAddressPick={(address) => setForm((p) => ({ ...p, address }))}
            height={280}
          />
        </Field>
      </div>
    </FormSection>

    <FormSection title="Görsel ve Profil" icon={ImageIcon} variant="card">
      <div className="space-y-[15px]">
        <div className="grid grid-cols-2 gap-[15px]">
          <EventImageUploader
            label="Firma Logosu"
            value={{ ...COMPANY_LOGO_SPEC, url: form.logo || undefined }}
            onChange={(v) => setForm((p) => ({ ...p, logo: v.url ?? '' }))}
            onUpload={(file) => companyService.uploadImage(file)}
          />
          <EventImageUploader
            label="Banner Görseli (Web)"
            value={{ ...COMPANY_BANNER_SPEC, url: form.bannerImage || undefined }}
            onChange={(v) => setForm((p) => ({ ...p, bannerImage: v.url ?? '' }))}
            onUpload={(file) => companyService.uploadImage(file)}
          />
        </div>

        <EventImageUploader
          label="Banner Görseli (Mobil)"
          value={{ ...COMPANY_BANNER_MOBILE_SPEC, url: form.bannerImageMobile || undefined }}
          onChange={(v) => setForm((p) => ({ ...p, bannerImageMobile: v.url ?? '' }))}
          onUpload={(file) => companyService.uploadImage(file)}
        />

        <Field label="Web Sitesi">
          <Input
            placeholder="https://"
            value={form.website}
            onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
          />
        </Field>


        <Field label="Açıklama">
          <Textarea
            rows={3}
            placeholder="Firma hakkında kısa bilgi"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </Field>
      </div>
    </FormSection>

    <FormSection title="Sosyal Medya" icon={ShareIcon} variant="card">
      <div className="grid grid-cols-2 gap-[15px]">
        <Field label="Facebook">
          <Input placeholder="https://facebook.com/..." value={form.facebook} onChange={(e) => setForm((p) => ({ ...p, facebook: e.target.value }))} />
        </Field>
        <Field label="Instagram">
          <Input placeholder="https://instagram.com/..." value={form.instagram} onChange={(e) => setForm((p) => ({ ...p, instagram: e.target.value }))} />
        </Field>
        <Field label="Twitter / X">
          <Input placeholder="https://x.com/..." value={form.twitter} onChange={(e) => setForm((p) => ({ ...p, twitter: e.target.value }))} />
        </Field>
        <Field label="LinkedIn">
          <Input placeholder="https://linkedin.com/..." value={form.linkedin} onChange={(e) => setForm((p) => ({ ...p, linkedin: e.target.value }))} />
        </Field>
      </div>
    </FormSection>

    <FormSection title="Hizmet Kategorisi" icon={TagsIcon} variant="card">
      <Field label="Hizmet Kategorisi" required hint="Tek kategori seçin (arayarak). Kampanyalar bu kategoride gösterilir.">
        <Combobox
          value={form.serviceCategoryId}
          displayValue={categoryOptions.find((c) => c.id === form.serviceCategoryId)?.name}
          options={categoryOptions.map((c) => ({ value: c.id, label: c.name }))}
          allowCustom
          clearable
          placeholder="Kategori ara veya yeni ekle…"
          emptyText="Kategori bulunamadı"
          onChange={async (value, option) => {
            if (option || categoryOptions.some((c) => c.id === value)) {
              setForm((p) => ({ ...p, serviceCategoryId: value }))
            } else if (value.trim()) {
              const ref = await createCategory(value.trim())
              setForm((p) => ({ ...p, serviceCategoryId: ref.id }))
            } else {
              setForm((p) => ({ ...p, serviceCategoryId: '' }))
            }
          }}
        />
      </Field>
    </FormSection>
  </div>
  )
}
