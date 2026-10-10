import { useEffect, useState, useCallback } from 'react'
import { MapPinIcon } from 'lucide-react'
import { EmptyState, SkeletonRows } from '@/design-system'
import { FacilityMap } from '@/components/specialized/FacilityMap'
import { FacilityDetailModal } from './FacilityDetailModal'
import serviceFacilityService from '@/services/serviceFacility.service'
import type { FacilityMapPoint } from '@/types/serviceFacility.types'

export const FacilityMapView = () => {
  const cachedPoints = serviceFacilityService.getCachedMapPoints()
  const [points, setPoints] = useState<FacilityMapPoint[]>(cachedPoints ?? [])
  const [loading, setLoading] = useState(!cachedPoints)
  const [detailId, setDetailId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const cached = serviceFacilityService.getCachedMapPoints()
    if (!cached) setLoading(true)
    try {
      const next = await serviceFacilityService.getMapPoints(!!cached)
      setPoints(next)
    }
    catch {
      if (!cached) setPoints([])
    }
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
          title="Haritada gösterilecek tesis yok"
          description="Konum (koordinat) tanımlı tesis bulunmuyor. Tesis formunun “Konum” sekmesinden harita konumu ekleyin."
        />
      ) : (
        <>
          <p className="flex-shrink-0 type-caption">
            {located.length} tesis haritada gösteriliyor{missing > 0 ? ` · ${missing} tesisin konumu tanımlı değil` : ''}. Bir pin'in üzerine gelip “Detayları Gör” ile tesis detayına gidin.
          </p>
          <div className="min-h-0 flex-1 overflow-hidden rounded-card border border-border shadow-card">
            <FacilityMap points={located} onOpenDetail={setDetailId} />
          </div>
        </>
      )}

      {detailId && <FacilityDetailModal id={detailId} open={!!detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}
