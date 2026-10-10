import { cn } from '@/lib/utils'
import type { SeatingFloor, SeatStatus } from '@/types/seating.types'
import { getRowLabels, getRowSegments, getRowCells, getFloorSeatCount, seatKey } from './seatingModel'

const SEAT_STATUS_STYLE: Record<SeatStatus, string> = {
  available: 'bg-success-soft text-success border-success/40',
  reserved: 'bg-accent-blue-soft text-accent-blue border-accent-blue/50',
  protocol: 'bg-accent-violet-soft text-accent-violet border-accent-violet/50',
  closed: 'bg-danger-soft text-danger border-danger/40 opacity-70',
}

interface FloorPreviewProps {
  floor: SeatingFloor
  states?: Record<string, SeatStatus>
  selected?: Set<string>
  onSeatPointerDown?: (rowIdx: number, seatNo: number) => void
  showStage?: boolean
}

const Stage = () => (
  <div className="mx-auto mb-4 w-2/3 min-w-[140px] rounded-pill bg-surface-2 py-1 text-center">
    <span className="type-caption tracking-[0.3em] text-foreground-muted">SAHNE</span>
  </div>
)

export const FloorPreview = ({ floor, states, selected, onSeatPointerDown, showStage = true }: FloorPreviewProps) => {
  const seatCount = getFloorSeatCount(floor)
  const labels = getRowLabels(floor)

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface-1/60 p-4">
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
                      ) : (
                        <button
                          key={ci}
                          type="button"
                          title={`${labels[r]}${cell.seatNo}`}
                          onPointerDown={(e) => { e.preventDefault(); onSeatPointerDown?.(r, cell.seatNo) }}
                          className={cn(
                            'flex h-6 w-6 select-none touch-none items-center justify-center rounded-sm border text-[9px] font-medium tabular-nums transition-colors',
                            selected?.has(seatKey(floor.id, r, cell.seatNo))
                              ? 'border-primary bg-primary text-white shadow-sm'
                              : SEAT_STATUS_STYLE[states?.[seatKey(floor.id, r, cell.seatNo)] ?? 'available'],
                          )}
                        >
                          {cell.seatNo}
                        </button>
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
        <p className="mt-4 text-center type-caption text-foreground-muted">{floor.name} · {seatCount} koltuk · {floor.rows} sıra</p>
      </div>
    </div>
  )
}
