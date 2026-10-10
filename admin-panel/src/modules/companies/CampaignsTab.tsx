import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TicketPercentIcon, CheckCircle2Icon, CircleCheckBigIcon, CircleSlashIcon, UsersIcon,
  InfoIcon, CalendarRangeIcon, BuildingIcon, ImageIcon, PackageIcon, PlusIcon, Trash2Icon, Loader2Icon, XIcon,
  SparklesIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import {
  Select, Combobox, FilterField, Badge, FormSection, DetailRow,
  Input, NumberInput, Textarea, DatePicker, Field, Switch, LockedField, AdminFormShell,
  Button, IconButton,
} from '@/design-system'
import { DateRangeSelect, type DateRangeValue } from '@/design-system/DateRangeSelect'
import { ImageCropModal } from '@/components/specialized/ImageCropModal'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import { formatDate } from '@/lib/utils'
import campaignService from '@/services/campaign.service'
import companyService from '@/services/company.service'
import serviceCategoryService from '@/services/serviceCategory.service'
import type { SelectOption } from '@/types/common'
import type { ServiceCategoryRef } from '@/types/serviceCategory.types'
import type { Campaign, CampaignInput, CampaignSummary, CampaignCategory } from '@/types/campaign.types'
import {
  CAMPAIGN_STATUS_OPTIONS, CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_TONE, formatDiscount,
  DISCOUNT_TYPE_OPTIONS, CAMPAIGN_CATEGORY_OPTIONS, CAMPAIGN_CATEGORY_LABELS,
} from '@/types/campaign.types'
import { campaignColumns, campaignColumnsWithCompany } from './campaignColumns'

type ProductDraft = { id?: string; name: string; imageUrl: string | null; price: number | null }

interface CampaignFormData {
  companyId: string
  name: string
  discountType: string
  discountValue: number
  perUserLimit: number
  unlimited: boolean
  totalUsageLimit: number
  minOrderAmount: number | null
  startDate: string
  endDate: string
  category: CampaignCategory
  imageUrl: string
  description: string
  products: ProductDraft[]
}

const EMPTY_FORM: CampaignFormData = {
  companyId: '',
  name: '',
  discountType: 'percentage',
  discountValue: 10,
  perUserLimit: 1,
  unlimited: true,
  totalUsageLimit: 100,
  minOrderAmount: null,
  startDate: '',
  endDate: '',
  category: 'Discount',
  imageUrl: '',
  description: '',
  products: [],
}

function toInput(form: CampaignFormData): CampaignInput {
  return {
    companyId: form.companyId,
    name: form.name,
    discountType: form.discountType as CampaignInput['discountType'],
    discountValue: form.discountValue,
    perUserLimit: form.perUserLimit,
    totalUsageLimit: form.unlimited ? null : form.totalUsageLimit,
    minOrderAmount: form.minOrderAmount ?? undefined,
    startDate: form.startDate,
    endDate: form.endDate,
    category: form.category,
    imageUrl: form.imageUrl || null,
    description: form.description || null,
    products: form.products
      .filter((p) => p.name.trim().length > 0)
      .map((p, i) => ({
        id: p.id,
        name: p.name.trim(),
        imageUrl: p.imageUrl ?? null,
        price: p.price != null && p.price > 0 ? p.price : null,
        sortOrder: i,
      })),
  }
}

function toForm(row: Campaign): CampaignFormData {
  return {
    companyId: row.companyId,
    name: row.name,
    discountType: row.discountType,
    discountValue: row.discountValue,
    perUserLimit: row.perUserLimit,
    unlimited: row.totalUsageLimit == null,
    totalUsageLimit: row.totalUsageLimit ?? 100,
    minOrderAmount: row.minOrderAmount ?? null,
    startDate: row.startDate ? row.startDate.slice(0, 10) : '',
    endDate: row.endDate ? row.endDate.slice(0, 10) : '',
    category: row.category ?? 'Discount',
    imageUrl: row.imageUrl ?? '',
    description: row.description ?? '',
    products: (row.products ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl ?? null, price: p.price ?? null })),
  }
}

const DATE_FILTER_OPTIONS = [
  { value: 'active', label: 'Geçerli (devam eden)' },
  { value: 'future', label: 'Gelecek tarihli' },
  { value: 'past', label: 'Süresi geçmiş' },
]

type CropTarget = { kind: 'main' } | { kind: 'product'; index: number }

const CampaignMediaSection = ({
  imageUrl,
  products,
  onImageChange,
  onProductsChange,
}: {
  imageUrl: string
  products: ProductDraft[]
  onImageChange: (url: string) => void
  onProductsChange: (products: ProductDraft[]) => void
}) => {
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropTarget, setCropTarget] = useState<CropTarget>({ kind: 'main' })
  const [uploadingMain, setUploadingMain] = useState(false)
  const [uploadingProduct, setUploadingProduct] = useState<number | null>(null)
  const mainFileRef = useRef<HTMLInputElement>(null)
  const productFileRef = useRef<HTMLInputElement>(null)
  const pendingIndex = useRef<number | null>(null)

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
    try {
      if (target.kind === 'main') {
        setUploadingMain(true)
        const { url } = await companyService.uploadImage(file)
        onImageChange(url)
      } else {
        setUploadingProduct(target.index)
        const { url } = await companyService.uploadImage(file)
        onProductsChange(products.map((p, i) => (i === target.index ? { ...p, imageUrl: url } : p)))
      }
    } catch {
      toast.error('Görsel yüklenemedi.')
    } finally {
      setUploadingMain(false)
      setUploadingProduct(null)
    }
  }

  const addProduct = () => onProductsChange([...products, { name: '', imageUrl: null, price: null }])
  const removeProduct = (index: number) => onProductsChange(products.filter((_, i) => i !== index))
  const updateProduct = (index: number, patch: Partial<ProductDraft>) =>
    onProductsChange(products.map((p, i) => (i === index ? { ...p, ...patch } : p)))

  return (
    <>
      <input
        ref={mainFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) openCrop({ kind: 'main' }, file)
          e.target.value = ''
        }}
      />
      <input
        ref={productFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          const idx = pendingIndex.current
          if (file && idx != null) openCrop({ kind: 'product', index: idx }, file)
          e.target.value = ''
        }}
      />

      <Field label="Kampanya Görseli" hint="Görsel 4:3 oranında kırpılarak yüklenir.">
        {imageUrl ? (
          <div className="relative w-full overflow-hidden rounded-card border border-border" style={{ aspectRatio: '4 / 3' }}>
            <img src={imageUrl} alt="Kampanya görseli" className="h-full w-full object-cover" />
            <div className="absolute right-2 top-2">
              <IconButton tone="danger" onClick={() => onImageChange('')} title="Görseli kaldır">
                <XIcon className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            isLoading={uploadingMain}
            iconLeft={<ImageIcon className="h-4 w-4" />}
            onClick={() => mainFileRef.current?.click()}
          >
            Görsel Yükle
          </Button>
        )}
      </Field>

      <div className="mt-[15px]">
        <Field label="Ürünler" hint="Kampanyaya dahil ürünleri görsel, ad ve fiyatıyla ekleyin. Görseller 4:3 kırpılır.">
          <div className="space-y-3">
            {products.map((p, i) => (
              <div key={p.id ?? `new-${i}`} className="flex gap-3 rounded-card border border-border bg-surface-1 p-3">
                <button
                  type="button"
                  className="relative flex-shrink-0 overflow-hidden rounded-field border border-border bg-surface-0"
                  style={{ width: 80, aspectRatio: '4 / 3' }}
                  onClick={() => { pendingIndex.current = i; productFileRef.current?.click() }}
                  disabled={uploadingProduct === i}
                >
                  {uploadingProduct === i ? (
                    <span className="flex h-full w-full items-center justify-center text-foreground-muted">
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                    </span>
                  ) : p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-foreground-muted">
                      <PackageIcon className="h-4 w-4" />
                    </span>
                  )}
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Input value={p.name} onChange={(e) => updateProduct(i, { name: e.target.value })} placeholder="Ürün adı" />
                  <NumberInput value={p.price ?? 0} onChange={(n) => updateProduct(i, { price: n })} min={0} suffix="₺" />
                </div>
                <IconButton tone="danger" onClick={() => removeProduct(i)} title="Ürünü kaldır">
                  <Trash2Icon className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
            <Button variant="outline" size="sm" iconLeft={<PlusIcon className="h-4 w-4" />} onClick={addProduct}>
              Ürün Ekle
            </Button>
          </div>
        </Field>
      </div>

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

interface Scope {
  companyId?: string
}

const resolveCreatedRange = (range: DateRangeValue): { from?: string; to?: string } => {
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

  switch (range.preset) {
    case 'today':
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() }
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1)
      return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() }
    }
    case 'week': {
      const day = now.getDay() === 0 ? 7 : now.getDay()
      const monday = new Date(now); monday.setDate(now.getDate() - (day - 1))
      return { from: startOfDay(monday).toISOString(), to: endOfDay(now).toISOString() }
    }
    case 'month':
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)).toISOString(), to: endOfDay(now).toISOString() }
    case 'year':
      return { from: startOfDay(new Date(now.getFullYear(), 0, 1)).toISOString(), to: endOfDay(now).toISOString() }
    case 'custom':
      return {
        from: range.from ? startOfDay(new Date(range.from)).toISOString() : undefined,
        to: range.to ? endOfDay(new Date(range.to)).toISOString() : undefined,
      }
    default:
      return {}
  }
}

export const CampaignsTab = ({ scope, embedded, onMutated }: { scope?: Scope; embedded?: boolean; onMutated?: () => void } = {}) => {
  const { can } = useAuth()
  const scopedCompanyId = scope?.companyId
  const [companyFilter, setCompanyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [campaignCategoryFilter, setCampaignCategoryFilter] = useState('')
  const [sortFilter, setSortFilter] = useState('')
  const [companyOptions, setCompanyOptions] = useState<SelectOption[]>([])
  const [categoryOptions, setCategoryOptions] = useState<ServiceCategoryRef[]>([])
  const [summary, setSummary] = useState<CampaignSummary | null>(null)
  const [createdRangeActive, setCreatedRangeActive] = useState(false)
  const [createdRange, setCreatedRange] = useState<DateRangeValue>({ preset: 'week' })

  useEffect(() => {
    let active = true
    companyService.getOptions()
      .then((o) => { if (active) setCompanyOptions(o) })
      .catch(() => { if (active) setCompanyOptions([]) })
    serviceCategoryService.getOptions()
      .then((o) => { if (active && !embedded) setCategoryOptions(o) })
      .catch(() => { if (active) setCategoryOptions([]) })
    return () => { active = false }
  }, [embedded])

  const effectiveCompanyId = scopedCompanyId ?? companyFilter

  const fetchSummary = useCallback(async () => {
    const params: Record<string, string> = {}
    if (effectiveCompanyId) params.companyId = effectiveCompanyId
    try { setSummary(await campaignService.getSummary(params)) }
    catch { setSummary(null) }
  }, [effectiveCompanyId])
  useEffect(() => { fetchSummary() }, [fetchSummary])

  const handleMutated = () => { fetchSummary(); onMutated?.() }

  const resolvedCreated = createdRangeActive ? resolveCreatedRange(createdRange) : {}

  const extraParams: Record<string, string> = {}
  if (effectiveCompanyId) extraParams.companyId = effectiveCompanyId
  if (statusFilter) extraParams.status = statusFilter
  if (dateFilter) extraParams.dateRange = dateFilter
  if (categoryFilter) extraParams.serviceCategoryId = categoryFilter
  if (campaignCategoryFilter) extraParams.category = campaignCategoryFilter
  if (resolvedCreated.from) extraParams.createdFrom = resolvedCreated.from
  if (resolvedCreated.to) extraParams.createdTo = resolvedCreated.to
  if (sortFilter) { const [k, d] = sortFilter.split('-'); extraParams.sort = k; extraParams.order = d }

  const userFilterCount = (companyFilter ? 1 : 0) + (statusFilter ? 1 : 0) + (dateFilter ? 1 : 0)
    + (categoryFilter ? 1 : 0) + (campaignCategoryFilter ? 1 : 0) + (createdRangeActive ? 1 : 0) + (sortFilter ? 1 : 0)


  return (
    <CrudListTemplate<Campaign, CampaignFormData>
      icon={TicketPercentIcon}
      title="Kampanyalar"
      subtitle="Firmaların oluşturduğu indirim kampanyalarını izleyin ve denetleyin"
      resourceName="Kampanya"
      listTitle="Kampanya Listesi"
      creatable={!embedded && can('companies.create')}
      service={{
        getList: (p) => campaignService.getList(p),
        remove: can('companies.delete') ? (id) => campaignService.delete(id) : undefined,
        toggleStatus: can('companies.edit') ? (id) => campaignService.toggleStatus(id) : undefined,
      }}
      onCreate={!embedded && can('companies.create') ? (data) => campaignService.create(toInput(data)).then(() => undefined) : undefined}
      onUpdate={can('companies.edit') ? (id, data) => campaignService.update(id, toInput(data)).then(() => undefined) : undefined}
      rowKey={(r) => r.id}
      columns={scopedCompanyId ? campaignColumns : campaignColumnsWithCompany}
      defaultSort={{ key: 'createdAt', dir: 'desc' }}
      searchPlaceholder="Kampanya veya firma ara..."
      embedded={embedded}
      onMutated={handleMutated}
      filterColumns={3}
      extraParams={extraParams}
      selectable
      hasActiveFilters={embedded ? false : userFilterCount > 0}
      filterCount={userFilterCount}
      onClearFilters={() => { setCompanyFilter(''); setStatusFilter(''); setDateFilter(''); setCategoryFilter(''); setCampaignCategoryFilter(''); setCreatedRangeActive(false); setCreatedRange({ preset: 'week' }); setSortFilter('') }}
      renderFilters={embedded ? undefined : () => (
        <>
          <FilterField label="Firma">
            <Combobox
              value={companyFilter}
              displayValue={companyOptions.find((o) => o.value === companyFilter)?.label}
              options={companyOptions}
              onChange={(v) => setCompanyFilter(v)}
              clearable
              placeholder="Tüm Firmalar"
              emptyText="Firma bulunamadı"
            />
          </FilterField>
          <FilterField label="Hizmet Kategorisi">
            <Combobox
              value={categoryFilter}
              displayValue={categoryOptions.find((o) => o.id === categoryFilter)?.name}
              options={categoryOptions.map((o) => ({ value: o.id, label: o.name }))}
              onChange={(v) => setCategoryFilter(v)}
              clearable
              placeholder="Tüm Kategoriler"
              emptyText="Kategori bulunamadı"
            />
          </FilterField>
          <FilterField label="Kampanya Kategorisi">
            <Select value={campaignCategoryFilter} onChange={(e) => setCampaignCategoryFilter(e.target.value)}>
              <option value="">Tüm Kategoriler</option>
              {CAMPAIGN_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Sıralama">
            <Select value={sortFilter} onChange={(e) => setSortFilter(e.target.value)}>
              <option value="">Kayıt Tarihine Göre (Yeni)</option>
              <option value="name-asc">Alfabetik Sıra (A-Z)</option>
              <option value="name-desc">Alfabetik Sıra (Z-A)</option>
              <option value="createdat-asc">Kayıt Tarihine Göre (Eski)</option>
            </Select>
          </FilterField>
          <FilterField label="Durum">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tüm Durumlar</option>
              {CAMPAIGN_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Geçerlilik Tarihi">
            <Select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
              <option value="">Tüm Tarihler</option>
              {DATE_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Eklenme Tarihi (Yeni Kampanyalar)">
            <div className="flex items-center gap-2">
              {!createdRangeActive ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => { setCreatedRangeActive(true); setCreatedRange({ preset: 'week' }) }}
                >
                  <SparklesIcon className="h-3.5 w-3.5" /> Yeni Eklenenler (Son 7 Gün)
                </Button>
              ) : (
                <>
                  <DateRangeSelect value={createdRange} onChange={setCreatedRange} className="flex-1" />
                  <Button variant="outline" size="sm" onClick={() => setCreatedRangeActive(false)}>Kaldır</Button>
                </>
              )}
            </div>
          </FilterField>
        </>
      )}

      stats={({ total }) => [
        { label: 'Toplam Kampanya', value: summary?.total ?? total, icon: TicketPercentIcon, accent: 'blue' },
        { label: 'Aktif', value: summary?.active ?? 0, icon: CheckCircle2Icon, accent: 'green' },
        { label: 'Tamamlanan', value: summary?.completed ?? 0, icon: CircleCheckBigIcon, accent: 'violet' },
        { label: 'Pasif', value: summary?.passive ?? 0, icon: CircleSlashIcon, accent: 'orange' },
        { label: 'Toplam Kullanım', value: (summary?.totalUsages ?? 0).toLocaleString('tr-TR'), icon: UsersIcon, accent: 'primary' },
      ]}
      emptyForm={{ ...EMPTY_FORM, companyId: scopedCompanyId ?? '' }}
      toForm={toForm}
      canEdit={() => !embedded && can('companies.edit')}
      canDelete={() => can('companies.delete')}
      isActive={(r) => r.status === 'Active'}
      canToggle={(r) => r.status === 'Active' || r.status === 'Passive'}
      deleteConfirm={{ title: 'Kampanyayı Kaldır', description: 'Bu kampanya sistemden kaldırılacak. Bu işlem geri alınamaz. Devam edilsin mi?' }}
      toggleConfirm={(row, willActivate) => willActivate
        ? { title: 'Kampanyayı Aktif Et', description: `"${row.name}" kampanyası yeniden aktif edilecek.` }
        : { title: 'Kampanyayı Pasife Al', description: `"${row.name}" kampanyası pasife alınacak; yeni kullanım yapılamaz. Devam edilsin mi?` }}
      viewable
      renderView={(row) => (
        <div className="space-y-4">
          <FormSection title="Kampanya Bilgileri" icon={InfoIcon} variant="card">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              <DetailRow label="Firma" icon={BuildingIcon}>{row.companyName || '—'}</DetailRow>
              <DetailRow label="Kampanya Adı">{row.name}</DetailRow>
              <DetailRow label="Durum"><Badge tone={CAMPAIGN_STATUS_TONE[row.status]}>{CAMPAIGN_STATUS_LABELS[row.status]}</Badge></DetailRow>
              <DetailRow label="Toplam Kullanım">{(row.usageCount ?? 0).toLocaleString('tr-TR')}</DetailRow>
            </div>
            <div className="mt-3">
              <p className="type-caption mb-1.5">Hizmet Kategorisi</p>
              {row.serviceCategory ? (
                <Badge color={row.serviceCategory.color}>{row.serviceCategory.name}</Badge>
              ) : <span className="type-muted">—</span>}
            </div>
          </FormSection>

          <FormSection title="İndirim ve Koşullar" icon={TicketPercentIcon} variant="card">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              <DetailRow label="İndirim Türü">{row.discountType === 'percentage' ? 'Yüzde (%)' : 'Sabit Tutar (TL)'}</DetailRow>
              <DetailRow label="İndirim"><span className="font-medium text-primary">{formatDiscount(row.discountType, row.discountValue)}</span></DetailRow>
              <DetailRow label="Min. Harcama Tutarı">{row.minOrderAmount ? `${row.minOrderAmount.toLocaleString('tr-TR')} TL` : '—'}</DetailRow>
              <DetailRow label="Kişi Başı Kullanım Limiti">{row.perUserLimit} kez</DetailRow>
              <DetailRow label="Toplam Kullanım Limiti">
                {row.totalUsageLimit != null ? `${(row.usageCount ?? 0).toLocaleString('tr-TR')} / ${row.totalUsageLimit.toLocaleString('tr-TR')} kişi` : 'Sınırsız'}
              </DetailRow>
            </div>
          </FormSection>

          <FormSection title="Geçerlilik" icon={CalendarRangeIcon} variant="card">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              <DetailRow label="Başlangıç">{formatDate(row.startDate)}</DetailRow>
              <DetailRow label="Bitiş">{formatDate(row.endDate)}</DetailRow>
            </div>
          </FormSection>

          {(row.imageUrl || row.description) && (
            <FormSection title="Görsel ve Açıklama" icon={InfoIcon} variant="card">
              <div className="mb-2">
                <Badge tone="neutral">{CAMPAIGN_CATEGORY_LABELS[row.category] ?? 'Diğer'}</Badge>
              </div>
              {row.imageUrl && (
                <div className="mb-3 overflow-hidden rounded-card border border-border" style={{ aspectRatio: '4 / 3' }}>
                  <img src={row.imageUrl} alt={row.name} className="h-full w-full object-cover" />
                </div>
              )}
              {row.description && (
                <div>
                  <p className="type-caption mb-1">Açıklama</p>
                  <p className="type-body whitespace-pre-wrap">{row.description}</p>
                </div>
              )}
            </FormSection>
          )}

          {(row.products?.length ?? 0) > 0 && (
            <FormSection title="Ürünler" icon={PackageIcon} variant="card">
              <div className="grid grid-cols-2 gap-2">
                {row.products.map((p, idx) => (
                  <div key={p.id ?? idx} className="overflow-hidden rounded-card border border-border">
                    <div className="w-full overflow-hidden bg-surface-2" style={{ aspectRatio: '4 / 3' }}>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-foreground-muted">
                          <PackageIcon className="h-6 w-6" />
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="type-body-strong truncate">{p.name}</p>
                      {p.price != null && p.price > 0 && (
                        <p className="type-body text-primary">{p.price.toLocaleString('tr-TR')} ₺</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </FormSection>
          )}
        </div>
      )}
      formShell
      renderForm={({ form, setForm, mode }) => {
        const patch = (partial: Partial<CampaignFormData>) => setForm((p) => ({ ...p, ...partial }))
        const isEdit = mode === 'edit'
        return (
          <AdminFormShell
            icon={TicketPercentIcon}
            title={isEdit ? 'Kampanya Düzenle' : 'Yeni Kampanya Ekle'}
            subtitle="Firma, indirim koşulları, kullanım limiti ve geçerlilik tarihlerini yönetin"
            badge="Kampanya"
            tone="orange"
          >
            {!scopedCompanyId && (
              <FormSection title="Firma" icon={BuildingIcon} variant="card">
                <Field label="Firma" required>
                  <Combobox
                    value={form.companyId}
                    displayValue={companyOptions.find((o) => o.value === form.companyId)?.label}
                    options={companyOptions}
                    onChange={(v) => patch({ companyId: v })}
                    placeholder="Firma seçin..."
                    emptyText="Firma bulunamadı"
                  />
                </Field>
              </FormSection>
            )}

            <FormSection title="Kampanya Bilgileri" icon={TicketPercentIcon} variant="card">
              <Field label="Kampanya Adı" required>
                <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="ör. Yaz İndirimi" />
              </Field>
              <div className="mt-[15px]">
                <Field label="Kategori" required hint="Kampanyayı sınıflandırır, listelerde filtrelenir.">
                  <Select value={form.category} onChange={(e) => patch({ category: e.target.value as CampaignCategory })}>
                    {CAMPAIGN_CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="mt-[15px] grid grid-cols-2 gap-[15px]">
                <Field label="İndirim Türü" required>
                  {isEdit ? (
                    <LockedField value={DISCOUNT_TYPE_OPTIONS.find((o) => o.value === form.discountType)?.label} />
                  ) : (
                    <Select value={form.discountType} onChange={(e) => patch({ discountType: e.target.value })}>
                      {DISCOUNT_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label={form.discountType === 'percentage' ? 'İndirim (%)' : 'İndirim (TL)'} required>
                  {isEdit ? (
                    <LockedField value={form.discountType === 'percentage' ? `${form.discountValue}%` : `${form.discountValue.toLocaleString('tr-TR')} TL`} />
                  ) : (
                    <NumberInput
                      value={form.discountValue}
                      onChange={(n) => patch({ discountValue: n })}
                      min={1}
                      max={form.discountType === 'percentage' ? 100 : undefined}
                      suffix={form.discountType === 'percentage' ? '%' : '₺'}
                    />
                  )}
                </Field>
              </div>
              <div className="mt-[15px] grid grid-cols-2 gap-[15px]">
                <Field label="Kişi Başı Kullanım" required hint="Bir kişi kaç kez kullanabilir?">
                  {isEdit ? (
                    <LockedField value={`${form.perUserLimit} kez`} />
                  ) : (
                    <NumberInput value={form.perUserLimit} onChange={(n) => patch({ perUserLimit: n })} min={1} suffix="kez" />
                  )}
                </Field>
                <Field label="Min. Harcama Tutarı" hint="Boş bırakılırsa şart yok">
                  <NumberInput
                    value={form.minOrderAmount ?? 0}
                    onChange={(n) => patch({ minOrderAmount: n > 0 ? n : null })}
                    min={0}
                    suffix="₺"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Toplam Kullanım Limiti" icon={UsersIcon} variant="card">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground-strong">Sınırsız Kullanım</p>
                  <p className="type-caption mt-0.5">Kapalıysa kampanya toplam kullanım sayısıyla sınırlandırılır</p>
                </div>
                <Switch checked={form.unlimited} onCheckedChange={(v) => patch({ unlimited: v })} />
              </div>
              {!form.unlimited && (
                <div className="mt-[15px]">
                  <Field label="Limit" required hint="Kampanyayı toplamda kaç kişi kullanabilir?">
                    <NumberInput value={form.totalUsageLimit} onChange={(n) => patch({ totalUsageLimit: n })} min={1} suffix="kişi" />
                  </Field>
                </div>
              )}
            </FormSection>

            <FormSection title="Geçerlilik Tarihleri" icon={CalendarRangeIcon} variant="card">
              <div className="grid grid-cols-2 gap-[15px]">
                <Field label="Başlangıç Tarihi" required>
                  <DatePicker value={form.startDate} onChange={(v) => patch({ startDate: v ?? '' })} min={new Date().toISOString().slice(0, 10)} />
                </Field>
                <Field label="Bitiş Tarihi" required>
                  <DatePicker value={form.endDate} onChange={(v) => patch({ endDate: v ?? '' })} min={form.startDate || new Date().toISOString().slice(0, 10)} />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Görsel ve Ürünler" icon={PackageIcon} variant="card">
              <CampaignMediaSection
                imageUrl={form.imageUrl}
                products={form.products}
                onImageChange={(url) => patch({ imageUrl: url })}
                onProductsChange={(products) => patch({ products })}
              />
            </FormSection>

            <FormSection title="Açıklama" icon={InfoIcon} variant="card">
              <Field label="Açıklama">
                <Textarea value={form.description} onChange={(e) => patch({ description: e.target.value })} rows={3} placeholder="Kampanya hakkında kısa bilgi..." />
              </Field>
            </FormSection>
          </AdminFormShell>
        )
      }}
    />
  )
}
