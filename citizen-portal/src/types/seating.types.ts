export type SeatingTemplateId =
  | 'theater'
  | 'cinema'
  | 'amphitheater'
  | 'conference'
  | 'classroom'
  | 'ushape'
  | 'banquet'
  | 'custom'

export type SeatStatus = 'available' | 'reserved' | 'protocol' | 'closed'

export interface SeatingFloor {
  id: string
  name: string
  rows: number
  defaultSegments: number[]
  rowOverrides: Record<number, number[]>
  crossAisles: number[]
  rowLabelStart: string
  skipIO: boolean
}

export interface SeatingLayout {
  template: SeatingTemplateId
  floors: SeatingFloor[]
}

export type SeatMapState = 'closed' | 'protocol' | 'occupied'

export interface SeatMap {
  hallId?: string | null
  hallName?: string | null
  layout?: SeatingLayout | null
  states: Record<string, SeatMapState>
  reservationType: string
}
