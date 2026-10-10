import { useCallback, useEffect, useState } from 'react'
import {
  Bell, CheckCheck, ClipboardList, Loader2, Megaphone, RefreshCw, ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import type { CitizenNotification } from '@/types/notification.types'
import notificationService from '@/services/notification.service'
import { cn, formatDateTime } from '@/lib/utils'

// Kullanıcı isteği (2026-09-02): "anketörün sayfasına gelen mesaj ve bildirimler listeleme
// ekranda olacak, hangi tarihte saatte; ve gönderilen bildirimlerin mutlaka ekranda okudum
// demesi gerek." Zil panelinden farklı olarak bu KALICI bir liste ekranıdır: tarih/saat,
// okundu ve "Okudum" onay durumu satır satır görünür.

const ICONS: Record<string, typeof Bell> = {
  'survey-field-task': ClipboardList,
  'survey-field-announcement': Megaphone,
}

export const FieldNotificationsTab = () => {
  const [items, setItems] = useState<CitizenNotification[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const paged = await notificationService.list({ page: 1, limit: 50, scope: 'self' })
      setItems(paged.items)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  /** Onay gerektiren duyuruda "Okudum" — admin bu onayı alıcı bazında görür. */
  const acknowledge = async (n: CitizenNotification) => {
    setBusyId(n.id)
    try {
      await notificationService.acknowledge(n.id)
      setItems((prev) => prev?.map((x) => x.id === n.id
        ? { ...x, isRead: true, acknowledgedAt: new Date().toISOString() }
        : x) ?? prev)
      toast.success('Okundu bilgisi yöneticinize iletildi.')
    } catch {
      toast.error('Onay gönderilemedi. Tekrar deneyin.')
    } finally {
      setBusyId(null)
    }
  }

  const markRead = async (n: CitizenNotification) => {
    setBusyId(n.id)
    try {
      await notificationService.markRead(n.id)
      setItems((prev) => prev?.map((x) => x.id === n.id ? { ...x, isRead: true } : x) ?? prev)
    } catch {
      toast.error('İşaretlenemedi.')
    } finally {
      setBusyId(null)
    }
  }

  const unread = (items ?? []).filter((n) => !n.isRead).length
  const pendingAck = (items ?? []).filter((n) => n.requiresAck && !n.acknowledgedAt).length

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Bell className="h-4.5 w-4.5 text-violet-600" />
            <h2 className="text-sm font-black tracking-tight text-slate-900">Mesaj ve Bildirimler</h2>
            {unread > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-black text-rose-700">
                {unread} okunmamış
              </span>
            )}
            {pendingAck > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-700">
                {pendingAck} onay bekliyor
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Yenile
          </button>
        </div>

        {loading && !items ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : (items?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <Bell className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-black text-slate-900">Bildirim yok</p>
            <p className="text-xs font-semibold text-slate-500">
              Yöneticiniz duyuru gönderdiğinde veya size görev atandığında burada listelenir.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items!.map((n) => {
              const Icon = ICONS[n.type] ?? Bell
              const needsAck = n.requiresAck && !n.acknowledgedAt
              return (
                <div
                  key={n.id}
                  data-testid="field-notification-item"
                  className={cn(
                    'rounded-2xl border bg-white p-3.5 shadow-sm transition-colors',
                    needsAck ? 'border-amber-300 bg-amber-50/40' : n.isRead ? 'border-slate-200' : 'border-indigo-200 bg-indigo-50/30',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn(
                      'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl',
                      needsAck ? 'bg-amber-100 text-amber-700' : 'bg-indigo-50 text-indigo-600',
                    )}>
                      <Icon className="h-4.5 w-4.5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-900">{n.title}</span>
                        {!n.isRead && (
                          <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700">YENİ</span>
                        )}
                        {n.requiresAck && (
                          <span className={cn(
                            'rounded-md px-1.5 py-0.5 text-[10px] font-black',
                            n.acknowledgedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                          )}>
                            {n.acknowledgedAt ? 'OKUNDU ONAYLANDI' : 'ONAY BEKLİYOR'}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 whitespace-pre-wrap text-xs font-medium leading-relaxed text-slate-600">
                        {n.body}
                      </p>

                      {/* Tarih ve saat — kullanıcı isteği: "hangi tarihte saatte" */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-400">
                        <span>Gönderim: {formatDateTime(n.createdAt)}</span>
                        {n.acknowledgedAt && (
                          <span className="text-emerald-600">
                            Okudum onayı: {formatDateTime(n.acknowledgedAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 flex-col gap-1.5">
                      {needsAck ? (
                        <button
                          type="button"
                          onClick={() => void acknowledge(n)}
                          disabled={busyId === n.id}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-2 text-[11px] font-black text-white shadow-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                        >
                          {busyId === n.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                          Okudum
                        </button>
                      ) : !n.isRead ? (
                        <button
                          type="button"
                          onClick={() => void markRead(n)}
                          disabled={busyId === n.id}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                          {busyId === n.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                          Okundu
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-bold text-emerald-600">
                          <CheckCheck className="h-3.5 w-3.5" />
                          Okundu
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
