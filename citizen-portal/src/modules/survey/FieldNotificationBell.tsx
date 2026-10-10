import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, ClipboardList, Loader2, Megaphone, X } from 'lucide-react'
import type { CitizenNotification } from '@/types/notification.types'
import notificationService from '@/services/notification.service'
import { cn, formatDateTime } from '@/lib/utils'

// Kullanıcı isteği (2026-09-01): "sağ üste bildirim alanı olsun ... mesaj gönderme,
// duyuru gönderme, yeni anket eklendiğinde bunları da takip edecek."
// Saha ekranının üst barına oturan bildirim zili: okunmamış rozeti, açılır liste,
// tek tek ve toplu okundu işaretleme.
const POLL_MS = 60_000

const ICONS: Record<string, typeof Bell> = {
  'survey-field-task': ClipboardList,
  'survey-field-announcement': Megaphone,
}

export const FieldNotificationBell = () => {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<CitizenNotification[] | null>(null)
  const [unread, setUnread] = useState(0)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  const refreshCount = useCallback(async () => {
    try { setUnread(await notificationService.unreadCount('self')) } catch { /* sessiz */ }
  }, [])

  const loadList = useCallback(async () => {
    setBusy(true)
    try {
      const paged = await notificationService.list({ page: 1, limit: 20, scope: 'self' })
      setItems(paged.items)
    } catch {
      setItems([])
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void refreshCount()
    const timer = setInterval(() => void refreshCount(), POLL_MS)
    return () => clearInterval(timer)
  }, [refreshCount])

  // Panel dışına tıklayınca kapansın (zorunlu duyuru popup'ından farklı olarak
  // bu panel serbestçe kapatılabilir).
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next) await loadList()
  }

  const markOne = async (n: CitizenNotification) => {
    if (n.isRead) return
    // Zorunlu duyuru yalnızca popup'taki "Okudum" ile kapanır; buradan
    // okundu yapılırsa kullanıcı metni görmeden geçmiş olurdu.
    if (n.requiresAck && !n.acknowledgedAt) return
    await notificationService.markRead(n.id).catch(() => undefined)
    setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)) ?? null)
    void refreshCount()
  }

  const markAll = async () => {
    await notificationService.markAllRead('self').catch(() => undefined)
    await loadList()
    void refreshCount()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={unread > 0 ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'}
        data-testid="field-notification-bell"
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 transition-colors hover:bg-white/20"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span
            data-testid="field-notification-badge"
            className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-black text-white shadow"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="field-notification-panel"
          className="absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[70vh] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <span className="text-sm font-bold">Bildirimler</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void markAll()}
                title="Tümünü okundu yap"
                className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              >
                <CheckCheck className="h-4 w-4" /> Tümü
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Bildirim panelini kapat"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {busy && items === null ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
              </div>
            ) : (items?.length ?? 0) === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">Henüz bildiriminiz yok.</p>
            ) : (
              items!.map((n) => {
                const Icon = ICONS[n.type] ?? Bell
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void markOne(n)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-slate-50',
                      !n.isRead && 'bg-blue-50/60',
                    )}
                  >
                    <span className={cn(
                      'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                      n.isRead ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-600',
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold leading-snug">{n.title}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-slate-600">{n.body}</span>
                      <span className="mt-1 block text-[11px] font-medium text-slate-400">{formatDateTime(n.createdAt)}</span>
                    </span>
                    {!n.isRead && <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
