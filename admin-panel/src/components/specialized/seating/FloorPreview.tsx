import { cn } from '@/lib/utils'
import type { SeatingFloor, SeatingTemplateId, SeatStateMap, SeatStatus } from '@/types/hall.types'
import {
  getRowLabels,
  getRowSegments,
  getRowCells,
  getFloorSeatCount,
  seatKey,
} from './seatingModel'

const SEAT_STATUS_STYLE: Record<SeatStatus, string> = {
  available: 'bg-success-soft text-success border-success/40',
  reserved: 'bg-accent-blue-soft text-accent-blue border-accent-blue/50',
  protocol: 'bg-accent-violet-soft text-accent-violet border-accent-violet/50',
  closed: 'bg-danger-soft text-danger border-danger/40 opacity-70',
}

interface FloorPreviewProps {
  floor: SeatingFloor
  template?: SeatingTemplateId
  states?: SeatStateMap
  selected?: Set<string>
  onSeatPointerDown?: (rowIdx: number, seatNo: number) => void
  onSeatPointerEnter?: (rowIdx: number, seatNo: number) => void
  showStage?: boolean
  className?: string
}

const Stage = () => (
  <div className="mx-auto mb-4 w-2/3 min-w-[140px] rounded-pill bg-surface-2 py-1 text-center">
    <span className="type-caption tracking-[0.3em] text-foreground-muted">SAHNE</span>
  </div>
)

const SeatMini = () => <span className="h-4 w-4 rounded-sm border border-border bg-surface-2" />

export const FloorPreview = ({
  floor,
  template = 'theater',
  states,
  selected,
  onSeatPointerDown,
  onSeatPointerEnter,
  showStage = true,
  className,
}: FloorPreviewProps) => {
  const seatCount = getFloorSeatCount(floor)

  const footer = (
    <p className="mt-4 text-center type-caption text-foreground-muted">
      {floor.name} · {seatCount} koltuk · {floor.rows} sıra
    </p>
  )

  if (template === 'banquet') {
    const perRow = floor.defaultSegments[0] || 8
    const tables = floor.rows * perRow
    return (
      <div className={cn('rounded-card border border-border bg-surface-1/60 p-4', className)}>
        {showStage && <Stage />}
        <div className="mx-auto grid max-w-[460px] gap-2" style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}>
          {Array.from({ length: tables }, (_, i) => (
            <div key={i} className="flex aspect-square items-center justify-center rounded-full border border-primary bg-primary-soft text-[8px] font-medium text-primary">
              M{i + 1}
            </div>
          ))}
        </div>
        {footer}
      </div>
    )
  }

  if (template === 'ushape') {
    const perSide = Math.max(2, floor.rows * 2)
    const top = floor.defaultSegments[0] || 10
    return (
      <div className={cn('rounded-card border border-border bg-surface-1/60 p-4', className)}>
        {showStage && <Stage />}
        <div className="mx-auto max-w-[420px] rounded-card border border-dashed border-border p-4">
          <div className="mb-3 flex justify-center gap-1">
            {Array.from({ length: top }, (_, i) => <SeatMini key={`t${i}`} />)}
          </div>
          <div className="flex items-stretch justify-between gap-4">
            <div className="flex flex-col gap-1">
              {Array.from({ length: perSide }, (_, i) => <SeatMini key={`l${i}`} />)}
            </div>
            <div className="flex flex-1 items-center justify-center">
              <span className="type-caption italic text-foreground-subtle">Açık alan</span>
            </div>
            <div className="flex flex-col gap-1">
              {Array.from({ length: perSide }, (_, i) => <SeatMini key={`r${i}`} />)}
            </div>
          </div>
        </div>
        {footer}
      </div>
    )
  }

  const labels = getRowLabels(floor)
  const interactive = !!onSeatPointerDown

  return (
    <div className={cn('overflow-x-auto rounded-card border border-border bg-surface-1/60 p-4', className)}>
      <div className="mx-auto w-max">
        {showStage && <Stage />}
        <div className="flex flex-col items-center gap-1">
          {Array.from({ length: floor.rows }, (_, r) => {
            const segments = getRowSegments(floor, r)
            const cells = getRowCells(segments)
            const hasCrossAisle = floor.crossAisles.includes(r + 1)
            return (
              <div key={r}>
                <div className="flex items-center gap-2">
                  <span className="w-5 select-none text-right type-caption tabular-nums text-foreground-subtle">{labels[r]}</span>
                  <div className="flex items-center gap-[3px]">
                    {cells.map((cell, ci) =>
                      cell.type === 'gap' ? (
                        <span key={`g${ci}`} className="w-3" />
                      ) : interactive ? (
                        <button
                          key={ci}
                          type="button"
                          title={`${labels[r]}${cell.seatNo}`}
                          onPointerDown={(e) => { e.preventDefault(); onSeatPointerDown?.(r, cell.seatNo) }}
                          onPointerEnter={() => onSeatPointerEnter?.(r, cell.seatNo)}
                          className={cn(
                            'flex h-5 w-5 select-none touch-none items-center justify-center rounded-sm border text-[8px] font-medium tabular-nums transition-colors',
                            selected?.has(seatKey(floor.id, r, cell.seatNo))
                              ? 'border-primary bg-primary text-white shadow-sm'
                              : SEAT_STATUS_STYLE[states?.[seatKey(floor.id, r, cell.seatNo)] ?? 'available'],
                          )}
                        >
                          {cell.seatNo}
                        </button>
                      ) : (
                        <span
                          key={ci}
                          title={`${labels[r]}${cell.seatNo}`}
                          className="flex h-5 w-5 items-center justify-center rounded-sm border border-border bg-surface-2 text-[8px] tabular-nums text-foreground-subtle"
                        >
                          {cell.seatNo}
                        </span>
                      ),
                    )}
                  </div>
                  <span className="w-5 select-none type-caption tabular-nums text-foreground-subtle">{labels[r]}</span>
                </div>
                {hasCrossAisle && <div className="h-3" />}
              </div>
            )
          })}
        </div>
        {footer}
      </div>
    </div>
  )
}
