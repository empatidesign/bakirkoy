import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Modal, Button } from '@/design-system'
import { ZoomInIcon, ZoomOutIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AspectOption { label: string; value: number }

interface ImageCropModalProps {
  open: boolean
  imageSrc: string
  aspect?: number
  // Kullanıcı isteği (2026-10-01): "resimleri croplamada 1:1 4:3 3:4 16:9 her formata göre
  // otomatik oranla" — verilirse modalda bir oran seçici gösterilir, kullanıcı hangi formatta
  // kırpacağını seçebilir (mobilde doğru en-boy oranında görünmesi için).
  aspectOptions?: AspectOption[]
  outputWidth?: number
  outputHeight?: number
  outputType?: 'image/jpeg' | 'image/webp'
  outputQuality?: number
  minZoom?: number
  helperText?: string
  onClose: () => void
  onCrop: (blob: Blob) => void
}

async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  outputWidth?: number,
  outputHeight?: number,
  outputType: 'image/jpeg' | 'image/webp' = 'image/jpeg',
  outputQuality = 0.9,
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  canvas.width = outputWidth ?? pixelCrop.width
  canvas.height = outputHeight ?? pixelCrop.height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Canvas boş')) }, outputType, outputQuality)
  })
}

const STAGE_WIDTH = 712
const STAGE_MIN_HEIGHT = 320
const STAGE_MAX_HEIGHT = 560

function getStageHeight(aspect: number): number {
  const framed = STAGE_WIDTH / aspect
  return Math.round(Math.min(STAGE_MAX_HEIGHT, Math.max(STAGE_MIN_HEIGHT, framed * 1.6)))
}

export const ImageCropModal = ({
  open,
  imageSrc,
  aspect = 16 / 9,
  aspectOptions,
  outputWidth,
  outputHeight,
  outputType = 'image/jpeg',
  outputQuality = 0.9,
  minZoom = 0.4,
  helperText = 'Sürükleyerek kaydır · Kaydırıcı veya ± ile büyüt/küçült',
  onClose,
  onCrop,
}: ImageCropModalProps) => {
  const [activeAspect, setActiveAspect] = useState(aspectOptions?.[0]?.value ?? aspect)
  const stageHeight = getStageHeight(activeAspect)

  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [applying, setApplying] = useState(false)

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedArea(pixels)
  }, [])

  const handleApply = async () => {
    if (!croppedArea) return
    setApplying(true)
    try {
      const blob = await getCroppedBlob(
        imageSrc,
        croppedArea,
        outputWidth,
        outputHeight,
        outputType,
        outputQuality,
      )
      onCrop(blob)
    } finally {
      setApplying(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Görseli Düzenle"
      width={760}
      className="max-w-[calc(100vw-2rem)]"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
          <Button variant="primary" className="flex-1" isLoading={applying} onClick={() => void handleApply()}>
            Uygula
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-6">
        {aspectOptions && aspectOptions.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-caption text-foreground-muted">Oran:</span>
            {aspectOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setActiveAspect(opt.value)}
                className={cn(
                  'rounded-pill border px-3 py-1 text-[12px] font-semibold transition-colors',
                  activeAspect === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface-1 text-foreground-muted hover:border-primary/50',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        <div
          className="relative w-full overflow-hidden rounded-card bg-[hsl(var(--surface-2))]"
          style={{ height: stageHeight, maxHeight: '60vh' }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={activeAspect}
            minZoom={minZoom}
            restrictPosition={false}
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid={false}
            style={{
              containerStyle: { borderRadius: 'var(--radius-card)' },
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(minZoom, Number((z - 0.1).toFixed(2))))}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-field border border-border bg-surface-1 text-foreground-muted hover:bg-surface-2"
          >
            <ZoomOutIcon className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={minZoom}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[hsl(var(--primary))]"
          />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(2))))}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-field border border-border bg-surface-1 text-foreground-muted hover:bg-surface-2"
          >
            <ZoomInIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="type-caption text-center text-foreground-muted">{helperText}</p>
      </div>
    </Modal>
  )
}
