import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOverlayDismiss } from '@/lib/useOverlayDismiss'

export interface LightboxImage {
  url: string
  name?: string
}

interface ImageLightboxProps {
  open: boolean
  onClose: () => void
  images: LightboxImage[]
  index?: number
  onIndexChange?: (index: number) => void
}

const chromeButton =
  'flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20'

export const ImageLightbox = ({ open, onClose, images, index = 0, onIndexChange }: ImageLightboxProps) => {
  const [current, setCurrent] = useState(index)
  useOverlayDismiss(open, onClose)

  useEffect(() => {
    if (open) setCurrent(index)
  }, [open, index])

  const total = images.length
  const go = useCallback(
    (delta: number) => {
      if (total <= 1) return
      setCurrent((c) => {
        const next = (c + delta + total) % total
        onIndexChange?.(next)
        return next
      })
    },
    [total, onIndexChange],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(1)
      else if (event.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, go])

  if (!open || total === 0) return null

  const safeIndex = Math.min(current, total - 1)
  const image = images[safeIndex]

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-10">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <button type="button" aria-label="Kapat" onClick={onClose} className={cn(chromeButton, 'absolute right-4 top-4 z-20')}>
        <XIcon className="h-5 w-5" />
      </button>

      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Önceki"
            onClick={() => go(-1)}
            className={cn(chromeButton, 'absolute left-4 top-1/2 z-20 -translate-y-1/2')}
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Sonraki"
            onClick={() => go(1)}
            className={cn(chromeButton, 'absolute right-4 top-1/2 z-20 -translate-y-1/2')}
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>
        </>
      )}

      <figure className="relative z-10 flex max-h-full max-w-full flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <img
          src={image.url}
          alt={image.name ?? ''}
          className="max-h-[82vh] max-w-[92vw] rounded-card object-contain shadow-modal"
        />
        {(image.name || total > 1) && (
          <figcaption className="flex items-center gap-3 text-xs text-white/80">
            {image.name && <span className="max-w-[60vw] truncate">{image.name}</span>}
            {total > 1 && <span className="tabular-nums text-white/60">{safeIndex + 1} / {total}</span>}
          </figcaption>
        )}
      </figure>
    </div>,
    document.body,
  )
}
