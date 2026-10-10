import { useEffect, useState } from 'react'
import {
  XIcon, CalendarDaysIcon, MapPinIcon, ClockIcon, UsersIcon, ExternalLinkIcon,
  BadgeCheckIcon, CoinsIcon, Loader2Icon, GlobeIcon, AlertTriangleIcon,
} from 'lucide-react'
import type { PublicEvent, PublicEventSession } from '@/types/public.types'
import { GENDER_LABELS } from '@/types/public.types'
import publicService from '@/services/public.service'
import { citizenPortalEventUrl, formatDate } from '@/lib/utils'

interface Props {
  eventId: string | null
  onClose: () => void
}

export const EventDetailModal = ({ eventId, onClose }: Props) => {
  const [ev, setEv] = useState<PublicEvent | null>(null)
  const [sessions, setSessions] = useState<PublicEventSession[]>([])
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (!eventId) { setEv(null); setSessions([]); setNotFound(false); setLoadFailed(false); return }
    let active = true
    setLoading(true)
    setNotFound(false)
    setLoadFailed(false)
    // Oturumlar (sessions) ayrı bir çağrı: geçersiz/malformed ID'lerde bu
    // endpoint route-level 404/500 verebilir (getEvent'in aksine "bulunamadı"
    // olarak modellenmemiştir). Bu ikincil veri, ana kaydın bulunup
    // bulunmadığı sonucunu bozmasın diye ayrı try/catch'te ele alınıyor —
    // ana kayıt bulunamadıysa zaten gösterilmeyecek, bulunduysa oturumlar
    // yüklenemese bile sayfa çökmesin, sadece boş liste gösterilsin.
    publicService.getEvent(eventId)
      .then(async (detail) => {
        if (!active) return
        if (!detail) { setNotFound(true); return }
        setEv(detail)
        try {
          const sess = await publicService.getEventSessions(eventId)
          if (active) setSessions(sess)
        } catch {
          if (active) setSessions([])
        }
      })
      .catch(() => { if (active) { setNotFound(true); setLoadFailed(true) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [eventId])

  if (!eventId) return null

  const isFull = ev ? ev.capacity > 0 && ev.registeredCount >= ev.capacity : false
  const hasAgeRange = ev && ev.minAge > 0 && ev.maxAge > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex h-72 items-center justify-center">
            <Loader2Icon className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : notFound || !ev ? (
          <div className="flex h-72 flex-col items-center justify-center gap-3 p-6 text-center">
            {loadFailed && <AlertTriangleIcon className="h-8 w-8 text-foreground/30" />}
            <p className="font-bold text-foreground/70">{loadFailed ? 'Etkinlik yüklenemedi' : 'Etkinlik bulunamadı'}</p>
            <p className="text-sm text-foreground/45">
              {loadFailed ? 'Bağlantınızı kontrol edip tekrar deneyin.' : 'Bu etkinlik kaldırılmış veya artık aktif olmayabilir.'}
            </p>
            <button type="button" onClick={onClose} className="rounded-lg bg-surface-1 px-4 py-2 text-sm font-semibold text-foreground/60">
              Kapat
            </button>
          </div>
        ) : (
          <>
            <div className="relative shrink-0" style={{ aspectRatio: '16 / 8' }}>
              {ev.primaryImageUrl ? (
                <img src={ev.primaryImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full" style={{ background: `linear-gradient(160deg, ${ev.categoryColor ?? '#6366F1'}f0, ${ev.categoryColor ?? '#6366F1'}80)` }} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/0" />
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
              >
                <XIcon className="h-4 w-4" />
              </button>
              <span
                className="absolute bottom-3 left-3 rounded-lg px-2.5 py-1 text-[11px] font-bold text-white"
                style={{ background: ev.categoryColor ?? '#6366F1' }}
              >
                {ev.categoryName}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <h2 className="font-display text-xl font-black leading-snug text-foreground">{ev.name}</h2>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-start gap-2.5 text-[13.5px] text-foreground/70">
                  <CalendarDaysIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    {ev.isSingleDay ? formatDate(ev.startDate) : `${formatDate(ev.startDate)} — ${formatDate(ev.endDate)}`}
                    {ev.startTime && ` · ${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''}`}
                  </span>
                </div>

                {(ev.facilityName || ev.location?.name) && (
                  <div className="flex items-start gap-2.5 text-[13.5px] text-foreground/70">
                    <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{ev.facilityName ?? ev.location?.name}{ev.hallName ? ` · ${ev.hallName}` : ''}</span>
                  </div>
                )}

                <div className="flex items-start gap-2.5 text-[13.5px] text-foreground/70">
                  <UsersIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    {GENDER_LABELS[ev.gender] ?? ev.gender}
                    {hasAgeRange && ` · ${ev.minAge}–${ev.maxAge} yaş`}
                    {' · '}{ev.registeredCount.toLocaleString('tr-TR')}/{ev.capacity > 0 ? ev.capacity.toLocaleString('tr-TR') : '∞'} kayıtlı
                  </span>
                </div>

                <div className="flex items-start gap-2.5 text-[13.5px] text-foreground/70">
                  <CoinsIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{ev.isPaid ? (ev.priceInfo ?? 'Ücretli') : 'Ücretsiz'}</span>
                </div>

                {ev.sultangaziResidentOnly && (
                  <div className="flex items-start gap-2.5 text-[13.5px] text-foreground/70">
                    <BadgeCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Yalnızca Bakırköy ikametli vatandaşlar başvurabilir</span>
                  </div>
                )}
              </div>

              {ev.description && (
                <div className="mt-4 rounded-lg bg-surface-1 p-3.5">
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground/65">{ev.description}</p>
                </div>
              )}

              {sessions.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-foreground/40">Oturumlar</p>
                  <div className="space-y-1.5">
                    {sessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2 text-[13px]">
                        <span className="flex items-center gap-2 text-foreground/70">
                          <ClockIcon className="h-3.5 w-3.5 text-foreground/35" />
                          {formatDate(s.date)} · {s.startTime}–{s.endTime}
                        </span>
                        {s.isCancelled && <span className="text-[11px] font-semibold text-red-500">İptal</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-border p-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
              {isFull ? (
                <div className="rounded-lg bg-surface-1 py-3 text-center text-sm font-semibold text-foreground/50">
                  Bu etkinliğin kontenjanı dolu
                </div>
              ) : !ev.registrationOpen ? (
                <div className="rounded-lg bg-surface-1 py-3 text-center text-sm font-semibold text-foreground/50">
                  Başvuru dönemi kapalı
                </div>
              ) : (
                <a
                  href={citizenPortalEventUrl(ev.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                >
                  Vatandaş Portalında Başvur
                  <ExternalLinkIcon className="h-4 w-4" />
                </a>
              )}
              <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11.5px] text-foreground/40">
                <GlobeIcon className="h-3 w-3" />
                Başvuru için giriş/kayıt gerekir · Vatandaş Portalına yönlendirileceksiniz
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
