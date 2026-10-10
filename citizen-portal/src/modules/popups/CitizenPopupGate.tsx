import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, XIcon, MegaphoneIcon, Loader2 } from 'lucide-react'
import popupService from '@/services/popup.service'
import type { CitizenPopup } from '@/types/popup.types'
import { cn } from '@/lib/utils'

// YouTube/Vimeo linklerini gömülebilir (embed) adrese çevirir; tanımadığı bağlantılarda
// (doğrudan .mp4 gibi) ham <video> etiketiyle oynatmayı dener. Admin panelindeki
// PopupFormSections.tsx'teki toEmbedUrl ile aynı mantık (iki ayrı frontend, tek küçük
// regex fonksiyonu paylaşılan pakete taşınmadı — kopyalamak burada daha basit).
const toEmbedUrl = (url: string): { kind: 'youtube' | 'vimeo' | 'file'; src: string } => {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/)
  if (yt) return { kind: 'youtube', src: `https://www.youtube.com/embed/${yt[1]}?autoplay=1` }
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return { kind: 'vimeo', src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1` }
  return { kind: 'file', src: url }
}

// Kullanıcı isteği (2026-09-20): admin panelden yönetilen popup/duyuru sistemi. Zorunlu
// popup, MandatoryAnnouncementGate ile aynı davranış deseni (kapatılamaz, okundu onayı
// gerekir) — ama burada birden fazla resim/video/metin öğesi karusel olarak gösterilir.
// Bilgilendirme (opsiyonel) popup'ta kullanıcı "Kapat" veya (izin verilmişse) "Bir daha
// gösterme" seçebilir. MinDisplaySeconds doluncaya kadar onay/kapatma düğmesi pasif kalır.
interface Props {
  trigger: 'first_login' | 'every_login' | 'module_enter'
  moduleKey?: string
  onDone?: () => void
}

export const CitizenPopupGate = ({ trigger, moduleKey, onDone }: Props) => {
  const [popup, setPopup] = useState<CitizenPopup | null>(null)
  const [slide, setSlide] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    popupService.getNext(trigger, moduleKey)
      .then((p) => {
        if (p) {
          setPopup(p)
          setRemainingSeconds(p.minDisplaySeconds)
        } else {
          onDone?.()
        }
      })
      .catch(() => onDone?.())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, moduleKey])

  useEffect(() => {
    if (!popup || remainingSeconds <= 0) return
    const timer = setInterval(() => setRemainingSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [popup, remainingSeconds])

  useEffect(() => {
    if (!popup) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [popup])

  const finish = useCallback(() => {
    setPopup(null)
    onDone?.()
  }, [onDone])

  if (!popup) return null

  const media = popup.mediaItems[slide]
  const canProceed = remainingSeconds <= 0
  const isLast = slide >= popup.mediaItems.length - 1

  const goNext = () => {
    if (!canProceed) return
    if (!isLast) { setSlide((s) => s + 1); return }
    void acknowledge(false)
  }
  const goPrev = () => { if (slide > 0) setSlide((s) => s - 1) }

  const acknowledge = async (dismissForever: boolean) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await popupService.acknowledge(popup.id, dismissForever)
      finish()
    } catch {
      // Onay sunucuya ulaşmadıysa popup kapanmamalı — zorunlu popup tekrar gösterilecek,
      // opsiyonel popup için kullanıcı tekrar deneyebilir.
    } finally {
      setSubmitting(false)
    }
  }

  const closeOptional = () => { if (canProceed) void acknowledge(false) }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      data-testid="citizen-popup-gate"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className={cn(
          'flex items-start gap-3 border-b px-5 py-4',
          popup.isMandatory ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50',
        )}>
          <div className={cn(
            'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white',
            popup.isMandatory ? 'bg-amber-500' : 'bg-primary',
          )}>
            <MegaphoneIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-tight text-slate-900">{popup.title}</h2>
            {popup.isMandatory && (
              <p className="mt-0.5 text-xs font-medium text-amber-700">Okundu onayı gerekli</p>
            )}
          </div>
          {!popup.isMandatory && canProceed && (
            <button type="button" onClick={closeOptional} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600" aria-label="Kapat">
              <XIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {media?.type === 'image' && media.url && (
            <img src={media.url} alt="" className="mx-auto max-h-[50vh] w-full rounded-lg object-contain" />
          )}
          {media?.type === 'video' && media.url && (() => {
            const embed = toEmbedUrl(media.url)
            return embed.kind === 'file'
              ? <video src={embed.src} controls autoPlay className="mx-auto max-h-[50vh] w-full rounded-lg" />
              : <iframe src={embed.src} className="mx-auto aspect-video w-full rounded-lg" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          })()}
          {media?.text && (
            <p className={cn('whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700', media.type !== 'text' && 'mt-3 text-center text-sm text-slate-500')}>
              {media.text}
            </p>
          )}

          {popup.mediaItems.length > 1 && (
            <div className="mt-4 flex items-center justify-center gap-1.5">
              {popup.mediaItems.map((_, i) => (
                <span key={i} className={cn('h-1.5 rounded-full transition-all', i === slide ? 'w-6 bg-primary' : 'w-1.5 bg-slate-300')} />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          {!canProceed && (
            <p className="mb-2 text-center text-xs font-semibold text-slate-500">
              {remainingSeconds} saniye sonra devam edebilirsiniz…
            </p>
          )}
          <div className="flex items-center gap-2">
            {popup.mediaItems.length > 1 && slide > 0 && (
              <button
                type="button"
                onClick={goPrev}
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100"
                aria-label="Önceki"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={submitting || !canProceed}
              data-testid="citizen-popup-confirm"
              className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-bold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : isLast ? <CheckIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
              {isLast ? (popup.isMandatory ? 'Okudum, anladım' : 'Tamam') : 'İleri'}
            </button>
          </div>
          {!popup.isMandatory && popup.allowDismissForever && isLast && (
            <button
              type="button"
              onClick={() => acknowledge(true)}
              disabled={submitting || !canProceed}
              className="mt-2 w-full text-center text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              Bir daha gösterme
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
