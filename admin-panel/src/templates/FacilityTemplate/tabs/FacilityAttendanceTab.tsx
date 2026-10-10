import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { RadioTowerIcon, CopyIcon } from 'lucide-react'
import {
  SectionToolbar, Card, Badge, EmptyState, IconButton,
} from '@/design-system'
import type { FacilityModuleConfig } from '../moduleConfig'
import type { FacilityModuleService } from '../types'
import type { FacilityDevice, DeviceDirection, DeviceScope } from '@/types/facility.types'

interface Props {
  config: FacilityModuleConfig
  service: FacilityModuleService
  facilityId: string
}

const DIRECTION: Record<DeviceDirection, { label: string; tone: 'success' | 'danger' | 'info' }> = {
  entry: { label: 'Giriş', tone: 'success' },
  exit: { label: 'Çıkış', tone: 'danger' },
  both: { label: 'Çift Yönlü', tone: 'info' },
}
const SCOPE: Record<DeviceScope, string> = {
  facility_general: 'Genel Giriş',
  area: 'Alan Cihazı',
  event: 'Etkinlik Salonu',
}

export const FacilityAttendanceTab = ({ service, facilityId }: Props) => {
  const [devices, setDevices] = useState<FacilityDevice[]>([])

  const loadDevices = useCallback(() => {
    service.devices.getList(facilityId).then(setDevices).catch(() => setDevices([]))
  }, [service, facilityId])

  useEffect(() => { loadDevices() }, [loadDevices])

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} kopyalandı.`))
  }

  return (
    <>
      <SectionToolbar
        icon={RadioTowerIcon}
        title="Tesis Cihazları & Kiosk QR'ları"
        subtitle="Turnike ve tablet kiosk cihazları. Seanslardan yoklama alabilir, cihaz eklemek için Ayarlar'ı kullanabilirsiniz."
      />
      {devices.length === 0 ? (
        <Card className="py-4">
          <EmptyState
            icon={RadioTowerIcon}
            title="Cihaz tanımlı değil"
            description="Bu tesise henüz turnike veya kiosk cihazı eklenmedi. Cihazlar Ayarlar'dan tanımlanır."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {devices.map((d) => (
            <Card key={d.id}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-field bg-primary-soft text-primary">
                      <RadioTowerIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="type-body-strong">{d.name}</p>
                      <p className="type-caption">{SCOPE[d.scope]}</p>
                    </div>
                  </div>
                  <Badge tone={DIRECTION[d.direction].tone}>{DIRECTION[d.direction].label}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-field bg-surface-1 px-3 py-2">
                  <span className="type-caption">Cihaz ID</span>
                  <div className="flex items-center gap-2">
                    <span className="type-body-strong font-mono">{d.deviceCode}</span>
                    <IconButton tone="default" title="Kopyala" onClick={() => copy(d.deviceCode, 'Cihaz ID')}>
                      <CopyIcon className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
