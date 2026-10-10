import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  ArmchairIcon, RefreshCwIcon, WrenchIcon, SaveIcon, XIcon, LogOutIcon,
  CoffeeIcon, SettingsIcon, CheckCircle2Icon, UserIcon, TimerIcon,
  BookmarkIcon,
} from 'lucide-react'
import {
  Button, Badge, Modal, SkeletonRows, EmptyState, Card, StatCard, SectionToolbar, Progress, Banner,
} from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import { LibrarySeatGrid, SeatLegend } from '@/components/specialized/LibrarySeatGrid'
import { KrokiViewerModal, useKrokiViewer, KrokiIcon } from '@/components/specialized/KrokiViewerModal'
import { SeatingStructureEditor } from './SeatingStructureEditor'
import libraryService from '@/services/library.service'
import { SEAT_STATUS_LABELS } from '@/types/library.types'
import type { LibrarySeatPlan, Seat } from '@/types/library.types'
import { fmtTime, occupancyTone } from './libraryHelpers'

export const SeatingTab = ({ libraryId, refreshKey }: { libraryId: string; refreshKey?: number }) => {
  const [plan, setPlan] = useState<LibrarySeatPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [active, setActive] = useState<Seat | null>(null)
  const [busy, setBusy] = useState(false)
  const [manageMode, setManageMode] = useState(false)
  const { can } = useAuth()
  const canManage = can('library.edit')
  const kroki = useKrokiViewer()

  const load = useCallback(async () => {
    setLoading(true)
    try { setPlan(await libraryService.seatPlan.get(libraryId)) } catch { setPlan(null) } finally { setLoading(false) }
  }, [libraryId])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (refreshKey) load() }, [refreshKey, load])

  const startEdit = () => {
    const maint = new Set<string>()
    plan?.floors.forEach((f) => f.seats.forEach((s) => { if (s.status === 'maintenance') maint.add(s.key) }))
    setSelected(maint)
    setEditMode(true)
  }
  const cancelEdit = () => { setEditMode(false); setSelected(new Set()) }

  const onSeatClick = (seat: Seat) => {
    if (editMode) {
      if (seat.status === 'occupied' || seat.status === 'on_break' || seat.status === 'reserved') return
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(seat.key)) next.delete(seat.key)
        else next.add(seat.key)
        return next
      })
      return
    }
    if (seat.status === 'occupied' || seat.status === 'on_break' || seat.status === 'reserved') setActive(seat)
  }

  const saveMaintenance = async () => {
    setSaving(true)
    try {
      await libraryService.seatPlan.saveMaintenance(libraryId, [...selected])
      toast.success('Oturma planı güncellendi.')
      setEditMode(false)
      await load()
    } finally { setSaving(false) }
  }

  const exitOccupant = async () => {
    if (!active?.sessionId) return
    setBusy(true)
    try {
      await libraryService.occupants.exit(active.sessionId)
      toast.success(`${active.occupantName} çıkışı kaydedildi.`)
      setActive(null)
      await load()
    } finally { setBusy(false) }
  }

  const cancelReservation = async () => {
    const rid = active?.reservationId ?? active?.sessionId
    if (!rid) return
    setBusy(true)
    try {
      await libraryService.reservations.cancel(rid)
      toast.success('Rezervasyon iptal edildi.')
      setActive(null)
      await load()
    } finally { setBusy(false) }
  }

  const total = (plan?.available ?? 0) + (plan?.occupied ?? 0) + (plan?.onBreak ?? 0) + (plan?.reserved ?? 0) + (plan?.maintenance ?? 0)
  const occupancyPct = total > 0 ? Math.round(((plan?.occupied ?? 0) + (plan?.onBreak ?? 0)) / total * 100) : 0
  const floorsWithKroki = plan?.floors.filter((f) => f.krokiUrl) ?? []

  if (manageMode) {
    return (
      <SeatingStructureEditor
        libraryId={libraryId}
        seatingMode={plan?.seatingMode ?? 'masali'}
        onSaved={() => { setManageMode(false); load() }}
        onCancel={() => setManageMode(false)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">

      <SectionToolbar
        icon={ArmchairIcon}
        title="Oturma Planı"
        subtitle={plan?.seatingMode === 'sirali' ? 'Sıralı sistem — doluluk gösterimi' : 'Canlı koltuk doluluğu ve atama'}
        actions={
          editMode ? (
            <>
              <Button variant="outline" size="sm" onClick={cancelEdit}><XIcon className="h-4 w-4" /> İptal</Button>
              <Button variant="primary" size="sm" isLoading={saving} onClick={saveMaintenance}><SaveIcon className="h-4 w-4" /> Kaydet</Button>
            </>
          ) : (
            <>
              {floorsWithKroki.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => kroki.show(null)}>
                  <KrokiIcon className="h-4 w-4" /> Oturma Planı Krokisi
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={load}><RefreshCwIcon className="h-4 w-4" /> Yenile</Button>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setManageMode(true)}>
                  <SettingsIcon className="h-4 w-4" /> Yönetim Modu
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={startEdit}><WrenchIcon className="h-4 w-4" /> Bakım Modu</Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Boş" value={plan?.available ?? 0} icon={CheckCircle2Icon} accent="green" loading={loading} />
        <StatCard label="Dolu" value={plan?.occupied ?? 0} icon={UserIcon} accent="blue" loading={loading} />
        <StatCard label="Molada" value={plan?.onBreak ?? 0} icon={TimerIcon} accent="orange" loading={loading} />
        <StatCard label="Rezerve" value={plan?.reserved ?? 0} icon={BookmarkIcon} accent="violet" loading={loading} />
        <StatCard label="Bakım" value={plan?.maintenance ?? 0} icon={WrenchIcon} accent="danger" loading={loading} />
      </div>

      {!loading && plan && total > 0 && (
        <div className="rounded-card border border-border bg-surface-1 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="type-caption font-semibold text-foreground-muted">Doluluk Oranı</span>
            <span className="type-caption font-black text-foreground-strong">%{occupancyPct} · {(plan.occupied ?? 0) + (plan.onBreak ?? 0)}/{total} koltuk</span>
          </div>
          <Progress value={occupancyPct} tone={occupancyTone(occupancyPct)} />
        </div>
      )}

      {editMode && (
        <Banner tone="info" variant="soft" icon={WrenchIcon}>
          <strong>Bakım modu:</strong> Boş koltuklara tıklayarak bakıma alın veya açın. Değişiklikleri kaydetmeyi unutmayın.
        </Banner>
      )}

      {loading ? (
        <Card padded><SkeletonRows rows={6} /></Card>
      ) : !plan || plan.floors.length === 0 ? (
        <Card className="py-6">
          <EmptyState icon={ArmchairIcon} title="Kat tanımlı değil" description="Kütüphaneye kat ve kapasite tanımlayın (Yönetim Modu → Kaydet)." />
        </Card>
      ) : (
        <div className="space-y-4">
          <SeatLegend />
          <LibrarySeatGrid floors={plan.floors} editMode={editMode} selected={selected} onSeatClick={onSeatClick} />
        </div>
      )}

      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        title={active?.occupantName ?? 'Koltuk'}
        subtitle={active?.label}
        width={420}
        footer={
          active?.status === 'reserved' ? (
            canManage ? (
              <Button variant="danger" className="w-full" isLoading={busy} onClick={cancelReservation}><XIcon className="h-4 w-4" /> Rezervasyonu İptal Et</Button>
            ) : (
              <p className="type-caption text-center text-[hsl(var(--foreground-muted))]">Rezervasyon iptali yalnızca yöneticiler tarafından yapılabilir.</p>
            )
          ) : canManage ? (
            <Button variant="danger" className="w-full" isLoading={busy} onClick={exitOccupant}><LogOutIcon className="h-4 w-4" /> Çıkış</Button>
          ) : (
            <p className="type-caption text-center text-[hsl(var(--foreground-muted))]">Çıkış işlemi yalnızca yöneticiler tarafından yapılabilir.</p>
          )
        }
      >
        <div className="space-y-3 p-1">
          <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--surface-1))] px-3 py-2.5">
            <span className="type-muted">Durum</span>
            <Badge
              tone={active?.status === 'on_break' ? 'warning' : active?.status === 'reserved' ? 'info' : 'success'}
              className={active?.status === 'on_break' && active.breakType === 'long' ? 'bg-[hsl(var(--accent-orange-soft))] text-[hsl(var(--accent-orange))]' : undefined}
            >
              {active?.status === 'on_break'
                ? <><CoffeeIcon className="mr-1 inline h-3 w-3" />{active.breakType === 'long' ? 'Uzun Molada' : 'Kısa Molada'}</>
                : active ? SEAT_STATUS_LABELS[active.status] : ''}
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--surface-1))] px-3 py-2.5">
            <span className="type-muted">Giriş Saati</span>
            <span className="tabular-nums type-body-strong">{fmtTime(active?.entryTime)}</span>
          </div>
        </div>
      </Modal>

      <KrokiViewerModal open={kroki.open} onClose={kroki.hide} floors={plan?.floors ?? []} initialFloorId={kroki.floorId} />
    </div>
  )
}
