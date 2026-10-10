import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { MapPinIcon, CoffeeIcon, LayersIcon, DoorOpenIcon, AlertTriangleIcon, BookIcon, QrCodeIcon, ClockIcon, ListOrderedIcon, LayoutGridIcon, BarChart3Icon, MapIcon, CarIcon, ShieldAlertIcon, UsersIcon } from 'lucide-react'
import { Modal, Button, SkeletonRows, SegmentedControl } from '@/design-system'
import { todayIso } from '@/lib/utils'
import type { CitizenLibrarySeatPlan, CitizenLibraryStatus, CitizenStatusPerson } from '@/types/library.types'
import { seatLabel, isSessionOnBreak } from '@/types/library.types'
import libraryService from '@/services/library.service'
import { LibraryActionQrModal } from './LibraryActionQrModal'
import type { LibraryAction } from './LibraryActionQrModal'
import { LibraryOccupancy } from './LibraryOccupancy'
import { LibraryTableGrid } from './LibraryTableGrid'
import { LibraryStatsPanel } from './LibraryStatsPanel'
import { KrokiViewerModal, useKrokiViewer } from './KrokiViewerModal'
import { LibraryStaticQrScanButton } from './LibraryStaticQrScanButton'

type DetailTab = 'seats' | 'stats'

interface Props {
  libraryId: string | null
  onClose: () => void
  onReserved: () => void
}

const activeReservationMessage = async (): Promise<string> => {
  try {
    const session = await libraryService.session()
    if (session) return `Aktif oturumunuz ${session.libraryName} kütüphanesinde devam ediyor. Önce onu kullanın veya kapatın.`
  } catch { void 0 }
  try {
    const list = await libraryService.reservations({ page: 1, limit: 20 })
    const held = list.items.find((r) => r.status === 'held')
    if (held) {
      const seat = held.seatLabel ? ` (${held.seatLabel})` : ''
      return `Aktif bir rezervasyonunuz ${held.libraryName}${seat} kütüphanesinde var. Önce onu kullanın veya iptal edin.`
    }
  } catch { void 0 }
  return 'Aktif bir yer ayırtmanız var. Önce onu kullanın veya iptal edin.'
}

const PersonRow = ({ p, right }: { p: CitizenStatusPerson; right?: string | null }) => (
  <div className={`flex items-center justify-between gap-2 rounded-field px-2.5 py-1.5 ${p.isMe ? 'bg-primary-soft' : ''}`}>
    <span className={`truncate ${p.isMe ? 'type-body-strong text-primary' : 'type-body'}`}>{p.name}{p.isMe ? ' (Siz)' : ''}</span>
    {right && <span className="type-caption flex-shrink-0">{right}</span>}
  </div>
)

export const LibraryDetailModal = ({ libraryId, onClose, onReserved }: Props) => {
  const [status, setStatus] = useState<CitizenLibraryStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [seatPlan, setSeatPlan] = useState<CitizenLibrarySeatPlan | null>(null)
  const [qrAction, setQrAction] = useState<LibraryAction | null>(null)
  const intentGuardRef = useRef<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<DetailTab>('seats')
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null)
  const [overdueBooks, setOverdueBooks] = useState<{ hasOverdue: boolean; count: number; books: { title: string; author?: string | null; dueDate: string; daysOverdue: number }[] } | null>(null)
  const [accessType, setAccessType] = useState<string | undefined>(undefined)
  const [entryControlMode, setEntryControlMode] = useState<string | undefined>(undefined)
  const [deviceKind, setDeviceKind] = useState<string | null>(null)
  const [staticQrEnabled, setStaticQrEnabled] = useState(false)
  const [staticQrMode, setStaticQrMode] = useState<string | undefined>()
  const [remainingLongBreaks, setRemainingLongBreaks] = useState<number | null>(null)
  const [parkingInfo, setParkingInfo] = useState<{ capacity: number | null; type: string | null } | null>(null)
  const [nearestEmergencyArea, setNearestEmergencyArea] = useState<{ name: string; distanceKm: number } | null>(null)
  const kroki = useKrokiViewer()

  const loadSeatPlan = useCallback(async () => {
    if (!libraryId) return
    try { setSeatPlan(await libraryService.seatPlan(libraryId, todayIso())) } catch { setSeatPlan(null) }
  }, [libraryId])

  const load = useCallback(async () => {
    if (!libraryId) return
    try {
      const s = await libraryService.status(libraryId)
      setStatus(s)
      if (s.my.state === 'inside' && s.breakSystemEnabled) {
        try {
          const session = await libraryService.session()
          setRemainingLongBreaks(session?.remainingLongBreaks ?? null)
        } catch { setRemainingLongBreaks(null) }
      } else {
        setRemainingLongBreaks(null)
      }
    } catch { void 0 }
  }, [libraryId])

  useEffect(() => {
    if (!libraryId) { setStatus(null); setSeatPlan(null); setQrAction(null); setOverdueBooks(null); setTab('seats'); setSelectedSeat(null); setAccessType(undefined); setEntryControlMode(undefined); setDeviceKind(null); setStaticQrEnabled(false); setRemainingLongBreaks(null); setParkingInfo(null); setNearestEmergencyArea(null); return }
    let active = true
    setLoading(true)
    Promise.all([
      load(),
      loadSeatPlan(),
      libraryService.getMyOverdueBooks().then(r => { if (active) setOverdueBooks(r) }).catch(() => void 0),
      libraryService.detail(libraryId).then(d => {
        if (!active) return
        setAccessType(d.accessType)
        setEntryControlMode(d.entryControlMode)
        setDeviceKind(d.deviceKind ?? null)
        setStaticQrEnabled(!!d.staticQrEnabled)
        setStaticQrMode(d.staticQrMode)
        setParkingInfo(d.parkingCapacity ? { capacity: d.parkingCapacity, type: d.parkingType ?? null } : null)
        setNearestEmergencyArea(
          d.nearestEmergencyAreaName && d.nearestEmergencyAreaDistanceKm != null
            ? { name: d.nearestEmergencyAreaName, distanceKm: d.nearestEmergencyAreaDistanceKm }
            : null,
        )
      }).catch(() => void 0),
    ]).finally(() => { if (active) setLoading(false) })
    const id = setInterval(() => { if (!qrAction) { void load(); void loadSeatPlan() } }, 8000)
    return () => { active = false; clearInterval(id) }
  }, [libraryId, load, loadSeatPlan, qrAction])

  const masali = status?.seatingMode === 'masali'
  const isDevice = accessType === 'device'
  // Denetim bulgusu (2026-09-06): entryControlMode='manual' (görevli elle kayıt) olan
  // kütüphanelerde bu ekran önceden hep "QR ile Giriş Yap" akışını gösteriyordu — QR
  // üretiliyordu ama okutacak hiçbir cihaz yoktu (bkz. LibraryDetailModal QR-only akış
  // kod incelemesi). Artık bu durumda vatandaşa QR üretmek yerine görevliye başvurması
  // gerektiği açıkça söyleniyor.
  const isManualEntry = entryControlMode === 'manual' && !isDevice
  const canScanStaticQr = !isDevice && staticQrEnabled
  const staticQrExits = canScanStaticQr && (staticQrMode === 'entry_exit' || staticQrMode === 'split')
  const krokiFloors = (seatPlan?.floors ?? []).map((f) => ({ id: f.id, name: f.name, krokiUrl: f.krokiUrl }))
  const hasKroki = krokiFloors.some((f) => f.krokiUrl)

  useEffect(() => {
    if (!selectedSeat || !seatPlan) return
    const stillFree = seatPlan.floors.some((f) => {
      const nodes = [...(f.seats ?? []), ...(f.sections ?? []).flatMap((s) => s.tables.flatMap((t) => t.seats))]
      return nodes.some((n) => n.key === selectedSeat && (n.status === 'available' || n.status === 'free'))
    })
    if (!stillFree) setSelectedSeat(null)
  }, [seatPlan, selectedSeat])

  const onSelectSeat = (seat: string) => {
    setSelectedSeat((cur) => (cur === seat ? null : seat))
  }

  const doSelfExit = async () => {
    setBusy(true)
    try { await libraryService.exit() }
    catch { }
    finally { setBusy(false); void load() }
  }

  const doWalkIn = async (seat: string | null) => {
    if (!libraryId) return
    setBusy(true)
    try {
      await libraryService.walkIn(libraryId, seat)
      setSelectedSeat(null)
      await load()
      setQrAction('entry')
    } catch (e) {
      const err = e as { response?: { data?: { message?: string; errorCode?: string } } }
      if (err.response?.data?.errorCode === 'RESERVATION_ACTIVE') {
        toast.error(await activeReservationMessage())
        onClose()
        return
      }
      toast.error(err.response?.data?.message ?? 'Giriş yapılamadı. Lütfen tekrar deneyin.')
      setSelectedSeat(null)
      await load()
      await loadSeatPlan()
    } finally { setBusy(false) }
  }

  const doJoinQueue = async () => {
    if (!libraryId) return
    setBusy(true)
    try { const r = await libraryService.joinQueue(libraryId); toast.success(`Sıraya katıldınız. Sıra: ${r.position}.`); await load() }
    catch (e) {
      const err = e as { response?: { data?: { errorCode?: string } } }
      if (err.response?.data?.errorCode === 'RESERVATION_ACTIVE') {
        toast.error(await activeReservationMessage())
        onClose()
      }
    } finally { setBusy(false) }
  }

  const doLeaveQueue = async () => {
    if (!libraryId) return
    setBusy(true)
    try { await libraryService.leaveQueue(libraryId); toast.success('Sıradan ayrıldınız.'); await load() }
    catch { void 0 } finally { setBusy(false) }
  }

  const doReserve = async (seat: string | null) => {
    if (!libraryId) return
    setBusy(true)
    try {
      await libraryService.reserve(libraryId, { seat })
      setSelectedSeat(null)
      await load()
      onReserved()
      toast.success('Rezervasyonunuz alındı. QR ile giriş yapabilirsiniz.')
    } catch (e) {
      const err = e as { response?: { data?: { message?: string; errorCode?: string } } }
      if (err.response?.data?.errorCode === 'RESERVATION_ACTIVE') {
        toast.error(await activeReservationMessage())
        onClose()
        return
      }
      toast.error(err.response?.data?.message ?? 'Rezervasyon yapılamadı. Lütfen tekrar deneyin.')
      setSelectedSeat(null)
      await load()
      await loadSeatPlan()
    } finally { setBusy(false) }
  }

  const action = () => {
    if (!status) return null
    const s = status.my.state
    if (s === 'inside') {
      const longBreakUsedUp = remainingLongBreaks != null && remainingLongBreaks <= 0
      return (
        <div className="space-y-3">
          {status.breakSystemEnabled && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setQrAction('short_break')}
                  className="flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-card border-2 border-info/40 bg-info/10 px-3 py-3 text-info transition-all hover:bg-info/15 active:scale-[0.98]"
                >
                  <CoffeeIcon className="h-6 w-6" />
                  <span className="text-base font-bold leading-tight">Kısa Mola</span>
                </button>
                <button
                  type="button"
                  disabled={longBreakUsedUp}
                  onClick={() => setQrAction('long_break')}
                  className={`flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-card border-2 px-3 py-3 transition-all active:scale-[0.98] ${
                    longBreakUsedUp
                      ? 'cursor-not-allowed border-border bg-surface-2 text-foreground-subtle'
                      : 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/15'
                  }`}
                >
                  <CoffeeIcon className="h-6 w-6" />
                  <span className="text-base font-bold leading-tight">Uzun Mola</span>
                </button>
              </div>
              {longBreakUsedUp && (
                <p className="type-caption text-center text-foreground-muted">
                  Uzun mola hakkınızı kullandınız. Yeniden uzun molaya çıkamazsınız.
                </p>
              )}
            </div>
          )}
          {staticQrExits ? (
            <LibraryStaticQrScanButton label="QR Okut ile Çıkış Yap" variant="outline" onSuccess={() => void load()} />
          ) : (
            <Button variant="ghost" size="lg" className="w-full gap-1" isLoading={busy} onClick={() => void doSelfExit()}>
              <DoorOpenIcon className="h-4 w-4" /> Çıkış Yap
            </Button>
          )}
        </div>
      )
    }
    if (isSessionOnBreak(s)) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 rounded-card bg-warning-soft px-3 py-2 text-warning">
            <CoffeeIcon className="h-4 w-4" />
            <span className="type-body-strong">Şu an molasınız var.</span>
          </div>
          <Button variant="primary" size="lg" className="w-full" onClick={() => setQrAction('end_break')}>Mola Bitir</Button>
        </div>
      )
    }
    if (s === 'held') {
      return (
        <div className="space-y-2">
          <div className="rounded-card border border-primary/20 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <QrCodeIcon className="h-5 w-5 flex-shrink-0" />
              <span className="type-body-strong">Rezervasyonunuz hazır — {status.name}</span>
            </div>
            <p className="type-caption text-foreground-muted">
              {isManualEntry
                ? 'Görevliye T.C. kimlik numaranızı söyleyerek giriş yapabilirsiniz.'
                : 'Karekodunuzu okutarak doğrudan giriş yapabilirsiniz.'}
              {status.my.holdRemainingMinutes != null && (
                <span className="block mt-1 text-warning font-medium">
                  Kalan süre: {status.my.holdRemainingMinutes} dakika
                </span>
              )}
            </p>
          </div>
          {isManualEntry ? null : canScanStaticQr ? (
            <LibraryStaticQrScanButton label="QR Okut ile Giriş Yap" onSuccess={() => void load()} />
          ) : (
            <Button variant="primary" size="lg" className="w-full gap-1" onClick={() => setQrAction('entry')}>
              <QrCodeIcon className="h-4 w-4" /> QR ile Giriş Yap
            </Button>
          )}
        </div>
      )
    }
    if (s === 'called') {
      return (
        <div className="space-y-2">
          <div className="rounded-card border border-warning/30 bg-warning/5 p-3 space-y-1">
            <div className="flex items-center gap-2 text-warning">
              <ClockIcon className="h-4 w-4 flex-shrink-0" />
              <span className="type-body-strong">Sıranız geldi!</span>
            </div>
            {status.my.callRemainingMinutes != null && (
              <p className="type-caption text-warning">
                {status.my.callRemainingMinutes} dakika içinde giriş yapmazsanız sıranız iptal olacak.
              </p>
            )}
            <p className="type-caption text-foreground-muted">
              {isManualEntry ? 'Görevliye başvurarak giriş yapabilirsiniz.' : 'Karekodunuzu okutarak giriş yapabilirsiniz.'}
            </p>
          </div>
          {isManualEntry ? null : isDevice && !masali ? (
            <Button variant="primary" size="lg" className="w-full gap-1" onClick={() => setQrAction('entry')}>
              <QrCodeIcon className="h-4 w-4" /> QR ile Giriş Yap
            </Button>
          ) : canScanStaticQr ? (
            <LibraryStaticQrScanButton label="QR Okut ile Giriş Yap" variant="primary" onSuccess={() => void load()} />
          ) : masali && (
            <p className="type-caption text-center text-foreground-muted">Aşağıdan boş bir masa seçerek giriş yapın.</p>
          )}
        </div>
      )
    }
    if (s === 'queued') {
      return (
        <div className="space-y-2">
          <div className="rounded-card border border-info/20 bg-info/5 p-3">
            <div className="flex items-center gap-2 text-info mb-1">
              <ListOrderedIcon className="h-4 w-4 flex-shrink-0" />
              <span className="type-body-strong">Sıradasınız</span>
            </div>
            <p className="type-caption text-foreground-muted">
              Sıra numaranız: <span className="font-bold text-foreground-strong text-base">{status.my.queuePosition}. sıra</span>
            </p>
            <p className="type-caption text-foreground-muted mt-0.5">Sıranız geldiğinde bildirim alacaksınız.</p>
          </div>
          <Button variant="outline" size="lg" className="w-full" isLoading={busy} onClick={doLeaveQueue}>Sıradan Ayrıl</Button>
        </div>
      )
    }
    if (status.free > 0) {
      if (isDevice && !masali) {
        return (
          <div className="space-y-2">
            <div className="rounded-card border border-primary/20 bg-primary/5 p-3 space-y-1">
              <div className="flex items-center gap-2 text-primary">
                <QrCodeIcon className="h-4 w-4 flex-shrink-0" />
                <span className="type-body-strong">QR ile geçiş</span>
              </div>
              <p className="type-caption text-foreground-muted">
                QR ile geçiş işlemini başlatmak için aşağıdaki butonu kullanın.
              </p>
            </div>
            <Button variant="primary" size="lg" className="w-full gap-1" onClick={() => setQrAction('entry')}>
              <QrCodeIcon className="h-4 w-4" /> QR ile Geçiş Yap
            </Button>
          </div>
        )
      }

      const canReserve = status.reservationEnabled && status.reservationAllowed !== false
      const entryLabel = masali && selectedSeat ? 'Giriş Yap' : masali ? 'Masa seçin' : 'Giriş Yap'
      const entrySeat = masali ? selectedSeat : null

      if (isManualEntry && !canScanStaticQr) {
        return (
          <div className="rounded-card border border-info/20 bg-info/5 p-3 space-y-1">
            <div className="flex items-center gap-2 text-info">
              <UsersIcon className="h-4 w-4 flex-shrink-0" />
              <span className="type-body-strong">Görevliye başvurun</span>
            </div>
            <p className="type-caption text-foreground-muted">
              Bu kıraathanede giriş, T.C. kimlik numaranızla görevli tarafından kaydedilir. Lütfen bankoya başvurun.
            </p>
          </div>
        )
      }

      return (
        <div className="space-y-2">
          {masali && (
            <p className="type-caption text-center text-foreground-muted">
              {selectedSeat ? 'Seçtiğiniz koltuk için işlem seçin.' : 'Aşağıdan boş bir koltuk seçin.'}
            </p>
          )}
          {status.reservationEnabled && status.reservationAllowed === false && (
            <div className="rounded-card border border-warning/30 bg-warning/5 px-3 py-2 type-caption text-warning">
              Tekrarlanan iptal/giriş yapmama nedeniyle rezervasyon hakkınız geçici olarak kapalı. Giriş yapabilirsiniz.
            </div>
          )}
          {canScanStaticQr ? (
            <LibraryStaticQrScanButton label="QR Okut ile Giriş Yap" disabled={masali && !selectedSeat} onSuccess={() => void load()} />
          ) : (
            <Button
              variant="primary"
              size="lg"
              className="w-full gap-1"
              isLoading={busy}
              disabled={masali && !selectedSeat}
              onClick={() => void doWalkIn(entrySeat)}
            >
              <QrCodeIcon className="h-4 w-4" /> {entryLabel}
            </Button>
          )}
          {canReserve && (
            <Button
              variant="outline"
              size="lg"
              className="w-full gap-1"
              isLoading={busy}
              disabled={masali && !selectedSeat}
              onClick={() => void doReserve(entrySeat)}
            >
              <ClockIcon className="h-4 w-4" /> Rezervasyon Yap
            </Button>
          )}
        </div>
      )
    }
    if (status.queueEnabled) {
      return <Button variant="primary" size="lg" className="w-full" isLoading={busy} onClick={doJoinQueue}>Sıraya Katıl</Button>
    }
    return <Button variant="outline" size="lg" className="w-full" disabled>Şu an dolu</Button>
  }

  return (
    <>
      <Modal open={!!libraryId} onClose={onClose} title="Kıraathane" width={480} bodyClassName="p-5">
        {loading || !status ? (
          <SkeletonRows rows={5} />
        ) : (
          <div className="space-y-4">
            <p className="type-section">{status.name}</p>

            {overdueBooks?.hasOverdue && (
              <div className="rounded-card border border-danger/30 bg-danger/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-danger">
                  <AlertTriangleIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="type-body-strong">{overdueBooks.count} adet gecikmiş kitabınız var!</span>
                </div>
                <div className="space-y-1.5">
                  {overdueBooks.books.map((b, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <BookIcon className="h-3.5 w-3.5 text-danger/60 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="type-caption font-medium">{b.title}{b.author ? ` — ${b.author}` : ''}</p>
                        <p className="type-caption text-danger">{b.daysOverdue} gün gecikmiş</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="type-caption text-foreground-muted">Kütüphane girişi kısıtlanabilir. Lütfen kitapları iade edin.</p>
              </div>
            )}

            <LibraryOccupancy inside={status.inside} onBreak={status.onBreak} capacity={status.capacity} free={status.free} waiting={status.waiting} />

            <SegmentedControl
              value={tab}
              onChange={(v) => setTab(v as DetailTab)}
              options={[
                // Kullanıcı bulgusu (2026-09-06): SeatingMode='sirali' (masasız, sadece
                // giriş-çıkış) kütüphanelerde bu sekme her zaman "Masa Seçimi" yazıyordu
                // ama LibraryTableGrid yalnızca masali sistemde render ediliyor — kullanıcı
                // sekmeye tıklayınca hiç masa/koltuk grid'i görmüyordu (aslında giriş
                // butonu vardı ama etiket yanlış beklenti yaratıyordu). Etiket artık
                // gerçek oturma düzenine göre değişiyor.
                { value: 'seats', label: masali ? 'Masa Seçimi' : 'Giriş', icon: LayoutGridIcon },
                { value: 'stats', label: 'İstatistikler', icon: BarChart3Icon },
              ]}
            />

            {tab === 'stats' ? (
              <LibraryStatsPanel libraryId={libraryId!} />
            ) : (
              <div className="space-y-4">
                {status.floors.length > 1 && (
                  <div className="space-y-1.5 rounded-card bg-surface-1 p-3">
                    {status.floors.map((f) => (
                      <div key={f.id} className="flex items-center justify-between">
                        <span className="type-caption inline-flex items-center gap-1"><LayersIcon className="h-3 w-3" /> {f.name}</span>
                        <span className="type-body-strong">{f.inside}/{f.capacity}</span>
                      </div>
                    ))}
                  </div>
                )}

                {hasKroki && (
                  <button
                    type="button"
                    onClick={() => kroki.show(null)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-card border border-border bg-surface-0 px-3 py-2.5 type-body-strong text-primary transition hover:bg-surface-1"
                  >
                    <MapIcon className="h-4 w-4" /> Oturma Planı Krokisi
                  </button>
                )}

                {action()}

                {masali && (status.my.state === 'none' || status.my.state === 'called') && status.free > 0 && (
                  <LibraryTableGrid plan={seatPlan} selected={selectedSeat} onSelectSeat={onSelectSeat} />
                )}

                {status.onBreakList.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="type-label inline-flex items-center gap-1"><CoffeeIcon className="h-3.5 w-3.5" /> Molada ({status.onBreak})</p>
                    <div className="space-y-1 rounded-card bg-surface-1 p-2">
                      {status.onBreakList.map((p) => (
                        <PersonRow key={p.participantId ?? p.seatLabel} p={p} right={p.breakRemainingMinutes != null ? `${p.breakRemainingMinutes} dk` : null} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-card bg-surface-1 p-3">
                  <MapPinIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground-muted" />
                  <p className="type-caption">
                    {isManualEntry
                      ? `Bu kıraathanede giriş görevli tarafından yapılır.${masali ? ' Yalnız seçtiğiniz koltukta oturabilirsiniz.' : ''}`
                      : `Karekodunuzu okutarak doğrudan giriş yapabilirsiniz.${masali ? ' Yalnız seçtiğiniz koltukta oturabilirsiniz.' : ''}`}
                  </p>
                </div>

                {(parkingInfo || nearestEmergencyArea) && (
                  <div className="space-y-1.5">
                    {parkingInfo && (
                      <div className="flex items-center gap-2 rounded-card bg-surface-1 p-3">
                        <CarIcon className="h-4 w-4 flex-shrink-0 text-foreground-muted" />
                        <p className="type-caption">
                          Otopark{parkingInfo.capacity ? ` · ${parkingInfo.capacity} araçlık` : ''}
                        </p>
                      </div>
                    )}
                    {nearestEmergencyArea && (
                      <div className="flex items-center gap-2 rounded-card bg-surface-1 p-3">
                        <ShieldAlertIcon className="h-4 w-4 flex-shrink-0 text-foreground-muted" />
                        <p className="type-caption">
                          En yakın acil toplanma alanı: {nearestEmergencyArea.name} ({nearestEmergencyArea.distanceKm} km)
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {qrAction && (
        <LibraryActionQrModal
          open={qrAction !== null}
          action={qrAction}
          libraryId={libraryId ?? ''}
          seatLabel={status?.my.seat ? seatLabel(status.my.seat) : null}
          floorName={status?.floors.find(f => f.inside < f.capacity)?.name ?? status?.floors[0]?.name ?? null}
          accessType={accessType}
          deviceKind={deviceKind}
          onSuccess={() => { intentGuardRef.current = null; void load() }}
          intentGuardRef={intentGuardRef}
          onClose={() => setQrAction(null)}
        />
      )}

      <KrokiViewerModal open={kroki.open} onClose={kroki.hide} floors={krokiFloors} initialFloorId={kroki.floorId} />
    </>
  )
}
