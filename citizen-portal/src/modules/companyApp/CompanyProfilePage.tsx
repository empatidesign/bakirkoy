import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Building2Icon, PhoneIcon, MailIcon, MapPinIcon, GlobeIcon, FileTextIcon,
  HashIcon, CalendarIcon, PencilIcon, CameraIcon, ImageIcon, Loader2Icon,
  PlusIcon, Trash2Icon, LayoutListIcon, ShareIcon, FacebookIcon, InstagramIcon,
  TwitterIcon, LinkedinIcon, TagsIcon, HelpCircleIcon, KeyRoundIcon, RefreshCwIcon,
  ShieldIcon,
} from 'lucide-react'
import { Card, Avatar, Badge, Button, Modal, Field, FormSection, Input, PhoneInput, EmailInput, Textarea, Combobox, isValidEmail, PasswordInput } from '@/design-system'
import { formatDate, formatPhone } from '@/lib/utils'
import { isStrongPassword, PASSWORD_RULE_TEXT, generateSuggestedPassword } from '@/lib/password'
import { useCompanyAuth } from '@/framework/companyAuth/CompanyAuthContext'
import companyMeService from '@/services/companyMe.service'
import companyAuthService from '@/services/companyAuth.service'
import { COMPANY_STATUS_LABELS, COMPANY_STATUS_TONE, type CompanyUser, type UpdateCompanyProfileRequest, type CompanySocialMedia } from '@/types/companyAuth.types'
import type { ServiceCategoryRef } from '@/types/serviceCategory.types'
import { ImageCropModal } from '@/components/specialized/ImageCropModal'
import { MapPicker, type MapCoords } from '@/components/specialized/MapPicker'
import { CompanyStatusBanner } from './CompanyStatusBanner'
import { OPEN_COMPANY_ONBOARDING_EVENT } from '@/framework/companyLayout/CompanyAppShell'

const MAX_GALLERY_IMAGES = 10
const MAX_FILE_SIZE_MB = 3
const GALLERY_ASPECT = 4 / 3
const BANNER_MOBILE_ASPECT = 4 / 3

type InfoTone = 'blue' | 'green' | 'orange' | 'violet' | 'pink'

const INFO_TONE: Record<InfoTone, string> = {
  blue: 'bg-accent-blue-soft text-accent-blue',
  green: 'bg-accent-green-soft text-accent-green',
  orange: 'bg-accent-orange-soft text-accent-orange',
  violet: 'bg-accent-violet-soft text-accent-violet',
  pink: 'bg-accent-pink-soft text-accent-pink',
}

const InfoRow = ({
  icon: Icon,
  label,
  tone,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  tone: InfoTone
  children: React.ReactNode
}) => (
  <div className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-1">
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${INFO_TONE[tone]}`}>
      <Icon className="h-4 w-4" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="type-caption text-foreground-subtle">{label}</p>
      <div className="type-body-strong break-words text-foreground-default">{children}</div>
    </div>
  </div>
)

const basePayload = (c: CompanyUser): UpdateCompanyProfileRequest => ({
  name: c.name,
  phone: c.phone,
  email: c.email ?? undefined,
  address: c.address,
  district: c.district,
  logo: c.logo ?? null,
  bannerImage: c.bannerImage ?? null,
  bannerImageMobile: c.bannerImageMobile ?? null,
  description: c.description ?? null,
  website: c.website ?? null,
  socialMedia: c.socialMedia ?? null,
  latitude: c.latitude ?? null,
  longitude: c.longitude ?? null,
  galleryImages: c.galleryImages ?? [],
  serviceDescription: c.serviceDescription ?? null,
  serviceCategoryId: c.serviceCategory?.id ?? null,
})

export const CompanyProfilePage = () => {
  const { state, refreshCompany } = useCompanyAuth()

  const logoFileRef = useRef<HTMLInputElement>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoCropSrc, setLogoCropSrc] = useState<string | null>(null)

  const bannerWebFileRef = useRef<HTMLInputElement>(null)
  const [uploadingBannerWeb, setUploadingBannerWeb] = useState(false)
  const [bannerWebCropSrc, setBannerWebCropSrc] = useState<string | null>(null)

  const bannerMobileFileRef = useRef<HTMLInputElement>(null)
  const [uploadingBannerMobile, setUploadingBannerMobile] = useState(false)
  const [bannerMobileCropSrc, setBannerMobileCropSrc] = useState<string | null>(null)

  const galleryFileRef = useRef<HTMLInputElement>(null)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [galleryCropSrc, setGalleryCropSrc] = useState<string | null>(null)
  const [galleryCropQueue, setGalleryCropQueue] = useState<string[]>([])
  const [galleryAspect, setGalleryAspect] = useState<4 | 16>(4)
  const [deletingGalleryIdx, setDeletingGalleryIdx] = useState<number | null>(null)

  const [serviceDescOpen, setServiceDescOpen] = useState(false)
  const [serviceDescValue, setServiceDescValue] = useState('')
  const [savingServiceDesc, setSavingServiceDesc] = useState(false)

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwErrors, setPwErrors] = useState<{ current?: string; newPw?: string; confirm?: string }>({})
  const [savingPw, setSavingPw] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')
  const [coords, setCoords] = useState<MapCoords>({})
  const [facebook, setFacebook] = useState('')
  const [instagram, setInstagram] = useState('')
  const [twitter, setTwitter] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string; address?: string; serviceCategory?: string }>({})
  const [saving, setSaving] = useState(false)

  const [categories, setCategories] = useState<ServiceCategoryRef[]>([])
  const [serviceCategoryId, setServiceCategoryId] = useState('')

  useEffect(() => {
    companyMeService.serviceCategoryOptions().then(setCategories).catch(() => setCategories([]))
  }, [])

  const createCategory = async (name: string): Promise<ServiceCategoryRef> => {
    const created = await companyMeService.createServiceCategory(name)
    setCategories((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]))
    return created
  }

  const company = state.status === 'authenticated' ? state.company : undefined
  if (!company) return null

  const openEdit = () => {
    setName(company.name)
    setPhone(company.phone)
    setEmail(company.email ?? '')
    setAddress(company.address)
    setDescription(company.description ?? '')
    setWebsite(company.website ?? '')
    setCoords({ latitude: company.latitude ?? undefined, longitude: company.longitude ?? undefined })
    setFacebook(company.socialMedia?.facebook ?? '')
    setInstagram(company.socialMedia?.instagram ?? '')
    setTwitter(company.socialMedia?.twitter ?? '')
    setLinkedin(company.socialMedia?.linkedin ?? '')
    setServiceCategoryId(company.serviceCategory?.id ?? '')
    setErrors({})
    setEditOpen(true)
  }

  const save = async () => {
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Firma adı zorunludur.'
    if (!/^0\d{10}$/.test(phone)) next.phone = 'Telefon 0 ile başlamalı ve 11 haneli olmalıdır.'
    if (email.trim() && !isValidEmail(email.trim())) next.email = 'Geçerli bir e-posta adresi giriniz.'
    if (!address.trim()) next.address = 'Adres zorunludur.'
    if (!serviceCategoryId) next.serviceCategory = 'Hizmet kategorisi zorunludur.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setSaving(true)
    try {
      const social: CompanySocialMedia = {
        facebook: facebook.trim() || undefined,
        instagram: instagram.trim() || undefined,
        twitter: twitter.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
      }
      const hasSocial = social.facebook || social.instagram || social.twitter || social.linkedin
      await companyMeService.updateProfile({
        ...basePayload(company),
        name: name.trim(),
        phone,
        email: email.trim() || undefined,
        address: address.trim(),
        description: description.trim() || null,
        website: website.trim() || null,
        latitude: coords.latitude ?? null,
        longitude: coords.longitude ?? null,
        socialMedia: hasSocial ? social : null,
        serviceCategoryId,
      })
      await refreshCompany()
      toast.success('Firma bilgileri güncellendi.')
      setEditOpen(false)
    } catch {
      void 0
    } finally {
      setSaving(false)
    }
  }

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLogoCropSrc(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleLogoCropped = async (blob: Blob) => {
    setLogoCropSrc(null)
    setUploadingLogo(true)
    try {
      const file = new File([blob], 'logo.jpg', { type: 'image/jpeg' })
      const url = await companyMeService.uploadImage(file)
      await companyMeService.updateProfile({ ...basePayload(company), logo: url })
      await refreshCompany()
      toast.success('Logo güncellendi.')
    } catch {
      void 0
    } finally {
      setUploadingLogo(false)
    }
  }

  const onBannerWebChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setBannerWebCropSrc(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleBannerWebCropped = async (blob: Blob) => {
    setBannerWebCropSrc(null)
    setUploadingBannerWeb(true)
    try {
      const file = new File([blob], 'banner-web.jpg', { type: 'image/jpeg' })
      const url = await companyMeService.uploadImage(file)
      await companyMeService.updateProfile({ ...basePayload(company), bannerImage: url })
      await refreshCompany()
      toast.success('Web banner güncellendi.')
    } catch {
      void 0
    } finally {
      setUploadingBannerWeb(false)
    }
  }

  const onBannerMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setBannerMobileCropSrc(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleBannerMobileCropped = async (blob: Blob) => {
    setBannerMobileCropSrc(null)
    setUploadingBannerMobile(true)
    try {
      const file = new File([blob], 'banner-mobile.jpg', { type: 'image/jpeg' })
      const url = await companyMeService.uploadImage(file)
      await companyMeService.updateProfile({ ...basePayload(company), bannerImageMobile: url })
      await refreshCompany()
      toast.success('Mobil banner güncellendi.')
    } catch {
      void 0
    } finally {
      setUploadingBannerMobile(false)
    }
  }

  const onGalleryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const available = MAX_GALLERY_IMAGES - (company.galleryImages ?? []).length
    const selectedCount = e.target.files?.length ?? 0
    const files = Array.from(e.target.files ?? []).slice(0, available)
    e.target.value = ''
    if (files.length === 0) return

    const validFiles = files.filter((file) => {
      if (file.size <= MAX_FILE_SIZE_MB * 1024 * 1024) return true
      toast.error(`${file.name}: Dosya boyutu en fazla ${MAX_FILE_SIZE_MB} MB olabilir.`)
      return false
    })
    if (validFiles.length === 0) return
    if (selectedCount > available) {
      toast.info(`Galeri sınırı nedeniyle yalnızca ${available} görsel işleme alındı.`)
    }

    Promise.all(validFiles.map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    }))).then(([first, ...rest]) => {
      setGalleryCropSrc(first)
      setGalleryCropQueue(rest)
    }).catch(() => toast.error('Görseller okunamadı.'))
  }

  const handleGalleryCropped = async (blob: Blob) => {
    setGalleryCropSrc(null)
    const currentImages = company.galleryImages ?? []
    if (currentImages.length >= MAX_GALLERY_IMAGES) {
      toast.error(`En fazla ${MAX_GALLERY_IMAGES} galeri görseli yükleyebilirsiniz.`)
      setGalleryCropQueue([])
      return
    }
    setUploadingGallery(true)
    try {
      const file = new File([blob], `gallery-${Date.now()}.jpg`, { type: 'image/jpeg' })
      const url = await companyMeService.uploadImage(file)
      const newImages = [...currentImages, url]
      await companyMeService.updateProfile({ ...basePayload(company), galleryImages: newImages })
      await refreshCompany()
      toast.success('Galeri görseli eklendi.')
    } catch {
      void 0
    } finally {
      setUploadingGallery(false)
      const [next, ...rest] = galleryCropQueue
      setGalleryCropSrc(next ?? null)
      setGalleryCropQueue(rest)
    }
  }

  const closeGalleryCrop = () => {
    const [next, ...rest] = galleryCropQueue
    setGalleryCropSrc(next ?? null)
    setGalleryCropQueue(rest)
  }

  const handleDeleteGalleryImage = async (idx: number) => {
    const currentImages = company.galleryImages ?? []
    setDeletingGalleryIdx(idx)
    try {
      const newImages = currentImages.filter((_, i) => i !== idx)
      await companyMeService.updateProfile({ ...basePayload(company), galleryImages: newImages })
      await refreshCompany()
      toast.success('Görsel kaldırıldı.')
    } catch {
      void 0
    } finally {
      setDeletingGalleryIdx(null)
    }
  }

  const openServiceDesc = () => {
    setServiceDescValue(company.serviceDescription ?? '')
    setServiceDescOpen(true)
  }

  const saveServiceDesc = async () => {
    setSavingServiceDesc(true)
    try {
      await companyMeService.updateProfile({ ...basePayload(company), serviceDescription: serviceDescValue.trim() || null })
      await refreshCompany()
      toast.success('Hizmet tanıtımı güncellendi.')
      setServiceDescOpen(false)
    } catch {
      void 0
    } finally {
      setSavingServiceDesc(false)
    }
  }

  const openPassword = () => {
    setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwErrors({})
    setPasswordOpen(true)
  }

  const suggestPassword = () => {
    const suggestion = generateSuggestedPassword()
    setNewPw(suggestion)
    setConfirmPw(suggestion)
    setPwErrors((p) => ({ ...p, newPw: undefined, confirm: undefined }))
  }

  const savePassword = async () => {
    const next: typeof pwErrors = {}
    if (!currentPw) next.current = 'Mevcut şifrenizi giriniz.'
    if (!isStrongPassword(newPw)) next.newPw = PASSWORD_RULE_TEXT
    if (newPw && newPw === currentPw) next.newPw = 'Yeni şifre mevcut şifreden farklı olmalıdır.'
    if (confirmPw !== newPw) next.confirm = 'Şifreler eşleşmiyor.'
    setPwErrors(next)
    if (Object.keys(next).length > 0) return
    setSavingPw(true)
    try {
      await companyAuthService.changePassword({ currentPassword: currentPw, newPassword: newPw })
      toast.success('Şifreniz değiştirildi.')
      setPasswordOpen(false)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch {
      void 0
    } finally {
      setSavingPw(false)
    }
  }

  const bannerSrc = company.bannerImage ?? undefined
  const logoSrc = company.logo ?? undefined

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        <div className="p-4 pb-0">
          <CompanyStatusBanner status={company.status} rejectReason={company.rejectReason} />
        </div>

        <div className="relative">
          <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-primary via-accent-violet to-accent-pink">
            {bannerSrc ? (
              <img src={bannerSrc} alt="Firma Banner" className="h-full w-full object-cover" />
            ) : (
              <div className="relative flex h-full w-full items-center justify-center">
                <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_30%,white_0,transparent_40%),radial-gradient(circle_at_80%_70%,white_0,transparent_35%)]" />
                <Building2Icon className="relative h-12 w-12 text-white/70" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            <button
              type="button"
              title="Banner değiştir"
              disabled={uploadingBannerWeb}
              onClick={() => bannerWebFileRef.current?.click()}
              className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-black/20 backdrop-blur-md ring-1 ring-white/20 transition-all hover:bg-black/60 hover:shadow-black/30 active:scale-95 disabled:opacity-50"
            >
              {uploadingBannerWeb ? (
                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
              Banner
            </button>
          </div>

          <div className="absolute bottom-0 left-4 translate-y-1/2">
            <div className="relative rounded-lg bg-surface-0">
              <Avatar
                name={company.name}
                src={logoSrc}
                size="md"
                className="!h-20 !w-20 !rounded-lg object-contain ring-4 ring-surface-0"
              />
              <button
                type="button"
                title="Logo değiştir"
                disabled={uploadingLogo}
                onClick={() => logoFileRef.current?.click()}
                className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent-violet text-white shadow-md shadow-primary/40 ring-2 ring-surface-0 transition-all hover:shadow-lg hover:shadow-primary/50 active:scale-90 disabled:opacity-50"
              >
                {uploadingLogo ? (
                  <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CameraIcon className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12 px-4 pb-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-foreground-default">{company.name}</h1>
              <div className="mt-1">
                <Badge tone={COMPANY_STATUS_TONE[company.status]}>{COMPANY_STATUS_LABELS[company.status]}</Badge>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                type="button"
                title="Panel Kullanım Kılavuzu"
                onClick={() => window.dispatchEvent(new Event(OPEN_COMPANY_ONBOARDING_EVENT))}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-1 hover:text-primary"
              >
                <HelpCircleIcon className="h-4.5 w-4.5" />
              </button>
              <Button
                variant="primary"
                size="sm"
                className="bg-gradient-to-br from-primary to-accent-violet shadow-md shadow-primary/30 transition-all hover:shadow-lg hover:shadow-primary/40 active:scale-95"
                iconLeft={<PencilIcon className="h-4 w-4" />}
                onClick={openEdit}
              >
                Düzenle
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <Card padded accent="blue">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-blue to-accent-violet text-white shadow-sm shadow-accent-blue/30">
                <Building2Icon className="h-4 w-4" />
              </span>
              <p className="type-section">İletişim Bilgileri</p>
            </div>
            <div className="space-y-2.5">
              <InfoRow icon={HashIcon} label="Vergi Numarası" tone="violet">{company.taxNumber}</InfoRow>
              <InfoRow icon={PhoneIcon} label="Telefon" tone="green">{formatPhone(company.phone)}</InfoRow>
              <InfoRow icon={MailIcon} label="E-Posta" tone="blue">{company.email ?? '—'}</InfoRow>
              <InfoRow icon={MapPinIcon} label="Adres" tone="orange">{company.address}</InfoRow>
              <InfoRow icon={GlobeIcon} label="Web Sitesi" tone="blue">{company.website ?? '—'}</InfoRow>
              <InfoRow icon={FileTextIcon} label="Açıklama" tone="pink">{company.description ?? '—'}</InfoRow>
              <InfoRow icon={TagsIcon} label="Hizmet Kategorisi" tone="violet">
                {company.serviceCategory ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: company.serviceCategory.color }} />
                    {company.serviceCategory.name}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={openEdit}
                    className="type-body-strong text-danger underline decoration-dotted underline-offset-2"
                  >
                    Seçilmedi — eklemek için dokunun
                  </button>
                )}
              </InfoRow>
              <InfoRow icon={CalendarIcon} label="Kayıt Tarihi" tone="green">{formatDate(company.createdAt)}</InfoRow>
            </div>
            {typeof company.latitude === 'number' && typeof company.longitude === 'number' && (
              <div className="mt-3">
                <MapPicker readOnly value={{ latitude: company.latitude, longitude: company.longitude }} height={160} />
              </div>
            )}
            {(company.socialMedia?.facebook || company.socialMedia?.instagram || company.socialMedia?.twitter || company.socialMedia?.linkedin) && (
              <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                {company.socialMedia?.facebook && (
                  <a href={company.socialMedia.facebook} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-1 text-foreground-muted transition-colors hover:bg-accent-blue-soft hover:text-accent-blue">
                    <FacebookIcon className="h-4 w-4" />
                  </a>
                )}
                {company.socialMedia?.instagram && (
                  <a href={company.socialMedia.instagram} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-1 text-foreground-muted transition-colors hover:bg-accent-pink-soft hover:text-accent-pink">
                    <InstagramIcon className="h-4 w-4" />
                  </a>
                )}
                {company.socialMedia?.twitter && (
                  <a href={company.socialMedia.twitter} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-1 text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground-strong">
                    <TwitterIcon className="h-4 w-4" />
                  </a>
                )}
                {company.socialMedia?.linkedin && (
                  <a href={company.socialMedia.linkedin} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-1 text-foreground-muted transition-colors hover:bg-accent-blue-soft hover:text-accent-blue">
                    <LinkedinIcon className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}
          </Card>

          <Card padded accent="blue">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-blue to-primary text-white shadow-sm shadow-accent-blue/30">
                <ImageIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="type-section">Banner Görselleri</p>
                <p className="type-caption text-foreground-muted">Web ve mobil için ayrı görsel yükleyip farklı kırpabilirsiniz.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="type-caption font-semibold text-foreground-muted">Web Banner (16:9)</p>
                <div className="group relative aspect-video w-full overflow-hidden rounded-card bg-surface-1">
                  {bannerSrc ? (
                    <img src={bannerSrc} alt="Web banner" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-foreground-subtle" />
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={uploadingBannerWeb}
                    onClick={() => bannerWebFileRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 text-transparent transition-colors group-hover:bg-black/40 group-hover:text-white disabled:cursor-not-allowed"
                  >
                    {uploadingBannerWeb ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <CameraIcon className="h-4 w-4" />}
                    <span className="text-xs font-medium">Değiştir</span>
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="type-caption font-semibold text-foreground-muted">Mobil Banner (4:3)</p>
                <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-card bg-surface-1">
                  {company.bannerImageMobile ? (
                    <img src={company.bannerImageMobile} alt="Mobil banner" className="h-full w-full object-cover" />
                  ) : bannerSrc ? (
                    <>
                      <img src={bannerSrc} alt="Mobil banner (web'den)" className="h-full w-full object-cover opacity-60" />
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white">Web'den kullanılıyor</span>
                    </>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-foreground-subtle" />
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={uploadingBannerMobile}
                    onClick={() => bannerMobileFileRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 text-transparent transition-colors group-hover:bg-black/40 group-hover:text-white disabled:cursor-not-allowed"
                  >
                    {uploadingBannerMobile ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <CameraIcon className="h-4 w-4" />}
                    <span className="text-xs font-medium">Değiştir</span>
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card padded accent="violet">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-violet to-accent-pink text-white shadow-sm shadow-accent-violet/30">
                  <LayoutListIcon className="h-4 w-4" />
                </span>
                <p className="type-section">Hizmet Tanıtımı</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<PencilIcon className="h-4 w-4" />}
                onClick={openServiceDesc}
              >
                Düzenle
              </Button>
            </div>
            {company.serviceDescription ? (
              <p className="type-body whitespace-pre-wrap text-foreground-muted">{company.serviceDescription}</p>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <LayoutListIcon className="h-8 w-8 text-foreground-subtle" />
                <p className="type-caption text-foreground-muted">Henüz hizmet tanıtımı eklenmemiş.</p>
                <Button variant="outline" size="sm" iconLeft={<PlusIcon className="h-4 w-4" />} onClick={openServiceDesc}>
                  Tanıtım Ekle
                </Button>
              </div>
            )}
          </Card>

          <Card padded accent="orange">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-orange to-accent-pink text-white shadow-sm shadow-accent-orange/30">
                  <ImageIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="type-section">Fotoğraf Galerisi</p>
                  <p className="type-caption text-foreground-muted">{(company.galleryImages ?? []).length}/{MAX_GALLERY_IMAGES} görsel</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-border bg-surface-1 p-1">
                  <button
                    type="button"
                    onClick={() => setGalleryAspect(4)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${galleryAspect === 4 ? 'bg-white text-primary shadow-sm' : 'text-foreground-muted'}`}
                  >
                    4:3
                  </button>
                  <button
                    type="button"
                    onClick={() => setGalleryAspect(16)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${galleryAspect === 16 ? 'bg-white text-primary shadow-sm' : 'text-foreground-muted'}`}
                  >
                    16:9
                  </button>
                </div>
                {(company.galleryImages ?? []).length < MAX_GALLERY_IMAGES && (
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={uploadingGallery ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <PlusIcon className="h-4 w-4" />}
                    disabled={uploadingGallery}
                    onClick={() => galleryFileRef.current?.click()}
                  >
                    Görseller Ekle
                  </Button>
                )}
              </div>
            </div>
            {(company.galleryImages ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <ImageIcon className="h-10 w-10 text-foreground-subtle" />
                <p className="type-caption text-foreground-muted">Galeri boş. Firma fotoğraflarınızı ekleyin.</p>
                <p className="type-caption text-foreground-subtle">En fazla {MAX_GALLERY_IMAGES} görsel · 4:3 veya 16:9 · Max {MAX_FILE_SIZE_MB} MB</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(company.galleryImages ?? []).map((url, idx) => (
                  <div key={idx} className="group relative aspect-[4/3] overflow-hidden rounded-card bg-slate-100">
                    <img src={url} alt={`Galeri ${idx + 1}`} className="h-full w-full object-contain" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                      <button
                        type="button"
                        disabled={deletingGalleryIdx === idx}
                        onClick={() => void handleDeleteGalleryImage(idx)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-danger text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 disabled:opacity-50"
                        title="Görseli kaldır"
                      >
                        {deletingGalleryIdx === idx ? (
                          <Loader2Icon className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2Icon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card padded accent="violet">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-pink to-danger text-white shadow-sm shadow-accent-pink/30">
                <KeyRoundIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="type-section">Güvenlik</p>
                <p className="type-caption text-foreground-muted">Giriş şifrenizi istediğiniz zaman değiştirin.</p>
              </div>
            </div>
            <Button variant="outline" className="w-full" iconLeft={<KeyRoundIcon className="h-4 w-4" />} onClick={openPassword}>
              Şifremi Değiştir
            </Button>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="type-section">Gizlilik ve İzinler</p>
                <p className="type-caption text-foreground-muted">
                  KVKK: {company.kvkkAccepted ? 'Onaylandı' : 'Onaylanmadı'} · Bildirim izni: {company.notificationConsentAccepted ? 'Onaylandı' : 'Onaylanmadı'}
                </p>
              </div>
            </div>
          </Card>

        </div>
      </div>

      <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
      <input ref={bannerWebFileRef} type="file" accept="image/*" className="hidden" onChange={onBannerWebChange} />
      <input ref={bannerMobileFileRef} type="file" accept="image/*" className="hidden" onChange={onBannerMobileChange} />
      <input ref={galleryFileRef} type="file" accept="image/*" multiple className="hidden" onChange={onGalleryFileChange} />

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        fullscreen
        fullscreenDesktopWidth={800}
        title="Firma Bilgileri"
        subtitle="İletişim ve tanıtım bilgilerinizi güncelleyin"
        bodyClassName="bg-surface-1 p-4"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Vazgeç</Button>
            <Button variant="primary" className="flex-1" isLoading={saving} onClick={save}>Kaydet</Button>
          </div>
        }
      >
        <div className="mx-auto max-w-[720px] space-y-4 py-4">
          <FormSection title="İletişim Bilgileri" icon={Building2Icon} variant="card">
            <div className="space-y-4">
              <Field label="Firma Adı" required error={errors.name}>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Firma ünvanı" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefon" required error={errors.phone}>
                  <PhoneInput value={phone} onChange={setPhone} />
                </Field>
                <Field label="E-Posta (opsiyonel)" error={errors.email}>
                  <EmailInput value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
              </div>
              <Field label="Adres" required error={errors.address}>
                <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Firma adresi" />
              </Field>
              <Field label="Hizmet Kategorisi" required error={errors.serviceCategory}>
                <Combobox
                  value={serviceCategoryId}
                  displayValue={categories.find((c) => c.id === serviceCategoryId)?.name}
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  allowCustom
                  placeholder="Kategori ara veya yeni ekle…"
                  emptyText="Kategori bulunamadı"
                  onChange={async (value, option) => {
                    if (option || categories.some((c) => c.id === value)) {
                      setServiceCategoryId(value)
                      setErrors((p) => ({ ...p, serviceCategory: undefined }))
                    } else if (value.trim()) {
                      const created = await createCategory(value.trim())
                      setServiceCategoryId(created.id)
                      setErrors((p) => ({ ...p, serviceCategory: undefined }))
                    } else {
                      setServiceCategoryId('')
                    }
                  }}
                />
                {!errors.serviceCategory && <p className="type-caption">Kampanyalarınız bu kategori altında listelenecektir. Listede olmayan bir kategori adı yazıp seçerek yeni kategori oluşturabilirsiniz.</p>}
              </Field>
            </div>
          </FormSection>

          <FormSection title="Konum" icon={MapPinIcon} variant="card">
            <Field hint="Google Haritalar'da doğrudan arayın (yazarken öneriler düşer) veya haritaya dokunarak/pin'i sürükleyerek elle işaretleyin.">
              <MapPicker
                value={coords}
                onChange={setCoords}
                onAddressPick={(picked) => setAddress((current) => current.trim() ? current : picked)}
              />
            </Field>
          </FormSection>

          <FormSection title="Tanıtım" icon={FileTextIcon} variant="card">
            <div className="space-y-4">
              <Field label="Web Sitesi">
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
              </Field>
              <Field label="Açıklama" hint="Firmanızı kısaca tanıtın">
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Firma açıklaması" />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Sosyal Medya" icon={ShareIcon} variant="card">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Facebook">
                <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://facebook.com/..." iconLeft={<FacebookIcon className="h-4 w-4" />} />
              </Field>
              <Field label="Instagram">
                <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/..." iconLeft={<InstagramIcon className="h-4 w-4" />} />
              </Field>
              <Field label="Twitter / X">
                <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/..." iconLeft={<TwitterIcon className="h-4 w-4" />} />
              </Field>
              <Field label="LinkedIn">
                <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/..." iconLeft={<LinkedinIcon className="h-4 w-4" />} />
              </Field>
            </div>
          </FormSection>
        </div>
      </Modal>

      {logoCropSrc && (
        <ImageCropModal
          open={!!logoCropSrc}
          imageSrc={logoCropSrc}
          aspect={1}
          onClose={() => setLogoCropSrc(null)}
          onCrop={(blob) => void handleLogoCropped(blob)}
        />
      )}

      {bannerWebCropSrc && (
        <ImageCropModal
          open={!!bannerWebCropSrc}
          imageSrc={bannerWebCropSrc}
          aspect={16 / 9}
          onClose={() => setBannerWebCropSrc(null)}
          onCrop={(blob) => void handleBannerWebCropped(blob)}
        />
      )}

      {bannerMobileCropSrc && (
        <ImageCropModal
          open={!!bannerMobileCropSrc}
          imageSrc={bannerMobileCropSrc}
          aspect={BANNER_MOBILE_ASPECT}
          onClose={() => setBannerMobileCropSrc(null)}
          onCrop={(blob) => void handleBannerMobileCropped(blob)}
        />
      )}

      {galleryCropSrc && (
        <ImageCropModal
          open={!!galleryCropSrc}
          imageSrc={galleryCropSrc}
          aspect={galleryAspect === 16 ? 16 / 9 : GALLERY_ASPECT}
          onClose={closeGalleryCrop}
          onCrop={(blob) => void handleGalleryCropped(blob)}
        />
      )}

      <Modal
        open={serviceDescOpen}
        onClose={() => setServiceDescOpen(false)}
        title="Hizmet Tanıtımı"
        subtitle="Firmanızın sunduğu hizmetleri ve çalışma alanlarını tanıtın"
        width={480}
        bodyClassName="p-5"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setServiceDescOpen(false)}>Vazgeç</Button>
            <Button variant="primary" className="flex-1" isLoading={savingServiceDesc} onClick={() => void saveServiceDesc()}>Kaydet</Button>
          </div>
        }
      >
        <Field label="Hizmet Tanıtımı" hint="Müşterilerinize sunduğunuz hizmetler, uzmanlık alanlarınız ve çalışma koşullarınız hakkında bilgi verin.">
          <Textarea
            value={serviceDescValue}
            onChange={(e) => setServiceDescValue(e.target.value)}
            placeholder="Örn. 10 yıllık deneyimimizle erkek kuaförü hizmetleri sunuyoruz. Saç kesimi, sakal tıraşı ve cilt bakımı alanlarında uzmanız..."
            rows={7}
          />
        </Field>
      </Modal>

      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Şifremi Değiştir"
        subtitle="Mevcut şifrenizi doğrulayıp yeni bir şifre belirleyin"
        width={420}
        bodyClassName="p-5"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setPasswordOpen(false)}>Vazgeç</Button>
            <Button variant="primary" className="flex-1" isLoading={savingPw} disabled={!currentPw || !newPw || !confirmPw} onClick={() => void savePassword()}>Kaydet</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Mevcut Şifre" error={pwErrors.current}>
            <PasswordInput value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Mevcut şifreniz" />
          </Field>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="Yeni Şifre" hint={PASSWORD_RULE_TEXT} error={pwErrors.newPw}>
                <PasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Yeni şifre" />
              </Field>
            </div>
            <Button variant="outline" size="sm" className="mb-0.5" iconLeft={<RefreshCwIcon className="h-4 w-4" />} onClick={suggestPassword} title="Güçlü bir şifre öner">
              Öner
            </Button>
          </div>
          <Field label="Yeni Şifre (Tekrar)" error={pwErrors.confirm}>
            <PasswordInput value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Yeni şifre tekrar" />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
