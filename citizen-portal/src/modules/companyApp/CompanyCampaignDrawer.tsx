import { useEffect, useRef, useState } from 'react'
import { ImageIcon, Loader2Icon, XIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Drawer, Button, Field, Input, SegmentedControl, NumberInput, DatePicker, Textarea, Switch, LockedField, Select } from '@/design-system'
import { ImageCropModal } from '@/components/specialized/ImageCropModal'
import { todayIso } from '@/lib/utils'
import companyMeService from '@/services/companyMe.service'
import type { Campaign, DiscountType, CampaignCategory, CampaignProduct } from '@/types/companyCampaign.types'
import { CAMPAIGN_CATEGORY_OPTIONS } from '@/types/companyCampaign.types'

type ProductDraft = { id?: string; name: string; imageUrl: string | null; price: number | null }
type CropTarget = { kind: 'main' } | { kind: 'product'; index: number }

interface CompanyCampaignDrawerProps {
  open: boolean
  onClose: () => void
  campaign?: Campaign | null
  onSaved: () => void
}

const today = (): string => todayIso()
const toDateInput = (iso: string): string => (iso ? iso.slice(0, 10) : '')

export const CompanyCampaignDrawer = ({ open, onClose, campaign, onSaved }: CompanyCampaignDrawerProps) => {
  const isEdit = !!campaign

  const [name, setName] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('percentage')
  const [discountValue, setDiscountValue] = useState(0)
  const [perUserLimit, setPerUserLimit] = useState(1)
  const [unlimited, setUnlimited] = useState(true)
  const [totalUsageLimit, setTotalUsageLimit] = useState(1)
  const [minOrderAmount, setMinOrderAmount] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [category, setCategory] = useState<CampaignCategory>('Discount')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [products, setProducts] = useState<ProductDraft[]>([])
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState('')
  const [kvkkText, setKvkkText] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingProductIndex, setUploadingProductIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropTarget, setCropTarget] = useState<CropTarget>({ kind: 'main' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const productFileInputRef = useRef<HTMLInputElement>(null)
  const pendingProductIndex = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    if (campaign) {
      setName(campaign.name)
      setDiscountType(campaign.discountType)
      setDiscountValue(campaign.discountValue)
      setPerUserLimit(campaign.perUserLimit)
      setUnlimited(campaign.totalUsageLimit == null)
      setTotalUsageLimit(campaign.totalUsageLimit ?? 1)
      setMinOrderAmount(campaign.minOrderAmount ?? 0)
      setStartDate(toDateInput(campaign.startDate))
      setEndDate(toDateInput(campaign.endDate))
      setCategory(campaign.category ?? 'Discount')
      setImageUrl(campaign.imageUrl ?? null)
      setProducts(
        (campaign.products ?? [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl ?? null, price: p.price ?? null })),
      )
      setDescription(campaign.description ?? '')
      setRules(campaign.rules ?? '')
      setKvkkText(campaign.kvkkText ?? '')
    } else {
      setName('')
      setDiscountType('percentage')
      setDiscountValue(0)
      setPerUserLimit(1)
      setUnlimited(true)
      setTotalUsageLimit(1)
      setMinOrderAmount(0)
      setStartDate('')
      setEndDate('')
      setCategory('Discount')
      setImageUrl(null)
      setProducts([])
      setDescription('')
      setRules('')
      setKvkkText('')
    }
  }, [open, campaign])

  const openCrop = (target: CropTarget, file: File) => {
    setCropTarget(target)
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleCropped = async (blob: Blob) => {
    const target = cropTarget
    setCropSrc(null)
    const file = new File([blob], 'kampanya-gorseli.jpg', { type: 'image/jpeg' })
    if (target.kind === 'main') {
      setUploadingImage(true)
      try {
        const url = await companyMeService.uploadImage(file)
        setImageUrl(url)
      } catch {
        void 0
      } finally {
        setUploadingImage(false)
      }
    } else {
      setUploadingProductIndex(target.index)
      try {
        const url = await companyMeService.uploadImage(file)
        setProducts((prev) => prev.map((p, i) => (i === target.index ? { ...p, imageUrl: url } : p)))
      } catch {
        void 0
      } finally {
        setUploadingProductIndex(null)
      }
    }
  }

  const addProduct = () => setProducts((prev) => [...prev, { name: '', imageUrl: null, price: null }])
  const removeProduct = (index: number) => setProducts((prev) => prev.filter((_, i) => i !== index))
  const updateProduct = (index: number, patch: Partial<ProductDraft>) =>
    setProducts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))

  const startMin = isEdit ? undefined : today()
  const percentTooHigh = discountType === 'percentage' && discountValue > 100
  const datesValid = !!startDate && !!endDate && endDate >= startDate
  const startNotPast = isEdit || (!!startDate && startDate >= today())
  const isFormValid =
    name.trim().length > 0 &&
    discountValue > 0 &&
    !percentTooHigh &&
    perUserLimit >= 1 &&
    minOrderAmount >= 0 &&
    datesValid &&
    startNotPast

  const save = async () => {
    if (!isFormValid) return
    setSaving(true)
    try {
      const cleanProducts: CampaignProduct[] = products
        .filter((p) => p.name.trim().length > 0)
        .map((p, i) => ({
          id: p.id,
          name: p.name.trim(),
          imageUrl: p.imageUrl ?? null,
          price: p.price != null && p.price > 0 ? p.price : null,
          sortOrder: i,
        }))
      const payload = {
        name: name.trim(),
        discountType,
        discountValue,
        perUserLimit,
        totalUsageLimit: unlimited ? null : totalUsageLimit,
        minOrderAmount: minOrderAmount > 0 ? minOrderAmount : null,
        startDate,
        endDate,
        category,
        imageUrl: imageUrl ?? null,
        description: description.trim() || null,
        rules: rules.trim() || null,
        kvkkText: kvkkText.trim() || null,
        products: cleanProducts,
      }
      if (isEdit && campaign) {
        await companyMeService.updateCampaign(campaign.id, payload)
        toast.success('Kampanya güncellendi.')
      } else {
        await companyMeService.createCampaign(payload)
        toast.success('Kampanya oluşturuldu.')
      }
      onSaved()
      onClose()
    } catch {
      void 0
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Kampanyayı Düzenle' : 'Yeni Kampanya'}
      subtitle={isEdit ? campaign?.name : 'İndirim kampanyanızı tanımlayın'}
      width={460}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
          <Button variant="primary" className="flex-1" isLoading={saving} disabled={!isFormValid} onClick={save}>
            {isEdit ? 'Kaydet' : 'Oluştur'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-4">
        <Field label="Kampanya Adı" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Hafta Sonu %20 İndirim" />
        </Field>

        <Field label="Kategori" required hint="Kampanyanızı sınıflandırır, listelerde filtrelenir.">
          <Select value={category} onChange={(e) => setCategory(e.target.value as CampaignCategory)}>
            {CAMPAIGN_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="İndirim Türü" required>
          {isEdit ? (
            <LockedField value={discountType === 'percentage' ? 'Yüzde (%)' : 'Tutar (₺)'} />
          ) : (
            <SegmentedControl
              value={discountType}
              onChange={(v) => setDiscountType(v as DiscountType)}
              options={[
                { value: 'percentage', label: 'Yüzde (%)' },
                { value: 'fixed', label: 'Tutar (₺)' },
              ]}
            />
          )}
        </Field>

        <Field
          label="İndirim Değeri"
          required
          hint={discountType === 'percentage' ? 'Yüzde olarak (en fazla %100)' : 'TL tutar olarak'}
          error={!isEdit && percentTooHigh ? 'Yüzde indirim 100\'ü aşamaz.' : undefined}
        >
          {isEdit ? (
            <LockedField value={discountType === 'percentage' ? `${discountValue}%` : `${discountValue.toLocaleString('tr-TR')} TL`} />
          ) : (
            <NumberInput
              value={discountValue}
              onChange={setDiscountValue}
              min={0}
              max={discountType === 'percentage' ? 100 : undefined}
              suffix={discountType === 'percentage' ? '%' : '₺'}
            />
          )}
        </Field>

        <Field label="Kişi Başı Kullanım Limiti" required hint="Bir kişi kampanyayı kaç kez kullanabilir">
          {isEdit ? (
            <LockedField value={`${perUserLimit} kez`} />
          ) : (
            <NumberInput value={perUserLimit} onChange={setPerUserLimit} min={1} suffix="kez" />
          )}
        </Field>

        <Field label="Toplam Kullanım Limiti" hint="Kampanyayı toplam kaç kişi kullanabilir">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground-strong">Sınırsız Kullanım</p>
                <p className="type-caption mt-0.5">Kapalıysa toplam kullanım sayısıyla sınırlandırılır</p>
              </div>
              <Switch checked={unlimited} onCheckedChange={setUnlimited} />
            </div>
            {!unlimited && (
              <NumberInput value={totalUsageLimit} onChange={setTotalUsageLimit} min={1} suffix="kişi" />
            )}
          </div>
        </Field>

        <Field label="Min. Harcama Tutarı" hint="0 girilirse alt limit uygulanmaz">
          <NumberInput value={minOrderAmount} onChange={setMinOrderAmount} min={0} suffix="₺" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Başlangıç" required>
            <DatePicker value={startDate} min={startMin} onChange={setStartDate} />
          </Field>
          <Field
            label="Bitiş"
            required
            error={startDate && endDate && endDate < startDate ? 'Bitiş başlangıçtan önce olamaz.' : undefined}
          >
            <DatePicker value={endDate} min={startDate || startMin} onChange={setEndDate} />
          </Field>
        </div>

        <Field label="Kampanya Görseli" hint="Görsel 4:3 oranında kırpılarak yüklenir.">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) openCrop({ kind: 'main' }, file)
              e.target.value = ''
            }}
          />
          {imageUrl ? (
            <div className="relative w-full overflow-hidden rounded-card border border-border" style={{ aspectRatio: '4 / 3' }}>
              <img src={imageUrl} alt="Kampanya görseli" className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-surface-0 shadow-card"
                onClick={() => setImageUrl(null)}
              >
                <XIcon className="h-3.5 w-3.5 text-foreground-muted" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-border bg-surface-1 py-6 text-foreground-muted transition-colors hover:bg-surface-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
            >
              {uploadingImage
                ? <Loader2Icon className="h-5 w-5 animate-spin" />
                : <ImageIcon className="h-5 w-5" />}
              <span className="type-caption">{uploadingImage ? 'Yükleniyor…' : 'Görsel Yükle'}</span>
            </button>
          )}
        </Field>

        <Field label="Ürünler" hint="Kampanyaya dahil ürünleri görsel, ad ve fiyatıyla ekleyin. Görseller 4:3 kırpılır.">
          <input
            ref={productFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              const idx = pendingProductIndex.current
              if (file && idx != null) openCrop({ kind: 'product', index: idx }, file)
              e.target.value = ''
            }}
          />
          <div className="space-y-3">
            {products.map((p, i) => (
              <div key={p.id ?? `new-${i}`} className="flex gap-3 rounded-card border border-border bg-surface-1 p-3">
                <button
                  type="button"
                  className="relative flex-shrink-0 overflow-hidden rounded-lg border border-border bg-surface-0"
                  style={{ width: 72, aspectRatio: '4 / 3' }}
                  onClick={() => {
                    pendingProductIndex.current = i
                    productFileInputRef.current?.click()
                  }}
                  disabled={uploadingProductIndex === i}
                >
                  {uploadingProductIndex === i ? (
                    <span className="flex h-full w-full items-center justify-center">
                      <Loader2Icon className="h-4 w-4 animate-spin text-foreground-muted" />
                    </span>
                  ) : p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-foreground-muted">
                      <ImageIcon className="h-4 w-4" />
                    </span>
                  )}
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Input
                    value={p.name}
                    onChange={(e) => updateProduct(i, { name: e.target.value })}
                    placeholder="Ürün adı"
                  />
                  <NumberInput
                    value={p.price ?? 0}
                    onChange={(v) => updateProduct(i, { price: v })}
                    min={0}
                    suffix="₺"
                  />
                </div>
                <button
                  type="button"
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center self-start rounded-full text-danger transition-colors hover:bg-danger-soft"
                  onClick={() => removeProduct(i)}
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" iconLeft={<PlusIcon className="h-3.5 w-3.5" />} onClick={addProduct}>
              Ürün Ekle
            </Button>
          </div>
        </Field>

        <Field label="Açıklama" hint="Kampanya koşulları veya detayları hakkında kısa bilgi.">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Kampanya detaylarını buraya yazabilirsiniz…"
            rows={3}
          />
        </Field>

        <Field label="Kampanya Kuralları" hint="İndirim uygulanacak ürün/hizmet kısıtları, kullanım koşulları.">
          <Textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            placeholder="Örn. Yalnızca saç kesimi hizmetinde geçerlidir. Diğer indirimlerle birleştirilemez."
            rows={4}
          />
        </Field>

        <Field label="KVKK Metni" hint="Müşteri verilerinin işlenmesine ilişkin aydınlatma metni.">
          <Textarea
            value={kvkkText}
            onChange={(e) => setKvkkText(e.target.value)}
            placeholder="Kişisel verileriniz, kampanya kapsamında 6698 sayılı KVKK uyarınca işlenecektir…"
            rows={5}
          />
        </Field>
      </div>
    </Drawer>

    {cropSrc && (
      <ImageCropModal
        open={!!cropSrc}
        imageSrc={cropSrc}
        aspect={4 / 3}
        onClose={() => setCropSrc(null)}
        onCrop={(blob) => void handleCropped(blob)}
      />
    )}
    </>
  )
}
