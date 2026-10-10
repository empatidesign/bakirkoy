
export type BusSeatStatus =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'blocked'
  | 'hidden'
  | 'driver'
  | 'guide'

export interface BusSeatState {
  status: BusSeatStatus
  participantName?: string
  participantId?: string
  reason?: string
}

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
  description: string
  rows: number
  leftSeats: number
  rightSeats: number
  backRowSeats: number
  hasDriverSeat: boolean
  hasGuideSeat: boolean
  totalSeats: number
}

const passengerTotal = (rows: number, left: number, right: number, back: number) =>
  rows * (left + right) + back

export const BUS_TEMPLATES: BusTemplate[] = [
  {
    id: 'intercity_2plus1_39',
    name: 'Şehirlerarası 2+1',
    description: '13 sıra (1+2) + 4 arka koltuk · şoför + rehber',
    rows: 13,
    leftSeats: 1,
    rightSeats: 2,
    backRowSeats: 4,
    hasDriverSeat: true,
    hasGuideSeat: true,
    totalSeats: passengerTotal(13, 1, 2, 4),
  },
  {
    id: 'tour_2plus2_44',
    name: 'Servis / Tur 2+2',
    description: '11 sıra (2+2) + 5 arka koltuk · şoför + rehber',
    rows: 11,
    leftSeats: 2,
    rightSeats: 2,
    backRowSeats: 5,
    hasDriverSeat: true,
    hasGuideSeat: true,
    totalSeats: passengerTotal(11, 2, 2, 5),
  },
  {
    id: 'minibus_2plus1_20',
    name: 'Minibüs 2+1 (20 kişilik)',
    description: '6 sıra (1+2) + 2 arka koltuk · şoför',
    rows: 6,
    leftSeats: 1,
    rightSeats: 2,
    backRowSeats: 2,
    hasDriverSeat: true,
    hasGuideSeat: false,
    totalSeats: passengerTotal(6, 1, 2, 2),
  },
  {
    id: 'midibus_2plus2_30',
    name: 'Midibüs 2+2 (30 kişilik)',
    description: '7 sıra (2+2) + 2 arka koltuk · şoför + rehber',
    rows: 7,
    leftSeats: 2,
    rightSeats: 2,
    backRowSeats: 2,
    hasDriverSeat: true,
    hasGuideSeat: true,
    totalSeats: passengerTotal(7, 2, 2, 2),
  },
]

export const getBusTemplateOrNull = (id?: string): BusTemplate | undefined =>
  BUS_TEMPLATES.find((t) => t.id === id)

export const getBusTemplate = (id?: string): BusTemplate =>
  getBusTemplateOrNull(id) ?? BUS_TEMPLATES[0]

export const generateBusSeatPositions = (template: BusTemplate): BusSeatPosition[] => {
  const positions: BusSeatPosition[] = []
  if (template.hasDriverSeat) {
    positions.push({ id: 'DRIVER', label: 'Ş', row: 0, zone: 'driver', index: 0 })
  }
  if (template.hasGuideSeat) {
    positions.push({ id: 'GUIDE', label: 'R', row: 0, zone: 'guide', index: 0 })
  }

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

export const createInitialBusSeatStates = (
  positions: BusSeatPosition[],
): Record<string, BusSeatState> => {
  const states: Record<string, BusSeatState> = {}
  for (const p of positions) {
    if (p.zone === 'driver') states[p.id] = { status: 'driver', reason: 'Şoför' }
    else if (p.zone === 'guide') states[p.id] = { status: 'guide', reason: 'Rehber' }
    else states[p.id] = { status: 'available' }
  }
  return states
}

export const countBusSeatStatuses = (
  positions: BusSeatPosition[],
  states: Record<string, BusSeatState>,
) => {
  const counts = { available: 0, occupied: 0, reserved: 0, blocked: 0, hidden: 0, driver: 0, guide: 0, total: 0 }
  for (const p of positions) {
    const s = states[p.id]?.status ?? 'available'
    counts[s] += 1
    if (p.zone !== 'driver' && p.zone !== 'guide') counts.total += 1
  }
  return counts
}

export const visibleSeatCount = (counts: ReturnType<typeof countBusSeatStatuses>) =>
  counts.total - counts.hidden

export const BUS_SEAT_STATUS_META: Record<BusSeatStatus, { label: string }> = {
  available: { label: 'Boş' },
  occupied: { label: 'Dolu' },
  reserved: { label: 'Rezerve' },
  blocked: { label: 'Kapalı' },
  hidden: { label: 'Gizli (Gösterme)' },
  driver: { label: 'Şoför' },
  guide: { label: 'Rehber' },
}

export const isPassengerSeat = (zone: BusZone) => zone !== 'driver' && zone !== 'guide'
