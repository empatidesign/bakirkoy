import { useMemo } from 'react'
import { CarIcon, FlagIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getBusTemplate, generateBusSeatPositions, isPassengerSeat,
  type BusSeatState, type BusSeatPosition,
} from './busSeatModel'

interface BusBoardingBoardProps {
  templateId?: string
  seatStates: Record<string, BusSeatState>
  occupantGenders?: Record<string, 'male' | 'female'>
  driverName?: string
  guideName?: string
}

const SEAT_TONE: Record<string, string> = {
  available: 'border-dashed border-border bg-surface-1 text-foreground-subtle',
  blocked: 'border-danger/40 bg-danger-soft text-danger',
  reserved: 'border-accent-violet/50 bg-accent-violet-soft text-accent-violet',
  occupied: 'border-accent-blue/50 bg-accent-blue-soft text-accent-blue',
}
const GENDER_TONE: Record<'male' | 'female', string> = {
  male: 'border-2 border-accent-blue bg-blue-100 text-blue-900 shadow-sm ring-2 ring-accent-blue/15',
  female: 'border-2 border-accent-pink bg-pink-100 text-pink-900 shadow-sm ring-2 ring-accent-pink/15',
}

const BoardSeat = ({
  position, state, gender, driverName, guideName,
}: {
  position: BusSeatPosition
  state: BusSeatState
  gender?: 'male' | 'female'
  driverName?: string
  guideName?: string
}) => {
  if (position.zone === 'driver') {
    return (
      <div className="flex h-12 w-[104px] flex-col justify-center rounded-card border border-primary/40 bg-primary-soft px-2 text-primary">
        <span className="inline-flex items-center gap-1 type-caption font-medium"><CarIcon className="h-3 w-3" /> Şoför</span>
        <span className="truncate type-caption">{driverName || '—'}</span>
      </div>
    )
  }
  if (position.zone === 'guide') {
    return (
      <div className="flex h-12 w-[104px] flex-col justify-center rounded-card border border-primary/40 bg-primary-soft px-2 text-primary">
        <span className="inline-flex items-center gap-1 type-caption font-medium"><FlagIcon className="h-3 w-3" /> Rehber</span>
        <span className="truncate type-caption">{guideName || '—'}</span>
      </div>
    )
  }

  const occupied = state.status === 'occupied' || state.status === 'reserved'
  const tone = occupied && gender ? GENDER_TONE[gender] : SEAT_TONE[state.status] ?? SEAT_TONE.available
  const sub = state.status === 'blocked'
    ? 'Kapalı'
    : occupied
      ? `${gender === 'male' ? '♂ ' : gender === 'female' ? '♀ ' : ''}${state.participantName || 'Dolu'}`
      : 'Boş'

  if (state.status === 'hidden') {
    return <div className="h-12 w-[104px]" aria-hidden="true" />
  }

  return (
    <div className={cn('flex h-12 w-[104px] flex-col justify-center rounded-card border px-2', tone)}>
      <span className="type-caption font-semibold tabular-nums opacity-80">{position.label}</span>
      <span className="truncate type-caption font-medium leading-tight">{sub}</span>
    </div>
  )
}

export const BusBoardingBoard = ({ templateId, seatStates, occupantGenders, driverName, guideName }: BusBoardingBoardProps) => {
  const template = getBusTemplate(templateId)
  const positions = useMemo(() => generateBusSeatPositions(template), [template])
  const stateOf = (id: string): BusSeatState => seatStates[id] ?? { status: 'available' }

  const driver = positions.find((p) => p.zone === 'driver')
  const guide = positions.find((p) => p.zone === 'guide')
  const back = positions.filter((p) => p.zone === 'back')

  const seatedCount = positions.filter((p) => isPassengerSeat(p.zone) && (stateOf(p.id).status === 'occupied' || stateOf(p.id).status === 'reserved')).length

  return (
    <div className="overflow-x-auto bg-gradient-to-b from-surface-0 to-surface-1/70 p-4 sm:p-5">
      <div className="mx-auto w-max space-y-2.5">
        <div className="flex flex-wrap items-center justify-end gap-2 pb-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-blue/40 bg-blue-100 px-2.5 py-1 type-caption font-semibold text-blue-900"><span className="h-2.5 w-2.5 rounded-full bg-accent-blue" /> Erkek</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-pink/40 bg-pink-100 px-2.5 py-1 type-caption font-semibold text-pink-900"><span className="h-2.5 w-2.5 rounded-full bg-accent-pink" /> Kadın</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 type-caption font-medium text-foreground-muted"><span className="h-2.5 w-2.5 rounded-full border border-dashed border-border bg-surface-1" /> Boş</span>
        </div>
        <div className="flex items-center justify-between gap-8 border-b border-dashed border-border pb-3">
          <div className="flex items-center gap-2">
            {driver && <BoardSeat position={driver} state={stateOf(driver.id)} driverName={driverName} />}
            {guide && <BoardSeat position={guide} state={stateOf(guide.id)} guideName={guideName} />}
          </div>
          <span className="type-caption tracking-[0.2em] text-foreground-muted">↑ ÖN KAPI ↑</span>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          {Array.from({ length: template.rows }, (_, idx) => {
            const r = idx + 1
            const left = positions.filter((p) => p.row === r && p.zone === 'left')
            const right = positions.filter((p) => p.row === r && p.zone === 'right')
            return (
              <div key={r} className="flex items-center gap-3">
                <span className="w-5 select-none text-right type-caption tabular-nums text-foreground-subtle">{r}</span>
                <div className="flex items-center gap-1.5">
                  {left.map((p) => <BoardSeat key={p.id} position={p} state={stateOf(p.id)} gender={occupantGenders?.[p.label]} />)}
                </div>
                <span className="w-6" />
                <div className="flex items-center gap-1.5">
                  {right.map((p) => <BoardSeat key={p.id} position={p} state={stateOf(p.id)} gender={occupantGenders?.[p.label]} />)}
                </div>
              </div>
            )
          })}
        </div>

        {back.length > 0 && (
          <div className="flex items-center gap-3 border-t border-dashed border-border pt-3">
            <span className="w-5 select-none text-right type-caption text-foreground-subtle">Arka</span>
            <div className="flex items-center gap-1.5">
              {back.map((p) => <BoardSeat key={p.id} position={p} state={stateOf(p.id)} gender={occupantGenders?.[p.label]} />)}
            </div>
          </div>
        )}

        <p className="pt-1 type-caption text-foreground-muted">
          Dolu koltuk: <strong className="text-foreground-strong tabular-nums">{seatedCount}</strong> · İsim koltuğun üzerinde yazar
        </p>
      </div>
    </div>
  )
}
