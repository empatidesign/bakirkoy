import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArmchairIcon, MapPinIcon, BookOpenIcon, LayersIcon, LayoutGridIcon, ClockIcon, CoffeeIcon, TimerIcon } from 'lucide-react'
import { EmptyState, Badge, Card, Button, SkeletonRows, ConfirmModal } from '@/design-system'
import type { CitizenLibraryReservation, CitizenSession, CitizenSessionStatus } from '@/types/library.types'
import { LIBRARY_RESERVATION_LABELS, LIBRARY_RESERVATION_TONE, seatLabel, isSessionOnBreak } from '@/types/library.types'
import libraryService from '@/services/library.service'
import { LibraryActionQrModal } from './LibraryActionQrModal'
import type { LibraryAction } from './LibraryActionQrModal'

const minutesLeft = (iso: string, now: number): number =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60000))

const fmtLeft = (m: number): string =>
  m >= 60 ? `${Math.floor(m / 60)} sa ${m % 60} dk` : `${m} dk`

interface MetaProps {
  district?: string | null
  floorName?: string | null
  sectionName?: string | null
  seat?: string | null
  extra?: { icon: typeof ClockIcon; text: string }
}

const MetaRow = ({ district, floorName, sectionName, seat, extra }: MetaProps) => {
  const Extra = extra?.icon
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
      {district && <span className="inline-flex items-center gap-1 type-caption"><MapPinIcon className="h-3 w-3" /> {district}</span>}
      {floorName && <span className="inline-flex items-center gap-1 type-caption"><LayersIcon className="h-3 w-3" /> {floorName}</span>}
      {sectionName && <span className="inline-flex items-center gap-1 type-caption"><LayoutGridIcon className="h-3 w-3" /> {sectionName}</span>}
      {seat && <span className="inline-flex items-center gap-1 type-caption"><ArmchairIcon className="h-3 w-3" /> {seat}</span>}
      {extra && Extra && <span className="inline-flex items-center gap-1 type-caption"><Extra className="h-3 w-3" /> {extra.text}</span>}
    </div>
  )
}

const ActionRow = ({ mode, onAction }: {
  mode: 'held' | CitizenSessionStatus
  onAction: (action: LibraryAction) => void
}) => {
  const onBreak = isSessionOnBreak(mode)
  const canExit = mode === 'inside' || onBreak
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Button variant="primary" size="sm" disabled={mode !== 'held'} onClick={() => onAction('entry')}>Giriş Yap</Button>
      <Button variant="outline" size="sm" disabled={!canExit} onClick={() => onAction('exit')}>Çıkış Yap</Button>
      {onBreak ? (
        <Button variant="primary" size="sm" className="col-span-2" onClick={() => onAction('end_break')}>Molayı Bitir</Button>
      ) : (
        <>
          <Button variant="outline" size="sm" disabled={mode !== 'inside'} onClick={() => onAction('short_break')}>Mola Ver</Button>
          <Button variant="outline" size="sm" disabled={mode !== 'inside'} onClick={() => onAction('long_break')}>Uzun Mola</Button>
        </>
      )}
    </div>
  )
}

export const LibraryReservationsTab = () => {
  const [session, setSession] = useState<CitizenSession | null>(null)
  const [items, setItems] = useState<CitizenLibraryReservation[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [qrAction, setQrAction] = useState<LibraryAction | null>(null)
  const [qrLibraryId, setQrLibraryId] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    const [sess, resv] = await Promise.all([
      libraryService.session().catch(() => null),
      libraryService.reservations({ page: 1, limit: 50 }).then((r) => r.items).catch(() => [] as CitizenLibraryReservation[]),
    ])
    setSession(sess)
    setItems(resv)
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    load().finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(id)
  }, [])

  const doCancel = async () => {
    if (!cancelId) return
    setCanceling(true)
    try {
      await libraryService.cancel(cancelId)
      toast.success('Rezervasyon iptal edildi.')
      setCancelId(null)
      await load()
    } catch {
      void 0
    } finally {
      setCanceling(false)
    }
  }

  const held = (items ?? []).filter((r) => r.status === 'held')
  const past = (items ?? []).filter((r) => r.status !== 'held')

  const sessionActions = (s: CitizenSession) => (
    <ActionRow mode={s.status} onAction={(action) => { setQrLibraryId(s.libraryId); setQrAction(action) }} />
  )

  const sessionCard = (s: CitizenSession) => (
    <Card key={s.id} padded>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-card bg-info-soft text-info">
          <ArmchairIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="type-section truncate">{s.libraryName}</p>
            <Badge tone={isSessionOnBreak(s.status) ? 'warning' : 'success'}>{isSessionOnBreak(s.status) ? 'Molada' : 'İçeride'}</Badge>
          </div>
          <MetaRow
            district={s.district}
            floorName={s.floorName}
            sectionName={s.sectionName}
            seat={s.seatLabel}
            extra={{ icon: TimerIcon, text: `Süre: ${fmtLeft(s.durationMinutes)}` }}
          />
        </div>
      </div>
      {isSessionOnBreak(s.status) && s.breakRemainingMinutes != null && (
        <div className="mt-3 flex items-center gap-1.5 rounded-card bg-warning-soft px-3.5 py-2.5 text-warning">
          <CoffeeIcon className="h-4 w-4" />
          <span className="type-body-strong">{s.breakType === 'long' ? 'Uzun mola' : 'Mola'} · {s.breakRemainingMinutes <= 0 ? 'süre doldu' : `${s.breakRemainingMinutes} dk kaldı`}</span>
        </div>
      )}
      {sessionActions(s)}
    </Card>
  )

  const heldCard = (r: CitizenLibraryReservation) => {
    const left = minutesLeft(r.holdUntil, now)
    const urgent = left <= 5
    const seat = r.seatLabel || (r.seat ? `Koltuk ${seatLabel(r.seat)}` : null)
    return (
      <Card key={r.id} padded>
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-card bg-info-soft text-info">
            <ArmchairIcon className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="type-section truncate">{r.libraryName}</p>
              <MetaRow district={r.district} floorName={r.floorName} sectionName={r.sectionName} seat={seat} />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Badge tone={LIBRARY_RESERVATION_TONE[r.status]}>{LIBRARY_RESERVATION_LABELS[r.status]}</Badge>
              <Button variant="ghost" size="sm" onClick={() => setCancelId(r.id)}>İptal</Button>
            </div>
          </div>
        </div>
        <div className={`mt-3 flex items-center justify-between gap-3 rounded-card px-3.5 py-2.5 ${urgent ? 'bg-warning-soft' : 'bg-info-soft'}`}>
          <span className={`inline-flex items-center gap-1.5 type-caption ${urgent ? 'text-warning' : 'text-info'}`}>
            <ClockIcon className="h-4 w-4" /> Girişe kalan süre
          </span>
          <span className={`type-body-strong ${urgent ? 'text-warning' : 'text-info'}`}>{left <= 0 ? 'Süre doldu' : fmtLeft(left)}</span>
        </div>
        <ActionRow mode="held" onAction={(action) => { setQrLibraryId(r.libraryId); setQrAction(action) }} />
      </Card>
    )
  }

  const pastCard = (r: CitizenLibraryReservation) => (
    <Card key={r.id} padded>
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-card bg-surface-2 text-foreground-subtle">
          <ArmchairIcon className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="type-body-strong truncate">{r.libraryName}</p>
            <MetaRow district={r.district} floorName={r.floorName} sectionName={r.sectionName} seat={r.seatLabel || (r.seat ? `Koltuk ${seatLabel(r.seat)}` : null)} />
          </div>
          <Badge tone={LIBRARY_RESERVATION_TONE[r.status]}>{LIBRARY_RESERVATION_LABELS[r.status]}</Badge>
        </div>
      </div>
    </Card>
  )

  const hasContent = !!session || held.length > 0 || past.length > 0

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-4">
      {loading ? (
        <SkeletonRows rows={4} />
      ) : !hasContent ? (
        <EmptyState icon={BookOpenIcon} title="Aktif ziyaret yok" description="Bir kıraathanede yer ayırttığınızda veya giriş yaptığınızda burada görünür." />
      ) : (
        <>
          {session && sessionCard(session)}
          {held.length > 0 && <div className="space-y-3">{held.map(heldCard)}</div>}
          {past.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="type-section-sub px-1">Geçmiş</p>
              {past.map(pastCard)}
            </div>
          )}
        </>
      )}

      {qrAction && (
        <LibraryActionQrModal
          open={qrAction !== null}
          action={qrAction}
          libraryId={qrLibraryId}
          onSuccess={() => { void load() }}
          onClose={() => setQrAction(null)}
        />
      )}
      <ConfirmModal
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={doCancel}
        title="Rezervasyonu iptal et"
        description="Bu rezervasyonu iptal etmek istediğinize emin misiniz?"
        confirmLabel="İptal Et"
        tone="danger"
        loading={canceling}
      />
    </div>
  )
}
