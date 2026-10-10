import { useEffect, useState } from 'react'
import { MapPinIcon, CopyIcon } from 'lucide-react'
import { Modal, Badge } from '@/design-system'
import travelBusService from '@/services/travelBus.service'
import type { TravelBus, TravelBusUsageHistory } from '@/types/travel.types'

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')

/**
 * Bir aracın (ve varsa ondan çoğaltılmış kopyalarının) hangi seferlerde
 * kullanıldığının izlenebilirliği. "Bu araç şu önceki seferde kullanılmıştı" bilgisini gösterir.
 */
export const TravelBusUsageHistoryModal = ({ bus, onClose }: { bus: TravelBus | null; onClose: () => void }) => {
  const [data, setData] = useState<TravelBusUsageHistory | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!bus) { setData(null); return }
    let active = true
    setLoading(true)
    travelBusService.getUsageHistory(bus.id)
      .then((d) => { if (active) setData(d) })
      .catch(() => { if (active) setData(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [bus])

  if (!bus) return null

  return (
    <Modal open onClose={onClose} title={`${bus.name} — Kullanım Geçmişi`} subtitle={bus.plateNumber || undefined} width={560} className="max-w-[96vw]">
      <div className="space-y-4 p-5">
        {bus.sourceBusId && (
          <div className="flex items-center gap-2 rounded-card border border-border bg-surface-1 px-3 py-2.5">
            <CopyIcon className="h-4 w-4 text-[hsl(var(--info))]" />
            <span className="type-body">
              Bu araç <strong>{data?.sourceBusName ?? 'başka bir araçtan'}</strong> çoğaltılarak oluşturuldu.
            </span>
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center type-muted">Yükleniyor…</p>
        ) : !data || data.usedInTravels.length === 0 ? (
          <p className="py-8 text-center type-muted">Bu araç henüz hiçbir sefere atanmamış.</p>
        ) : (
          <div className="divide-y divide-border rounded-card border border-border">
            {data.usedInTravels.map((t) => (
              <div key={t.travelId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <MapPinIcon className="h-4 w-4 shrink-0 text-[hsl(var(--foreground-muted))]" />
                  <div className="min-w-0">
                    <p className="truncate type-body-strong">{t.travelName}</p>
                    <p className="type-caption tabular-nums">{t.travelCode} · {fmtDate(t.startDate)} – {fmtDate(t.endDate)}</p>
                  </div>
                </div>
                {t.isClone && <Badge tone="info">Çoğaltılmış kopya</Badge>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
