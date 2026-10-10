import { useEffect, useMemo, useState } from 'react'
import { CheckIcon } from 'lucide-react'
import { Modal, Button } from '@/design-system'
import eventService from '@/services/event.service'
import type { SeatMap, SeatStatus } from '@/types/seating.types'
import { FloorPreview } from './FloorPreview'
import { seatKey, getRowSegments, getRowSeatCount, getRowLabels, isRowBasedTemplate } from './seatingModel'

interface Props {
  open: boolean
  onClose: () => void
  eventId: string
  sessionId?: string | null
  mode: 'seat' | 'row'
  value?: string | null
  taken?: string[]
  onSelect: (seatNumber: string, label: string) => void
}

const TAKEN: SeatStatus[] = ['closed', 'protocol', 'reserved']

export const SeatPickerModal = ({ open, onClose, eventId, sessionId, mode, value, taken, onSelect }: Props) => {
  const [map, setMap] = useState<SeatMap | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [picked, setPicked] = useState<string | undefined>(value ?? undefined)

  useEffect(() => {
    if (!open || !eventId) return
    setActiveIdx(0)
    setPicked(value ?? undefined)
    setMap(null)
    let cancelled = false
    setLoading(true)
    eventService.seatMap(eventId, sessionId)
      .then((m) => { if (!cancelled) setMap(m) })
      .catch(() => { if (!cancelled) setMap(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, eventId, sessionId, value])

  const layout = map?.layout
  const floors = layout?.floors ?? []
  const floor = floors[Math.min(activeIdx, Math.max(0, floors.length - 1))]
  const rowBased = !!layout && isRowBasedTemplate(layout.template)

  const displayStates = useMemo<Record<string, SeatStatus>>(() => {
    const out: Record<string, SeatStatus> = {}
    for (const [k, v] of Object.entries(map?.states ?? {})) out[k] = v === 'occupied' ? 'reserved' : (v as SeatStatus)
    for (const k of taken ?? []) out[k] = 'reserved'
    return out
  }, [map, taken])

  const isTaken = (key: string) => TAKEN.includes(displayStates[key])

  const selectedSet = useMemo<Set<string>>(() => {
    if (!picked || !floor) return new Set()
    if (mode === 'row') {
      const [floorId, rowIdxStr] = picked.split(':')
      if (floorId !== floor.id) return new Set()
      const rowIdx = Number(rowIdxStr)
      const seats = getRowSeatCount(getRowSegments(floor, rowIdx))
      const keys = new Set<string>()
      for (let s = 1; s <= seats; s++) keys.add(seatKey(floor.id, rowIdx, s))
      return keys
    }
    return new Set([picked])
  }, [picked, floor, mode])

  const onSeatDown = (rowIdx: number, seatNo: number) => {
    if (!floor) return
    if (mode === 'row') {
      const seats = getRowSeatCount(getRowSegments(floor, rowIdx))
      let hasFree = false
      for (let s = 1; s <= seats; s++) if (!isTaken(seatKey(floor.id, rowIdx, s))) { hasFree = true; break }
      if (!hasFree) return
      setPicked(`${floor.id}:${rowIdx}`)
    } else {
      const key = seatKey(floor.id, rowIdx, seatNo)
      if (isTaken(key)) return
      setPicked(key)
    }
  }

  const pickedLabel = (): string => {
    if (!picked) return ''
    const [floorId, rowIdxStr, seatNoStr] = picked.split(':')
    const f = floors.find((x) => x.id === floorId) ?? floor
    if (!f) return ''
    const rowIdx = Number(rowIdxStr)
    const rowLabel = getRowLabels(f)[rowIdx] ?? String(rowIdx + 1)
    const prefix = floors.length > 1 ? `${f.name} · ` : ''
    return mode === 'row' ? `${prefix}${rowLabel} sırası` : `${prefix}${rowLabel}-${seatNoStr}`
  }

  const confirm = () => {
    if (!picked) return
    onSelect(picked, pickedLabel())
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      className="max-w-[96vw]"
      title={mode === 'row' ? 'Sıra Seçimi' : 'Koltuk Seçimi'}
      subtitle={map?.hallName ?? (mode === 'row' ? 'Boş bir sıra seçin' : 'Boş bir koltuk seçin')}
      footer={
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" className="flex-1 gap-1" disabled={!picked} onClick={confirm}>
            <CheckIcon className="h-4 w-4" /> Onayla
          </Button>
        </div>
      }
      bodyClassName="p-4"
    >
      <div className="space-y-3">
        {loading ? (
          <p className="py-10 text-center type-muted">Yükleniyor...</p>
        ) : !layout || floors.length === 0 || !rowBased ? (
          <p className="py-10 text-center type-muted">Bu etkinliğin salonunda seçilebilir koltuk planı bulunmuyor.</p>
        ) : (
          <>
            {floors.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {floors.map((f, i) => (
                  <Button key={f.id} size="sm" variant={i === activeIdx ? 'primary' : 'outline'} onClick={() => setActiveIdx(i)}>
                    {f.name}
                  </Button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 px-1">
              <span className="inline-flex items-center gap-1.5 type-caption"><span className="inline-block h-3 w-3 rounded-sm border border-success/40 bg-success-soft" /> Boş</span>
              <span className="inline-flex items-center gap-1.5 type-caption"><span className="inline-block h-3 w-3 rounded-sm border border-accent-blue/50 bg-accent-blue-soft" /> Dolu</span>
              <span className="inline-flex items-center gap-1.5 type-caption"><span className="inline-block h-3 w-3 rounded-sm border border-primary bg-primary" /> Seçili</span>
              {picked && <span className="ml-auto type-body-strong text-primary">{pickedLabel()}</span>}
            </div>
            {floor && (
              <div className="max-h-[52vh] overflow-auto">
                <FloorPreview floor={floor} states={displayStates} selected={selectedSet} onSeatPointerDown={onSeatDown} />
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
