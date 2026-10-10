import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon, MapPinIcon, PhoneIcon, GlobeIcon, ClockIcon, CheckIcon,
  AccessibilityIcon, ParkingCircleIcon, Loader2Icon, ImageOffIcon, CalendarDaysIcon, AlertTriangleIcon,
  ImagesIcon, RefreshCwIcon,
} from 'lucide-react'
import type { PublicServiceFacility, PublicEvent } from '@/types/public.types'
import publicService from '@/services/public.service'
import { formatDateShort } from '@/lib/utils'

export const FacilityDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [facility, setFacility] = useState<PublicServiceFacility | null>(null)
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    setNotFound(false)
    setLoadFailed(false)
    // İlişkili etkinlikler ayrı bir çağrı: geçersiz/malformed ID'lerde bu
    // endpoint route-level 404/500 verebilir (getFacility'nin aksine
    // "bulunamadı" olarak modellenmemiştir). Bu ikincil veri, ana kaydın
    // bulunup bulunmadığı sonucunu bozmasın diye ayrı try/catch'te ele
    // alınıyor — ana kayıt bulunamadıysa zaten gösterilmeyecek, bulunduysa
    // ilişkili etkinlikler yüklenemese bile sayfa çökmesin, sadece boş
    // liste gösterilsin.
    publicService.getFacility(id)
      .then(async (f) => {
        if (!active) return
        if (!f) { setNotFound(true); return }
        setFacility(f)
        try {
          const evs = await publicService.getEvents({ facilityId: id, limit: 12 })
          if (active) setEvents(evs)
        } catch {
          if (active) setEvents([])
        }
      })
      .catch(() => { if (active) { setNotFound(true); setLoadFailed(true) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2Icon className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  if (notFound || !facility) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-center">
        {loadFailed && <AlertTriangleIcon className="h-8 w-8 text-foreground/30" />}
        <p className="font-bold text-foreground/70">{loadFailed ? 'Tesis yüklenemedi' : 'Tesis bulunamadı'}</p>
        {loadFailed && <p className="text-sm text-foreground/45">Bağlantınızı kontrol edip tekrar deneyin.</p>}
        <button onClick={() => navigate('/tesisler')} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Tesislere Dön
        </button>
      </div>
    )
  }

  const f = facility

  return (
    <div>
      <div className="relative w-full bg-primary-soft" style={{ aspectRatio: '3 / 1' }}>
        {f.primaryImageUrl ? (
          <img src={f.primaryImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOffIcon className="h-12 w-12 text-primary/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <Link
          to="/tesisler"
          className="absolute left-4 top-4 flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-[13px] font-semibold text-foreground shadow-sm backdrop-blur transition-colors hover:bg-white"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Tesisler
        </Link>
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <span className="rounded-lg bg-white/20 px-2.5 py-1 text-[11px] font-bold backdrop-blur">{f.type}</span>
          <h1 className="mt-2 font-display text-2xl font-black drop-shadow">{f.name}</h1>
          {f.updatedAt && (
            <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-white/80">
              <RefreshCwIcon className="h-3 w-3" />
              Son güncelleme: {formatDateShort(f.updatedAt)}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {(f.description || f.about) && (
            <div className="rounded-lg border border-border bg-white p-5">
              <h2 className="mb-2 text-sm font-bold text-foreground/70">Hakkında</h2>
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-foreground/60">{f.about ?? f.description}</p>
            </div>
          )}

          {f.services.length > 0 && (
            <div className="rounded-lg border border-border bg-white p-5">
              <h2 className="mb-3 text-sm font-bold text-foreground/70">Sunulan Hizmetler</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {f.services.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-surface-1 px-3 py-2">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-[13px] font-semibold text-foreground/75">{s.name}</p>
                      {s.description && <p className="text-[11.5px] text-foreground/45">{s.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(f.facilities.length > 0 || f.accessibilityFeatures.length > 0) && (
            <div className="rounded-lg border border-border bg-white p-5">
              {f.facilities.length > 0 && (
                <div className="mb-4">
                  <h2 className="mb-2 text-sm font-bold text-foreground/70">Olanaklar</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {f.facilities.map((item, i) => (
                      <span key={i} className="rounded-full bg-surface-1 px-2.5 py-1 text-[12px] font-medium text-foreground/60">{item}</span>
                    ))}
                  </div>
                </div>
              )}
              {f.accessibilityFeatures.length > 0 && (
                <div>
                  <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground/70">
                    <AccessibilityIcon className="h-4 w-4" /> Erişilebilirlik
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {f.accessibilityFeatures.map((item, i) => (
                      <span key={i} className="rounded-full bg-success-soft px-2.5 py-1 text-[12px] font-medium text-success">{item}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {f.images.length > 1 && (
            <div className="rounded-lg border border-border bg-white p-5">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-foreground/70">
                <ImagesIcon className="h-4 w-4" /> Galeri
              </h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {f.images.map((img, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-lg bg-surface-1">
                    <img src={img.url} alt={img.name ?? ''} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {events.length > 0 && (
            <div className="rounded-lg border border-border bg-white p-5">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-foreground/70">
                <CalendarDaysIcon className="h-4 w-4" /> Bu Tesisteki Etkinlikler
              </h2>
              <div className="space-y-2">
                {events.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => navigate(`/etkinlikler?eventId=${ev.id}`)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg bg-surface-1 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-foreground/75">{ev.name}</p>
                      <p className="text-[11.5px] text-foreground/45">{formatDateShort(ev.startDate)}</p>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `${ev.categoryColor ?? '#6366F1'}18`, color: ev.categoryColor ?? '#6366F1' }}>
                      {ev.categoryName}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-foreground/70">İletişim</h2>
            <div className="space-y-2.5">
              {(f.address || f.district || f.city) && (
                <div className="flex items-start gap-2.5 text-[13px] text-foreground/65">
                  <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{[f.address, f.district, f.city].filter(Boolean).join(', ')}</span>
                </div>
              )}
              {f.emergencyPhone && (
                <a href={`tel:${f.emergencyPhone}`} className="flex items-center gap-2.5 text-[13px] text-foreground/65 hover:text-primary">
                  <PhoneIcon className="h-4 w-4 shrink-0 text-primary" />
                  {f.emergencyPhone}
                </a>
              )}
              {f.website && (
                <a href={f.website} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 text-[13px] text-foreground/65 hover:text-primary">
                  <GlobeIcon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{f.website}</span>
                </a>
              )}
            </div>
          </div>

          {f.workingHours && (f.workingHours.weekdayOpen || f.workingHours.weekendOpen) && (
            <div className="rounded-lg border border-border bg-white p-5">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-foreground/70">
                <ClockIcon className="h-4 w-4" /> Çalışma Saatleri
              </h2>
              <div className="space-y-2 text-[13px] text-foreground/65">
                {f.workingHours.weekdayOpen && (
                  <div className="flex justify-between">
                    <span>Hafta içi</span>
                    <span className="font-semibold">{f.workingHours.weekdayOpen} – {f.workingHours.weekdayClose}</span>
                  </div>
                )}
                {f.workingHours.weekendOpen && (
                  <div className="flex justify-between">
                    <span>Hafta sonu</span>
                    <span className="font-semibold">{f.workingHours.weekendOpen} – {f.workingHours.weekendClose}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {(f.capacity || f.parkingCapacity) && (
            <div className="rounded-lg border border-border bg-white p-5">
              <h2 className="mb-3 text-sm font-bold text-foreground/70">Kapasite</h2>
              <div className="space-y-2 text-[13px] text-foreground/65">
                {f.capacity != null && (
                  <div className="flex justify-between"><span>Kişi kapasitesi</span><span className="font-semibold">{f.capacity.toLocaleString('tr-TR')}</span></div>
                )}
                {f.parkingCapacity != null && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><ParkingCircleIcon className="h-4 w-4" />Otopark</span>
                    <span className="font-semibold">{f.parkingCapacity.toLocaleString('tr-TR')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
