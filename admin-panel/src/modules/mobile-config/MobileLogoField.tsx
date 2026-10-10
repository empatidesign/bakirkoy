import { useEffect, useRef, useState } from 'react'
import { UploadIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/design-system'
import { ImageCropModal } from '@/components/specialized/ImageCropModal'

const LOGO_MAX_BYTES = 1 * 1024 * 1024
const LOGO_SOURCE_MAX_BYTES = 15 * 1024 * 1024

interface MobileLogoFieldProps {
  label: string
  description: string
  value: string | null
  outputWidth: number
  outputHeight: number
  round?: boolean
  onUpload: (file: File) => Promise<void>
  onRemove: () => Promise<void>
}

export const MobileLogoField = ({
  label, description, value, outputWidth, outputHeight, round, onUpload, onRemove,
}: MobileLogoFieldProps) => {
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
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

  const selectForCrop = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.warning('Lütfen bir görsel dosyası seçin.')
      return
    }
    if (file.size > LOGO_SOURCE_MAX_BYTES) {
      toast.warning('Kırpılacak kaynak görsel en fazla 15 MB olabilir.')
      return
    }
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(URL.createObjectURL(file))
  }

  const uploadCropped = async (blob: Blob) => {
    if (blob.size > LOGO_MAX_BYTES) {
      toast.warning('Logo en fazla 1 MB olabilir.')
      return
    }
    const file = new File([blob], `logo-${Date.now()}.webp`, { type: 'image/webp' })
    closeCrop()
    setUploading(true)
    try {
      await onUpload(file)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async () => {
    setRemoving(true)
    try {
      await onRemove()
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex items-start gap-4">
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-1 p-2 ${
          round ? 'h-20 w-20 rounded-full' : 'h-20 w-48 rounded-card'
        }`}
      >
        {value ? (
          <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="type-caption px-2 text-center">Varsayılan</span>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="type-body-strong">{label}</p>
          <p className="type-muted">{description}</p>
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

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            iconLeft={<UploadIcon className="h-4 w-4" />}
            isLoading={uploading}
            disabled={removing}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            {value ? 'Değiştir' : 'Yükle'}
          </Button>

          {value && (
            <Button
              variant="danger"
              iconLeft={<Trash2Icon className="h-4 w-4" />}
              isLoading={removing}
              disabled={uploading}
              onClick={() => void remove()}
              type="button"
            >
              Kaldır
            </Button>
          )}
        </div>
      </div>

      {cropSrc && (
        <ImageCropModal
          open
          imageSrc={cropSrc}
          aspect={outputWidth / outputHeight}
          outputWidth={outputWidth}
          outputHeight={outputHeight}
          outputType="image/webp"
          outputQuality={0.92}
          helperText={`Görünecek alanı sürükleyerek ayarlayın · Çıktı: ${outputWidth} × ${outputHeight} WebP`}
          onClose={closeCrop}
          onCrop={(blob) => void uploadCropped(blob)}
        />
      )}
    </div>
  )
}
