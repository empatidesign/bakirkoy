import { useEffect, useState } from 'react'
import { BusIcon, InfoIcon, PlusIcon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Badge, EmptyState, Button, Banner } from '@/design-system'
import {
  BusSeatPlanner, getBusTemplate, generateBusSeatPositions, countBusSeatStatuses, visibleSeatCount,
} from '@/components/specialized/seating'
import type { BusSeatState } from '@/components/specialized/seating/busSeatModel'
import travelBusService from '@/services/travelBus.service'
import travelService from '@/services/travel.service'
import { travelToForm } from './travelFormDefaults'
import { TravelBusQuickCreateModal } from './TravelBusQuickCreateModal'
import type { Travel, TravelBus, TravelBusSeating } from '@/types/travel.types'

const lockedForBus = (bus: TravelBusSeating, draft: Record<string, BusSeatState>): string[] => {
  const occupied = Object.entries(draft).filter(([, s]) => s.status === 'occupied').map(([id]) => id)
  return [...new Set([...bus.lockedSeatIds, ...occupied])]
}

export const TravelBusSeatModal = ({ travel, onClose }: { travel: Travel | null; onClose: () => void }) => {
  const [buses, setBuses] = useState<TravelBusSeating[]>([])
  const [drafts, setDrafts] = useState<Record<string, Record<string, BusSeatState>>>({})
  const [loading, setLoading] = useState(false)
  const [savingBusId, setSavingBusId] = useState<string | null>(null)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)

  const loadSeating = async (travelId: string) => {
    const list = await travelBusService.getTravelSeating(travelId)
    setBuses(list)
    setDrafts(Object.fromEntries(list.map((b) => [b.busId, b.seatStates])))
  }

  useEffect(() => {
    if (!travel) { setBuses([]); setDrafts({}); return }
    let active = true
    setLoading(true)
    travelBusService.getTravelSeating(travel.id)
      .then((list) => {
        if (!active) return
        setBuses(list)
        setDrafts(Object.fromEntries(list.map((b) => [b.busId, b.seatStates])))
      })
      .catch(() => { if (active) { setBuses([]); setDrafts({}) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [travel])

  const attachCreatedBus = async (bus: TravelBus) => {
    if (!travel) return
    const current = await travelBusService.getByTravel(travel.id)
    await travelService.update(travel.id, {
      ...travelToForm(travel),
      capacity: bus.capacity,
      busIds: [...current.map((b) => b.id), bus.id],
    })
    await loadSeating(travel.id)
  }

  const save = async (busId: string) => {
    if (!travel) return
    setSavingBusId(busId)
    try {
      await travelBusService.saveTravelSeating(travel.id, busId, drafts[busId] ?? {})
      toast.success('Gezi koltuk düzeni kaydedildi.')
      const list = await travelBusService.getTravelSeating(travel.id)
      setBuses(list)
      setDrafts((prev) => {
        const fresh = list.find((x) => x.busId === busId)
        return fresh ? { ...prev, [busId]: fresh.seatStates } : prev
      })
    } finally {
      setSavingBusId(null)
    }
  }

  return (
    <Modal
      open={!!travel}
      onClose={onClose}
      title={travel ? `${travel.name} — Koltuk Düzeni` : 'Koltuk Düzeni'}
      subtitle="Gezi bazında koltuk yönetimi — her gezinin düzeni kendine aittir"
      width={860}
      className="max-w-[96vw]"
    >
      <div className="space-y-5 p-6">
        <Banner tone="info" variant="soft" icon={InfoIcon}>
          Bu gezinin koltuk düzeni kendine aittir; buradaki değişiklik aracın diğer gezilerini etkilemez.
          Araçta kapalı (kırmızı) ile şoför/rehber koltukları gezi bazında değiştirilemez; dolu koltuklar başvurulardan gelir.
        </Banner>

        {loading ? (
          <p className="py-10 text-center type-muted">Yükleniyor…</p>
        ) : buses.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              icon={BusIcon}
              title="Araç atanmamış"
              description={travel?.isActive
                ? 'Bu sefer aktif olduğu için araç ataması kilitli. Önce seferi pasife alın.'
                : 'Bu sefere henüz araç tanımlanmadı. Yeni aracı buradan oluşturup doğrudan sefere ekleyebilirsiniz.'}
            />
            {!travel?.isActive && (
              <div className="flex justify-center">
                <Button variant="primary" onClick={() => setQuickCreateOpen(true)}>
                  <PlusIcon className="h-4 w-4" /> Araç Ekle
                </Button>
              </div>
            )}
          </div>
        ) : (
          buses.map((bus) => {
            if (bus.vehicleType === 'capacity') {
              return (
                <div key={bus.busId} className="space-y-3 rounded-card border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <span className="type-body-strong">{bus.name}</span>
                      <span className="type-muted"> · {bus.plateNumber || 'Kontenjanlı araç'}</span>
                    </div>
                    <Badge tone="info">{bus.occupiedCount} / {bus.capacity} kişi</Badge>
                  </div>
                  <p className="type-caption text-foreground-muted">
                    Bu araç numarasız (kontenjanlı); koltuk seçimi yoktur. Başvurular yalnızca toplam kontenjana göre kabul edilir.
                  </p>
                </div>
              )
            }

            const draft = drafts[bus.busId] ?? bus.seatStates
            const tmpl = getBusTemplate(bus.templateId)
            const counts = countBusSeatStatuses(generateBusSeatPositions(tmpl), draft)
            const occupantGenders: Record<string, 'male' | 'female'> = Object.fromEntries(
              bus.occupants.map((o) => [o.seatNumber, o.gender === 'female' ? 'female' : 'male'] as const),
            )
            // Kullanıcı isteği (2026-08-07): araçta kaç bay kaç bayan olduğu görünsün.
            const maleCount = bus.occupants.filter((o) => o.gender !== 'female').length
            const femaleCount = bus.occupants.filter((o) => o.gender === 'female').length
            return (
              <div key={bus.busId} className="space-y-3 rounded-card border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <span className="type-body-strong">{bus.name}</span>
                    <span className="type-muted"> · {bus.plateNumber} · {tmpl.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="info">{counts.occupied} / {visibleSeatCount(counts)} dolu</Badge>
                    {(maleCount > 0 || femaleCount > 0) && (
                      <>
                        <Badge tone="info">♂ {maleCount}</Badge>
                        <Badge tone="info">♀ {femaleCount}</Badge>
                      </>
                    )}
                    <Button size="sm" variant="primary" isLoading={savingBusId === bus.busId} onClick={() => save(bus.busId)}>
                      Kaydet
                    </Button>
                  </div>
                </div>
                <BusSeatPlanner
                  templateId={bus.templateId}
                  seatStates={draft}
                  lockedSeatIds={lockedForBus(bus, draft)}
                  occupantGenders={occupantGenders}
                  onSeatChange={(s) => setDrafts((prev) => ({ ...prev, [bus.busId]: s }))}
                />
                <div className="rounded-card border border-border bg-surface-1/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 type-body-strong"><UsersIcon className="h-4 w-4" /> Oturanlar</span>
                    <span className="type-caption text-foreground-muted">{bus.occupants.length} kişi</span>
                  </div>
                  {bus.occupants.length === 0 ? (
                    <p className="type-caption text-foreground-muted">Henüz bu araca oturan yolcu yok.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {[...bus.occupants].sort((a, b) => a.seatNumber.localeCompare(b.seatNumber, 'tr', { numeric: true })).map((o, index) => (
                        <div key={`${o.seatNumber}-${index}`} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate type-caption font-medium text-foreground-strong">{o.name || 'Yolcu'}</p>
                            <p className="type-caption text-foreground-muted">Koltuk {o.seatNumber || '—'}</p>
                          </div>
                          <Badge tone="info">{o.gender === 'female' ? 'Kadın' : o.gender === 'male' ? 'Erkek' : 'Belirsiz'}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
      <TravelBusQuickCreateModal
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onCreated={attachCreatedBus}
      />
    </Modal>
  )
}
