import { useMemo } from 'react'
import { MapIcon } from 'lucide-react'
import type { CitizenLibrarySeatPlan, CitizenLibrarySeatNode } from '@/types/library.types'
import { KrokiViewerModal, useKrokiViewer } from './KrokiViewerModal'

type TableItem = {
  id: string
  name: string
  floorId: string
  floorName: string
  krokiUrl?: string | null
  seats: CitizenLibrarySeatNode[]
}

const firstFreeSeat = (seats: CitizenLibrarySeatNode[]): CitizenLibrarySeatNode | undefined =>
  seats.find((s) => s.status === 'available' || s.status === 'free')

type TableState = 'free' | 'occupied' | 'reserved' | 'blocked'

const tableState = (seats: CitizenLibrarySeatNode[]): TableState => {
  if (firstFreeSeat(seats)) return 'free'
  if (seats.some((s) => s.status === 'reserved' || s.status === 'held')) return 'reserved'
  if (seats.length > 0 && seats.every((s) => s.status === 'maintenance' || s.status === 'blocked')) return 'blocked'
  return 'occupied'
}

const stateStyle: Record<TableState, string> = {
  free: 'border-success/40 bg-success/5 text-success hover:bg-success/10',
  occupied: 'border-danger/30 bg-danger/5 text-danger/70 cursor-not-allowed',
  reserved: 'border-warning/40 bg-warning/5 text-warning/80 cursor-not-allowed',
  blocked: 'border-border bg-surface-2 text-foreground-subtle cursor-not-allowed',
}

const Legend = () => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
    <span className="type-caption inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--success))' }} /> Boş</span>
    <span className="type-caption inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--primary))' }} /> Seçili</span>
    <span className="type-caption inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--danger))' }} /> Dolu</span>
    <span className="type-caption inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--warning))' }} /> Rezerve</span>
    <span className="type-caption inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--foreground-subtle))' }} /> Kapalı</span>
  </div>
)

export const LibraryTableGrid = ({
  plan,
  selected,
  onSelectSeat,
}: {
  plan: CitizenLibrarySeatPlan | null
  selected: string | null
  onSelectSeat: (seatKey: string) => void
}) => {
  const kroki = useKrokiViewer()

  const { tables, floors } = useMemo(() => {
    const out: TableItem[] = []
    const floorList: { id: string; name: string; krokiUrl?: string | null }[] = []
    for (const floor of plan?.floors ?? []) {
      floorList.push({ id: floor.id, name: floor.name, krokiUrl: floor.krokiUrl })
      if (floor.sections && floor.sections.length > 0) {
        for (const sec of floor.sections) {
          for (const t of sec.tables) {
            out.push({ id: `${floor.id}:${t.id}`, name: t.name, floorId: floor.id, floorName: floor.name, seats: t.seats })
          }
        }
      } else {
        for (const seat of floor.seats ?? []) {
          out.push({ id: `${floor.id}:${seat.key}`, name: seat.label || String(seat.number), floorId: floor.id, floorName: floor.name, seats: [seat] })
        }
      }
    }
    return { tables: out, floors: floorList }
  }, [plan])

  const floorsWithKroki = floors.filter((f) => f.krokiUrl)

  if (!plan || tables.length === 0) {
    return <p className="py-8 text-center type-muted">Bu kıraathane için oturma düzeni bulunamadı.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Legend />
        {floorsWithKroki.length > 0 && (
          <button
            type="button"
            onClick={() => kroki.show(null)}
            className="flex flex-shrink-0 items-center gap-1 rounded-field border border-border bg-surface-0 px-2.5 py-1.5 type-caption font-medium text-primary hover:bg-surface-1"
          >
            <MapIcon className="h-3.5 w-3.5" /> Oturma Planı
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tables.map((t) => {
          const state = tableState(t.seats)
          const free = firstFreeSeat(t.seats)
          const isSelected = free != null && selected === free.key
          const freeCount = t.seats.filter((s) => s.status === 'available' || s.status === 'free').length
          return (
            <button
              key={t.id}
              type="button"
              disabled={state !== 'free'}
              onClick={() => free && onSelectSeat(free.key)}
              className={`flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-card border-2 px-3 py-5 text-center transition-all active:scale-[0.98] ${
                isSelected ? 'border-primary bg-primary text-white shadow-card' : stateStyle[state]
              }`}
            >
              <span className="text-base font-bold leading-tight">{t.name}</span>
              {isSelected ? (
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">Seçildi</span>
              ) : state === 'free' ? (
                <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">{freeCount} boş</span>
              ) : state === 'occupied' ? (
                <span className="text-xs font-medium opacity-80">Dolu</span>
              ) : state === 'reserved' ? (
                <span className="text-xs font-medium opacity-80">Rezerve</span>
              ) : (
                <span className="text-xs font-medium opacity-80">Kapalı</span>
              )}
            </button>
          )
        })}
      </div>

      <KrokiViewerModal open={kroki.open} onClose={kroki.hide} floors={floors} initialFloorId={kroki.floorId} />
    </div>
  )
}
