import { useCallback, useEffect, useRef, useState } from 'react'
import { CoffeeIcon, GiftIcon, DoorOpenIcon, LibraryIcon, ClockIcon, LogInIcon, LogOutIcon, PlayIcon, InfoIcon, HistoryIcon, MapIcon } from 'lucide-react'
import { Modal, Button, SegmentedControl } from '@/design-system'
import libraryService from '@/services/library.service'
import { citizenRealtime } from '@/services/citizenRealtime'
import { todayIso } from '@/lib/utils'
import type { CitizenSession, CitizenLibraryMovement, CitizenLibraryMovementKind } from '@/types/library.types'
import { isSessionOnBreak, isSessionActive } from '@/types/library.types'
import { LibraryActionQrModal } from './LibraryActionQrModal'
import type { LibraryAction } from './LibraryActionQrModal'
import { KrokiViewerModal, useKrokiViewer } from './KrokiViewerModal'
import type { KrokiFloor } from './KrokiViewerModal'
import { LibraryStaticQrScanButton } from './LibraryStaticQrScanButton'

const MOVEMENT_META: Record<CitizenLibraryMovementKind, { label: string; icon: typeof LogInIcon; color: string; bg: string }> = {
  entry: { label: 'Giriş', icon: LogInIcon, color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  exit: { label: 'Çıkış', icon: LogOutIcon, color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
  break_start: { label: 'Mola başladı', icon: CoffeeIcon, color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
  break_end: { label: 'Moladan döndü', icon: PlayIcon, color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
}

interface Props {
  open: boolean
  onClose: () => void
  onChanged?: () => void
}

const fmtClock = (iso?: string | null): string => {
  if (!iso) return '--:--'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const fmtCountdownFromDeadline = (deadlineIso?: string | null, nowMs?: number): string => {
  if (!deadlineIso) return '--:--'
  const totalSeconds = Math.max(0, Math.round((new Date(deadlineIso).getTime() - (nowMs ?? Date.now())) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

export const LibrarySessionScreen = ({ open, onClose, onChanged }: Props) => {
  const [session, setSession] = useState<CitizenSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [qrAction, setQrAction] = useState<LibraryAction | null>(null)
  const intentGuardRef = useRef<string | null>(null)
  const [movements, setMovements] = useState<CitizenLibraryMovement[]>([])
  const [tab, setTab] = useState<'info' | 'history'>('info')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [krokiFloors, setKrokiFloors] = useState<KrokiFloor[]>([])
  const [canScanStaticQr, setCanScanStaticQr] = useState(false)
  const [staticQrMode, setStaticQrMode] = useState<string | undefined>()
  const [exiting, setExiting] = useState(false)
  const kroki = useKrokiViewer()

  const load = useCallback(async () => {
    setLoading(true)
    try { setSession(await libraryService.session()) }
    catch { setSession(null) }
    finally { setLoading(false) }
    try { setMovements(await libraryService.history()) }
    catch { setMovements([]) }
  }, [])

  useEffect(() => {
    if (!open) { setSession(null); setQrAction(null); return }
    void load()
    const id = setInterval(() => { if (!qrAction) void load() }, 15000)
    const off = citizenRealtime.onLibrarySession((e) => {
      void load()
      onChanged?.()
      if (!isSessionActive(e.status ?? undefined)) {
        setQrAction(null)
        onClose()
      }
    })
    return () => { clearInterval(id); off() }
  }, [open, load, qrAction, onChanged, onClose])

  useEffect(() => {
    if (!open) return
    const tick = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [open])

  useEffect(() => {
    if (!session?.libraryId) { setKrokiFloors([]); return }
    let active = true
    libraryService.seatPlan(session.libraryId, todayIso())
      .then((plan) => { if (active) setKrokiFloors(plan.floors.map((f) => ({ id: f.id, name: f.name, krokiUrl: f.krokiUrl }))) })
      .catch(() => { if (active) setKrokiFloors([]) })
    return () => { active = false }
  }, [session?.libraryId])

  const hasKroki = krokiFloors.some((f) => f.krokiUrl)

  useEffect(() => {
    if (!session?.libraryId) { setCanScanStaticQr(false); return }
    let active = true
    libraryService.detail(session.libraryId)
      .then((d) => { if (active) { setCanScanStaticQr(d.accessType !== 'device' && !!d.staticQrEnabled); setStaticQrMode(d.staticQrMode) } })
      .catch(() => { if (active) setCanScanStaticQr(false) })
    return () => { active = false }
  }, [session?.libraryId])

  const onBreak = isSessionOnBreak(session?.status)
  const deadlineIso = onBreak ? session?.breakEndsAt : session?.estimatedExitAt
  const remainingSeconds = deadlineIso
    ? Math.max(0, Math.round((new Date(deadlineIso).getTime() - nowMs) / 1000))
    : null
  const totalWindowSeconds = onBreak
    ? (session?.breakType === 'long' ? session?.longBreakDurationMinutes : session?.breakDurationMinutes)
    : session?.maxStudyMinutes
  const ringPct = totalWindowSeconds && totalWindowSeconds > 0 && remainingSeconds != null
    ? Math.max(0, Math.min(100, (remainingSeconds / (totalWindowSeconds * 60)) * 100))
    : 100
  const RING = 2 * Math.PI * 52

  const breakSystemEnabled = session?.breakSystemEnabled ?? true
  const shortBreakMinutes = session?.breakDurationMinutes || 30
  const longBreakMinutes = session?.longBreakDurationMinutes || 60
  const shortBreakExhausted = session?.remainingShortBreaks === 0
  const longBreakExhausted = session?.remainingLongBreaks === 0

  const staticQrExits = canScanStaticQr && (staticQrMode === 'entry_exit' || staticQrMode === 'split')
  const selfExit = async () => {
    setExiting(true)
    try { await libraryService.exit(); afterQr() }
    catch { void load() }
    finally { setExiting(false) }
  }
  const afterQr = () => { intentGuardRef.current = null; setQrAction(null); void load(); onChanged?.() }

  return (
    <>
      <Modal open={open} onClose={onClose} fullscreen bodyClassName="p-0">
        <div className="relative flex-shrink-0 bg-gradient-to-b from-success to-success/80 px-5 pb-6 pt-5 text-success-foreground">
          <p className="text-lg font-semibold text-success-foreground">Aktif Oturumunuz</p>
          {session && <p className="type-caption text-success-foreground/70">Oturum ID: #{session.id.slice(0, 6).toUpperCase()}</p>}

          {session && (
            <div className="mt-4 flex items-center gap-3 rounded-card bg-surface-0 px-4 py-3 text-foreground-strong">
              <span className="grid h-10 w-10 place-items-center rounded-field bg-success-soft text-success">
                <LibraryIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="type-body-strong truncate">{session.libraryName}</p>
                {session.seatLabel && <p className="type-caption text-foreground-muted">{session.seatLabel}{session.floorName ? ` · ${session.floorName}` : ''}</p>}
              </div>
              {hasKroki && (
                <button
                  type="button"
                  onClick={() => kroki.show(krokiFloors.find((f) => f.name === session.floorName)?.id ?? null)}
                  className="flex flex-shrink-0 items-center gap-1 rounded-field border border-border bg-surface-1 px-2.5 py-1.5 type-caption font-semibold text-foreground-strong transition hover:bg-surface-2"
                >
                  <MapIcon className="h-3.5 w-3.5" /> Kroki
                </button>
              )}
            </div>
          )}
        </div>

        {loading && !session ? (
          <div className="grid flex-1 place-items-center text-foreground-muted">
            <ClockIcon className="h-6 w-6 animate-pulse" />
          </div>
        ) : !session ? (
          <div className="grid flex-1 place-items-center gap-4 p-5 text-center">
            <p className="type-body text-foreground-muted">Aktif oturumunuz bulunmuyor.</p>
            <Button variant="primary" size="lg" onClick={onClose}>
              Ana Ekrana Dön
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex-shrink-0 px-5 pt-4 lg:hidden">
              <SegmentedControl
                value={tab}
                onChange={(v) => setTab(v as 'info' | 'history')}
                options={[
                  { value: 'info', label: 'Oturum Bilgileri', icon: InfoIcon },
                  { value: 'history', label: 'Oturum Geçmişi', icon: HistoryIcon },
                ]}
              />
            </div>

            <div className={`space-y-5 overflow-y-auto p-5 ${tab === 'info' ? '' : 'hidden'} lg:block`}>
              <div>
                <p className="type-label mb-2 hidden lg:block">Oturum Bilgileri</p>
                <div className="rounded-card border border-border bg-surface-0 p-4">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="leading-tight">
                      <p className="type-caption text-foreground-muted">Giriş Saati</p>
                      <p className="type-section">{fmtClock(session.entryTime)}</p>
                    </div>
                    <div className="text-right leading-tight">
                      <p className="type-caption text-foreground-muted">Tahmini Çıkış</p>
                      <p className="type-section">{fmtClock(session.estimatedExitAt)}</p>
                    </div>
                  </div>

                  <div className="grid place-items-center py-2">
                    <div className="relative grid h-40 w-40 place-items-center">
                      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-surface-2" />
                        <circle
                          cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"
                          className={onBreak ? 'text-warning transition-all duration-1000' : 'text-primary transition-all duration-1000'}
                          strokeDasharray={RING}
                          strokeDashoffset={RING - (ringPct / 100) * RING}
                        />
                      </svg>
                      <div className="text-center leading-tight">
                        <p className="type-caption text-foreground-muted">{onBreak ? 'Molada' : 'Kalan Süre'}</p>
                        <p className="text-3xl font-semibold text-foreground-strong tabular-nums">
                          {fmtCountdownFromDeadline(deadlineIso, nowMs)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 rounded-field bg-surface-1 px-3 py-2 text-center">
                    <p className="type-caption text-foreground-muted">
                      {onBreak
                        ? 'Moladasınız. Dönmek için QR kodu okutun; süreniz aşılırsa oturumunuz düşer.'
                        : 'Mola vermek isterseniz oturumunuz duraklatılır. Kalan süreniz korunur.'}
                    </p>
                  </div>

                  {breakSystemEnabled && (
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-3 py-1 type-caption text-success">
                        <CoffeeIcon className="h-3.5 w-3.5" />
                        Kısa mola hakkı: {session.remainingShortBreaks ?? 'Sınırsız'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-3 py-1 type-caption text-warning">
                        <GiftIcon className="h-3.5 w-3.5" />
                        Uzun mola hakkı: {session.remainingLongBreaks ?? 'Sınırsız'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {onBreak ? (
                <div className="space-y-2">
                  {canScanStaticQr ? (
                    <LibraryStaticQrScanButton label="QR Okut ile Moladan Dön" onSuccess={afterQr} />
                  ) : (
                    <Button variant="primary" size="lg" className="w-full gap-2" onClick={() => setQrAction('end_break')}>
                      <CoffeeIcon className="h-4 w-4" /> Moladan Dön (QR)
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {breakSystemEnabled && (
                  <div>
                    <p className="type-label mb-2">Mola Ver</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={shortBreakExhausted}
                        onClick={() => setQrAction('short_break')}
                        className="flex flex-col items-center gap-1 rounded-card border border-success/30 bg-success-soft px-3 py-4 text-success transition hover:bg-success-soft/70 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-success-soft"
                      >
                        <CoffeeIcon className="h-6 w-6" />
                        <span className="type-body-strong">{shortBreakMinutes} dk Mola</span>
                        <span className="type-caption text-success/80">{shortBreakExhausted ? 'Günlük hakkınız doldu' : 'Kısa mola · QR'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={longBreakExhausted}
                        onClick={() => setQrAction('long_break')}
                        className="flex flex-col items-center gap-1 rounded-card border border-warning/30 bg-warning-soft px-3 py-4 text-warning transition hover:bg-warning-soft/70 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-warning-soft"
                      >
                        <GiftIcon className="h-6 w-6" />
                        <span className="type-body-strong">{longBreakMinutes} dk Mola</span>
                        <span className="type-caption text-warning/80">{longBreakExhausted ? 'Günlük hakkınız doldu' : 'Uzun mola · QR'}</span>
                      </button>
                    </div>
                  </div>
                  )}

                  {staticQrExits ? (
                    <LibraryStaticQrScanButton label="QR Okut ile Çıkış Yap" variant="outline" onSuccess={afterQr} />
                  ) : (
                    <Button variant="danger" size="lg" className="w-full gap-1" isLoading={exiting} onClick={() => void selfExit()}>
                      <DoorOpenIcon className="h-4 w-4" /> Oturumu Sonlandır
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className={`overflow-y-auto p-5 ${tab === 'history' ? '' : 'hidden'} lg:block lg:border-l lg:border-t-0 lg:border-border`}>
              <p className="type-label mb-2">Bugünkü Hareketlerim</p>
              {movements.length === 0 ? (
                <p className="type-caption text-foreground-muted">Henüz hareket bulunmuyor.</p>
              ) : (
                <div className="space-y-1.5">
                  {movements.map((m) => {
                    const meta = MOVEMENT_META[m.kind]
                    const Icon = meta.icon
                    const suffix = (m.kind === 'break_start' || m.kind === 'break_end') && m.breakType
                      ? ` (${m.breakType === 'long' ? 'uzun' : 'kısa'})`
                      : ''
                    return (
                      <div key={`${m.id}-${m.kind}`} className="flex items-center gap-3 rounded-card border border-border bg-surface-0 px-3 py-2">
                        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-field" style={{ background: meta.bg, color: meta.color }}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1 leading-tight">
                          <p className="type-body-strong truncate">{meta.label}{suffix}</p>
                          {m.seatLabel && <p className="type-caption text-foreground-muted truncate">{m.seatLabel}{m.floorName ? ` · ${m.floorName}` : ''}</p>}
                        </div>
                        <span className="type-caption font-mono text-foreground-muted flex-shrink-0">{fmtClock(m.at)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {qrAction && session && (
        <LibraryActionQrModal
          open={qrAction !== null}
          action={qrAction}
          libraryId={session.libraryId}
          seatLabel={session.seatLabel}
          floorName={session.floorName}
          onSuccess={afterQr}
          intentGuardRef={intentGuardRef}
          onClose={() => setQrAction(null)}
        />
      )}

      <KrokiViewerModal open={kroki.open} onClose={kroki.hide} floors={krokiFloors} initialFloorId={kroki.floorId} />
    </>
  )
}
