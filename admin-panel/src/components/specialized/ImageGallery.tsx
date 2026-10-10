import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImagePlusIcon, Loader2Icon, StarIcon, XIcon } from 'lucide-react'
import { Badge, IconButton, ImageLightbox } from '@/design-system'
import { ImageCropModal } from './ImageCropModal'
import { cn } from '@/lib/utils'
import type { FacilityImage } from '@/types/serviceFacility.types'

interface ImageGalleryProps {
  value: FacilityImage[]
  onChange?: (images: FacilityImage[]) => void
  onUpload?: (file: File) => Promise<FacilityImage>
  readOnly?: boolean
  max?: number
}

// Kullanıcı isteği (2026-10-01): "resimleri croplamada 1:1 4:3 3:4 16:9 her formata göre
// otomatik oranla" — galeri fotoğrafları için seçilebilir oranlar. Kullanıcı yüklerken
// hangi formatta (kare, yatay, dikey, geniş ekran) kırpacağını seçer; sonuç mobilde o
// oranda gösterilebilsin diye doğru kırpılmış tek görsel kaydedilir.
const ASPECT_OPTIONS = [
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:4', value: 3 / 4 },
]

const ensurePrimary = (imgs: FacilityImage[]): FacilityImage[] => {
  if (imgs.length === 0 || imgs.some((i) => i.isPrimary)) return imgs
  return imgs.map((i, idx) => ({ ...i, isPrimary: idx === 0 }))
}

export const ImageGallery = ({ value, onChange, onUpload, readOnly, max = 12 }: ImageGalleryProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dragIndex = useRef<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)
  // Kullanıcı isteği (2026-10-01): "toplu resim yüklenebilsin" — birden fazla dosya aynı anda
  // seçilir/sürüklenirse kuyruğa alınır, her biri sırayla kırpma ekranından geçip yüklenir.
  const queueRef = useRef<File[]>([])

  const readAsDataUrl = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result as string)
    reader.readAsDataURL(file)
  }

  const processNextInQueue = () => {
    const next = queueRef.current.shift()
    if (next) readAsDataUrl(next)
  }

  const handleFiles = (files: FileList | null) => {
    if (!files || !onUpload) return
    const remaining = Math.max(0, max - value.length)
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, remaining)
    if (imageFiles.length === 0) return
    queueRef.current = imageFiles.slice(1)
    readAsDataUrl(imageFiles[0])
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleCropped = async (blob: Blob) => {
    if (!onUpload) return
    setCropSrc(null)
    setUploading(true)
    try {
      const file = new File([blob], 'galeri-foto.jpg', { type: 'image/jpeg' })
      const uploaded = await onUpload(file)
      onChange?.(ensurePrimary([...value, uploaded]))
    } catch {
      toast.error('Görsel galeriye eklenemedi. Lütfen tekrar deneyin.')
    } finally {
      setUploading(false)
      processNextInQueue()
    }
  }

  const setPrimary = (id: string) => onChange?.(value.map((i) => ({ ...i, isPrimary: i.id === id })))
  const remove = (id: string) => onChange?.(ensurePrimary(value.filter((i) => i.id !== id)))

  const onDropAt = (target: number) => {
    const from = dragIndex.current
    dragIndex.current = null
    if (from === null || from === target) return
    const next = value.slice()
    const [moved] = next.splice(from, 1)
    next.splice(target, 0, moved)
    onChange?.(next)
  }

  if (readOnly && value.length === 0) {
    return <p className="type-caption">Görsel eklenmemiş.</p>
  }

  return (
    <>
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {value.map((img, idx) => (
        <div
          key={img.id}
          draggable={!readOnly}
          onDragStart={() => { dragIndex.current = idx }}
          onDragOver={(e) => { if (!readOnly) e.preventDefault() }}
          onDrop={() => { if (!readOnly) onDropAt(idx) }}
          className={cn(
            'group relative aspect-square overflow-hidden rounded-card border bg-surface-1',
            img.isPrimary ? 'border-primary' : 'border-border',
            !readOnly && 'cursor-move',
          )}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(idx)}
            className="block h-full w-full cursor-zoom-in"
            aria-label="Görseli büyüt"
          >
            <img src={img.url} alt={img.name ?? ''} className="h-full w-full object-cover" />
          </button>
          {img.isPrimary && (
            <span className="absolute left-1.5 top-1.5">
              <Badge tone="primary">Ana foto</Badge>
            </span>
          )}
          {!readOnly && (
            <div className="absolute right-1 top-1 flex gap-0.5 rounded-pill bg-surface-0/85 p-0.5 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
              <IconButton tone={img.isPrimary ? 'primary' : 'default'} title="Ana foto yap" onClick={() => setPrimary(img.id)}>
                <StarIcon className="h-4 w-4" />
              </IconButton>
              <IconButton tone="danger" title="Kaldır" onClick={() => remove(img.id)}>
                <XIcon className="h-4 w-4" />
              </IconButton>
            </div>
          )}
        </div>
      ))}

      {!readOnly && value.length < max && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false) }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
          className={cn(
            'flex aspect-square flex-col items-center justify-center gap-1.5 rounded-card border border-dashed bg-surface-1 text-foreground-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-60',
            dragOver ? 'border-primary bg-primary/5 text-primary' : 'border-border',
          )}
        >
          {uploading ? <Loader2Icon className="h-6 w-6 animate-spin" /> : <ImagePlusIcon className="h-6 w-6" />}
          <span className="type-caption">{uploading ? 'Yükleniyor...' : dragOver ? 'Bırakın...' : 'Fotoğraf Ekle veya Sürükleyin'}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </button>
      )}
    </div>

    {cropSrc && (
      <ImageCropModal
        open={!!cropSrc}
        imageSrc={cropSrc}
        aspect={4 / 3}
        aspectOptions={ASPECT_OPTIONS}
        helperText={
          queueRef.current.length > 0
            ? `Sürükleyerek kaydır · Kaydırıcı veya ± ile büyüt/küçült · Sırada ${queueRef.current.length} fotoğraf daha var`
            : undefined
        }
        onClose={() => { queueRef.current = []; setCropSrc(null); if (inputRef.current) inputRef.current.value = '' }}
        onCrop={(blob) => void handleCropped(blob)}
      />
    )}

    <ImageLightbox
      open={lightboxIndex !== null}
      index={lightboxIndex ?? 0}
      images={value.map((i) => ({ url: i.url, name: i.name }))}
      onClose={() => setLightboxIndex(null)}
    />
    </>
  )
}
