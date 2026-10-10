import { useEffect, useState, useCallback } from 'react'
import { MapPinIcon } from 'lucide-react'
import { EmptyState, SkeletonRows } from '@/design-system'
import { EmergencyAreaMap } from '@/components/specialized/EmergencyAreaMap'
import { EmergencyAreaDetailModal } from './EmergencyAreaDetailModal'
import emergencyAreaService from '@/services/emergencyArea.service'
import type { EmergencyAreaMapPoint } from '@/types/emergencyArea.types'

export const EmergencyAreaMapView = () => {
  const [points, setPoints] = useState<EmergencyAreaMapPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setPoints(await emergencyAreaService.getMapPoints()) }
    catch { setPoints([]) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const located = points.filter((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number')
  const missing = points.length - located.length

  return (
    <div className="flex h-full flex-col gap-3">
      {loading ? (
        <div className="rounded-card border border-border bg-surface-1 p-6"><SkeletonRows rows={6} /></div>
      ) : located.length === 0 ? (
        <EmptyState
          icon={MapPinIcon}
          title="Haritada gösterilecek alan yok"
          description="Konum (koordinat) tanımlı acil toplanma alanı bulunmuyor. Alan formundan harita konumu ekleyin."
        />
      ) : (
        <>
          <p className="flex-shrink-0 type-caption">
            {located.length} alan haritada gösteriliyor{missing > 0 ? ` · ${missing} alanın konumu tanımlı değil` : ''}. Bir pin'in üzerine gelip “Detayları Gör” ile alan detayına gidin.
          </p>
          <div className="min-h-0 flex-1 overflow-hidden rounded-card border border-border shadow-card">
            <EmergencyAreaMap points={located} onOpenDetail={setDetailId} />
          </div>
        </>
      )}

      {detailId && <EmergencyAreaDetailModal id={detailId} open={!!detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}
