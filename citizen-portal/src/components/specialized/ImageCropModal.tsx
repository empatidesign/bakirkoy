import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Modal, Button } from '@/design-system'
import { ZoomInIcon, ZoomOutIcon } from 'lucide-react'

interface ImageCropModalProps {
  open: boolean
  imageSrc: string
  aspect?: number
  onClose: () => void
  onCrop: (blob: Blob) => void
}

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
    canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Canvas boş')) }, 'image/jpeg', 0.9)
  })
}

export const ImageCropModal = ({ open, imageSrc, aspect = 16 / 9, onClose, onCrop }: ImageCropModalProps) => {
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
      const blob = await getCroppedBlob(imageSrc, croppedArea)
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
      width={520}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
          <Button variant="primary" className="flex-1" isLoading={applying} onClick={() => void handleApply()}>
            Uygula
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="relative h-64 w-full overflow-hidden rounded-card bg-[hsl(var(--surface-2))]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
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
            onClick={() => setZoom((z) => Math.max(1, z - 0.2))}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-field border border-border bg-surface-1 text-foreground-muted hover:bg-surface-2"
          >
            <ZoomOutIcon className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[hsl(var(--primary))]"
          />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-field border border-border bg-surface-1 text-foreground-muted hover:bg-surface-2"
          >
            <ZoomInIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="type-caption text-center text-foreground-muted">Sürükleyerek kaydır · Kaydırıcı veya ± ile yakınlaştır</p>
      </div>
    </Modal>
  )
}
