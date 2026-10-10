import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ImagePlusIcon, Loader2Icon, RefreshCwIcon, CheckIcon, XIcon, CropIcon } from 'lucide-react'
import { Button, IconButton, Badge } from '@/design-system'
import type { EventImageVariant } from '@/types/event.types'

interface EventImageUploaderProps {
  label: string
  value: EventImageVariant
  onChange?: (value: EventImageVariant) => void
  onUpload?: (file: File) => Promise<{ url: string }>
  readOnly?: boolean
  cropEnabled?: boolean
  autoCompress?: boolean
}

const CROP_MAX_HEIGHT = 360
const PREVIEW_MAX_HEIGHT = 260
const ZOOM_MIN = 1
const ZOOM_MAX = 3

const ratioBoxStyle = (width: number, height: number, maxHeight: number): CSSProperties => ({
  aspectRatio: `${width} / ${height}`,
  maxWidth: `min(100%, ${Math.round((maxHeight * width) / height)}px)`,
})

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

const formatSize = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(kb % 1024 === 0 ? 0 : 1)} MB` : `${kb} KB`)

const imageSizeError = (maxSizeKb: number) =>
  `Görsel dosya boyutu ${formatSize(maxSizeKb)} sınırını aşıyor. Lütfen daha düşük boyutlu bir kaynak dosya kullanın veya sıkıştırmayı etkinleştirin.`

const imageCompressError = (maxSizeKb: number) =>
  `Görsel ${formatSize(maxSizeKb)} sınırına kadar sıkıştırılamadı. Lütfen daha düşük çözünürlüklü veya daha küçük bir kaynak dosya kullanın.`

const uploadErrorMessage = (fallback: string) => (error: unknown) => {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export const EventImageUploader = ({ label, value, onChange, onUpload, readOnly, cropEnabled = true, autoCompress = true }: EventImageUploaderProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  useEffect(() => () => { if (cropSrc) URL.revokeObjectURL(cropSrc) }, [cropSrc])

  useEffect(() => {
    if (!cropSrc) { setViewport(null); return }
    const vp = viewportRef.current
    if (!vp) return
    const measure = () => setViewport({ w: vp.clientWidth, h: vp.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(vp)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z - e.deltaY * 0.002)))
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      observer.disconnect()
      vp.removeEventListener('wheel', onWheel)
    }
  }, [cropSrc])

  const pickFile = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setError(null)
    if (!ACCEPTED.includes(file.type)) { setError('Yalnızca JPG, PNG veya WEBP yükleyebilirsiniz.'); return }
    const url = URL.createObjectURL(file)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setNatural(null)
    if (!cropEnabled) {
      void autoCropAndUpload(url)
      return
    }
    const probe = new Image()
    probe.onload = () => {
      const ratioMatches = Math.abs(probe.naturalWidth / probe.naturalHeight - value.width / value.height) < 0.01
      if (ratioMatches) void autoCropAndUpload(url)
      else setCropSrc(url)
    }
    probe.onerror = () => setCropSrc(url)
    probe.src = url
  }

  const autoCropAndUpload = async (objectUrl: string) => {
    const img = new Image()
    img.src = objectUrl
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Görsel okunamadı.'))
    })
    const scale = Math.max(value.width / img.naturalWidth, value.height / img.naturalHeight)
    const dispW = img.naturalWidth * scale
    const dispH = img.naturalHeight * scale
    const sx = (dispW - value.width) / 2 / scale
    const sy = (dispH - value.height) / 2 / scale
    const sw = value.width / scale
    const sh = value.height / scale

    const canvas = document.createElement('canvas')
    canvas.width = value.width
    canvas.height = value.height
    const ctx = canvas.getContext('2d')
    URL.revokeObjectURL(objectUrl)
    if (!ctx || !onUpload) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, value.width, value.height)
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, value.width, value.height)
    try {
      const blob = await compressToTarget(canvas, value.maxSizeKb)
      if (!blob) return
      const file = new File([blob], `event-${value.width}x${value.height}.jpg`, { type: 'image/jpeg' })

      setUploading(true)
      const { url } = await onUpload(file)
      onChange?.({ ...value, url })
    } catch (err) {
      setError(uploadErrorMessage('Görsel yüklenemedi. Dosya boyutu çok büyük olabilir, lütfen tekrar deneyin.')(err))
    } finally {
      setUploading(false)
    }
  }

  const compressToTarget = (canvas: HTMLCanvasElement, maxSizeKb: number): Promise<Blob | null> => {
    const target = maxSizeKb * 1024
    if (!autoCompress) {
      return (async () => {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
        if (blob && blob.size > target) {
          setError(imageSizeError(maxSizeKb))
          return null
        }
        return blob
      })()
    }
    return (async () => {
      let blob: Blob | null = null
      for (const quality of [0.92, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35]) {
        const candidate = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
        blob = candidate
        if (candidate && candidate.size <= target) break
      }
      if (blob && blob.size > target) {
        setError(imageCompressError(maxSizeKb))
        return null
      }
      return blob
    })()
  }

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
  }

  const metrics = () => {
    if (!viewport || !natural) return null
    const { w: vw, h: vh } = viewport
    const base = Math.max(vw / natural.w, vh / natural.h)
    const scale = base * zoom
    const dispW = natural.w * scale
    const dispH = natural.h * scale
    return { vw, vh, scale, dispW, dispH }
  }

  const clampOffset = (next: { x: number; y: number }) => {
    const m = metrics()
    if (!m) return next
    const maxX = Math.max(0, (m.dispW - m.vw) / 2)
    const maxY = Math.max(0, (m.dispH - m.vh) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
  }

  useEffect(() => {
    setOffset((prev) => clampOffset(prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clampOffset useCallback'e sarılı değil; eklenirse her render'da gereksiz yeniden çalışır
  }, [zoom, natural?.w, natural?.h, viewport?.w, viewport?.h])

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = { x: e.clientX, y: e.clientY, tx: offset.x, ty: offset.y }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setOffset(clampOffset({ x: dragStart.current.tx + dx, y: dragStart.current.ty + dy }))
  }
  const onPointerUp = () => { dragStart.current = null }

  const applyCrop = async () => {
    const m = metrics()
    const img = imageRef.current
    if (!m || !img || !natural || !onUpload) return
    const imgLeft = (m.vw - m.dispW) / 2 + offset.x
    const imgTop = (m.vh - m.dispH) / 2 + offset.y
    const sx = (0 - imgLeft) / m.scale
    const sy = (0 - imgTop) / m.scale
    const sw = m.vw / m.scale
    const sh = m.vh / m.scale

    const canvas = document.createElement('canvas')
    canvas.width = value.width
    canvas.height = value.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, value.width, value.height)
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, value.width, value.height)
    try {
      setError(null)
      const blob = await compressToTarget(canvas, value.maxSizeKb)
      if (!blob) return
      const file = new File([blob], `event-${value.width}x${value.height}.jpg`, { type: 'image/jpeg' })

      setUploading(true)
      const { url } = await onUpload(file)
      onChange?.({ ...value, url })
      cancelCrop()
    } catch (err) {
      setError(uploadErrorMessage('Görsel yüklenemedi. Dosya boyutu çok büyük olabilir, lütfen tekrar deneyin.')(err))
    } finally {
      setUploading(false)
    }
  }

  const cancelCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setNatural(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const specHint = `${value.width}×${value.height} · max ${formatSize(value.maxSizeKb)}`

  if (cropSrc) {
    const m = metrics()
    return (
      <div className="space-y-2">
        <p className="type-label">{label}</p>
        <div
          ref={viewportRef}
          className="relative mx-auto w-full select-none overflow-hidden rounded-card border border-border bg-surface-2 cursor-move"
          style={{ ...ratioBoxStyle(value.width, value.height, CROP_MAX_HEIGHT), touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <img
            ref={imageRef}
            src={cropSrc}
            onLoad={onImageLoad}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
            style={
              m
                ? {
                    width: m.dispW,
                    height: m.dispH,
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                  }
                : { visibility: 'hidden' }
            }
          />
        </div>

        <div className="flex items-center gap-2">
          <CropIcon className="h-4 w-4 text-foreground-muted" />
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.02}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-pill bg-surface-2 accent-[hsl(var(--primary))]"
          />
        </div>

        {error && <p className="type-caption text-[hsl(var(--danger))]">{error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={cancelCrop} disabled={uploading}>
            <XIcon className="h-4 w-4" /> Vazgeç
          </Button>
          <Button variant="primary" size="sm" className="flex-1" onClick={applyCrop} isLoading={uploading} disabled={uploading}>
            <CheckIcon className="h-4 w-4" /> Kırp ve Kaydet
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="type-label">{label}</p>

      {value.url ? (
        <div
          className="group relative overflow-hidden rounded-card border border-border bg-surface-1"
          style={ratioBoxStyle(value.width, value.height, PREVIEW_MAX_HEIGHT)}
        >
          <img src={value.url} alt={label} className="h-full w-full object-cover" />
          <span className="absolute left-2 top-2">
            <Badge tone="success">Yüklü</Badge>
          </span>
          {!readOnly && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface-0/70 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                <RefreshCwIcon className="h-4 w-4" /> Değiştir
              </Button>
              <IconButton tone="danger" title="Görseli kaldır" onClick={() => onChange?.({ ...value, url: undefined })}>
                <XIcon className="h-4 w-4" />
              </IconButton>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={readOnly || uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { if (!readOnly) e.preventDefault() }}
          onDrop={(e) => { if (readOnly) return; e.preventDefault(); pickFile(e.dataTransfer.files) }}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-card border border-dashed border-border bg-surface-1 text-foreground-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          style={ratioBoxStyle(value.width, value.height, PREVIEW_MAX_HEIGHT)}
        >
          {uploading ? <Loader2Icon className="h-6 w-6 animate-spin" /> : <ImagePlusIcon className="h-6 w-6" />}
          <span className="type-body-strong">Dosya seç veya sürükle</span>
          <span className="type-caption">{specHint}</span>
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
    </div>
  )
}
