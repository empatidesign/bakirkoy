import { useEffect, useMemo, useState } from 'react'
import { ArmchairIcon, CheckIcon } from 'lucide-react'
import { Modal, Button } from '@/design-system'
import { cn } from '@/lib/utils'
import applicationsService from '@/services/applications.service'
import type { SeatMap } from '@/types/application.types'
import type { SeatStatus } from '@/types/hall.types'
import { FloorPreview } from './FloorPreview'
import {
  seatKey, getRowSegments, getRowSeatCount, getRowLabels, isRowBasedTemplate,
} from './seatingModel'

interface SeatPickerModalProps {
  open: boolean
  onClose: () => void
  eventId: string
  sessionId?: string
  mode: 'seat' | 'row'
  value?: string
  onSelect: (seatNumber: string, label: string) => void
}

const TAKEN: SeatStatus[] = ['closed', 'protocol', 'reserved']

export const SeatPickerModal = ({ open, onClose, eventId, sessionId, mode, value, onSelect }: SeatPickerModalProps) => {
  const [map, setMap] = useState<SeatMap | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [picked, setPicked] = useState<string | undefined>(value)

  useEffect(() => {
    if (!open || !eventId) return
    setActiveIdx(0)
    setPicked(value)
    setMap(null)
    let cancelled = false
    setLoading(true)
    applicationsService.getSeatMap(eventId, sessionId)
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
    for (const [k, v] of Object.entries(map?.states ?? {})) out[k] = v === 'occupied' ? 'reserved' : v
    return out
  }, [map])

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
    <Modal open={open} onClose={onClose} width={820} className="max-w-[96vw]">
      <div className="border-b border-border px-6 py-4 pr-14">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-field bg-primary-soft">
            <ArmchairIcon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground-strong">{mode === 'row' ? 'Sıra Seçimi' : 'Koltuk Seçimi'}</h3>
            <p className="type-caption">{map?.hallName ? `${map.hallName} · ` : ''}{mode === 'row' ? 'Boş yer olan bir sıra seçin' : 'Boş bir koltuk seçin'}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {loading ? (
          <p className="py-10 text-center type-muted">Yükleniyor...</p>
        ) : !layout || floors.length === 0 || !rowBased ? (
          <p className="py-10 text-center type-muted">Bu etkinliğin salonunda seçilebilir koltuk planı bulunmuyor.</p>
        ) : (
          <>
            {floors.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {floors.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className={cn(
                      'rounded-field border px-2.5 py-1 type-caption transition-colors',
                      i === activeIdx ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface-0 text-foreground-muted hover:border-primary/40',
                    )}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 px-1">
              <span className="inline-flex items-center gap-1.5 type-caption text-foreground-default">
                <span className="inline-block h-3 w-3 rounded-sm border border-border bg-surface-0" /> Boş
              </span>
              <span className="inline-flex items-center gap-1.5 type-caption text-foreground-default">
                <span className="inline-block h-3 w-3 rounded-sm border border-accent-blue/50 bg-accent-blue-soft" /> Dolu
              </span>
              <span className="inline-flex items-center gap-1.5 type-caption text-foreground-default">
                <span className="inline-block h-3 w-3 rounded-sm border border-primary bg-primary-soft" /> Seçili
              </span>
              {picked && <span className="ml-auto type-body-strong text-primary">{pickedLabel()}</span>}
            </div>

            {floor && (
              <div className="max-h-[52vh] overflow-auto">
                <FloorPreview floor={floor} template={layout!.template} states={displayStates} selected={selectedSet} onSeatPointerDown={onSeatDown} />
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex gap-3 border-t border-border px-6 py-4">
        <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
        <Button variant="primary" className="flex-1" disabled={!picked} onClick={confirm}>
          <CheckIcon className="h-4 w-4" /> Onayla
        </Button>
      </div>
    </Modal>
  )
}
