import type { SeatingFloor, SeatingTemplateId } from '@/types/seating.types'

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function getRowSegments(floor: SeatingFloor, rowIdx: number): number[] {
  const override = floor.rowOverrides[rowIdx]
  return override && override.length ? override : floor.defaultSegments
}

export function getRowSeatCount(segments: number[]): number {
  return segments.reduce((sum, n) => sum + Math.max(0, Math.floor(n)), 0)
}

export function getFloorSeatCount(floor: SeatingFloor): number {
  let total = 0
  for (let r = 0; r < floor.rows; r++) total += getRowSeatCount(getRowSegments(floor, r))
  return total
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

const ROW_BASED_TEMPLATES: SeatingTemplateId[] = ['theater', 'cinema', 'amphitheater', 'conference', 'classroom', 'custom']

export function isRowBasedTemplate(template: SeatingTemplateId): boolean {
  return ROW_BASED_TEMPLATES.includes(template)
}
