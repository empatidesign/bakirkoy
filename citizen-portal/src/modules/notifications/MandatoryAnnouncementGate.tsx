import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import type { CitizenNotification } from '@/types/notification.types'
import notificationService from '@/services/notification.service'
import { formatDateTime } from '@/lib/utils'

// Kullanıcı isteği (2026-09-01): "eklenen popup okudum tamam demeden kapatamaz."
// Saha anketörüne gönderilen zorunlu duyuru, ekranı kaplayan ve kapatılamayan bir
// katman olarak açılır. Kapatma yolları bilinçli olarak kapalıdır:
//   • dışarı tıklama yok, çarpı yok, ESC yok
//   • onay düğmesi, metin sonuna kadar kaydırılmadan etkinleşmez (uzun metinlerde)
//   • birden fazla duyuru varsa sırayla onaylanır
//   • onaylanmayan duyuru bir sonraki açılışta yeniden gelir (sunucu tarafı garanti)
const POLL_MS = 60_000

export const MandatoryAnnouncementGate = () => {
  const [queue, setQueue] = useState<CitizenNotification[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [scrolledToEnd, setScrolledToEnd] = useState(true)
  const bodyRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    try {
      setQueue(await notificationService.pendingAcknowledgements())
    } catch {
      // Bildirim çekilemezse ekranı kilitlemeyiz; bir sonraki turda tekrar denenir.
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  const current = queue[0]

  // Uzun talimatlarda kullanıcı metni görmeden onaylayamasın: içerik taşıyorsa
  // onay düğmesi ancak sona kaydırıldığında etkinleşir.
  useEffect(() => {
    const el = bodyRef.current
    if (!current || !el) return
    const overflowing = el.scrollHeight > el.clientHeight + 4
    setScrolledToEnd(!overflowing)
  }, [current])

  // Açıkken sayfa kaydırmasını kilitle: arkadaki ekranla etkileşim kurulmasın.
  useEffect(() => {
    if (!current) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [current])

  if (!current) return null

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setScrolledToEnd(true)
  }

  const confirm = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await notificationService.acknowledge(current.id)
      setQueue((q) => q.slice(1))
      setScrolledToEnd(true)
    } catch {
      // Onay sunucuya ulaşmadıysa popup kapanmamalı: aksi hâlde duyuru
      // okunmuş sayılır ama kayıt düşmez.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="mandatory-announcement-title"
      data-testid="mandatory-announcement"
    >
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 id="mandatory-announcement-title" className="text-lg font-bold leading-tight text-amber-900">
              {current.title}
            </h2>
            <p className="mt-0.5 text-xs font-medium text-amber-700">
              Okundu onayı gerekli · {formatDateTime(current.createdAt)}
              {queue.length > 1 && ` · ${queue.length} duyuru bekliyor`}
            </p>
          </div>
        </div>

        <div ref={bodyRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-5 py-4">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{current.body}</p>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          {!scrolledToEnd && (
            <p className="mb-2 text-center text-xs font-semibold text-slate-500">
              Onaylamak için duyurunun tamamını okuyun.
            </p>
          )}
          <button
            type="button"
            onClick={confirm}
            disabled={submitting || !scrolledToEnd}
            data-testid="mandatory-announcement-confirm"
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-base font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            Okudum, anladım
          </button>
        </div>
      </div>
    </div>
  )
}
