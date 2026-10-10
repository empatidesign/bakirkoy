import { LockIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SEAT_STATUS_LABELS, SECTION_TYPE_LABELS } from '@/types/library.types'
import type { SeatFloor, SeatSection, Seat, SeatStatus } from '@/types/library.types'

const STATUS_STYLE: Record<SeatStatus, { cell: string; dot: string }> = {
  available:   { cell: 'bg-[hsl(var(--success-soft))] text-[hsl(var(--success))] border-[hsl(var(--success))]/40 hover:brightness-95', dot: 'bg-[hsl(var(--success))]' },
  occupied:    { cell: 'bg-[hsl(var(--accent-blue-soft))] text-[hsl(var(--accent-blue))] border-[hsl(var(--accent-blue))]/50 hover:brightness-95', dot: 'bg-[hsl(var(--accent-blue))]' },
  on_break:    { cell: 'bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))] border-[hsl(var(--warning))]/40 hover:brightness-95', dot: 'bg-[hsl(var(--warning))]' },
  reserved:    { cell: 'bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground-muted))] border-[hsl(var(--border))] opacity-70', dot: 'bg-[hsl(var(--foreground-muted))]' },
  maintenance: { cell: 'bg-[hsl(var(--danger-soft))] text-[hsl(var(--danger))] border-[hsl(var(--danger))]/40 opacity-60', dot: 'bg-[hsl(var(--danger))]' },
}

const BREAK_STYLE: Record<'short' | 'long', { cell: string; dot: string }> = {
  short: { cell: 'bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))] border-[hsl(var(--warning))]/40 hover:brightness-95', dot: 'bg-[hsl(var(--warning))]' },
  long:  { cell: 'bg-[hsl(var(--accent-orange-soft))] text-[hsl(var(--accent-orange))] border-[hsl(var(--accent-orange))]/50 hover:brightness-95', dot: 'bg-[hsl(var(--accent-orange))]' },
}

const seatCellStyle = (seat: Seat) =>
  seat.status === 'on_break' ? BREAK_STYLE[seat.breakType === 'long' ? 'long' : 'short'] : STATUS_STYLE[seat.status]

const STATUS_LEGEND: { status: SeatStatus; label: string; style?: { cell: string; dot: string } }[] = [
  { status: 'available',   label: 'Boş' },
  { status: 'occupied',    label: 'Dolu' },
  { status: 'on_break',    label: 'Kısa Molada', style: BREAK_STYLE.short },
  { status: 'on_break',    label: 'Uzun Molada', style: BREAK_STYLE.long },
  { status: 'reserved',    label: 'Rezerve (giriş yapılmadı)' },
  { status: 'maintenance', label: 'Bakım' },
]

interface SeatCellProps {
  seat: Seat
  editMode?: boolean
  selected?: Set<string>
  onSeatClick?: (seat: Seat) => void
}

const SeatCell = ({ seat, editMode, selected, onSeatClick }: SeatCellProps) => {
  const isSelected = editMode && selected?.has(seat.key)
  const isReserved = seat.status === 'reserved'
  const breakLabel = seat.status === 'on_break' ? (seat.breakType === 'long' ? 'Uzun Mola' : 'Kısa Mola') : null
  return (
    <button
      type="button"
      title={
        seat.occupantName
          ? `${seat.label} · ${seat.occupantName}`
          : isReserved
            ? `${seat.label} · Rezerve (giriş yapılmadı)`
            : `${seat.label} · ${breakLabel ?? SEAT_STATUS_LABELS[seat.status]}`
      }
      onClick={() => onSeatClick?.(seat)}
      className={cn(
        'relative flex h-10 w-10 select-none flex-col items-center justify-center rounded-lg border text-[11px] font-bold tabular-nums transition-all',
        isSelected
          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white shadow-md scale-105'
          : seatCellStyle(seat).cell,
        onSeatClick ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      {isReserved ? (
        <>
          <LockIcon className="h-3 w-3" />
          <span className="text-[9px] leading-none">R</span>
        </>
      ) : (
        seat.number
      )}
      {(seat.status === 'occupied' || seat.status === 'on_break') && (
        <span className={cn('absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-white', seatCellStyle(seat).dot)} />
      )}
    </button>
  )
}

const tableStat = (seats: Seat[]) => {
  let bos = 0, dolu = 0, mola = 0, rez = 0, bakim = 0
  for (const s of seats) {
    if (s.status === 'available') bos++
    else if (s.status === 'occupied') dolu++
    else if (s.status === 'on_break') mola++
    else if (s.status === 'reserved') rez++
    else bakim++
  }
  return { bos, dolu, mola, rez, bakim }
}

interface SectionBlockProps {
  section: SeatSection
  editMode?: boolean
  selected?: Set<string>
  onSeatClick?: (seat: Seat) => void
}

const SectionBlock = ({ section, editMode, selected, onSeatClick }: SectionBlockProps) => {
  const totalSeats = section.tables.reduce((t, tbl) => t + tbl.seats.length, 0)
  const occupiedSeats = section.tables.reduce((t, tbl) => t + tbl.seats.filter(s => s.status === 'occupied' || s.status === 'on_break').length, 0)
  const pct = totalSeats > 0 ? Math.round(occupiedSeats / totalSeats * 100) : 0

  return (
    <div
      className="overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]"
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))]" style={{ background: `${section.color}0d` }}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${section.color}22` }}>
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: section.color }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="type-body-strong text-[hsl(var(--foreground-strong))]">{section.name}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: `${section.color}20`, color: section.color }}
            >
              {SECTION_TYPE_LABELS[section.type] ?? section.type}
            </span>
            <span className="type-caption text-[hsl(var(--foreground-muted))]">{section.tables.length} masa · {section.capacity} koltuk</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="type-caption font-semibold" style={{ color: section.color }}>%{pct}</span>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[hsl(var(--surface-2))]">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: section.color }} />
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, max-content))' }}>
          {section.tables.map((tbl) => {
            const st = tableStat(tbl.seats)
            const tblPct = tbl.seats.length > 0 ? Math.round((st.dolu + st.mola) / tbl.seats.length * 100) : 0
            return (
              <div
                key={tbl.id}
                className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="type-body-strong text-[hsl(var(--foreground-strong))]">{tbl.name}</p>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                    style={{ background: `${section.color}18`, color: section.color }}
                  >
                    {tblPct}%
                  </span>
                </div>

                <div className="mb-2.5 flex flex-wrap gap-1">
                  {st.bos > 0 && (
                    <span className="rounded-full bg-[hsl(var(--success-soft))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--success))]">
                      {st.bos} boş
                    </span>
                  )}
                  {st.dolu > 0 && (
                    <span className="rounded-full bg-[hsl(var(--accent-blue-soft))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--accent-blue))]">
                      {st.dolu} dolu
                    </span>
                  )}
                  {st.mola > 0 && (
                    <span className="rounded-full bg-[hsl(var(--warning-soft))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--warning))]">
                      {st.mola} mola
                    </span>
                  )}
                  {st.rez > 0 && (
                    <span className="rounded-full bg-[hsl(var(--accent-violet-soft))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--accent-violet))]">
                      {st.rez} rezerve
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5 justify-items-center">
                  {tbl.seats.map((seat) => (
                    <SeatCell key={seat.key} seat={seat} editMode={editMode} selected={selected} onSeatClick={onSeatClick} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface LibrarySeatGridProps {
  floors: SeatFloor[]
  editMode?: boolean
  selected?: Set<string>
  onSeatClick?: (seat: Seat) => void
}

export const LibrarySeatGrid = ({ floors, editMode, selected, onSeatClick }: LibrarySeatGridProps) => (
  <div className="space-y-4">
    {floors.map((floor) => (
      <div key={floor.id} className="overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]">
        <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--primary-soft))]">
            <span className="text-[11px] font-black text-[hsl(var(--primary))]">{floors.indexOf(floor) + 1}</span>
          </div>
          <div>
            <p className="type-body-strong text-[hsl(var(--foreground-strong))]">{floor.name}</p>
            <p className="type-caption text-[hsl(var(--foreground-muted))]">{floor.capacity} koltuk kapasitesi</p>
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          {floor.krokiUrl && (
            <img
              src={floor.krokiUrl}
              alt={`${floor.name} krokisi`}
              className="mx-auto mb-4 max-h-48 rounded-xl border border-[hsl(var(--border))] object-contain"
            />
          )}
          {floor.sections && floor.sections.length > 0 ? (
            <div className="space-y-3">
              {floor.sections.map((sec) => (
                <SectionBlock key={sec.id} section={sec} editMode={editMode} selected={selected} onSeatClick={onSeatClick} />
              ))}
            </div>
          ) : (
            <div className="mx-auto flex max-w-[720px] flex-wrap justify-center gap-1.5">
              {floor.seats.map((seat) => (
                <SeatCell key={seat.key} seat={seat} editMode={editMode} selected={selected} onSeatClick={onSeatClick} />
              ))}
            </div>
          )}
        </div>
      </div>
    ))}
  </div>
)

export const SeatLegend = () => (
  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-4 py-2.5">
    {STATUS_LEGEND.map(({ status, label, style }) => (
      <span key={label} className="flex items-center gap-1.5">
        <span className={cn('h-4 w-4 rounded-md border', (style ?? STATUS_STYLE[status]).cell)} />
        <span className="type-caption text-[hsl(var(--foreground-muted))]">{label}</span>
      </span>
    ))}
  </div>
)

export const SeatCountPreview = ({ count, color }: { count: number; color?: string }) => (
  <div className="grid grid-cols-2 justify-items-center gap-1.5">
    {Array.from({ length: Math.max(0, count) }).map((_, i) => (
      <span
        key={i}
        className={cn('flex h-8 w-full items-center justify-center rounded-lg border text-xs font-bold tabular-nums', !color && 'border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground-muted))]')}
        style={color ? { backgroundColor: `${color}1a`, borderColor: `${color}59`, color } : undefined}
      >
        {i + 1}
      </span>
    ))}
  </div>
)
