import { useEffect, useRef, useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, ImageIcon, PresentationIcon, Trash2Icon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Banner, Button, FormSection, IconButton } from '@/design-system'
import { ImageCropModal } from '@/components/specialized/ImageCropModal'
import { mobileConfigService, type MobileAppConfig } from '@/services/mobileConfig.service'

const MAX_IMAGES = 20
const IMAGE_MAX_BYTES = 2 * 1024 * 1024
const SOURCE_MAX_BYTES = 15 * 1024 * 1024
const WIDTH = 1080
const HEIGHT = 2340

interface OnboardingImagesSectionProps {
  images: string[]
  onChange: (config: MobileAppConfig) => void
}

export const OnboardingImagesSection = ({ images, onChange }: OnboardingImagesSectionProps) => {
  const [busy, setBusy] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const closeCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  useEffect(() => () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
  }, [cropSrc])

  const save = async (next: string[], successMessage: string) => {
    setBusy(true)
    try {
      onChange(await mobileConfigService.updateOnboardingImages(next))
      toast.success(successMessage)
    } finally {
      setBusy(false)
    }
  }

  const selectForCrop = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.warning('Lütfen bir görsel dosyası seçin.')
      return
    }
    if (file.size > SOURCE_MAX_BYTES) {
      toast.warning('Kırpılacak kaynak görsel en fazla 15 MB olabilir.')
      return
    }
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(URL.createObjectURL(file))
  }

  const uploadCropped = async (blob: Blob) => {
    closeCrop()
    if (blob.size > IMAGE_MAX_BYTES) {
      toast.warning('Görsel en fazla 2 MB olabilir.')
      return
    }
    setBusy(true)
    try {
      const file = new File([blob], `onboarding-${Date.now()}.webp`, { type: 'image/webp' })
      const { url } = await mobileConfigService.uploadOnboardingImage(file)
      onChange(await mobileConfigService.updateOnboardingImages([...images, url]))
      toast.success('Tanıtım görseli eklendi.')
    } finally {
      setBusy(false)
    }
  }

  const move = (index: number, delta: number) => {
    const next = [...images]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    void save(next, 'Sıralama güncellendi.')
  }

  const remove = (index: number) =>
    void save(images.filter((_, i) => i !== index), 'Tanıtım görseli kaldırıldı.')

  return (
    <FormSection
      variant="card"
      icon={PresentationIcon}
      title="Tanıtım ekranları"
      subtitle="Uygulamayı ilk kez açan kullanıcılara kaydırmalı olarak gösterilir"
    >
      <div className="space-y-4">
        <Banner tone="info" variant="soft">
          Görselleri <strong>1080 × 2340 px</strong> (9:19.5, güncel telefon ekranı) boyutunda
          hazırlayın; yüklenen görsel bu orana kırpılır ve WebP olarak kaydedilir. Alt kısımdaki
          ~250 px'e nokta ve ok butonu gelir, önemli içerik koymayın. Kullanıcı sırayla kaydırır; son görselde "Başla" ile uygulamaya geçer.
          Görsel eklenmezse tanıtım gösterilmez. En fazla {MAX_IMAGES} görsel eklenebilir.
        </Banner>

        <div className="flex flex-wrap gap-4">
          {images.map((url, index) => (
            <div key={url} className="flex w-[108px] flex-col items-center gap-1">
              <div className="h-[234px] w-[108px] overflow-hidden rounded-card border border-border bg-surface-2">
                <img src={url} alt={`Tanıtım ${index + 1}`} className="h-full w-full object-cover" />
              </div>
              <div className="flex items-center">
                <IconButton
                  size="sm"
                  title="Sola al"
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                </IconButton>
                <span className="type-caption w-5 text-center">{index + 1}</span>
                <IconButton
                  size="sm"
                  title="Sağa al"
                  disabled={busy || index === images.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowRightIcon className="h-4 w-4" />
                </IconButton>
                <IconButton size="sm" tone="danger" title="Kaldır" disabled={busy} onClick={() => remove(index)}>
                  <Trash2Icon className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          ))}

          {images.length === 0 && (
            <div className="flex h-[234px] w-[108px] items-center justify-center rounded-card border border-border bg-surface-2">
              <ImageIcon className="h-8 w-8 text-foreground-subtle" />
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) selectForCrop(file)
          }}
        />
        <Button
          variant="outline"
          iconLeft={<UploadIcon className="h-4 w-4" />}
          isLoading={busy}
          disabled={images.length >= MAX_IMAGES}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          Görsel ekle
        </Button>
      </div>

      {cropSrc && (
        <ImageCropModal
          open
          imageSrc={cropSrc}
          aspect={WIDTH / HEIGHT}
          outputWidth={WIDTH}
          outputHeight={HEIGHT}
          outputType="image/webp"
          outputQuality={0.88}
          helperText="Telefon ekranı alanını sürükleyerek ayarlayın · Çıktı: 1080 × 2340 WebP"
          onClose={closeCrop}
          onCrop={(blob) => void uploadCropped(blob)}
        />
      )}
    </FormSection>
  )
}
