import type {
  SeatingFloor,
  SeatingLayout,
  SeatingTemplateId,
  SeatStatus,
  SeatStateMap,
} from '@/types/hall.types'

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

let sequence = 0
export function uid(prefix: string): string {
  sequence += 1
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}${sequence}${rand}`
}

export function getRowSegments(floor: SeatingFloor, rowIdx: number): number[] {
  const override = floor.rowOverrides[rowIdx]
  return override && override.length ? override : floor.defaultSegments
}

export function getRowSeatCount(segments: number[]): number {
  return segments.reduce((sum, n) => sum + Math.max(0, Math.floor(n)), 0)
}

export function getFloorSeatCount(floor: SeatingFloor): number {
  let total = 0
  for (let r = 0; r < floor.rows; r++) {
    total += getRowSeatCount(getRowSegments(floor, r))
  }
  return total
}

export function calculateTotalSeats(layout: SeatingLayout | undefined): number {
  if (!layout) return 0
  return layout.floors.reduce((total, floor) => total + getFloorSeatCount(floor), 0)
}

export function getMaxRowSeatCount(floor: SeatingFloor): number {
  let max = 0
  for (let r = 0; r < floor.rows; r++) {
    max = Math.max(max, getRowSeatCount(getRowSegments(floor, r)))
  }
  return max
}

export function getRowLabels(floor: SeatingFloor): string[] {
  const letters = (floor.skipIO ? ALPHA.replace(/[IO]/g, '') : ALPHA).split('')
  const seq: string[] = []
  let rep = 1
  const need = floor.rows + letters.length
  while (seq.length < need) {
    for (const ch of letters) seq.push(ch.repeat(rep))
    rep += 1
  }
  const start = (floor.rowLabelStart || 'A').toUpperCase()
  let startIdx = seq.indexOf(start)
  if (startIdx < 0) startIdx = 0
  return Array.from({ length: floor.rows }, (_, i) => seq[startIdx + i] ?? '')
}

export type RowCell = { type: 'seat'; seatNo: number } | { type: 'gap' }

export function getRowCells(segments: number[]): RowCell[] {
  const cells: RowCell[] = []
  let n = 0
  segments.forEach((count, segIdx) => {
    if (segIdx > 0) cells.push({ type: 'gap' })
    for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
      n += 1
      cells.push({ type: 'seat', seatNo: n })
    }
  })
  return cells
}

export function seatKey(floorId: string, rowIdx: number, seatNo: number): string {
  return `${floorId}:${rowIdx}:${seatNo}`
}

export const SEAT_STATUS_CYCLE: SeatStatus[] = ['available', 'reserved', 'protocol', 'closed']

export function nextSeatStatus(status: SeatStatus): SeatStatus {
  const i = SEAT_STATUS_CYCLE.indexOf(status)
  return SEAT_STATUS_CYCLE[(i + 1) % SEAT_STATUS_CYCLE.length]
}

export function countSeatStatuses(
  layout: SeatingLayout | undefined,
  states: SeatStateMap,
): Record<SeatStatus, number> {
  const counts: Record<SeatStatus, number> = { available: 0, reserved: 0, protocol: 0, closed: 0 }
  if (!layout) return counts
  for (const floor of layout.floors) {
    for (let r = 0; r < floor.rows; r++) {
      const seats = getRowSeatCount(getRowSegments(floor, r))
      for (let s = 1; s <= seats; s++) {
        const status = states[seatKey(floor.id, r, s)] ?? 'available'
        counts[status] += 1
      }
    }
  }
  return counts
}

export function makeFloor(
  name: string,
  rows: number,
  defaultSegments: number[],
  opts?: Partial<SeatingFloor>,
): SeatingFloor {
  return {
    id: uid('flr'),
    name,
    rows,
    defaultSegments,
    rowOverrides: {},
    crossAisles: [],
    rowLabelStart: 'A',
    skipIO: false,
    ...opts,
  }
}

export interface SeatingTemplateMeta {
  id: SeatingTemplateId
  label: string
  description: string
}

export const SEATING_TEMPLATES: SeatingTemplateMeta[] = [
  { id: 'theater', label: 'Tiyatro', description: 'Düz sıralar, ortada koridor' },
  { id: 'cinema', label: 'Sinema', description: 'Yan koridorlu, I/O atlanır' },
  { id: 'amphitheater', label: 'Amfi', description: 'Çift koridor + yatay koridor' },
  { id: 'conference', label: 'Konferans', description: 'Düz sıralar, orta koridor' },
  { id: 'classroom', label: 'Sınıf', description: 'Sıralı masa-koltuk düzeni' },
  { id: 'ushape', label: 'U-Şekli', description: 'Toplantı, ortada açık alan' },
  { id: 'banquet', label: 'Banket', description: 'Yuvarlak masalar' },
]

export const ROW_BASED_TEMPLATES: SeatingTemplateId[] = [
  'theater', 'cinema', 'amphitheater', 'conference', 'classroom', 'custom',
]

export function isRowBasedTemplate(template: SeatingTemplateId): boolean {
  return ROW_BASED_TEMPLATES.includes(template)
}

export function createLayoutFromTemplate(template: SeatingTemplateId): SeatingLayout {
  switch (template) {
    case 'theater':
      return { template, floors: [makeFloor('Zemin Kat', 15, [8, 12, 8])] }
    case 'cinema':
      return { template, floors: [makeFloor('Zemin Kat', 12, [6, 10, 6], { skipIO: true })] }
    case 'amphitheater':
      return { template, floors: [makeFloor('Zemin Kat', 12, [12, 12], { crossAisles: [5] })] }
    case 'conference':
      return { template, floors: [makeFloor('Zemin Kat', 8, [10, 10])] }
    case 'classroom':
      return { template, floors: [makeFloor('Zemin Kat', 6, [4, 4, 4])] }
    case 'ushape':
      return { template, floors: [makeFloor('Zemin Kat', 5, [10])] }
    case 'banquet':
      return { template, floors: [makeFloor('Zemin Kat', 6, [8])] }
    default:
      return { template: 'theater', floors: [makeFloor('Zemin Kat', 15, [8, 12, 8])] }
  }
}

export function createDefaultLayout(): SeatingLayout {
  return createLayoutFromTemplate('theater')
}
