import { useCallback, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { ImagePlusIcon, Loader2Icon, RefreshCwIcon, XIcon, CheckIcon } from 'lucide-react'
import { Button, IconButton, Badge, Modal } from '@/design-system'
import { cn } from '@/lib/utils'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

type AspectOption = { label: string; value: number; tag: string }

const ASPECTS: AspectOption[] = [
  { label: '4:3 Yatay', value: 4 / 3, tag: '4:3' },
  { label: '9:16 Dikey', value: 9 / 16, tag: '9:16' },
]

async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Canvas boş')) }, 'image/jpeg', 0.92)
  })
}

interface RewardImageUploaderProps {
  value: string
  onChange: (url: string) => void
  onUpload: (file: File) => Promise<string>
}

export const RewardImageUploader = ({ value, onChange, onUpload }: RewardImageUploaderProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [aspect, setAspect] = useState<AspectOption>(ASPECTS[0])
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)

  const pickFile = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setError(null)
    if (!ACCEPTED.includes(file.type)) { setError('Yalnızca JPG, PNG veya WEBP yükleyebilirsiniz.'); return }
    const url = URL.createObjectURL(file)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCropSrc(url)
  }

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedArea(pixels)
  }, [])

  const handleApply = async () => {
    if (!croppedArea || !cropSrc) return
    setUploading(true)
    try {
      const blob = await getCroppedBlob(cropSrc, croppedArea)
      const file = new File([blob], `reward-image.jpg`, { type: 'image/jpeg' })
      const url = await onUpload(file)
      onChange(url)
      cancelCrop()
    } finally {
      setUploading(false)
    }
  }

  const cancelCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="group relative overflow-hidden rounded-card border border-border bg-surface-1" style={{ aspectRatio: '4/3', maxHeight: 200 }}>
          <img src={value} alt="Hediye görseli" className="h-full w-full object-cover" />
          <span className="absolute left-2 top-2"><Badge tone="success">Yüklü</Badge></span>
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface-0/70 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <RefreshCwIcon className="h-4 w-4" /> Değiştir
            </Button>
            <IconButton tone="danger" title="Görseli kaldır" onClick={() => onChange('')}>
              <XIcon className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files) }}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border bg-surface-1 text-foreground-muted transition-colors hover:border-primary hover:text-primary"
          style={{ minHeight: 120 }}
        >
          <ImagePlusIcon className="h-7 w-7" />
          <span className="type-body-strong">Görsel seç veya sürükle</span>
          <span className="type-caption">JPG, PNG, WEBP · 4:3 veya 9:16</span>
        </button>
      )}

      {error && <p className="type-caption text-[hsl(var(--danger))]">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => pickFile(e.target.files)}
      />

      <Modal
        open={!!cropSrc}
        onClose={cancelCrop}
        title="Görseli Düzenle"
        width={540}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={cancelCrop} disabled={uploading}>
              <XIcon className="h-4 w-4" /> Vazgeç
            </Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={() => void handleApply()} isLoading={uploading} disabled={uploading}>
              <CheckIcon className="h-4 w-4" /> Kırp ve Yükle
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            {ASPECTS.map((a) => (
              <button
                key={a.tag}
                type="button"
                onClick={() => { setAspect(a); setCrop({ x: 0, y: 0 }); setZoom(1) }}
                className={cn(
                  'flex-1 rounded-field border py-1.5 text-sm font-semibold transition-colors',
                  aspect.tag === a.tag
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border bg-surface-1 text-foreground-muted hover:border-primary/50',
                )}
              >
                {a.tag} · {a.label}
              </button>
            ))}
          </div>

          <div
            className="relative overflow-hidden rounded-card bg-surface-2"
            style={{ height: aspect.value < 1 ? 400 : 260 }}
          >
            {cropSrc && (
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect.value}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                style={{ containerStyle: { borderRadius: 8 } }}
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="type-caption shrink-0 text-foreground-muted">Zum</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.02}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-pill bg-surface-2 accent-[hsl(var(--primary))]"
            />
          </div>

          {uploading && (
            <div className="flex items-center justify-center gap-2 text-foreground-muted">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              <span className="type-caption">Yükleniyor…</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
