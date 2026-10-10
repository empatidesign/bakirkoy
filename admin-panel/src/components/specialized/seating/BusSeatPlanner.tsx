import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button, Label, Select } from '@/design-system'
import {
  BUS_TEMPLATES,
  BUS_SEAT_STATUS_META,
  getBusTemplate,
  generateBusSeatPositions,
  countBusSeatStatuses,
  visibleSeatCount,
  isPassengerSeat,
  type BusSeatStatus,
  type BusSeatState,
  type BusSeatPosition,
} from './busSeatModel'

const SEAT_STYLE: Record<BusSeatStatus, string> = {
  available: 'bg-success-soft text-success border-success/40',
  occupied: 'bg-accent-blue-soft text-accent-blue border-accent-blue/50',
  reserved: 'bg-accent-violet-soft text-accent-violet border-accent-violet/50',
  blocked: 'bg-danger-soft text-danger border-danger/40 opacity-70',
  hidden: 'bg-surface-2 text-foreground-subtle border-border border-dashed opacity-50',
  driver: 'bg-primary-soft text-primary border-primary/40',
  guide: 'bg-primary-soft text-primary border-primary/40',
}

const SWATCH: Record<BusSeatStatus, string> = {
  available: 'bg-success-soft border-success/40',
  occupied: 'bg-accent-blue-soft border-accent-blue/50',
  reserved: 'bg-accent-violet-soft border-accent-violet/50',
  blocked: 'bg-danger-soft border-danger/40',
  hidden: 'bg-surface-2 border-border border-dashed',
  driver: 'bg-primary-soft border-primary/40',
  guide: 'bg-primary-soft border-primary/40',
}

const OCCUPIED_GENDER_STYLE: Record<'male' | 'female', string> = {
  male: 'bg-accent-blue-soft text-accent-blue border-accent-blue/50',
  female: 'bg-accent-pink-soft text-accent-pink border-accent-pink/50',
}

const APPLY_STATUSES: BusSeatStatus[] = ['available', 'occupied', 'reserved', 'blocked', 'hidden']

interface BusSeatPlannerProps {
  templateId?: string
  onTemplateChange?: (id: string) => void
  seatStates: Record<string, BusSeatState>
  onSeatChange: (next: Record<string, BusSeatState>) => void
  readOnly?: boolean
  allowTemplateChange?: boolean
  lockedSeatIds?: string[]
  occupantGenders?: Record<string, 'male' | 'female'>
}

const Seat = ({
  position, state, selected, interactive, gender, onPointerDown, onPointerEnter,
}: {
  position: BusSeatPosition
  state: BusSeatState
  selected: boolean
  interactive: boolean
  gender?: 'male' | 'female'
  onPointerDown?: () => void
  onPointerEnter?: () => void
}) => {
  const meta = BUS_SEAT_STATUS_META[state.status]
  const passenger = isPassengerSeat(position.zone)
  const genderLabel = gender === 'male' ? ' · Erkek' : gender === 'female' ? ' · Kadın' : ''
  const title = passenger
    ? `Koltuk ${position.label} · ${meta.label}${state.participantName ? ` · ${state.participantName}` : ''}${genderLabel}`
    : meta.label
  const canSelect = interactive && passenger
  const base = state.status === 'occupied' && gender ? OCCUPIED_GENDER_STYLE[gender] : SEAT_STYLE[state.status]
  // Kullanıcı isteği (2026-08-07): dolu koltuklarda kimin bay/bayan olduğu görünsün diye
  // koltuk numarasının yanında ♂/♀ simgesi gösteriliyor (renk kodlaması zaten vardı — mavi/pembe
  // — ama görme engelliler ve renk körlüğü için de metinsel bir işaret eklendi).
  const genderGlyph = state.status === 'occupied' && gender ? (gender === 'male' ? '♂' : '♀') : null
  return (
    <button
      type="button"
      title={title}
      disabled={!canSelect}
      onPointerDown={canSelect ? (e) => { e.preventDefault(); onPointerDown?.() } : undefined}
      onPointerEnter={canSelect ? onPointerEnter : undefined}
      className={cn(
        'relative flex h-6 w-6 touch-none select-none items-center justify-center rounded-sm border text-[9px] font-medium tabular-nums transition-colors',
        selected ? 'border-primary bg-primary text-white shadow-sm' : base,
        canSelect ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      {position.label}
      {genderGlyph && !selected && (
        <span
          className={cn(
            'absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full border text-[8px] leading-none',
            gender === 'male' ? 'border-accent-blue/60 bg-white text-accent-blue' : 'border-accent-pink/60 bg-white text-accent-pink',
          )}
          aria-hidden="true"
        >
          {genderGlyph}
        </span>
      )}
    </button>
  )
}

export const BusSeatPlanner = ({
  templateId,
  onTemplateChange,
  seatStates,
  onSeatChange,
  readOnly,
  allowTemplateChange,
  lockedSeatIds,
  occupantGenders,
}: BusSeatPlannerProps) => {
  const template = getBusTemplate(templateId)
  const positions = useMemo(() => generateBusSeatPositions(template), [template])
  const counts = countBusSeatStatuses(positions, seatStates)
  const lockedSet = useMemo(() => new Set(lockedSeatIds ?? []), [lockedSeatIds])
  const hasGenders = !!occupantGenders && Object.keys(occupantGenders).length > 0
  // Kullanıcı isteği (2026-08-07): araçta kaç bay kaç bayan olduğu sayısal olarak görünsün.
  const maleCount = useMemo(
    () => (occupantGenders ? Object.values(occupantGenders).filter((g) => g === 'male').length : 0),
    [occupantGenders],
  )
  const femaleCount = useMemo(
    () => (occupantGenders ? Object.values(occupantGenders).filter((g) => g === 'female').length : 0),
    [occupantGenders],
  )

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null)

  useEffect(() => {
    const stop = () => setDragMode(null)
    window.addEventListener('pointerup', stop)
    return () => window.removeEventListener('pointerup', stop)
  }, [])

  useEffect(() => { setSelected(new Set()) }, [template.id])

  const stateOf = (id: string): BusSeatState => seatStates[id] ?? { status: 'available' }

  const applySel = (id: string, mode: 'add' | 'remove') => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (mode === 'add') next.add(id)
      else next.delete(id)
      return next
    })
  }
  const onSeatDown = (id: string) => {
    const mode: 'add' | 'remove' = selected.has(id) ? 'remove' : 'add'
    setDragMode(mode)
    applySel(id, mode)
  }
  const onSeatEnter = (id: string) => {
    if (!dragMode) return
    applySel(id, dragMode)
  }

  const passengerIds = useMemo(() => positions.filter((p) => isPassengerSeat(p.zone) && !lockedSet.has(p.id)).map((p) => p.id), [positions, lockedSet])
  const selectAll = () => setSelected(new Set(passengerIds))
  const clearSelection = () => setSelected(new Set())

  const applyToSelected = (status: BusSeatStatus) => {
    if (selected.size === 0) return
    const next = { ...seatStates }
    for (const id of selected) next[id] = { status }
    onSeatChange(next)
    setSelected(new Set())
  }

  const driver = positions.find((p) => p.zone === 'driver')
  const guide = positions.find((p) => p.zone === 'guide')
  const back = positions.filter((p) => p.zone === 'back')
  const interactive = !readOnly

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {allowTemplateChange && interactive ? (
          <div className="min-w-[240px]">
            <Label>Otobüs Tipi</Label>
            <Select value={template.id} onChange={(e) => onTemplateChange?.(e.target.value)}>
              {BUS_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.name} · {t.totalSeats} koltuk</option>
              ))}
            </Select>
          </div>
        ) : (
          <div>
            <p className="type-body-strong">{template.name}</p>
            <p className="type-caption">{template.description}</p>
          </div>
        )}
        {interactive && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="type-caption text-foreground-muted">
              Gerçek koltuk: <strong className="text-foreground-strong tabular-nums">{visibleSeatCount(counts)}</strong>
            </span>
            <span className="type-caption text-foreground-muted">Seçili: <strong className="text-foreground-strong tabular-nums">{selected.size}</strong></span>
            <Button variant="ghost" size="sm" onClick={selectAll}>Tümünü Seç</Button>
            <Button variant="ghost" size="sm" disabled={selected.size === 0} onClick={clearSelection}>Seçimi Temizle</Button>
          </div>
        )}
      </div>

      {interactive && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-card border border-border bg-surface-1/60 px-3 py-2">
          <span className="type-caption text-foreground-muted">{selected.size > 0 ? `${selected.size} koltuğu işaretle:` : 'Önce koltuk seçin, sonra:'}</span>
          {APPLY_STATUSES.map((s) => (
            <Button key={s} variant="outline" size="sm" disabled={selected.size === 0} onClick={() => applyToSelected(s)}>
              <span className={cn('mr-1 inline-block h-2.5 w-2.5 rounded-sm border', SWATCH[s])} />
              {BUS_SEAT_STATUS_META[s].label}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 px-1">
        {APPLY_STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 type-caption text-foreground-default">
            <span className={cn('inline-block h-3 w-3 rounded-sm border', SWATCH[s])} />
            {BUS_SEAT_STATUS_META[s].label} · <span className="tabular-nums">{counts[s]}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 type-caption text-foreground-default">
          <span className={cn('inline-block h-3 w-3 rounded-sm border', SWATCH.driver)} />
          Şoför/Rehber
        </span>
        {hasGenders && (
          <>
            <span className="inline-flex items-center gap-1.5 type-caption text-foreground-default">
              <span className="inline-block h-3 w-3 rounded-sm border border-accent-blue/50 bg-accent-blue-soft" />
              Dolu (Erkek) · <span className="tabular-nums">{maleCount}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 type-caption text-foreground-default">
              <span className="inline-block h-3 w-3 rounded-sm border border-accent-pink/50 bg-accent-pink-soft" />
              Dolu (Kadın) · <span className="tabular-nums">{femaleCount}</span>
            </span>
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-card border border-border bg-surface-1/60 p-4">
        <div className="mx-auto w-max space-y-2">
          <div className="flex items-center justify-between gap-6 border-b border-dashed border-border pb-3">
            <div className="flex items-center gap-1">
              {driver && <Seat position={driver} state={stateOf(driver.id)} selected={false} interactive={false} />}
              {guide && <Seat position={guide} state={stateOf(guide.id)} selected={false} interactive={false} />}
            </div>
            <span className="type-caption tracking-[0.2em] text-foreground-muted">↑ ÖN KAPI ↑</span>
          </div>

          <div className="flex flex-col gap-1 pt-1">
            {Array.from({ length: template.rows }, (_, idx) => {
              const r = idx + 1
              const left = positions.filter((p) => p.row === r && p.zone === 'left')
              const right = positions.filter((p) => p.row === r && p.zone === 'right')
              return (
                <div key={r} className="flex items-center gap-2">
                  <span className="w-5 select-none text-right type-caption tabular-nums text-foreground-subtle">{r}</span>
                  <div className="flex items-center gap-[3px]">
                    {left.map((p) => (
                      <Seat key={p.id} position={p} state={stateOf(p.id)} selected={selected.has(p.id)} interactive={interactive && !lockedSet.has(p.id)} gender={occupantGenders?.[p.label]} onPointerDown={() => onSeatDown(p.id)} onPointerEnter={() => onSeatEnter(p.id)} />
                    ))}
                  </div>
                  <span className="w-5" />
                  <div className="flex items-center gap-[3px]">
                    {right.map((p) => (
                      <Seat key={p.id} position={p} state={stateOf(p.id)} selected={selected.has(p.id)} interactive={interactive && !lockedSet.has(p.id)} gender={occupantGenders?.[p.label]} onPointerDown={() => onSeatDown(p.id)} onPointerEnter={() => onSeatEnter(p.id)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {back.length > 0 && (
            <div className="flex items-center gap-2 border-t border-dashed border-border pt-3">
              <span className="w-5 select-none text-right type-caption text-foreground-subtle">Arka</span>
              <div className="flex items-center gap-[3px]">
                {back.map((p) => (
                  <Seat key={p.id} position={p} state={stateOf(p.id)} selected={selected.has(p.id)} interactive={interactive && !lockedSet.has(p.id)} gender={occupantGenders?.[p.label]} onPointerDown={() => onSeatDown(p.id)} onPointerEnter={() => onSeatEnter(p.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
