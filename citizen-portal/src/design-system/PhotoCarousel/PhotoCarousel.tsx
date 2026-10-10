import { useState, type UIEvent } from 'react'

interface PhotoCarouselProps {
  photos: string[]
  onPhotoClick?: (url: string) => void
  slideClassName?: string
}

export const PhotoCarousel = ({ photos, onPhotoClick, slideClassName = 'aspect-[4/3] rounded-card' }: PhotoCarouselProps) => {
  const [active, setActive] = useState(0)

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.clientWidth === 0) return
    setActive(Math.round(el.scrollLeft / el.clientWidth))
  }

  if (photos.length === 0) return null

  const slideClass = `relative w-full flex-shrink-0 snap-center overflow-hidden bg-surface-2 ${slideClassName}`

  return (
    <div className="relative">
      <div
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((url, i) =>
          onPhotoClick ? (
            <button key={i} type="button" onClick={() => onPhotoClick(url)} className={`${slideClass} focus:outline-none`}>
              <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ) : (
            <div key={i} className={slideClass}>
              <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </div>
          ),
        )}
      </div>
      {photos.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <div className="flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1 backdrop-blur-sm">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === active ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
