export type BusSeatStatus =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'blocked'
  | 'hidden'
  | 'driver'
  | 'guide'

export type BusZone = 'left' | 'right' | 'back' | 'driver' | 'guide'

export interface BusSeatPosition {
  id: string
  label: string
  row: number
  zone: BusZone
  index: number
}

export interface BusTemplate {
  id: string
  name: string
  rows: number
  leftSeats: number
  rightSeats: number
  backRowSeats: number
  hasDriverSeat: boolean
  hasGuideSeat: boolean
}

export const BUS_TEMPLATES: BusTemplate[] = [
  { id: 'intercity_2plus1_39', name: 'Şehirlerarası 2+1', rows: 13, leftSeats: 1, rightSeats: 2, backRowSeats: 4, hasDriverSeat: true, hasGuideSeat: true },
  { id: 'tour_2plus2_44', name: 'Servis / Tur 2+2', rows: 11, leftSeats: 2, rightSeats: 2, backRowSeats: 5, hasDriverSeat: true, hasGuideSeat: true },
  { id: 'minibus_2plus1_20', name: 'Minibüs 2+1', rows: 6, leftSeats: 1, rightSeats: 2, backRowSeats: 2, hasDriverSeat: true, hasGuideSeat: false },
  { id: 'midibus_2plus2_30', name: 'Midibüs 2+2', rows: 7, leftSeats: 2, rightSeats: 2, backRowSeats: 2, hasDriverSeat: true, hasGuideSeat: true },
]

export const getBusTemplate = (id?: string): BusTemplate =>
  BUS_TEMPLATES.find((t) => t.id === id) ?? BUS_TEMPLATES[0]

export const generateBusSeatPositions = (template: BusTemplate): BusSeatPosition[] => {
  const positions: BusSeatPosition[] = []
  if (template.hasDriverSeat) positions.push({ id: 'DRIVER', label: 'Ş', row: 0, zone: 'driver', index: 0 })
  if (template.hasGuideSeat) positions.push({ id: 'GUIDE', label: 'R', row: 0, zone: 'guide', index: 0 })

  let seatNo = 0
  for (let r = 1; r <= template.rows; r++) {
    for (let i = 0; i < template.leftSeats; i++) {
      seatNo += 1
      positions.push({ id: `L-${r}-${i}`, label: String(seatNo), row: r, zone: 'left', index: i })
    }
    for (let i = 0; i < template.rightSeats; i++) {
      seatNo += 1
      positions.push({ id: `R-${r}-${i}`, label: String(seatNo), row: r, zone: 'right', index: i })
    }
  }
  for (let i = 0; i < template.backRowSeats; i++) {
    seatNo += 1
    positions.push({ id: `B-${i}`, label: String(seatNo), row: template.rows + 1, zone: 'back', index: i })
  }
  return positions
}

export const isPassengerSeat = (zone: BusZone): boolean => zone !== 'driver' && zone !== 'guide'

export const getAdjacentLabels = (template: BusTemplate, label: string): string[] => {
  const positions = generateBusSeatPositions(template)
  const target = positions.find((p) => p.label === label)
  if (!target || !isPassengerSeat(target.zone)) return []
  return positions
    .filter((p) => p.label !== label && p.zone === target.zone && p.row === target.row && Math.abs(p.index - target.index) === 1)
    .map((p) => p.label)
}
