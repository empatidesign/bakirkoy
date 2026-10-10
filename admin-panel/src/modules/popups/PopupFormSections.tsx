import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import {
  ImageIcon, VideoIcon, TypeIcon, PlusIcon, Trash2Icon, UploadCloudIcon, Loader2Icon,
  MegaphoneIcon, ClockIcon, Layers3Icon, MapPinnedIcon, LinkIcon, FileIcon,
} from 'lucide-react'
import {
  Field, FormSection, Input, Textarea, Select, DatePicker, ToggleRow, Button, IconButton, Badge, Banner,
} from '@/design-system'
import popupService from '@/services/popup.service'
import { cn } from '@/lib/utils'
import {
  POPUP_TRIGGER_OPTIONS, POPUP_TRIGGER_HINTS, POPUP_MODULE_TARGET_OPTIONS,
} from '@/types/popup.types'
import type { PopupForm, PopupMediaItem, PopupMediaType, PopupTriggerType } from '@/types/popup.types'
import { emptyPopupMediaItem } from '@/types/popup.types'

// Kullanıcı isteği (2026-09-20): "video linki de eklenebilsin, video dosyası dışında da
// yükleme yapılabilsin" — video içerikleri artık ya dosya yüklenerek (mp4 vb.) ya da
// doğrudan bir bağlantı (YouTube, Vimeo veya herhangi bir mp4/m3u8 URL'si) yapıştırılarak
// eklenebilir. Ayrıca dosya yükleme artık video/image mime tipiyle sınırlı değil — kabul
// listesi genişletildi (ör. .mov, .webm, .mkv gibi tarayıcının video/* ile tanımadığı ama
// yine de video olan formatlar için accept özniteliği serbest bırakıldı).
const isLikelyUrl = (v: string) => /^https?:\/\//i.test(v.trim())

// YouTube/Vimeo linklerini gömülebilir (embed) adrese çevirir; tanımadığı bağlantılarda
// (doğrudan .mp4 gibi) ham <video> etiketiyle oynatmayı dener.
const toEmbedUrl = (url: string): { kind: 'youtube' | 'vimeo' | 'file'; src: string } => {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/)
  if (yt) return { kind: 'youtube', src: `https://www.youtube.com/embed/${yt[1]}` }
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return { kind: 'vimeo', src: `https://player.vimeo.com/video/${vimeo[1]}` }
  return { kind: 'file', src: url }
}

const VideoLinkPreview = ({ url }: { url: string }) => {
  const embed = toEmbedUrl(url)
  if (embed.kind === 'file') {
    return <video src={embed.src} controls className="max-h-48 w-full rounded-md border border-border" />
  }
  return (
    <iframe
      src={embed.src}
      className="aspect-video w-full rounded-md border border-border"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  )
}

type SetForm = Dispatch<SetStateAction<PopupForm>>

interface Props {
  form: PopupForm
  setForm: SetForm
}

const MEDIA_TYPE_META: Record<PopupMediaType, { icon: typeof ImageIcon; label: string }> = {
  image: { icon: ImageIcon, label: 'Resim' },
  video: { icon: VideoIcon, label: 'Video' },
  text: { icon: TypeIcon, label: 'Metin' },
}

const MediaItemCard = ({
  item, index, canRemove, onChange, onRemove,
}: {
  item: PopupMediaItem
  index: number
  canRemove: boolean
  onChange: (fn: (m: PopupMediaItem) => PopupMediaItem) => void
  onRemove: () => void
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  // Kullanıcı isteği (2026-09-20): mevcut bir URL varsa hangi girişten geldiğini tahmin et
  // (dosya yükleme her zaman aynı MinIO host'una yazar) — böylece düzenlemede doğru sekme açık gelir.
  const [sourceMode, setSourceMode] = useState<'upload' | 'link'>(() => (item.url && isLikelyUrl(item.url) && !item.url.includes('/files/public/popup-media/') ? 'link' : 'upload'))
  const meta = MEDIA_TYPE_META[item.type]

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const { url } = await popupService.uploadMedia(file)
      onChange((m) => ({ ...m, url }))
    } catch {
      toast.error('Dosya yüklenemedi, tekrar deneyin.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3 rounded-card border border-border bg-surface-1 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Badge tone="primary"><meta.icon className="h-3.5 w-3.5" /> {meta.label}</Badge>
          <span className="type-caption">İçerik {index + 1}</span>
        </span>
        <IconButton tone="danger" title="İçeriği kaldır" disabled={!canRemove} onClick={onRemove}>
          <Trash2Icon className="h-4 w-4" />
        </IconButton>
      </div>

      <Field label="Tür">
        <Select
          value={item.type}
          onChange={(e) => {
            setSourceMode('upload')
            onChange((m) => ({ ...m, type: e.target.value as PopupMediaType, url: null, text: null }))
          }}
        >
          <option value="image">Resim</option>
          <option value="video">Video</option>
          <option value="text">Metin</option>
        </Select>
      </Field>

      {(item.type === 'image' || item.type === 'video') && (
        <Field label={item.type === 'image' ? 'Resim Dosyası' : 'Video Dosyası'}>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setSourceMode('upload'); onChange((m) => ({ ...m, url: null })) }}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                sourceMode === 'upload' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-surface-2',
              )}
            >
              <FileIcon className="h-3.5 w-3.5" /> Dosya Yükle
            </button>
            <button
              type="button"
              onClick={() => { setSourceMode('link'); onChange((m) => ({ ...m, url: null })) }}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                sourceMode === 'link' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-surface-2',
              )}
            >
              <LinkIcon className="h-3.5 w-3.5" /> Bağlantı (Link)
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={item.type === 'image' ? 'image/*' : 'video/*,.mov,.mkv,.avi,.webm'}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />

          {sourceMode === 'link' ? (
            <div className="space-y-2">
              <Input
                placeholder={item.type === 'video' ? 'https://youtube.com/watch?v=... veya doğrudan video adresi' : 'https://...'}
                value={item.url ?? ''}
                onChange={(e) => onChange((m) => ({ ...m, url: e.target.value.trim() || null }))}
              />
              {item.type === 'video' && (
                <p className="type-caption">YouTube, Vimeo bağlantıları veya doğrudan bir video dosyası adresi (.mp4, .m3u8 vb.) kabul edilir.</p>
              )}
              {item.url && isLikelyUrl(item.url) && (
                item.type === 'image' ? (
                  <img src={item.url} alt="" className="max-h-48 rounded-md border border-border object-contain" />
                ) : (
                  <VideoLinkPreview url={item.url} />
                )
              )}
            </div>
          ) : item.url ? (
            <div className="space-y-2">
              {item.type === 'image' ? (
                <img src={item.url} alt="" className="max-h-48 rounded-md border border-border object-contain" />
              ) : (
                <video src={item.url} controls className="max-h-48 w-full rounded-md border border-border" />
              )}
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} isLoading={uploading}>
                <UploadCloudIcon className="h-4 w-4" /> Değiştir
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} isLoading={uploading}>
              {uploading ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <UploadCloudIcon className="h-4 w-4" />} Dosya Yükle
            </Button>
          )}
          <Field label="Alt Yazı (opsiyonel)">
            <Input
              placeholder="Görsel/videonun altında görünecek kısa metin"
              value={item.text ?? ''}
              onChange={(e) => onChange((m) => ({ ...m, text: e.target.value }))}
            />
          </Field>
        </Field>
      )}

      {item.type === 'text' && (
        <Field label="Metin İçeriği" required>
          <Textarea
            rows={4}
            placeholder="Popup'ta gösterilecek metni yazın"
            value={item.text ?? ''}
            onChange={(e) => onChange((m) => ({ ...m, text: e.target.value }))}
          />
        </Field>
      )}
    </div>
  )
}

export const PopupFormSections = ({ form, setForm }: Props) => {
  const updateMedia = (i: number, fn: (m: PopupMediaItem) => PopupMediaItem) =>
    setForm((p) => ({ ...p, mediaItems: p.mediaItems.map((m, idx) => (idx === i ? fn(m) : m)) }))

  const addMedia = () =>
    setForm((p) => ({ ...p, mediaItems: [...p.mediaItems, emptyPopupMediaItem(p.mediaItems.length)] }))

  const removeMedia = (i: number) =>
    setForm((p) => ({ ...p, mediaItems: p.mediaItems.filter((_, idx) => idx !== i) }))

  return (
    <div className="space-y-5">
      <Field label="Popup Başlığı" required>
        <Input
          placeholder="Örn. Yeni Sezon Kütüphane Kuralları"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
        />
      </Field>

      <FormSection title="Zorunluluk ve Kapatma" subtitle="Zorunlu popup, okundu/izlendi onayı verilene kadar her girişte tekrar gösterilir" icon={MegaphoneIcon} variant="card">
        <ToggleRow
          label="Zorunlu popup"
          description="Açıksa vatandaş 'okudum/izledim' demeden popup'ı kapatamaz; onaylayana kadar her girişte tekrar gösterilir."
          checked={form.isMandatory}
          onChange={(v) => setForm((p) => ({ ...p, isMandatory: v, allowDismissForever: v ? false : p.allowDismissForever }))}
        />
        {!form.isMandatory && (
          <ToggleRow
            label="'Bir daha gösterme' seçeneği sun"
            description="Vatandaş kapatırken bu popup'ı bir daha görmek istemediğini seçebilir."
            checked={form.allowDismissForever}
            onChange={(v) => setForm((p) => ({ ...p, allowDismissForever: v }))}
          />
        )}
        {!form.isMandatory && (
          <Field label="Tekrar Gösterme Aralığı (saat)" hint="Vatandaş kapattıktan sonra kaç saat geçince tekrar gösterilebilir? 0 = her tetiklemede tekrar göster.">
            <Input
              sanitize="digits"
              inputMode="numeric"
              value={String(form.repeatIntervalHours)}
              onChange={(e) => setForm((p) => ({ ...p, repeatIntervalHours: Math.max(0, Number(e.target.value) || 0) }))}
            />
          </Field>
        )}
      </FormSection>

      <FormSection title="Ne Zaman Tetiklenir" subtitle="Popup vatandaşa hangi durumda gösterilsin" icon={MapPinnedIcon} variant="card">
        <Field label="Tetikleme">
          <Select
            value={form.triggerType}
            onChange={(e) => setForm((p) => ({ ...p, triggerType: e.target.value as PopupTriggerType }))}
          >
            {POPUP_TRIGGER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <p className="type-caption">{POPUP_TRIGGER_HINTS[form.triggerType]}</p>

        {form.triggerType === 'module_enter' && (
          <Field label="Hedef Alan" required>
            <Select
              value={form.triggerModuleKey}
              onChange={(e) => setForm((p) => ({ ...p, triggerModuleKey: e.target.value }))}
            >
              <option value="">Seçin...</option>
              {POPUP_MODULE_TARGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        )}
      </FormSection>

      <FormSection title="Zamanlama" subtitle="Belirli bir tarih aralığında gösterilmesi gerekiyorsa doldurun; boş bırakılırsa süresiz geçerlidir" icon={ClockIcon} variant="card">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Başlangıç Tarihi">
            <DatePicker value={form.startDate} onChange={(v) => setForm((p) => ({ ...p, startDate: v }))} clearable />
          </Field>
          <Field label="Bitiş Tarihi">
            <DatePicker value={form.endDate} onChange={(v) => setForm((p) => ({ ...p, endDate: v }))} clearable min={form.startDate || undefined} />
          </Field>
        </div>
        <Field label="Asgari Gösterim Süresi (saniye)" hint="Kapatma/onay düğmesi bu süre dolmadan aktif olmaz. 0 = kısıtlama yok.">
          <Input
            sanitize="digits"
            inputMode="numeric"
            value={String(form.minDisplaySeconds)}
            onChange={(e) => setForm((p) => ({ ...p, minDisplaySeconds: Math.max(0, Number(e.target.value) || 0) }))}
          />
        </Field>
        <Field label="Öncelik" hint="Aynı anda birden fazla uygun popup varsa, en yüksek öncelikli önce gösterilir.">
          <Input
            sanitize="digits"
            inputMode="numeric"
            value={String(form.priority)}
            onChange={(e) => setForm((p) => ({ ...p, priority: Number(e.target.value) || 0 }))}
          />
        </Field>
        <ToggleRow
          label="Aktif"
          description="Kapalıyken bu popup hiçbir vatandaşa gösterilmez."
          checked={form.isActive}
          onChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
        />
      </FormSection>

      <FormSection
        title="İçerik (Resim / Video / Metin)"
        subtitle="Birden fazla içerik eklerseniz sırayla (karusel) gösterilir"
        icon={Layers3Icon}
        variant="card"
        action={<Button variant="outline" size="sm" onClick={addMedia}><PlusIcon className="h-4 w-4" /> İçerik Ekle</Button>}
      >
        <div className="space-y-3">
          {form.mediaItems.length === 0 && (
            <Banner tone="warning" variant="soft">En az bir içerik öğesi eklemelisiniz.</Banner>
          )}
          {form.mediaItems.map((item, i) => (
            <MediaItemCard
              key={i}
              item={item}
              index={i}
              canRemove={form.mediaItems.length > 1}
              onChange={(fn) => updateMedia(i, fn)}
              onRemove={() => removeMedia(i)}
            />
          ))}
        </div>
      </FormSection>
    </div>
  )
}
