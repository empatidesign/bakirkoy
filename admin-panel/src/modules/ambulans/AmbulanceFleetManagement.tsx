import { useState } from 'react'
import {
  AmbulanceIcon,
  UsersIcon,
  WrenchIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  PlusIcon,
  MapPinIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Button, Input, Badge, Modal, Field, Tabs,
  DataTable, type DataTableColumn,
} from '@/design-system'
import { AmbulanceVehicle, AmbulanceCrew } from './types'

interface Props {
  vehicles: AmbulanceVehicle[]
  crews: AmbulanceCrew[]
  onUpdateVehicleStatus: (vehicleId: string, status: any) => void
}

type FleetTab = 'VEHICLES' | 'CREWS' | 'MAINTENANCE'

const STATUS_META: Record<string, { label: string; tone: 'success' | 'warning' | 'info' | 'neutral' }> = {
  AVAILABLE: { label: 'Müsait', tone: 'success' },
  MAINTENANCE: { label: 'Bakımda', tone: 'warning' },
  ON_DUTY: { label: 'Görevde', tone: 'info' },
}

export const AmbulanceFleetManagement = ({
  vehicles,
  crews,
  onUpdateVehicleStatus
}: Props) => {
  const [activeTab, setActiveTab] = useState<FleetTab>('VEHICLES')
  const [newVehicleModal, setNewVehicleModal] = useState(false)

  return (
    <div className="space-y-4">
      <Tabs
        variant="compact"
        value={activeTab}
        onValueChange={key => setActiveTab(key as FleetTab)}
        tabs={[
          { key: 'VEHICLES', label: 'Ambulans Filosu', icon: AmbulanceIcon, count: vehicles.length },
          { key: 'CREWS', label: 'Ekipler ve Vardiyalar', icon: UsersIcon, count: crews.length },
          { key: 'MAINTENANCE', label: 'Bakım ve Muayene', icon: WrenchIcon },
        ]}
        action={
          <Button iconLeft={<PlusIcon className="h-4 w-4" />} onClick={() => setNewVehicleModal(true)}>
            Yeni Ambulans Ekle
          </Button>
        }
      />

      {activeTab === 'VEHICLES' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {vehicles.map(veh => {
            const crew = crews.find(c => c.ambulanceId === veh.id)
            const meta = STATUS_META[veh.status] ?? { label: veh.status, tone: 'neutral' as const }

            return (
              <div key={veh.id} className="space-y-4 rounded-lg border border-border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.08)] text-primary">
                      <AmbulanceIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-foreground">{veh.plate}</span>
                        <Badge tone={meta.tone} dot>{meta.label}</Badge>
                      </div>
                      <div className="type-muted mt-0.5">{veh.brandModel} ({veh.modelYear})</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="type-caption">Görev Skoru (GYP)</div>
                    <div className="font-semibold text-primary">{veh.workloadScoreToday} Puan</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
                  <Badge tone="neutral">Sedye: {veh.stretcherCapacity}</Badge>
                  <Badge tone="neutral">Tekerlekli Sandalye: {veh.wheelchairCapacity}</Badge>
                  {veh.hasCentralOxygen && <Badge tone="info">Merkezi O2</Badge>}
                  {veh.hasVentilator && <Badge tone="primary">Ventilatör</Badge>}
                  {veh.hasDefibrillator && <Badge tone="danger">Defibrilatör</Badge>}
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg bg-surface-1 p-3 text-center">
                  <div>
                    <div className="type-caption">Kilometre</div>
                    <div className="font-mono font-semibold text-foreground">{veh.odometerKm.toLocaleString('tr-TR')} km</div>
                  </div>
                  <div>
                    <div className="type-caption">Sonraki Bakım</div>
                    <div className="font-mono font-semibold text-foreground">{veh.nextMaintenanceKm.toLocaleString('tr-TR')} km</div>
                  </div>
                  <div>
                    <div className="type-caption">Muayene Tarihi</div>
                    <div className="font-mono font-semibold text-foreground">{veh.inspectionDate}</div>
                  </div>
                </div>

                <div className="type-muted space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1">
                      <MapPinIcon className="h-3.5 w-3.5" /> {veh.currentLocation.address}
                    </span>
                    <span className="font-mono">{veh.currentLocation.speedKmH} km/h</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>Görevli Ekip: <strong className="text-foreground">{crew ? `${crew.driver.fullName} (${crew.paramedic.title})` : 'Boş'}</strong></span>
                    <span>İletişim: {veh.phone}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end border-t border-border pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const next = veh.status === 'AVAILABLE' ? 'MAINTENANCE' : 'AVAILABLE'
                      onUpdateVehicleStatus(veh.id, next)
                    }}
                  >
                    <WrenchIcon className="h-4 w-4" />
                    {veh.status === 'MAINTENANCE' ? 'Bakımdan Çıkar' : 'Bakıma Al'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'CREWS' && (
        <DataTable<AmbulanceCrew>
          showRowNumbers
          rowKey={c => c.id}
          rows={crews}
          columns={[
            {
              key: 'plate', header: 'Ambulans Plaka',
              cell: crew => {
                const veh = vehicles.find(v => v.id === crew.ambulanceId)
                return <span className="font-mono font-semibold">{veh ? veh.plate : 'Atanmadı'}</span>
              },
            },
            { key: 'shiftHours', header: 'Vardiya Saatleri', cell: crew => <span className="font-mono">{crew.shiftHours}</span> },
            {
              key: 'driver', header: 'Şoför (Direksiyon Saati)',
              cell: crew => (
                <>
                  <div className="font-medium text-foreground">{crew.driver.fullName}</div>
                  <div className="type-caption">
                    Ehliyet: {crew.driver.licenseClass} • Bugün: {crew.driver.drivingHoursToday} saat (Max 9)
                  </div>
                </>
              ),
            },
            {
              key: 'paramedic', header: 'Sağlık Personeli',
              cell: crew => (
                <>
                  <div className="font-medium text-foreground">{crew.paramedic.fullName}</div>
                  <div className="type-caption">{crew.paramedic.title}</div>
                </>
              ),
            },
            { key: 'assistant', header: 'Yardımcı Personel', cell: crew => <>{crew.assistant ? crew.assistant.fullName : 'Yok'}</> },
            { key: 'status', header: 'Durum', cell: () => <Badge tone="success" dot>Aktif Görevde</Badge> },
          ] as DataTableColumn<AmbulanceCrew>[]}
        />
      )}

      {activeTab === 'MAINTENANCE' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-border bg-white p-4">
            <div className="type-title flex items-center gap-2">
              <AlertTriangleIcon className="h-4 w-4 text-[hsl(var(--warning))]" />
              Periyodik Bakımı Yaklaşan Araçlar
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-1 p-3">
              <span className="type-body"><strong>34 BKR 113:</strong> 58.210 km — 60.000 km ağır bakımına 1.790 km kaldı.</span>
              <Badge tone="warning">Kritik</Badge>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-1 p-3">
              <span className="type-body"><strong>34 BKR 115:</strong> Fen İşleri atölyesinde şanzıman ve klima bakımı sürüyor.</span>
              <Badge tone="info">Atölyede</Badge>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-white p-4">
            <div className="type-title flex items-center gap-2">
              <ShieldCheckIcon className="h-4 w-4 text-primary" />
              Tıbbi Donanım ve Cihaz Kalibrasyonları
            </div>
            {[
              ['Merkezi Oksijen Sistemleri Testi', 'Geçerli (Sonraki: 2027)'],
              ['Defibrilatör & Monitör Kalibrasyonu', 'Geçerli (Sonraki: 2027)'],
              ['Sedye Hidrolik & Emniyet Kilidi Kontrolü', 'Tamamlandı (Haftalık)'],
            ].map(([label, status]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-surface-1 p-3">
                <span className="type-body">{label}</span>
                <Badge tone="success">{status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={newVehicleModal}
        onClose={() => setNewVehicleModal(false)}
        title="Yeni Ambulans Tanımla"
        width={560}
        footer={
          <>
            <Button variant="outline" onClick={() => setNewVehicleModal(false)}>İptal</Button>
            <Button
              onClick={() => {
                toast.success('Yeni ambulans filo listesine eklendi.')
                setNewVehicleModal(false)
              }}
            >
              Ambulansı Kaydet
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Araç Plakası" required>
            <Input placeholder="Örn: 34 BKR 116" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Marka & Model">
              <Input placeholder="Örn: Mercedes Sprinter" />
            </Field>
            <Field label="Model Yılı">
              <Input type="number" defaultValue="2025" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Sedye Kapasitesi">
              <Input type="number" defaultValue="1" />
            </Field>
            <Field label="Tekerlekli Sandalye">
              <Input type="number" defaultValue="1" />
            </Field>
          </div>
          <Field label="GPS Cihazı IMEI">
            <Input placeholder="864209048123905" />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
