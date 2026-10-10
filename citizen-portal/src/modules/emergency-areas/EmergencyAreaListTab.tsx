import { useState } from 'react'
import { ShieldAlertIcon, MapPinIcon, UsersIcon, AlertTriangleIcon } from 'lucide-react'
import { EmptyState, PressableCard, SkeletonRows, Button } from '@/design-system'
import { DistanceBadge } from '@/components/specialized/DistanceBadge'
import type { CitizenEmergencyArea } from '@/types/emergency-area.types'
import { EmergencyAreaDetailModal } from './EmergencyAreaDetailModal'

type Props = {
  areas: CitizenEmergencyArea[] | null
  loading: boolean
  error?: boolean
  onRetry?: () => void
}

export const EmergencyAreaListTab = ({ areas, loading, error, onRetry }: Props) => {
  const [selected, setSelected] = useState<CitizenEmergencyArea | null>(null)

  return (
    <div className="space-y-3 p-4">
      {loading ? (
        <SkeletonRows rows={4} />
      ) : error ? (
        <EmptyState
          icon={AlertTriangleIcon}
          title="Alanlar yüklenemedi"
          description="Bağlantı sorunu olabilir. Lütfen tekrar deneyin."
          action={onRetry ? <Button size="sm" variant="outline" onClick={onRetry}>Tekrar Dene</Button> : undefined}
        />
      ) : !areas || areas.length === 0 ? (
        <EmptyState icon={ShieldAlertIcon} title="Alan bulunamadı" description="Acil toplanma alanları burada görünecek." />
      ) : (
        areas.map((a) => (
          <PressableCard key={a.id} onClick={() => setSelected(a)} className="items-start">
            <div className="min-w-0 flex-1">
              <p className="type-body-strong">{a.name}</p>
              {a.neighborhood && (
                <p className="type-caption mt-0.5 inline-flex items-center gap-1">
                  <MapPinIcon className="h-3 w-3" /> {a.neighborhood}
                </p>
              )}
              {a.address && <p className="type-caption mt-0.5 line-clamp-1">{a.address}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="type-caption inline-flex items-center gap-1">
                  <UsersIcon className="h-3 w-3" /> {a.capacity.toLocaleString('tr-TR')} kişi
                </p>
                <DistanceBadge target={a.latitude != null && a.longitude != null ? { latitude: a.latitude, longitude: a.longitude } : null} />
              </div>
            </div>
          </PressableCard>
        ))
      )}
      <EmergencyAreaDetailModal area={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
