import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import {
  MapPinIcon, ImageIcon, FileTextIcon, ShieldCheckIcon, AwardIcon, UsersIcon,
} from 'lucide-react'
import { Input, Combobox, Select, SegmentedControl, Field, ToggleRow, NumberInput, type ComboOption } from '@/design-system'
import { RichTextEditor } from '@/components/specialized/RichTextEditor'
import { EventImageUploader } from '@/components/specialized/EventImageUploader'
import { ImageGallery } from '@/components/specialized/ImageGallery'
import { MapPicker } from '@/components/specialized/MapPicker'
import { FULL_RESIDENCY_MODE_OPTIONS, type FullResidencyMode } from '@/lib/residency'
import travelCategoryService from '@/services/travelCategory.service'
import travelService from '@/services/travel.service'
import type { TravelRouteFormData } from '@/types/travel.types'
import type { EventImageVariant } from '@/types/event.types'
import type { SelectOption } from '@/types/common'
import { GENDER_OPTIONS } from './travelFormDefaults'

interface Props {
  form: TravelRouteFormData
  setForm: Dispatch<SetStateAction<TravelRouteFormData>>
  readOnly?: boolean
}

/**
 * "Gezi" (rota/lokasyon) formu — ör. Çanakkale. İçerik alanlarını (isim, hedef,
 * açıklama, kural, görsel, fiyat, yaş/cinsiyet kısıtı) düzenler. Bu alanlar sefer
 * bazında override edilmez; her Sefer bunları aynen miras alır.
 */
export const RouteForm = ({ form, setForm, readOnly }: Props) => {
  const [categories, setCategories] = useState<(SelectOption & { color?: string })[]>([])
  const categoryOptions: ComboOption[] = categories.map((c) => ({ value: c.value, label: c.label }))

  useEffect(() => {
    travelCategoryService.getOptions().then(setCategories).catch(() => setCategories([]))
  }, [])

  const patch = (p: Partial<TravelRouteFormData>) => setForm((f) => ({ ...f, ...p }))
  const patchRestrictions = (p: Partial<TravelRouteFormData['restrictions']>) =>
    setForm((f) => ({ ...f, restrictions: { ...f.restrictions, ...p } }))
  const setImage = (group: 'web' | 'mobile', slot: 'cover' | 'card' | 'thumb', v: EventImageVariant) =>
    setForm((f) => ({ ...f, images: { ...f.images, [group]: { ...f.images[group], [slot]: v } } }))

  const upload = (file: File) => travelService.uploadImage(file)

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4 bg-surface-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <MapPinIcon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground-strong">Temel Bilgiler</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <Field label="Gezi Kategorisi" required>
            <Combobox
              value={form.categoryId}
              displayValue={categories.find((c) => c.value === form.categoryId)?.label ?? ''}
              onChange={(v) => patch({ categoryId: v })}
              options={categoryOptions}
              searchInList
              searchPlaceholder="Kategori ara..."
              placeholder="Kategori seçin"
              emptyText="Eşleşen kategori bulunamadı"
              disabled={readOnly}
            />
          </Field>

          <div className="grid gap-[15px] sm:grid-cols-2">
            <Field label="Gezi Adı" required>
              <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Örn: Çanakkale" disabled={readOnly} />
            </Field>
            <Field label="Hedef / Destinasyon" required>
              <Input value={form.destination} onChange={(e) => patch({ destination: e.target.value })} placeholder="Örn: Çanakkale" disabled={readOnly} />
            </Field>
          </div>

          <Field label="Kalkış Noktası" hint="Yolcuların bineceği buluşma noktası — mesaj şablonlarında {{kalkis_noktasi}} olarak kullanılır.">
            <Input value={form.departurePoint ?? ''} onChange={(e) => patch({ departurePoint: e.target.value })} placeholder="Örn: Bakırköy Belediyesi önü" disabled={readOnly} />
          </Field>

          <Field label="Harita Konumu" hint="Adres arayıp sonuçtan seçin ya da koordinatları elle girin.">
            <MapPicker
              value={{ latitude: form.latitude, longitude: form.longitude }}
              onChange={(c) => patch({ latitude: c.latitude, longitude: c.longitude })}
              readOnly={readOnly}
              height={280}
            />
          </Field>

          <Field label="Cinsiyet">
            <SegmentedControl
              value={form.gender}
              onChange={(v) => patch({ gender: v as TravelRouteFormData['gender'] })}
              columns={3}
              disabled={readOnly}
              options={GENDER_OPTIONS}
            />
          </Field>

          <div className="grid gap-[15px] sm:grid-cols-2">
            <Field label="Minimum Yaş">
              <NumberInput value={form.minAge} onChange={(n) => patch({ minAge: n })} min={0} max={120} placeholder="0" disabled={readOnly} />
            </Field>
            <Field label="Maksimum Yaş">
              <NumberInput value={form.maxAge} onChange={(n) => patch({ maxAge: n })} min={0} max={120} placeholder="0" disabled={readOnly} />
            </Field>
          </div>
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
          <div className="grid gap-[15px] sm:grid-cols-2">
            <div className="space-y-3">
              <p className="type-label">Web</p>
              <EventImageUploader label="Kapak" value={form.images.web.cover} onChange={(v) => setImage('web', 'cover', v)} onUpload={upload} readOnly={readOnly} />
              <EventImageUploader label="Kart" value={form.images.web.card} onChange={(v) => setImage('web', 'card', v)} onUpload={upload} readOnly={readOnly} />
              <EventImageUploader label="Küçük" value={form.images.web.thumb} onChange={(v) => setImage('web', 'thumb', v)} onUpload={upload} readOnly={readOnly} />
            </div>
            <div className="space-y-3">
              <p className="type-label">Mobil</p>
              <EventImageUploader label="Kapak" value={form.images.mobile.cover} onChange={(v) => setImage('mobile', 'cover', v)} onUpload={upload} readOnly={readOnly} />
              <EventImageUploader label="Kart" value={form.images.mobile.card} onChange={(v) => setImage('mobile', 'card', v)} onUpload={upload} readOnly={readOnly} />
              <EventImageUploader label="Küçük" value={form.images.mobile.thumb} onChange={(v) => setImage('mobile', 'thumb', v)} onUpload={upload} readOnly={readOnly} />
            </div>
          </div>
          <div className="space-y-2 border-t border-border pt-4">
            <p className="type-body-strong">Fotoğraf Galerisi</p>
            <ImageGallery
              value={form.images.photos ?? []}
              onChange={(imgs) => patch({ images: { ...form.images, photos: imgs } })}
              onUpload={(f) => travelService.uploadGalleryPhoto(f)}
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
          <RichTextEditor value={form.description} onChange={(html) => patch({ description: html })} placeholder="Gezi hakkında detaylı açıklama..." readOnly={readOnly} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4 bg-surface-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheckIcon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground-strong">Koşullar ve Kısıtlamalar</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <Field label="Koşullar / Program">
            <RichTextEditor value={form.conditions} onChange={(html) => patch({ conditions: html })} placeholder="Gezi koşulları, program detayları ve önemli bilgiler..." readOnly={readOnly} />
          </Field>

          <Field label="Katılım Bölgesi (İkamet / Uyruk)" hint="Bu geziye kimlerin başvurabileceğini ikamet adresine (NVI/KPS) ve uyruğa (T.C./yabancı) göre belirler">
            <Select
              value={form.restrictions.residencyMode}
              onChange={(e) => patchRestrictions({
                residencyMode: e.target.value as FullResidencyMode,
                sultangaziResidentOnly: e.target.value === 'sultangazi_only',
                allowOutsideSultangazi: e.target.value === 'anyone' || e.target.value === 'outside_only',
              })}
              disabled={readOnly}
            >
              {FULL_RESIDENCY_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>

          <div className="space-y-2">
            <ToggleRow label="Veli onayı gerekli" description="18 yaş altı için veli onayı zorunlu" checked={form.restrictions.requiresGuardianConsent} onChange={(v) => patchRestrictions({ requiresGuardianConsent: v })} disabled={readOnly} />
            <ToggleRow label="Evrak gerekli" description="Başvuruda belge yüklenmesi zorunlu" checked={form.restrictions.documentRequired} onChange={(v) => patchRestrictions({ documentRequired: v })} disabled={readOnly} />
          </div>

          <Field label="Maksimum Misafir" hint="Bir katılımcının yanında getirebileceği misafir sayısı">
            <NumberInput value={form.restrictions.maxCompanions} onChange={(n) => patchRestrictions({ maxCompanions: n })} min={0} max={10} placeholder="0" disabled={readOnly} />
          </Field>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4 bg-surface-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <UsersIcon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground-strong">Çocuk Katılımı</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <ToggleRow
            label="Çocuk getirilebilir"
            description="Açıksa katılımcılar NVI kütüğünden çocuklarını bu geziye ekleyebilir (Maksimum Misafir ayarından bağımsızdır)"
            checked={form.restrictions.allowChildren}
            onChange={(v) => patchRestrictions({ allowChildren: v })}
            disabled={readOnly}
          />
          {form.restrictions.allowChildren && (
            <>
              <Field label="Maksimum Çocuk Sayısı" hint="Bir velinin bu geziye getirebileceği toplam çocuk sayısı (ayrı ayrı başvurular dahil)">
                <NumberInput value={form.restrictions.maxChildren} onChange={(n) => patchRestrictions({ maxChildren: n })} min={1} max={10} placeholder="1" disabled={readOnly} />
              </Field>
              <div className="grid gap-[15px] sm:grid-cols-2">
                <Field label="Çocuk Min. Yaş">
                  <NumberInput value={form.restrictions.childMinAge} onChange={(n) => patchRestrictions({ childMinAge: n })} min={0} max={17} placeholder="0" disabled={readOnly} />
                </Field>
                <Field label="Çocuk Maks. Yaş">
                  <NumberInput value={form.restrictions.childMaxAge} onChange={(n) => patchRestrictions({ childMaxAge: n })} min={0} max={17} placeholder="17" disabled={readOnly} />
                </Field>
              </div>
              <Field label="Çocuk Cinsiyeti" hint="Bu geziye katılabilecek çocuğun cinsiyet şartı">
                <SegmentedControl
                  value={form.restrictions.childGenderMode}
                  onChange={(v) => patchRestrictions({ childGenderMode: v as TravelRouteFormData['restrictions']['childGenderMode'] })}
                  columns={3}
                  disabled={readOnly}
                  options={GENDER_OPTIONS}
                />
              </Field>
            </>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4 bg-surface-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <AwardIcon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground-strong">Puan</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <ToggleRow label="Puan Ver" description="Geziye katılana puan kazandır" checked={form.points.enabled} onChange={(v) => patch({ points: { ...form.points, enabled: v } })} disabled={readOnly} />
          {form.points.enabled && (
            <Field label="Katılım Puanı">
              <NumberInput value={form.points.basePoints} onChange={(n) => patch({ points: { ...form.points, basePoints: n } })} min={0} placeholder="0" disabled={readOnly} />
            </Field>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4 bg-surface-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <UsersIcon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground-strong">Durum</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <ToggleRow label="Aktif" description="Pasif geziler yeni sefer eklenirken listede görünmez" checked={form.isActive} onChange={(v) => patch({ isActive: v })} disabled={readOnly} />
        </div>
      </div>
    </>
  )
}
