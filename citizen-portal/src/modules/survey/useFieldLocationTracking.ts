import { useEffect, useRef, useState } from 'react'
import fieldSurveyService from '@/services/fieldSurvey.service'

// Kullanıcı isteği (2026-09-01): "canlı haritada saha görevlileri canlı takip edilecek, GPS
// açık olacak, ne kadar yürüdüğünü nereleri gezdiğini de takip edeceğiz."
//
// Saha Anket Sistemi ekranı açık olduğu sürece konum izlenir ve en fazla PING_INTERVAL_MS'de
// bir sunucuya gönderilir. Sunucu, aktif saha görevi yoksa ping'i reddeder (KVKK: görev dışı
// izleme yapılmaz) — bu durumda takip sessizce durur, kullanıcıya hata gösterilmez.

const PING_INTERVAL_MS = 30_000
/** Bu mesafeden az oynamalarda ara ping gönderilmez (GPS gürültüsü + veri tasarrufu). */
const MIN_MOVE_METERS = 15

export type FieldTrackingStatus = 'idle' | 'tracking' | 'denied' | 'unsupported' | 'stopped'

function distanceMeters(a: GeolocationCoordinates, bLat: number, bLng: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - a.latitude)
  const dLng = toRad(bLng - a.longitude)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.latitude)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface FieldTrackingState {
  status: FieldTrackingStatus
  /** Sunucunun döndürdüğü, bugün yürünen toplam mesafe (metre). */
  todayDistanceMeters: number
}

export function useFieldLocationTracking(enabled: boolean): FieldTrackingState {
  const [status, setStatus] = useState<FieldTrackingStatus>('idle')
  const [todayDistanceMeters, setTodayDistanceMeters] = useState(0)

  const lastSentAt = useRef(0)
  const lastSent = useRef<{ lat: number; lng: number } | null>(null)
  const sending = useRef(false)

  useEffect(() => {
    if (!enabled) return
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }

    let cancelled = false

    const send = async (coords: GeolocationCoordinates) => {
      if (sending.current) return
      sending.current = true
      try {
        const res = await fieldSurveyService.sendLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracyMeters: Number.isFinite(coords.accuracy) ? coords.accuracy : undefined,
          speedMps: coords.speed != null && Number.isFinite(coords.speed) ? coords.speed : undefined,
          recordedAt: new Date().toISOString(),
        })
        if (cancelled) return
        lastSentAt.current = Date.now()
        lastSent.current = { lat: coords.latitude, lng: coords.longitude }
        setTodayDistanceMeters(res.todayDistanceMeters)
        setStatus('tracking')
      } catch {
        // Aktif görev yoksa (409) ya da ağ koptuysa takip sessizce beklemeye alınır;
        // sonraki konum güncellemesinde yeniden denenir.
        if (!cancelled) setStatus('stopped')
      } finally {
        sending.current = false
      }
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return
        const elapsed = Date.now() - lastSentAt.current
        const moved = lastSent.current
          ? distanceMeters(pos.coords, lastSent.current.lat, lastSent.current.lng)
          : Infinity
        if (elapsed >= PING_INTERVAL_MS || moved >= MIN_MOVE_METERS) void send(pos.coords)
      },
      (err) => {
        if (cancelled) return
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'stopped')
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 },
    )

    // watchPosition hareketsizken tetiklenmeyebilir; duraklamaların da haritada
    // görünmesi için düzenli aralıkla tek seferlik konum alınır.
    const timer = window.setInterval(() => {
      if (Date.now() - lastSentAt.current < PING_INTERVAL_MS) return
      navigator.geolocation.getCurrentPosition(
        (pos) => { if (!cancelled) void send(pos.coords) },
        () => { /* geçici hata: bir sonraki turda tekrar denenir */ },
        { enableHighAccuracy: false, timeout: 15_000, maximumAge: 30_000 },
      )
    }, PING_INTERVAL_MS)

    return () => {
      cancelled = true
      navigator.geolocation.clearWatch(watchId)
      window.clearInterval(timer)
    }
  }, [enabled])

  return { status, todayDistanceMeters }
}
