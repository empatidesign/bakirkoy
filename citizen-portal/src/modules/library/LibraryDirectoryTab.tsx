import { useCallback, useEffect, useState } from 'react'
import { MapPinIcon, UsersIcon, LayersIcon, LibraryIcon, NavigationIcon, SearchIcon, WifiIcon, ZapIcon, BabyIcon, ArchiveIcon, DoorOpenIcon, ChevronRightIcon, LockIcon, ArmchairIcon } from 'lucide-react'
import { SkeletonRows } from '@/design-system'
import { DistanceBadge } from '@/components/specialized/DistanceBadge'
import { toast } from 'sonner'
import type { CitizenLibrary, CitizenSession, CitizenLibraryReservation, CitizenMyQueue, CitizenLibraryFilters } from '@/types/library.types'
import { isSessionOnBreak, isSessionActive } from '@/types/library.types'
import libraryService from '@/services/library.service'
import { citizenRealtime } from '@/services/citizenRealtime'
import { LibraryDetailModal } from './LibraryDetailModal'
import { LibrarySessionScreen } from './LibrarySessionScreen'

const buildDirectionsUrl = (l: CitizenLibrary): string | null => {
  if (l.latitude != null && l.longitude != null)
    return `https://www.google.com/maps/dir/?api=1&destination=${l.latitude},${l.longitude}`
  const place = [l.name, l.district, l.address, l.city].filter(Boolean).join(' ')
  if (!place) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
}

const AMENITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  wifi: WifiIcon,
  power: ZapIcon,
  locker: ArchiveIcon,
  childroom: BabyIcon,
}

function getOccupancyColor(inside: number, capacity: number) {
  if (capacity === 0) return '#94A3B8'
  const pct = inside / capacity
  if (pct >= 1) return '#EF4444'
  if (pct >= 0.75) return '#F59E0B'
  return '#10B981'
}

function getAccessTypeLabel(accessType?: string, _deviceKind?: string | null, entryControlMode?: string): string | null {
  if (accessType === 'open') return 'Serbest Kullanım'
  if (accessType === 'device') return 'QR ile Geçiş'
  // Denetim bulgusu (2026-09-06): rozet önceden yalnızca accessType='qr' ise "QR Girişli"
  // gösteriyordu, ama accessType='qr' (cihaz yok) olan kütüphanelerin bir kısmında
  // entryControlMode='manual' (görevli elle kayıt) olabiliyor — bu durumda "QR Girişli"
  // etiketi yanıltıcı, çünkü kıraathanede okutacak bir cihaz/kiosk yok.
  if (accessType === 'qr' && entryControlMode === 'manual') return 'Görevli Girişli'
  if (accessType === 'qr') return 'QR Girişli'
  return null
}

function getStatusLabel(free: number, capacity: number) {
  if (capacity === 0) return 'Bilinmiyor'
  if (free === 0) return 'Dolu'
  if (free <= 3) return `Son ${free} yer`
  return 'Yer Var'
}

export const LibraryDirectoryTab = () => {
  const [items, setItems] = useState<CitizenLibrary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [areaType, setAreaType] = useState<string>('')
  const [filters, setFilters] = useState<CitizenLibraryFilters>({ areaTypes: [], totalCount: 0, availableCount: 0 })
  const [refresh, setRefresh] = useState(0)
  const [session, setSession] = useState<CitizenSession | null>(null)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [reservation, setReservation] = useState<CitizenLibraryReservation | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [myQueue, setMyQueue] = useState<CitizenMyQueue | null>(null)
  const [bindingUnknown, setBindingUnknown] = useState(false)

  const loadSession = useCallback(async () => {
    let failed = false
    try { setSession(await libraryService.session()) }
    catch { setSession(null); failed = true }
    try {
      const list = await libraryService.reservations({ page: 1, limit: 20 })
      setReservation(list.items.find((r) => r.status === 'held') ?? null)
    } catch { setReservation(null); failed = true }
    try { setMyQueue(await libraryService.myQueue()) }
    catch { setMyQueue(null) }
    setBindingUnknown(failed)
  }, [])

  const cancelReservation = useCallback(async () => {
    if (!reservation) return
    setCancelling(true)
    try {
      await libraryService.cancel(reservation.id)
      toast.success('Rezervasyonunuz iptal edildi.')
      setReservation(null)
      void loadSession()
      setRefresh((n) => n + 1)
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Rezervasyon iptal edilemedi.')
    } finally { setCancelling(false) }
  }, [reservation, loadSession])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let active = true
    const params: Record<string, unknown> = {}
    if (debouncedSearch) params.search = debouncedSearch
    libraryService.filters(params)
      .then((f) => { if (active) setFilters(f) })
      .catch(() => { if (active) setFilters({ areaTypes: [], totalCount: 0, availableCount: 0 }) })
    return () => { active = false }
  }, [debouncedSearch])

  useEffect(() => {
    let active = true
    setLoading(true)
    const params: Record<string, unknown> = { page: 1, limit: 50 }
    if (debouncedSearch) params.search = debouncedSearch
    if (areaType) params.areaType = areaType
    libraryService.discover(params)
      .then((r) => { if (active) setItems(r.items) })
      .catch(() => { if (active) setItems([]) })
      .finally(() => { if (active) setLoading(false) })
    void loadSession()
    return () => { active = false }
  }, [refresh, debouncedSearch, areaType, loadSession])

  useEffect(() => citizenRealtime.onLibrarySession((e) => {
    void loadSession()
    if (isSessionActive(e.status ?? undefined)) {
      if (e.action === 'entry' || e.action === 'end_break') {
        setSelectedId(null)
        setSessionOpen(true)
      }
    } else {
      setSessionOpen(false)
    }
  }), [loadSession])

  useEffect(() => citizenRealtime.onLibraryOccupancy((e) => {
    setItems((prev) => prev?.map((l) => l.id === e.libraryId
      ? { ...l, inside: e.inside, onBreak: e.onBreak, free: e.free, waiting: e.waiting, occupancyRate: l.capacity > 0 ? Math.round((e.inside / l.capacity) * 100) : 0 }
      : l) ?? prev)
  }), [])

  useEffect(() => citizenRealtime.onLibraryQueueCalled((e) => {
    toast.success(`Sıranız geldi! ${e.libraryName} için süre içinde giriş yapın.`, { duration: 8000 })
    setSelectedId(e.libraryId)
    void loadSession()
  }), [loadSession])

  const filtered = items ?? []

  return (
    <div className="flex flex-col bg-surface-1">
      <div
        className="sticky top-0 z-10 px-4 pt-4 pb-3 bg-surface-1/90"
        style={{
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="relative">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-300" />
          <input
            type="text"
            placeholder="Kıraathane veya semt ara…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-2xl pl-10 pr-4 py-2.5 text-sm text-foreground-default placeholder:text-foreground-subtle outline-none transition-all bg-card"
            style={{
              border: '1.5px solid rgba(59,130,246,0.15)',
              boxShadow: '0 2px 8px rgba(59,130,246,0.06)',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.15)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,0.06)' }}
          />
        </div>

        {filters.areaTypes.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setAreaType('')}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors"
              style={areaType === ''
                ? { borderColor: '#1d4ed8', background: '#1d4ed8', color: '#fff' }
                : { borderColor: 'rgba(59,130,246,0.2)', background: 'var(--card)', color: 'var(--foreground-muted)' }}
            >
              Tümü
              <span className="rounded-full px-1.5 text-[11px] font-bold"
                style={areaType === '' ? { background: 'rgba(255,255,255,0.25)' } : { background: 'rgba(59,130,246,0.1)' }}>
                {filters.totalCount}
              </span>
            </button>
            {filters.areaTypes.map((a) => {
              const active = areaType === a.value
              return (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAreaType(active ? '' : a.value)}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors"
                  style={active
                    ? { borderColor: '#1d4ed8', background: '#1d4ed8', color: '#fff' }
                    : { borderColor: 'rgba(59,130,246,0.2)', background: 'var(--card)', color: 'var(--foreground-muted)' }}
                >
                  {a.label}
                  <span className="rounded-full px-1.5 text-[11px] font-bold"
                    style={active ? { background: 'rgba(255,255,255,0.25)' } : { background: 'rgba(59,130,246,0.1)' }}>
                    {a.count}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {bindingUnknown && (
          <div className="flex items-start gap-2 rounded-2xl px-4 py-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
            <div className="flex-1">
              <p className="text-[13px] font-semibold" style={{ color: '#92400e' }}>Durum bilgisi alınamadı</p>
              <p className="mt-0.5 text-[12px]" style={{ color: '#b45309' }}>
                Aktif oturumunuz olup olmadığı doğrulanamadı. Yanlışlıkla ikinci bir işlem açılmaması için
                kıraathane seçimi geçici olarak kapatıldı.
              </p>
            </div>
            <button type="button" onClick={() => void loadSession()}
              className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold"
              style={{ background: '#f59e0b', color: '#fff' }}>
              Tekrar dene
            </button>
          </div>
        )}
        {session && (
          <button
            type="button"
            onClick={() => setSessionOpen(true)}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-white transition-all ${!isSessionOnBreak(session.status) ? 'active-session-banner' : ''}`}
            style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)', boxShadow: '0 6px 18px rgba(29,78,216,0.28)' }}
          >
            <span className="relative grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-white/20">
              <DoorOpenIcon className="h-5 w-5" />
              {!isSessionOnBreak(session.status) && (
                <span className="active-session-dot absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
              )}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-sm font-semibold">
                {isSessionOnBreak(session.status) ? 'Molanız devam ediyor' : 'Aktif oturumunuz var'}
              </span>
              <span className="block truncate text-xs text-white/75">{session.libraryName} · oturum bitene kadar diğerleri kilitli</span>
            </span>
            <span className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-medium">
              Aç <ChevronRightIcon className="h-3.5 w-3.5" />
            </span>
          </button>
        )}

        {!session && reservation && (
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', boxShadow: '0 6px 18px rgba(124,58,237,0.28)' }}
          >
            <button type="button" onClick={() => setSelectedId(reservation.libraryId)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-white/20">
                <ArmchairIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-sm font-semibold">Aktif rezervasyonunuz var</span>
                <span className="block truncate text-xs text-white/75">
                  {reservation.libraryName}{reservation.seatLabel ? ` · ${reservation.seatLabel}` : ''} · süre içinde giriş yapın
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={cancelReservation}
              disabled={cancelling}
              className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold transition hover:bg-white/30 disabled:opacity-60"
            >
              {cancelling ? 'İptal…' : 'İptal Et'}
            </button>
          </div>
        )}

        {!session && !reservation && myQueue && (
          <button
            type="button"
            onClick={() => setSelectedId(myQueue.libraryId)}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-white transition-all"
            style={{
              background: myQueue.status === 'called'
                ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                : 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
              boxShadow: '0 6px 18px rgba(2,132,199,0.28)',
            }}
          >
            <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-white/20">
              <UsersIcon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-sm font-semibold">
                {myQueue.status === 'called' ? 'Sıranız geldi! Giriş yapın' : `Sıradasınız · ${myQueue.position}. sıra`}
              </span>
              <span className="block truncate text-xs text-white/75">
                {myQueue.libraryName}
                {myQueue.status === 'called' && myQueue.callRemainingMinutes != null
                  ? ` · ${myQueue.callRemainingMinutes} dk içinde giriş yapın`
                  : ' · sıranız gelince bildirilecek'}
              </span>
            </span>
            <span className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold">
              {myQueue.status === 'called' ? 'Giriş Yap' : 'Aç'} <ChevronRightIcon className="h-3.5 w-3.5" />
            </span>
          </button>
        )}

        {loading ? (
          <SkeletonRows rows={4} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.12)' }}>
              <LibraryIcon className="h-9 w-9 text-blue-300" />
            </div>
            <div>
              <p className="font-bold text-foreground-default">Kıraathane bulunamadı</p>
              <p className="mt-1 text-sm text-foreground-subtle">Arama kriterini değiştirin.</p>
            </div>
          </div>
        ) : (
          filtered.map((l) => {
            const directionsUrl = buildDirectionsUrl(l)
            const occupancyColor = getOccupancyColor(l.inside, l.capacity)
            const statusLabel = getStatusLabel(l.free, l.capacity)
            const pct = l.capacity > 0 ? Math.min(100, Math.round((l.inside / l.capacity) * 100)) : 0
            const isActiveSession = !!session && session.libraryId === l.id
            const isReserved = !session && !!reservation && reservation.libraryId === l.id
            const isQueued = !session && !reservation && !!myQueue && myQueue.libraryId === l.id
            const hasBinding = !!session || !!reservation
            const isMine = isActiveSession || isReserved || isQueued
            const locked = bindingUnknown ? true : (hasBinding && !isMine)

            return (
              <button
                key={l.id}
                onClick={() => { if (locked) return; if (isActiveSession) setSessionOpen(true); else setSelectedId(l.id) }}
                disabled={locked}
                className={`relative w-full text-left overflow-hidden rounded-2xl transition-all duration-200 bg-card ${locked ? 'cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99]'}`}
                style={{
                  backdropFilter: 'blur(20px)',
                  border: isActiveSession ? '1.5px solid rgba(29,78,216,0.5)' : isReserved ? '1.5px solid rgba(124,58,237,0.5)' : '1px solid var(--border)',
                  boxShadow: '0 4px 20px rgba(59,130,246,0.08), 0 1px 4px rgba(0,0,0,0.05)',
                  opacity: locked ? 0.55 : 1,
                  filter: locked ? 'grayscale(0.7)' : 'none',
                }}
              >
                {locked && (
                  <span className="absolute right-3 top-3 z-[1] flex items-center gap-1 rounded-full bg-gray-800/80 px-2 py-1 text-[10px] font-bold text-white">
                    <LockIcon className="h-3 w-3" /> Kilitli
                  </span>
                )}
                {isActiveSession && (
                  <span className="absolute right-3 top-3 z-[1] flex items-center gap-1 rounded-full bg-blue-600 px-2 py-1 text-[10px] font-bold text-white">
                    <DoorOpenIcon className="h-3 w-3" /> Aktif oturum
                  </span>
                )}
                {isReserved && (
                  <span className="absolute right-3 top-3 z-[1] flex items-center gap-1 rounded-full bg-violet-600 px-2 py-1 text-[10px] font-bold text-white">
                    <ArmchairIcon className="h-3 w-3" /> Rezerve
                  </span>
                )}
                {isQueued && (
                  <span className="absolute right-3 top-3 z-[1] flex items-center gap-1 rounded-full bg-sky-600 px-2 py-1 text-[10px] font-bold text-white">
                    <UsersIcon className="h-3 w-3" /> {myQueue?.status === 'called' ? 'Sıranız geldi' : `${myQueue?.position}. sıra`}
                  </span>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {l.imageUrl ? (
                        <div className="aspect-[4/3] w-24 flex-shrink-0 overflow-hidden rounded-xl bg-blue-50">
                          <img src={l.imageUrl} alt={l.name} className="h-full w-full object-cover" loading="lazy" />
                        </div>
                      ) : (
                        <div
                          className="flex aspect-[4/3] w-24 flex-shrink-0 items-center justify-center rounded-xl"
                          style={{ background: 'linear-gradient(135deg, #3B82F6, #0EA5E9)', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
                        >
                          <LibraryIcon className="h-7 w-7 text-white" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-foreground-strong leading-tight">{l.name}</p>
                          {l.reservationEnabled && (
                            <span
                              className="rounded-lg px-2 py-0.5 text-[10px] font-bold"
                              style={{ background: '#10B98118', color: '#10B981' }}
                            >
                              Yer ayırtılabilir
                            </span>
                          )}
                          {getAccessTypeLabel(l.accessType, l.deviceKind, l.entryControlMode) && (
                            <span
                              className="rounded-lg px-2 py-0.5 text-[10px] font-bold"
                              style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}
                            >
                              {getAccessTypeLabel(l.accessType, l.deviceKind, l.entryControlMode)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          {(l.district || l.address) && (
                            <span className="flex items-center gap-1 text-xs text-foreground-muted">
                              <MapPinIcon className="h-3 w-3" />
                              {[l.district, l.address].filter(Boolean).join(' · ')}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-foreground-muted">
                            <UsersIcon className="h-3 w-3" />
                            {l.capacity} kişilik
                          </span>
                          {l.floorCount > 1 && (
                            <span className="flex items-center gap-1 text-xs text-foreground-muted">
                              <LayersIcon className="h-3 w-3" />
                              {l.floorCount} kat
                            </span>
                          )}
                          <DistanceBadge
                            distanceOnly
                            target={l.latitude != null && l.longitude != null ? { latitude: l.latitude, longitude: l.longitude } : null}
                          />
                        </div>
                      </div>
                    </div>

                    {directionsUrl && (
                      <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-blue-50"
                        style={{ border: '1px solid rgba(59,130,246,0.2)' }}
                      >
                        <NavigationIcon className="h-3.5 w-3.5 text-blue-500" />
                      </a>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {[
                      { label: 'İçeride', value: `${l.inside}/${l.capacity}`, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
                      { label: 'Molada', value: l.onBreak, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
                      { label: 'Boş', value: l.free, color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
                      { label: 'Sırada', value: l.waiting, color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
                    ].map(stat => (
                      <div
                        key={stat.label}
                        className="flex flex-col items-center gap-1 rounded-xl py-3"
                        style={{ background: stat.bg }}
                      >
                        <span className="text-lg font-black leading-none tabular-nums" style={{ color: stat.color }}>{stat.value}</span>
                        <span className="text-[10px] font-semibold text-gray-500 leading-none">{stat.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold" style={{ color: occupancyColor }}>{statusLabel}</span>
                      <span className="text-[10px] font-semibold text-gray-300">{pct}% dolu</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'rgba(0,0,0,0.06)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${occupancyColor}cc, ${occupancyColor})` }}
                      />
                    </div>
                  </div>

                  {l.amenities.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {l.amenities.slice(0, 6).map(a => {
                        const Icon = AMENITY_ICONS[a.toLowerCase()] ?? LibraryIcon
                        return (
                          <span
                            key={a}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold"
                            style={{ background: 'rgba(59,130,246,0.08)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.15)' }}
                          >
                            <Icon className="h-3 w-3" />
                            {a}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>

      <LibraryDetailModal
        libraryId={selectedId}
        onClose={() => { setSelectedId(null); void loadSession() }}
        onReserved={() => { setSelectedId(null); void loadSession(); setRefresh(n => n + 1) }}
      />

      <LibrarySessionScreen
        open={sessionOpen}
        onClose={() => { setSessionOpen(false); void loadSession() }}
        onChanged={() => { void loadSession(); setRefresh(n => n + 1) }}
      />
    </div>
  )
}
