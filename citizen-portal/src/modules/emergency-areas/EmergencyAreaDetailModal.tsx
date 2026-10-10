import { PhoneIcon, UsersIcon, SquareIcon, NavigationIcon } from 'lucide-react'
import { Modal, Badge, Button } from '@/design-system'
import { DistanceBadge } from '@/components/specialized/DistanceBadge'
import type { CitizenEmergencyArea } from '@/types/emergency-area.types'

type Props = {
  area: CitizenEmergencyArea | null
  onClose: () => void
}

const openDirections = (area: CitizenEmergencyArea) => {
  if (area.latitude == null || area.longitude == null) return
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${area.latitude},${area.longitude}`, '_blank')
}

const EquipmentBadge = ({ label, available }: { label: string; available: boolean }) => (
  <Badge tone={available ? 'success' : 'neutral'}>{label}</Badge>
)

export const EmergencyAreaDetailModal = ({ area, onClose }: Props) => (
  <Modal open={!!area} onClose={onClose} title={area?.name ?? ''} subtitle={area?.neighborhood ?? undefined} width={440}>
    <div className="p-6">
      {area && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <UsersIcon className="h-4 w-4 text-foreground-muted" />
              <span className="type-body-strong">{area.capacity.toLocaleString('tr-TR')} kişi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <SquareIcon className="h-4 w-4 text-foreground-muted" />
              <span className="type-body-strong">{area.areaSizeM2} m²</span>
            </div>
            <DistanceBadge
              distanceOnly
              target={area.latitude != null && area.longitude != null ? { latitude: area.latitude, longitude: area.longitude } : null}
            />
          </div>

          {area.address && (
            <p className="type-caption">{area.address}</p>
          )}

          {area.emergencyPhone && (
            <div className="flex items-center gap-2">
              <PhoneIcon className="h-4 w-4 text-foreground-muted" />
              <span className="type-body">{area.emergencyPhone}</span>
            </div>
          )}

          <div>
            <p className="type-caption mb-2">Donatım</p>
            <div className="flex flex-wrap gap-2">
              <EquipmentBadge label="Tuvalet" available={area.toilet} />
              <EquipmentBadge label="Su" available={area.water} />
              <EquipmentBadge label="Elektrik" available={area.electricity} />
              <EquipmentBadge label="Jeneratör" available={area.generator} />
              <EquipmentBadge label="Isıtma" available={area.heating} />
              <EquipmentBadge label="Çadır Alanı" available={area.tentArea} />
            </div>
          </div>

          {area.latitude != null && area.longitude != null && (
            <Button
              variant="primary"
              className="w-full"
              iconLeft={<NavigationIcon className="h-4 w-4" />}
              onClick={() => openDirections(area)}
            >
              Konuma Git
            </Button>
          )}
        </div>
      )}
    </div>
  </Modal>
)
