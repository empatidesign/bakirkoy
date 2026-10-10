import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  SendIcon, UserSearchIcon, CheckCircle2Icon, PhoneIcon,
  HomeIcon, MapPinnedIcon, ImagePlusIcon, VideoIcon, XIcon, Loader2Icon,
} from 'lucide-react'
import {
  Modal, Button, Field, Input, Textarea, Select, TcknInput, DatePicker, PhoneInput,
  Banner, Switch, Badge,
} from '@/design-system'
import muhtarlikService from '@/services/muhtarlik.service'
import { CATEGORY_OPTIONS, SUBMISSION_TYPE_OPTIONS, PRIORITY_OPTIONS } from '@/types/muhtarlik.types'
import type { CreateSubmissionByMuhtarRequest, MuhtarNviLookupResult } from '@/types/muhtarlik.types'

const EMPTY: CreateSubmissionByMuhtarRequest = {
  title: '',
  description: '',
  categoryId: '',
  submissionType: 'request',
  priority: 'normal',
  address: '',
  onBehalfOf: false,
  addressType: 'residence',
  mediaUrls: [],
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const MAX_MEDIA_SIZE_BYTES = 100 * 1024 * 1024
const MAX_MEDIA_COUNT = 5
const ACCEPTED_MEDIA_TYPES = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,video/3gpp,video/x-matroska'

type PendingMedia = { url: string; fileName: string; isVideo: boolean }

export const NewMuhtarSubmissionModal = ({ open, onClose, onCreated }: Props) => {
  const [form, setForm] = useState<CreateSubmissionByMuhtarRequest>(EMPTY)
  const [saving, setSaving] = useState(false)

  const [tckn, setTckn] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState<MuhtarNviLookupResult | null>(null)
  const [citizenPhoneInput, setCitizenPhoneInput] = useState('')

  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().slice(0, 10)

  const isValid =
    form.title.trim().length > 0 &&
    form.description.trim().length > 0 &&
    form.categoryId.trim().length > 0 &&
    (!form.onBehalfOf || (
      !!verified &&
      (verified.isRegisteredCitizen || citizenPhoneInput.replace(/\D/g, '').length >= 10) &&
      (form.addressType === 'residence' || form.address.trim().length > 0)
    )) &&
    (form.onBehalfOf || form.address.trim().length > 0) &&
    !uploadingMedia

  const handleClose = () => {
    setForm(EMPTY)
    setTckn('')
    setBirthDate('')
    setVerified(null)
    setCitizenPhoneInput('')
    setPendingMedia([])
    onClose()
  }

  const handleOnBehalfToggle = (onBehalfOf: boolean) => {
    setForm((f) => ({ ...f, onBehalfOf, address: '', addressType: 'residence' }))
    setTckn('')
    setBirthDate('')
    setVerified(null)
    setCitizenPhoneInput('')
  }

  const handleVerify = async () => {
    if (tckn.length !== 11 || !birthDate) return
    setVerifying(true)
    try {
      const result = await muhtarlikService.muhtarNviLookup(tckn, birthDate)
      setVerified(result)
      toast.success(result.isRegisteredCitizen ? 'Kişi sistemde kayıtlı, bilgileri dolduruldu.' : 'Kimlik NVI ile doğrulandı.')
    } catch {
      toast.error('Kimlik doğrulanamadı. TC ve doğum tarihini kontrol edin.')
      setVerified(null)
    } finally {
      setVerifying(false)
    }
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
          const uploaded = await muhtarlikService.uploadMuhtarMedia(file)
          setPendingMedia((prev) => [...prev, { url: uploaded.url, fileName: file.name, isVideo: file.type.startsWith('video/') }])
          setForm((f) => ({ ...f, mediaUrls: [...(f.mediaUrls ?? []), uploaded.url] }))
        } catch {
          toast.error(`"${file.name}" yüklenemedi. Fotoğraf (JPEG/PNG/WEBP) veya video (MP4/MOV/WEBM) seçin.`)
        }
      }
    } finally {
      setUploadingMedia(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeMedia = (url: string) => {
    setPendingMedia((prev) => prev.filter((m) => m.url !== url))
    setForm((f) => ({ ...f, mediaUrls: (f.mediaUrls ?? []).filter((u) => u !== url) }))
  }

  const handleSubmit = async () => {
    if (!isValid) return
    setSaving(true)
    try {
      const payload: CreateSubmissionByMuhtarRequest = form.onBehalfOf
        ? {
            ...form,
            citizenTc: tckn,
            citizenBirthDate: birthDate,
            citizenPhone: verified?.isRegisteredCitizen ? undefined : citizenPhoneInput,
          }
        : form
      await muhtarlikService.createByMuhtar(payload)
      toast.success(form.onBehalfOf ? 'Talep bu kişi adına oluşturuldu.' : 'Talebiniz oluşturuldu.')
      handleClose()
      onCreated()
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Talep oluşturulamadı.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setForm(EMPTY)
    setTckn('')
    setBirthDate('')
    setVerified(null)
    setCitizenPhoneInput('')
    setPendingMedia([])
  }, [open])

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Yeni Talep Oluştur"
      subtitle="Mahalleniz adına belediyeye ileteceğiniz talep, istek/öneri ya da şikayet"
      width={600}
      footer={
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleClose}>İptal</Button>
          <Button
            variant="primary"
            className="flex-1"
            isLoading={saving}
            disabled={!isValid || saving}
            iconLeft={<SendIcon className="h-4 w-4" />}
            onClick={() => void handleSubmit()}
          >
            Talebi Gönder
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-card border border-border bg-surface-1 px-3.5 py-2.5">
          <div>
            <p className="type-body-strong">Başkası Adına Talep</p>
            <p className="type-caption text-foreground-subtle">
              {form.onBehalfOf ? 'Kimliği doğrulanan kişi adına açılıyor.' : 'Kendi adınıza (mahalleniz için) açılıyor.'}
            </p>
          </div>
          <Switch checked={!!form.onBehalfOf} onCheckedChange={handleOnBehalfToggle} />
        </div>

        {form.onBehalfOf && (
          <div className="space-y-3 rounded-card border border-border p-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="T.C. Kimlik No">
                <TcknInput value={tckn} onChange={(v) => { setTckn(v); setVerified(null) }} />
              </Field>
              <Field label="Doğum Tarihi">
                <DatePicker value={birthDate} max={today} onChange={(v) => { setBirthDate(v); setVerified(null) }} />
              </Field>
            </div>
            <Button
              variant="outline"
              className="w-full"
              isLoading={verifying}
              disabled={tckn.length !== 11 || !birthDate || verifying}
              iconLeft={<UserSearchIcon className="h-4 w-4" />}
              onClick={() => void handleVerify()}
            >
              Kimliği Doğrula
            </Button>

            {verified && (
              <div className="space-y-2 rounded-card border border-success/30 bg-success-soft/50 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2Icon className="h-4 w-4 text-success" />
                  <span className="type-body-strong">{verified.fullName}</span>
                  {verified.isRegisteredCitizen && <Badge tone="success">Sistemde Kayıtlı</Badge>}
                </div>
                {verified.isRegisteredCitizen ? (
                  <p className="type-caption flex items-center gap-1 text-foreground-subtle">
                    <PhoneIcon className="h-3 w-3" /> Kayıtlı telefon: {verified.registeredPhoneMasked} (otomatik kullanılacak)
                  </p>
                ) : (
                  <Field label="Cep Telefonu" hint="Bu kişi sistemde kayıtlı değil, iletişim için zorunludur.">
                    <PhoneInput value={citizenPhoneInput} onChange={setCitizenPhoneInput} />
                  </Field>
                )}
              </div>
            )}

            {verified && (
              <div>
                <p className="type-body-strong mb-1.5">Adres</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, addressType: 'residence', address: '' }))}
                    className={`flex items-center justify-center gap-1.5 rounded-field border-2 py-2 text-sm font-semibold transition-colors ${
                      form.addressType === 'residence' ? 'border-primary bg-primary/5 text-foreground-strong' : 'border-border bg-surface-0 text-foreground-subtle'
                    }`}
                  >
                    <HomeIcon className="h-4 w-4" /> İkametgah Adresi
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, addressType: 'other' }))}
                    className={`flex items-center justify-center gap-1.5 rounded-field border-2 py-2 text-sm font-semibold transition-colors ${
                      form.addressType === 'other' ? 'border-primary bg-primary/5 text-foreground-strong' : 'border-border bg-surface-0 text-foreground-subtle'
                    }`}
                  >
                    <MapPinnedIcon className="h-4 w-4" /> Başka Adres
                  </button>
                </div>
                {form.addressType === 'residence' ? (
                  <p className="type-caption mt-2 text-foreground-subtle">
                    {verified.address ? `Kayıtlı adres kullanılacak: ${verified.address}` : 'Kayıtlı adres bulunamadı, mahalle adı kullanılacak.'}
                  </p>
                ) : (
                  <Input
                    className="mt-2"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Sokak / Cadde, Dış Kapı No, İç Kapı No"
                  />
                )}
              </div>
            )}
          </div>
        )}

        <Field label="Başlık">
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Başlık girin"
          />
        </Field>

        <Field label="Açıklama">
          <Textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Açıklama girin"
            rows={4}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tür">
            <Select
              value={form.submissionType}
              onChange={(e) => setForm((f) => ({ ...f, submissionType: e.target.value as CreateSubmissionByMuhtarRequest['submissionType'] }))}
            >
              {SUBMISSION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Öncelik">
            <Select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as CreateSubmissionByMuhtarRequest['priority'] }))}
            >
              {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Kategori">
          <Select
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
          >
            <option value="" disabled>Kategori seçin</option>
            {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>

        {!form.onBehalfOf && (
          <Field label="Adres">
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Adres girin"
            />
          </Field>
        )}

        <div>
          <p className="type-body-strong mb-1.5">Fotoğraf / Video (opsiyonel)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_MEDIA_TYPES}
            multiple
            className="hidden"
            onChange={(e) => void handleFilesSelected(e.target.files)}
          />
          <div className="flex flex-wrap gap-2">
            {pendingMedia.map((m) => (
              <div key={m.url} className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-field border border-border bg-surface-1">
                {m.isVideo ? (
                  <VideoIcon className="h-6 w-6 text-foreground-subtle" />
                ) : (
                  <img src={m.url} alt={m.fileName} className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(m.url)}
                  className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <XIcon className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
            {pendingMedia.length < MAX_MEDIA_COUNT && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingMedia}
                className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-field border-2 border-dashed border-border text-foreground-subtle hover:border-primary hover:text-primary"
              >
                {uploadingMedia ? <Loader2Icon className="h-5 w-5 animate-spin" /> : <ImagePlusIcon className="h-5 w-5" />}
                <span className="text-[10px]">Ekle</span>
              </button>
            )}
          </div>
        </div>

        {form.onBehalfOf && !verified && (
          <Banner tone="info" variant="soft">
            Talebi göndermeden önce yukarıdan kişinin kimliğini doğrulayın.
          </Banner>
        )}
      </div>
    </Modal>
  )
}
