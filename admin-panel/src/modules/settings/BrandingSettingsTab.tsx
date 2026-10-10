import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImageIcon, UploadIcon, Trash2Icon, CheckCircle2Icon, RectangleHorizontalIcon } from 'lucide-react'
import { Button, FormSection, Banner } from '@/design-system'
import systemBrandingService from '@/services/systemBranding.service'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export const BrandingSettingsTab = () => {
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [hUploading, setHUploading] = useState(false)
  const [hRemoving, setHRemoving] = useState(false)
  const [horizontalLogoUrl, setHorizontalLogoUrl] = useState<string | null>(null)
  const hInputRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    systemBrandingService.get()
      .then((data) => {
        setLogoUrl(data.logoUrl)
        setHorizontalLogoUrl(data.horizontalLogoUrl)
        setUpdatedAt(data.updatedAt)
      })
      .catch(() => toast.error('Logo bilgisi yüklenemedi.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleFileSelect = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Logo yalnızca PNG, JPG, WEBP veya SVG formatında olabilir.')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Logo dosyası 5 MB\'tan büyük olamaz.')
      return
    }
    setUploading(true)
    try {
      const result = await systemBrandingService.uploadLogo(file)
      setLogoUrl(result.url)
      setUpdatedAt(new Date().toISOString())
      toast.success('Logo başarıyla güncellendi. Tüm uygulamalarda (admin panel, vatandaş portalı, mobil) yeni logo görünecek.')
    } catch {
      toast.error('Logo yüklenemedi.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    try {
      const result = await systemBrandingService.removeLogo()
      setLogoUrl(result.logoUrl)
      setUpdatedAt(result.updatedAt)
      toast.success('Logo kaldırıldı, varsayılan logoya dönüldü.')
    } catch {
      toast.error('Logo kaldırılamadı.')
    } finally {
      setRemoving(false)
    }
  }

  const handleHorizontalFileSelect = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Logo yalnızca PNG, JPG, WEBP veya SVG formatında olabilir.')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Logo dosyası 5 MB\'tan büyük olamaz.')
      return
    }
    setHUploading(true)
    try {
      const result = await systemBrandingService.uploadHorizontalLogo(file)
      setHorizontalLogoUrl(result.url)
      setUpdatedAt(new Date().toISOString())
      toast.success('Yatay logo güncellendi. Giriş ekranının üst kısmında bu logo kullanılacak.')
    } catch {
      toast.error('Yatay logo yüklenemedi.')
    } finally {
      setHUploading(false)
      if (hInputRef.current) hInputRef.current.value = ''
    }
  }

  const handleHorizontalRemove = async () => {
    setHRemoving(true)
    try {
      const result = await systemBrandingService.removeHorizontalLogo()
      setHorizontalLogoUrl(result.horizontalLogoUrl)
      setUpdatedAt(result.updatedAt)
      toast.success('Yatay logo kaldırıldı.')
    } catch {
      toast.error('Yatay logo kaldırılamadı.')
    } finally {
      setHRemoving(false)
    }
  }

  if (loading) {
    return <p className="type-muted">Yükleniyor…</p>
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <FormSection
        variant="card"
        icon={ImageIcon}
        title="Kurumsal Logo"
        subtitle="Admin panel, vatandaş portalı ve mobil uygulamada kullanılan logo"
      >
        <Banner tone="info" className="mb-4">
          Buradan yüklenen logo, admin panel giriş/menü ekranlarında, vatandaş portalında ve
          mobil uygulamada otomatik olarak kullanılır. Yeni yüklenen logo, kullanıcıların
          tarayıcı/uygulamayı yeniden açmasıyla görünür.
        </Banner>

        <div className="flex items-start gap-5">
          <div className="flex h-36 w-36 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]">
            {logoUrl ? (
              <img src={logoUrl} alt="Sistem logosu" className="h-full w-full object-contain p-1" />
            ) : (
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Varsayılan logo" className="h-full w-full object-contain p-1" />
            )}
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <p className="type-body-strong">
                {logoUrl ? 'Özel logo aktif' : 'Varsayılan logo kullanılıyor'}
              </p>
              {updatedAt && (
                <p className="type-caption">
                  Son güncelleme: {new Date(updatedAt).toLocaleString('tr-TR')}
                </p>
              )}
              {!logoUrl && (
                <p className="type-caption">
                  Henüz özel bir logo yüklenmedi, sistemin dahili varsayılan logosu gösteriliyor.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFileSelect(f) }}
              />
              <Button
                variant="primary"
                size="sm"
                isLoading={uploading}
                onClick={() => inputRef.current?.click()}
              >
                <UploadIcon className="h-3.5 w-3.5" />
                {logoUrl ? 'Logoyu Değiştir' : 'Logo Yükle'}
              </Button>
              {logoUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={removing}
                  onClick={() => void handleRemove()}
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                  Kaldır
                </Button>
              )}
            </div>

            <p className="type-caption">
              PNG, JPG, WEBP veya SVG · en fazla 5 MB · önerilen boyut kare (örn. 512×512px)
            </p>
          </div>
        </div>
      </FormSection>

      <FormSection
        variant="card"
        icon={RectangleHorizontalIcon}
        title="Yatay Logo"
        subtitle="Giriş ekranının üst kısmında kullanılan geniş/yatay logo"
      >
        <Banner tone="info" className="mb-4">
          Bu alan, kare logodan ayrı olarak yüklenir ve yalnızca uygulama giriş ekranının en
          üstünde kullanılır. Yüklenmezse giriş ekranında kare logo gösterilmeye devam eder.
        </Banner>

        <div className="flex items-start gap-5">
          <div className="flex h-36 w-60 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]">
            {horizontalLogoUrl ? (
              <img src={horizontalLogoUrl} alt="Yatay sistem logosu" className="h-full w-full object-contain p-1" />
            ) : (
              <span className="type-caption text-center px-2">Yatay logo yüklenmedi</span>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <p className="type-body-strong">
                {horizontalLogoUrl ? 'Yatay logo aktif' : 'Yatay logo yüklenmedi'}
              </p>
              {!horizontalLogoUrl && (
                <p className="type-caption">
                  Giriş ekranının üstünde şu anda kare logo kullanılıyor. Yatay logo yükleyerek değiştirebilirsiniz.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={hInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleHorizontalFileSelect(f) }}
              />
              <Button
                variant="primary"
                size="sm"
                isLoading={hUploading}
                onClick={() => hInputRef.current?.click()}
              >
                <UploadIcon className="h-3.5 w-3.5" />
                {horizontalLogoUrl ? 'Yatay Logoyu Değiştir' : 'Yatay Logo Yükle'}
              </Button>
              {horizontalLogoUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={hRemoving}
                  onClick={() => void handleHorizontalRemove()}
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                  Kaldır
                </Button>
              )}
            </div>

            <p className="type-caption">
              PNG, JPG, WEBP veya SVG · en fazla 5 MB · önerilen boyut geniş (örn. 480×160px)
            </p>
          </div>
        </div>
      </FormSection>

      {logoUrl && (
        <FormSection variant="card" icon={CheckCircle2Icon} title="Önizleme">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg p-4 flex flex-col items-center gap-2 bg-[var(--logo-preview-dark)]">
              <img src={logoUrl} alt="" className="h-10 w-10 object-contain" />
              <span className="text-xs text-white/70">Koyu zemin (Sidebar)</span>
            </div>
            <div className="rounded-lg p-4 flex flex-col items-center gap-2 border-[0.5px] border-[hsl(var(--border))] bg-[var(--logo-preview-light)]">
              <img src={logoUrl} alt="" className="h-10 w-10 object-contain" />
              <span className="text-xs text-[hsl(var(--foreground-muted))]">Açık zemin (Giriş ekranı)</span>
            </div>
            <div className="rounded-lg p-4 flex flex-col items-center gap-2 bg-primary">
              <img src={logoUrl} alt="" className="h-10 w-10 object-contain" />
              <span className="text-xs text-white/80">Ana renk zemin</span>
            </div>
          </div>
        </FormSection>
      )}
    </div>
  )
}
