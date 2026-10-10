import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ImagePlusIcon, XIcon, VideoIcon, HomeIcon, MapPinnedIcon,
  FileTextIcon, MapPinIcon, SendIcon, LightbulbIcon, MessageSquareWarningIcon, HandHelpingIcon,
  ChevronLeftIcon, ChevronRightIcon, ClipboardCheckIcon, AlertTriangleIcon,
} from 'lucide-react'
import { Input, Textarea, Field, Button, Select, FormSection, LockedField, Card } from '@/design-system'
import { MapPicker, type MapCoords } from '@/components/specialized/MapPicker'
import type { CreateSubmissionRequest } from '@/types/submission.types'
import { SUBMISSION_TYPE_LABELS, ADDRESS_TYPE_LABELS } from '@/types/submission.types'
import submissionService, { type SubmissionFormOptions } from '@/services/submission.service'
import { WizardStepper, type WizardStepDef } from './WizardStepper'

type Props = {
  onCreated: () => void
}

const COMPLAINT_REASON_OPTIONS = [
  { value: 'public_safety', label: 'Kamu Güvenliği' },
  { value: 'health_hygiene', label: 'Sağlık / Hijyen' },
  { value: 'recurring', label: 'Tekrarlayan Sorun' },
  { value: 'service_quality', label: 'Hizmet Kalitesi' },
  { value: 'environmental', label: 'Çevresel Etki' },
  { value: 'noise', label: 'Gürültü' },
  { value: 'damage', label: 'Mülk / Eşya Hasarı' },
  { value: 'other', label: 'Diğer' },
]

const COMPLAINT_REASON_LABELS: Record<string, string> = Object.fromEntries(
  COMPLAINT_REASON_OPTIONS.map((o) => [o.value, o.label]),
)

// Kullanıcı isteği (2026-08-28): "kendisi kategori seçiminde istek öneri şikayet 3 başlık
// olsun sadece diğer kategori içeride ulakbel yapsın" — vatandaşa 11 kalemlik teknik kategori
// listesi (Bozuk Yol, Kaldırım, Aydınlatma...) gösterilmiyor. Konu her zaman "other" ile
// gönderilir; backend'deki SubmissionContentAnalyzer (bkz. api/.../SubmissionContentAnalyzer.cs)
// başlık+açıklama metnini analiz edip doğru kategoriyi ve Ulakbel birimini kendisi belirliyor.
const TYPE_OPTIONS: { value: string; label: string; hint: string; icon: typeof HandHelpingIcon }[] = [
  { value: 'request', label: 'Talep', hint: 'Belediyeden bir hizmet talep edin.', icon: HandHelpingIcon },
  { value: 'suggestion', label: 'İstek / Öneri', hint: 'Bir fikir veya öneri iletin.', icon: LightbulbIcon },
  { value: 'complaint', label: 'Şikayet', hint: 'Bir sorunu bildirin.', icon: MessageSquareWarningIcon },
]

const EMPTY: CreateSubmissionRequest = {
  title: '',
  description: '',
  categoryId: 'other',
  submissionType: 'suggestion',
  priority: 'normal',
  neighborhood: '',
  address: '',
  latitude: null,
  longitude: null,
  // Kullanıcı isteği (2026-08-28): vatandaş arayüzünde "muhtar/muhtarlık" ifadesi hiç
  // görünmesin. Bildirim her başvuruda sabit olarak açık gönderilir; muhtar süreç
  // görünürlüğünü zaten kimlik gizliliğiyle (bkz. MuhtarDashboardService) kendi panelinde
  // görür, bu vatandaşa gösterilecek bir seçenek değil.
  notifyMuhtar: true,
  complaintReason: null,
  mediaUrls: [],
  addressType: 'residence',
  scope: 'neighborhood',
}

const MAX_MEDIA_SIZE_BYTES = 100 * 1024 * 1024
const MAX_MEDIA_COUNT = 5
const ACCEPTED_MEDIA_TYPES = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,video/3gpp,video/x-matroska'

type PendingMedia = { url: string; fileName: string; isVideo: boolean }

const EMPTY_OPTIONS: SubmissionFormOptions = {
  categories: [], types: [], priorities: [], neighborhoods: [],
  addressTypes: [], scopes: [], residenceNeighborhood: null, residenceAddress: null,
}

/**
 * Kullanıcı isteği (2026-08-28): "ikametgah adresim seçildiğinde alta kendi adresi ****
 * görünür ilk başlık görünür rakamlar görünmez" — sokak/cadde/mahalle adı okunur kalır,
 * kapı/daire gibi rakam dizileri maskelenir (ör. "No:12" -> "No:**").
 */
const maskAddressNumbers = (address: string): string => address.replace(/\d+/g, (m) => '*'.repeat(m.length))

// Kullanıcı isteği (2026-08-28): "form sihirbazı gibi girişleri vs yapacak, doldurulması
// gereken alanları doldurcak mutla ona göre uyarı mesajı verecek" — form artık 4 adımlı bir
// sihirbaz: (1) Konu, (2) Kapsam ve Adres, (3) Öncelik ve Ekler, (4) Gözden Geçir ve Gönder.
// Her adımda "İleri"ye basılınca o adıma özgü eksik alanlar kontrol edilir; eksikse adım
// değişmez ve hangi alanların doldurulması gerektiğini açıkça söyleyen bir uyarı gösterilir.
// Böylece kullanıcı hiçbir zaman "buton neden pasif" sorusuyla baş başa kalmaz.
const WIZARD_STEPS: WizardStepDef[] = [
  { key: 'topic', label: 'Konu' },
  { key: 'location', label: 'Kapsam ve Adres' },
  { key: 'extras', label: 'Öncelik ve Ekler' },
  { key: 'review', label: 'Gözden Geçir' },
]

export const NewSubmissionTab = ({ onCreated }: Props) => {
  const [form, setForm] = useState<CreateSubmissionRequest>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [options, setOptions] = useState<SubmissionFormOptions>(EMPTY_OPTIONS)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [stepIndex, setStepIndex] = useState(0)
  const [maxReachedIndex, setMaxReachedIndex] = useState(0)
  // "İleri"ye basılıp da eksik alan bulunduğunda true olur; alan doldurulunca otomatik kapanır.
  const [showStepErrors, setShowStepErrors] = useState(false)

  useEffect(() => {
    let active = true
    submissionService.options()
      .then((o) => {
        if (!active) return
        setOptions(o)
        // Kullanıcı isteği (2026-08-28): "ikametgah adresi mi yoksa farklı bir adreste mi
        // olduğunu seçecek" — varsayılan "ikametgah adresim" olduğu için mahalle/adres
        // alanlarını kayıtlı bilgiyle otomatik dolduruyoruz.
        // BUG FIX (2026-08-28): Kayıtlı adresi olmayan vatandaşlar (sistemde ~148k kişi)
        // için "ikametgah adresim" seçiliyken adres alanı hem salt-okunur (LockedField) hem
        // de boş kalıyordu; form doldurulsa da isValid asla true olmuyor ve Gönder butonu
        // hiçbir açıklama olmadan sonsuza kadar pasif görünüyordu. Kayıtlı adres yoksa
        // otomatik olarak "farklı adres" moduna geçip düzenlenebilir alanları gösteriyoruz.
        const hasResidence = !!(o.residenceNeighborhood && o.residenceAddress)
        setForm((f) => ({
          ...f,
          neighborhood: f.neighborhood || (o.residenceNeighborhood ?? ''),
          address: f.address || (o.residenceAddress ?? ''),
          addressType: hasResidence ? f.addressType : 'other',
        }))
      })
      .catch(() => { if (active) setOptions(EMPTY_OPTIONS) })
      .finally(() => { if (active) setLoadingOptions(false) })
    return () => { active = false }
  }, [])

  // Adres türü değiştiğinde alanları uygun şekilde doldur / temizle.
  // Kullanıcı isteği (2026-08-28): "mahallem ile ilgili dediği için zaten kayıtlı adresi
  // ne ise otomatik olarak mahalle seçili olması lazım, adres kısmından mahalleyi otomatik
  // seçsin" — "Farklı bir adres" seçilse bile vatandaşın kayıtlı mahallesi zaten biliniyor;
  // Mahalle alanı boş ("Mahalle seçin") başlamak yerine kayıtlı mahalleyle önceden
  // doldurulur (yine de değiştirilebilir). Sadece Adres metni gerçekten farklı olduğu için
  // boş bırakılır, vatandaş elle girer. Not: "Farklı adres" modunda mahalle zaten doluysa
  // (vatandaş manuel başka bir mahalle seçmişse) üzerine yazılmaz — sadece boşken kayıtlı
  // mahalleyle varsayılan doldurulur; "İkametgah adresim" modunda ise adres zaten kayıtlı
  // adrese kilitli olduğundan mahalle her zaman kayıtlı mahalleyle eşleşecek şekilde ayarlanır.
  const handleAddressTypeChange = (addressType: string) => {
    setForm((f) => ({
      ...f,
      addressType,
      neighborhood: addressType === 'residence'
        ? (options.residenceNeighborhood ?? f.neighborhood)
        : (options.neighborhoods.some((o) => o.value === f.neighborhood) ? f.neighborhood : ''),
      address: addressType === 'residence' ? (options.residenceAddress ?? '') : '',
      latitude: addressType === 'residence' ? null : f.latitude,
      longitude: addressType === 'residence' ? null : f.longitude,
    }))
  }

  const isResidence = form.addressType === 'residence'
  const hasResidenceAddress = !!options.residenceAddress

  // ---- Adım bazlı validasyon: her adımın kendi eksik-alan listesi ----
  const topicMissing: string[] = []
  if (form.title.trim().length === 0) topicMissing.push('Başlık')
  if (form.description.trim().length === 0) topicMissing.push('Açıklama')
  if (form.submissionType === 'complaint' && !form.complaintReason) topicMissing.push('Şikayet Nedeni')

  const locationMissing: string[] = []
  if (form.neighborhood.trim().length === 0) locationMissing.push('Mahalle')
  if (form.address.trim().length === 0) locationMissing.push('Adres')

  // Öncelik ve Ekler adımında zorunlu alan yok (öncelik zaten varsayılan değere sahip,
  // fotoğraf/video opsiyonel) — yine de dosya yükleme sürüyorsa ileri gitmeyi engelliyoruz.
  const extrasMissing: string[] = []
  if (uploadingMedia) extrasMissing.push('Dosya yükleniyor, lütfen bekleyin')

  const STEP_MISSING: string[][] = [topicMissing, locationMissing, extrasMissing, []]
  const isValid = topicMissing.length === 0 && locationMissing.length === 0

  const goToStep = (index: number) => {
    setStepIndex(index)
    setShowStepErrors(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNext = () => {
    const missing = STEP_MISSING[stepIndex]
    if (missing.length > 0) {
      setShowStepErrors(true)
      return
    }
    const next = Math.min(stepIndex + 1, WIZARD_STEPS.length - 1)
    setMaxReachedIndex((m) => Math.max(m, next))
    goToStep(next)
  }

  const handleBack = () => {
    goToStep(Math.max(stepIndex - 1, 0))
  }

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (pendingMedia.length + files.length > MAX_MEDIA_COUNT) {
      toast.error(`En fazla ${MAX_MEDIA_COUNT} dosya ekleyebilirsiniz.`)
      return
    }
    setUploadingMedia(true)
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_MEDIA_SIZE_BYTES) {
          toast.error(`"${file.name}" 100 MB sınırını aşıyor.`)
          continue
        }
        try {
          const uploaded = await submissionService.uploadMedia(file)
          setPendingMedia((prev) => [...prev, { url: uploaded.url, fileName: file.name, isVideo: file.type.startsWith('video/') }])
          setForm((f) => ({ ...f, mediaUrls: [...f.mediaUrls, uploaded.url] }))
        } catch {
          toast.error(`"${file.name}" yüklenemedi. Lütfen fotoğraf (JPEG/PNG/WEBP) veya video (MP4/MOV/WEBM) seçin.`)
        }
      }
    } finally {
      setUploadingMedia(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeMedia = (url: string) => {
    setPendingMedia((prev) => prev.filter((m) => m.url !== url))
    setForm((f) => ({ ...f, mediaUrls: f.mediaUrls.filter((u) => u !== url) }))
  }

  const handleSubmit = () => {
    if (!isValid) {
      // Son adımdan gönderirken bir eksik varsa ilgili adıma geri götür ve göster.
      const badIndex = STEP_MISSING.findIndex((m) => m.length > 0)
      if (badIndex >= 0) {
        setShowStepErrors(true)
        goToStep(badIndex)
      }
      return
    }
    setSaving(true)
    submissionService.create(form)
      .then((created) => {
        toast.success(
          created.trackingNo
            ? `Başvurunuz alındı. Takip No: ${created.trackingNo}`
            : 'Başvurunuz iletildi. Durumunu "Başvurularım" sekmesinden takip edebilirsiniz.',
        )
        setForm({ ...EMPTY, neighborhood: options.residenceNeighborhood ?? '', address: options.residenceAddress ?? '' })
        setPendingMedia([])
        setStepIndex(0)
        setMaxReachedIndex(0)
        setShowStepErrors(false)
        onCreated()
      })
      .catch(() => {
        toast.error('Başvuru gönderilemedi. Lütfen tekrar deneyin.')
      })
      .finally(() => setSaving(false))
  }

  const currentMissing = STEP_MISSING[stepIndex]
  const priorityLabel = options.priorities.find((p) => p.value === form.priority)?.label ?? form.priority
  const addressTypeLabel = ADDRESS_TYPE_LABELS[form.addressType] ?? form.addressType

  return (
    <div className="space-y-4 p-4">
      <Card padded>
        <WizardStepper steps={WIZARD_STEPS} currentIndex={stepIndex} maxReachedIndex={maxReachedIndex} onStepClick={goToStep} />
      </Card>

      {/* ---- Adım 1: Konu ---- */}
      {stepIndex === 0 && (
        <FormSection variant="card" title="Konu" subtitle="Ne hakkında başvuruyorsunuz?" icon={FileTextIcon}>
          {/* Kullanıcı isteği (2026-08-28): "kategori seçiminde istek öneri şikayet 3 başlık
              olsun" — dropdown yerine 3 net seçenek, dokunması kolay büyük kartlar. */}
          <Field label="Başvuru Türü">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TYPE_OPTIONS.map((o) => {
                const Icon = o.icon
                const active = form.submissionType === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, submissionType: o.value, complaintReason: o.value === 'complaint' ? f.complaintReason : null }))}
                    className={`flex flex-col items-start gap-1 rounded-card border px-3 py-2.5 text-left transition ${
                      active
                        ? 'border-primary bg-primary/5 text-foreground-strong'
                        : 'border-border bg-surface-0 text-foreground-default hover:bg-surface-1'
                    }`}
                  >
                    <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-primary' : 'text-foreground-subtle'}`} />
                    <span className="type-body-strong">{o.label}</span>
                    <span className="type-caption">{o.hint}</span>
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="Başlık" error={showStepErrors && form.title.trim().length === 0 ? 'Başlık girmelisiniz.' : undefined}>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Kısa bir başlık girin"
            />
          </Field>

          <Field
            label="Açıklama"
            hint="Yazdığınız konu otomatik analiz edilip ilgili müdürlüğe iletilir."
            error={showStepErrors && form.description.trim().length === 0 ? 'Açıklama girmelisiniz.' : undefined}
          >
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Durumu ayrıntılı anlatın"
              rows={4}
            />
          </Field>

          {form.submissionType === 'complaint' && (
            <Field
              label="Şikayet Nedeni"
              error={showStepErrors && !form.complaintReason ? 'Şikayet nedeni seçmelisiniz.' : undefined}
            >
              <Select
                value={form.complaintReason ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, complaintReason: e.target.value || null }))}
              >
                <option value="">Seçiniz</option>
                {COMPLAINT_REASON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
          )}
        </FormSection>
      )}

      {/* ---- Adım 2: Kapsam ve Adres ---- */}
      {stepIndex === 1 && (
        <FormSection variant="card" title="Kapsam ve Adres" subtitle="Konum bilgisi ilgili birime yönlendirmede kullanılır." icon={MapPinIcon}>
          {/* Kullanıcı isteği (2026-08-28, üçüncü tur): "sultangazi iptalini de iptal et" —
              "Konunun Kapsamı" (Mahallem ile ilgili / Sultangazi geneli) seçimi tamamen
              kaldırıldı. Başvurular her zaman vatandaşın mahallesiyle ilişkilendirilir
              (form.scope sabit 'neighborhood' olarak gönderilir); vatandaşa ayrıca
              sorulmuyor. */}
          {/* Kullanıcı isteği (2026-08-28): "burda olayın gerçekleştiği adres desin" — etiket
              netleştirildi: bu, sorunun/konunun fiilen bulunduğu adrestir. Kullanıcı isteği
              (2026-08-28, ikinci tur): "şikayet ise önce konu seçilecek sonra olayın nerde
              mahallesinde mi ev adresi mi başka adres mi bunların detaylarını" — seçim burada
              üç net seçenek (mahallem/ev adresim/başka adres) olarak sunulur. */}
          <Field label="Olayın Gerçekleştiği Adres">
            <div className="grid grid-cols-2 gap-2">
              {options.addressTypes.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => handleAddressTypeChange(o.value)}
                  className={`flex items-center gap-2 rounded-card border px-3 py-2.5 text-left transition ${
                    form.addressType === o.value
                      ? 'border-primary bg-primary/5 text-foreground-strong'
                      : 'border-border bg-surface-0 text-foreground-default hover:bg-surface-1'
                  }`}
                >
                  {o.value === 'residence'
                    ? <HomeIcon className="h-4 w-4 flex-shrink-0" />
                    : <MapPinnedIcon className="h-4 w-4 flex-shrink-0" />}
                  <span className="type-body-strong">{o.label}</span>
                </button>
              ))}
            </div>
          </Field>

          {isResidence ? (
            // Kullanıcı isteği (2026-08-28): "ikametgah adresim seçildiğinde alta kendi adresi
            // **** görünür ilk başlık görünür rakamlar görünmez" — mahalle/adres alanları
            // düzenlenebilir olarak GÖSTERİLMEZ; kayıtlı adres salt okunur ve numaraları
            // maskelenmiş olarak gösterilir. Gönderilen gerçek değer (form.address) maskesiz
            // kalır, sadece ekranda gizlenir.
            <Field label={options.residenceDistrict ? `Kayıtlı Adresiniz · ${options.residenceDistrict}` : "Kayıtlı Adresiniz"} hint="Bu bilgi başvuruyla birlikte iletilir, ekranda numaralar gizlenir.">
              <LockedField value={hasResidenceAddress ? maskAddressNumbers(form.address) : undefined} placeholder="Kayıtlı adres bulunamadı" />
            </Field>
          ) : (
            <>
              <Field
                label="Mahalle"
                error={showStepErrors && form.neighborhood.trim().length === 0 ? 'Mahalle seçmelisiniz.' : undefined}
              >
                <Select
                  value={form.neighborhood}
                  onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
                  disabled={loadingOptions}
                >
                  <option value="" disabled>{loadingOptions ? 'Yükleniyor…' : 'Mahalle seçin'}</option>
                  {options.neighborhoods.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Adres"
                error={showStepErrors && form.address.trim().length === 0 ? 'Adres girmelisiniz.' : undefined}
              >
                <Input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Sorunun bulunduğu adres"
                />
              </Field>

              <Field label="Konum (opsiyonel)">
                <MapPicker
                  value={{ latitude: form.latitude ?? undefined, longitude: form.longitude ?? undefined }}
                  onChange={(coords: MapCoords) => setForm((f) => ({
                    ...f,
                    latitude: coords.latitude ?? null,
                    longitude: coords.longitude ?? null,
                  }))}
                  onAddressPick={(address) => setForm((f) => ({ ...f, address: f.address.trim() ? f.address : address }))}
                  height={220}
                />
              </Field>
            </>
          )}
        </FormSection>
      )}

      {/* ---- Adım 3: Öncelik ve Ekler ---- */}
      {stepIndex === 2 && (
        <FormSection variant="card" title="Öncelik ve Ekler" icon={SendIcon}>
          <Field label="Öncelik">
            <Select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            >
              {options.priorities.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>

          <Field label="Fotoğraf / Video (opsiyonel)" hint={`En fazla ${MAX_MEDIA_COUNT} dosya, dosya başına en fazla 100 MB.`}>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_MEDIA_TYPES}
              multiple
              className="hidden"
              onChange={(e) => { void handleFilesSelected(e.target.files) }}
            />
            <div className="space-y-2">
              {pendingMedia.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {pendingMedia.map((m) => (
                    <div key={m.url} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-1">
                      {m.isVideo ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-foreground-subtle">
                          <VideoIcon className="h-6 w-6" />
                          <span className="type-caption px-1 text-center line-clamp-2">{m.fileName}</span>
                        </div>
                      ) : (
                        <img src={m.url} alt={m.fileName} className="h-full w-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(m.url)}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                        aria-label="Kaldır"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={uploadingMedia || pendingMedia.length >= MAX_MEDIA_COUNT}
                isLoading={uploadingMedia}
                iconLeft={<ImagePlusIcon className="h-4 w-4" />}
                onClick={() => fileInputRef.current?.click()}
              >
                Fotoğraf veya Video Ekle
              </Button>
            </div>
          </Field>
        </FormSection>
      )}

      {/* ---- Adım 4: Gözden Geçir ve Gönder ---- */}
      {stepIndex === 3 && (
        <FormSection variant="card" title="Gözden Geçir ve Gönder" subtitle="Göndermeden önce bilgilerinizi kontrol edin." icon={ClipboardCheckIcon}>
          <div className="divide-y divide-border rounded-card border border-border">
            <ReviewRow label="Başvuru Türü">{SUBMISSION_TYPE_LABELS[form.submissionType] ?? form.submissionType}</ReviewRow>
            <ReviewRow label="Başlık">{form.title || '—'}</ReviewRow>
            <ReviewRow label="Açıklama">
              <span className="whitespace-pre-wrap break-words">{form.description || '—'}</span>
            </ReviewRow>
            {form.submissionType === 'complaint' && (
              <ReviewRow label="Şikayet Nedeni">{form.complaintReason ? (COMPLAINT_REASON_LABELS[form.complaintReason] ?? form.complaintReason) : '—'}</ReviewRow>
            )}
            <ReviewRow label="Adres Türü">{addressTypeLabel}</ReviewRow>
            <ReviewRow label="Mahalle">{form.neighborhood || '—'}</ReviewRow>
            <ReviewRow label="Adres">
              {isResidence && hasResidenceAddress ? maskAddressNumbers(form.address) : (form.address || '—')}
            </ReviewRow>
            <ReviewRow label="Öncelik">{priorityLabel}</ReviewRow>
            <ReviewRow label="Ekler">
              {pendingMedia.length > 0 ? `${pendingMedia.length} dosya eklendi` : 'Ek yok'}
            </ReviewRow>
          </div>

          <p className="type-caption">
            Gönder butonuna bastığınızda başvurunuz otomatik analiz edilip ilgili müdürlüğe iletilir.
            Durumunu "Başvurularım" sekmesinden takip edebilirsiniz.
          </p>
        </FormSection>
      )}

      {/* ---- Uyarı: mevcut adımda eksik alan varsa ---- */}
      {showStepErrors && currentMissing.length > 0 && (
        <div className="flex items-start gap-2 rounded-card border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs text-foreground-muted">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
          <span>
            Devam etmeden önce şu alanları doldurun: <span className="font-medium text-foreground-strong">{currentMissing.join(', ')}</span>
          </span>
        </div>
      )}

      {/* ---- Gezinme: Geri / İleri / Gönder ---- */}
      <div className="flex items-center gap-2">
        {stepIndex > 0 && (
          <Button variant="outline" className="flex-1" iconLeft={<ChevronLeftIcon className="h-4 w-4" />} onClick={handleBack} disabled={saving}>
            Geri
          </Button>
        )}
        {stepIndex < WIZARD_STEPS.length - 1 ? (
          <Button variant="primary" className="flex-1" iconRight={<ChevronRightIcon className="h-4 w-4" />} onClick={handleNext}>
            İleri
          </Button>
        ) : (
          <Button variant="primary" className="flex-1" iconLeft={<SendIcon className="h-4 w-4" />} disabled={!isValid || saving || uploadingMedia} isLoading={saving} onClick={handleSubmit}>
            Gönder
          </Button>
        )}
      </div>
    </div>
  )
}

// Hata (2026-08-29): Gözden Geçir adımında satırların bir kısmı sağa, bir kısmı sola
// hizalı görünüyordu ("bir kısmı en sağa hizalanmış bir kısmı olmalı doğru ona göre
// düzenle" — kullanıcı raporu). Kök neden: flex + justify-between düzeninde değer
// hücresinin genişliği içeriğe göre daralıyordu; kısa metinlerde (ör. "Normal") span
// zaten kutunun tamamını kapladığından text-left etkisiz kalıp görsel olarak sağa
// yapışık duruyordu, sadece uzun/çok satırlı metinlerde (Açıklama, Adres) gerçekten
// sola hizalı görünüyordu. Grid tabanlı sabit iki sütuna geçildi: etiket sütunu sabit
// genişlikte, değer sütunu her zaman kalan tüm genişliği kaplar ve içeriği uzunluğuna
// bakılmaksızın tutarlı şekilde sola hizalanır.
const ReviewRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-1 gap-0.5 px-3 py-2.5 sm:grid-cols-[10rem_1fr] sm:items-start sm:gap-4">
    <span className="type-caption flex-shrink-0">{label}</span>
    <span className="type-body-strong text-left">{children}</span>
  </div>
)
