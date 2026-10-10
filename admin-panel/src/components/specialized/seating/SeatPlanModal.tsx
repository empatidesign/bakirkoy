import { useEffect, useState } from 'react'
import { SaveIcon, ArmchairIcon, InfoIcon, Building2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Button, ConfirmModal } from '@/design-system'
import { cn } from '@/lib/utils'
import hallService from '@/services/hall.service'
import sessionService from '@/services/session.service'
import eventService from '@/services/event.service'
import type { Hall, SeatStateMap, SeatStatus } from '@/types/hall.types'
import { SEAT_STATUS_LABELS } from '@/types/hall.types'
import { FloorPreview } from './FloorPreview'
import { StandingParticipantList } from './StandingParticipantList'
import {
  seatKey,
  countSeatStatuses,
  getRowSegments,
  getRowSeatCount,
  isRowBasedTemplate,
} from './seatingModel'

const SWATCH: Record<SeatStatus, string> = {
  available: 'bg-success-soft border-success/40',
  reserved: 'bg-accent-blue-soft border-accent-blue/50',
  protocol: 'bg-accent-violet-soft border-accent-violet/50',
  closed: 'bg-danger-soft border-danger/40',
}
const STATUSES: SeatStatus[] = ['available', 'protocol', 'closed']

interface SeatPlanModalProps {
  open: boolean
  onClose: () => void
  onSaved?: () => void
  hall: Hall | null
  sessionId?: string
  eventId?: string
}

export const SeatPlanModal = ({ open, onClose, onSaved, hall, sessionId, eventId }: SeatPlanModalProps) => {
  const [states, setStates] = useState<SeatStateMap>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!open || !hall) return
    setActiveIdx(0)
    setStates({})
    setSelected(new Set())
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const plan = sessionId
          ? await sessionService.getSeatPlan(sessionId)
          : eventId
            ? await eventService.getSeatPlan(eventId)
            : await hallService.getSeatPlan(hall.id)
        if (!cancelled) setStates(plan)
      } catch {
        if (!cancelled) setStates({})
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hall?.id, sessionId, eventId])

  useEffect(() => {
    const stop = () => setDragMode(null)
    window.addEventListener('pointerup', stop)
    return () => window.removeEventListener('pointerup', stop)
  }, [])

  if (!hall) return null
  const layout = hall.layout
  const floors = layout?.floors ?? []
  const floor = floors[Math.min(activeIdx, floors.length - 1)]
  const counts = countSeatStatuses(layout, states)
  const rowBased = !!layout && isRowBasedTemplate(layout.template)

  const switchFloor = (i: number) => { setActiveIdx(i); setSelected(new Set()) }

  const applySel = (key: string, mode: 'add' | 'remove') => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (mode === 'add') next.add(key)
      else next.delete(key)
      return next
    })
  }

  const onSeatDown = (rowIdx: number, seatNo: number) => {
    if (!floor) return
    const key = seatKey(floor.id, rowIdx, seatNo)
    const mode: 'add' | 'remove' = selected.has(key) ? 'remove' : 'add'
    setDragMode(mode)
    applySel(key, mode)
  }

  const onSeatEnter = (rowIdx: number, seatNo: number) => {
    if (!dragMode || !floor) return
    applySel(seatKey(floor.id, rowIdx, seatNo), dragMode)
  }

  const floorSeatKeys = (): string[] => {
    if (!floor) return []
    const keys: string[] = []
    for (let r = 0; r < floor.rows; r++) {
      const seats = getRowSeatCount(getRowSegments(floor, r))
      for (let s = 1; s <= seats; s++) keys.push(seatKey(floor.id, r, s))
    }
    return keys
  }

  const selectAll = () => setSelected(new Set(floorSeatKeys()))
  const clearSelection = () => setSelected(new Set())

  const applyToSelected = (status: SeatStatus) => {
    if (selected.size === 0) return
    setStates((prev) => {
      const next = { ...prev }
      for (const key of selected) next[key] = status
      return next
    })
    setSelected(new Set())
  }

  const save = async () => {
    setSaving(true)
    try {
      if (sessionId) await sessionService.saveSeatPlan(sessionId, states)
      else if (eventId) await eventService.saveSeatPlan(eventId, states)
      else await hallService.saveSeatPlan(hall.id, states)
      toast.success('Oturma planı kaydedildi.')
      setConfirmOpen(false)
      onSaved?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const onSaveClick = () => {
    if (sessionId || eventId) save()
    else setConfirmOpen(true)
  }

  return (
    <>
    <Modal open={open} onClose={onClose} width={880} className="max-w-[96vw]">
      <div className="border-b border-border px-6 py-4 pr-14">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-field bg-primary-soft">
            <ArmchairIcon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground-strong">{hall.name} · {sessionId ? 'Seans Oturma Planı' : eventId ? 'Etkinlik Oturma Planı' : 'Oturma Planı'}</h3>
            {hall.facilityName && (
              <p className="type-caption flex items-center gap-1 text-foreground-default">
                <Building2Icon className="h-3.5 w-3.5 text-foreground-muted" /> {hall.facilityName}
              </p>
            )}
            <p className="type-caption">{sessionId ? 'Bu plan yalnızca bu seansa aittir; salon şablonunu etkilemez.' : eventId ? 'Bu plan yalnızca bu etkinliğe aittir; salon şablonunu etkilemez.' : 'Koltukları seçin (sürükleyerek de) → bir durum uygulayın'}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {!layout || floors.length === 0 ? (
          <StandingParticipantList eventId={eventId} sessionId={sessionId} />
        ) : !rowBased ? (
          <div className="space-y-2">
            <p className="type-caption text-foreground-muted">
              Bu düzen ({layout.template === 'banquet' ? 'banket' : 'U-şekli'}) koltuk bazlı durum yönetimi içermez; yalnız yerleşim önizlenir.
            </p>
            {floor && <FloorPreview floor={floor} template={layout.template} />}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {floors.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => switchFloor(i)}
                    className={cn(
                      'rounded-field border px-2.5 py-1 type-caption transition-colors',
                      i === activeIdx ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface-0 text-foreground-muted hover:border-primary/40',
                    )}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="type-caption text-foreground-muted">Seçili: <strong className="text-foreground-strong tabular-nums">{selected.size}</strong></span>
                <Button variant="ghost" size="sm" onClick={selectAll}>Tümünü Seç</Button>
                <Button variant="ghost" size="sm" disabled={selected.size === 0} onClick={clearSelection}>Seçimi Temizle</Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 rounded-card border border-border bg-surface-1/60 px-3 py-2">
              <span className="type-caption text-foreground-muted">{selected.size > 0 ? `${selected.size} koltuğu işaretle:` : 'Önce koltuk seçin, sonra:'}</span>
              {STATUSES.map((s) => (
                <Button key={s} variant="outline" size="sm" disabled={selected.size === 0} onClick={() => applyToSelected(s)}>
                  <span className={cn('mr-1 inline-block h-2.5 w-2.5 rounded-sm border', SWATCH[s])} />
                  {SEAT_STATUS_LABELS[s]}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-card border border-border bg-surface-1/60 px-3 py-2">
              <span className="type-body-strong text-foreground-strong">
                Kullanılabilir kontenjan: <span className="tabular-nums text-success">{counts.available}</span>
                <span className="type-caption text-foreground-muted"> / {counts.available + counts.reserved + counts.protocol + counts.closed} koltuk</span>
              </span>
              <div className="flex flex-wrap gap-3">
                {(['available', 'reserved', 'protocol', 'closed'] as SeatStatus[])
                  .filter((s) => s !== 'reserved' || counts.reserved > 0)
                  .map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5 type-caption text-foreground-default">
                      <span className={cn('inline-block h-3 w-3 rounded-sm border', SWATCH[s])} />
                      {SEAT_STATUS_LABELS[s]} · <span className="tabular-nums">{counts[s]}</span>
                    </span>
                  ))}
              </div>
            </div>

            {floor && (
              <div className="max-h-[52vh] overflow-auto">
                {loading ? (
                  <p className="py-10 text-center type-muted">Yükleniyor...</p>
                ) : (
                  <FloorPreview floor={floor} template={layout.template} states={states} selected={selected} onSeatPointerDown={onSeatDown} onSeatPointerEnter={onSeatEnter} />
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex gap-3 border-t border-border px-6 py-4">
        {!layout || floors.length === 0 ? (
          <Button variant="outline" className="flex-1" onClick={onClose}>Kapat</Button>
        ) : (
          <>
            <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
            <Button variant="primary" className="flex-1" isLoading={saving} disabled={saving || !layout} onClick={onSaveClick}>
              <SaveIcon className="h-4 w-4" /> Kaydet
            </Button>
          </>
        )}
      </div>
    </Modal>

    <ConfirmModal
      open={confirmOpen}
      onClose={() => setConfirmOpen(false)}
      onConfirm={save}
      tone="primary"
      icon={InfoIcon}
      title="Oturma planını kaydet"
      description="Bu salonu kullanan ileri tarihli ve henüz başlamamış seansların oturma düzenleri bu değişikliğe göre güncellenecek; kapatılan dolu koltuklardaki katılımcılar uygun boş koltuklara taşınacak, uygun yer yoksa görevli personele bildirilecek. Geçmiş ve devam eden seanslar etkilenmez."
      confirmLabel="Devam Et ve Kaydet"
      loading={saving}
    />
    </>
  )
}
