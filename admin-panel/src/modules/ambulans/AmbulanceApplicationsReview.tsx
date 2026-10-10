import { useMemo, useState } from 'react'
import {
  SearchIcon,
  FileTextIcon,
  AlertCircleIcon,
  MapPinIcon,
  PhoneIcon,
  HospitalIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import {
  Button, Input, Badge, Modal, Textarea, Select, FilterBar, FilterField, Field,
  DataTable, type DataTableColumn,
} from '@/design-system'
import { AmbulanceApplication } from './types'

interface Props {
  applications: AmbulanceApplication[]
  onApprove: (id: string, notes: string) => void
  onReject: (id: string, reason: string) => void
  onRequestDocument: (id: string, note: string) => void
}

export const AmbulanceApplicationsReview = ({
  applications,
  onApprove,
  onReject,
  onRequestDocument
}: Props) => {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selectedApp, setSelectedApp] = useState<AmbulanceApplication | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [missingDocText, setMissingDocText] = useState('')
  const [activeModalAction, setActiveModalAction] = useState<'NONE' | 'APPROVE' | 'REJECT' | 'MISSING_DOC'>('NONE')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  const filtered = applications.filter(app => {
    const matchesSearch =
      app.patient.fullName.toLowerCase().includes(search.toLowerCase()) ||
      app.patient.tckn.includes(search) ||
      app.applicationNo.toLowerCase().includes(search.toLowerCase()) ||
      app.destination.hospitalName.toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PENDING' && (app.status === 'YONETICI_DEGERLENDIRMESINDE' || app.status === 'BASVURU_ALINDI' || app.status === 'ON_INCELEMEDE')) ||
      (statusFilter === 'APPROVED' && (app.status === 'ONAYLANDI' || app.status === 'OPERASYON_PLANLANDI' || app.status === 'YOLA_CIKTI')) ||
      (statusFilter === 'MISSING' && app.status === 'EKSIK_BELGE') ||
      (statusFilter === 'REJECTED' && app.status === 'REDDEDILDI')

    return matchesSearch && matchesStatus
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit))
  const pagedApplications = useMemo(
    () => filtered.slice((page - 1) * limit, page * limit),
    [filtered, page, limit]
  )

  const statusTone = (s: string) =>
    s === 'ONAYLANDI' || s === 'OPERASYON_PLANLANDI' || s === 'YOLA_CIKTI'
      ? 'success'
      : s === 'EKSIK_BELGE'
        ? 'warning'
        : s === 'REDDEDILDI'
          ? 'danger'
          : 'info'

  const docTone = (s: string) => (s === 'APPROVED' ? 'success' : s === 'REJECTED' ? 'danger' : 'warning')

  const countBy = (f: string) =>
    applications.filter(app =>
      (f === 'PENDING' && (app.status === 'YONETICI_DEGERLENDIRMESINDE' || app.status === 'BASVURU_ALINDI' || app.status === 'ON_INCELEMEDE')) ||
      (f === 'APPROVED' && (app.status === 'ONAYLANDI' || app.status === 'OPERASYON_PLANLANDI' || app.status === 'YOLA_CIKTI')) ||
      (f === 'MISSING' && app.status === 'EKSIK_BELGE') ||
      (f === 'REJECTED' && app.status === 'REDDEDILDI')
    ).length

  const columns: DataTableColumn<AmbulanceApplication>[] = [
    {
      key: 'applicationNo', header: 'Başvuru No',
      cell: app => (
        <>
          <div className="font-mono font-semibold text-foreground">{app.applicationNo}</div>
          <div className="type-caption mt-0.5">{app.createdAt}</div>
        </>
      ),
    },
    {
      key: 'mernis', header: 'MERNİS', align: 'center',
      cell: app => (
        app.patient.mernisVerified
          ? <Badge tone="success" dot><ShieldCheckIcon className="h-3 w-3" /> Doğrulandı</Badge>
          : <Badge tone="warning" dot>Bekliyor</Badge>
      ),
    },
    {
      key: 'patient', header: 'Hasta Bilgisi',
      cell: app => (
        <>
          <div className="font-bold text-foreground text-sm">{app.patient.fullName}</div>
          <div className="text-foreground-muted text-xs font-mono">
            TC: {app.patient.tckn} • {app.patient.age} Yaş ({app.patient.gender})
          </div>
          <div className="text-xs text-foreground-muted flex items-center gap-1 mt-0.5">
            <MapPinIcon className="w-3 h-3 text-rose-500" /> {app.pickupAddress.neighborhood}
          </div>
        </>
      ),
    },
    {
      key: 'applicant', header: 'Yakınlık & İrtibat',
      cell: app => (
        <>
          <div className="font-semibold text-foreground">{app.applicant.fullName}</div>
          <div className="text-xs text-blue-600 font-bold">
            Yakınlık: {app.applicant.relationship}
          </div>
          <div className="text-xs text-foreground-muted flex items-center gap-1 mt-0.5">
            <PhoneIcon className="w-3 h-3" /> {app.applicant.phone}
          </div>
        </>
      ),
    },
    {
      key: 'health', header: 'Sağlık & Tıbbi İhtiyaçlar',
      cell: app => (
        <div className="max-w-xs">
          <div className="font-semibold text-foreground truncate">{app.healthProfile.diagnosis}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge tone="info">{app.healthProfile.mobilityStatus}</Badge>
            {app.healthProfile.needsOxygen && <Badge tone="danger">O2: {app.healthProfile.oxygenFlowLpm} L/dk</Badge>}
            {app.healthProfile.hasPeg && <Badge tone="warning">PEG</Badge>}
          </div>
        </div>
      ),
    },
    {
      key: 'destination', header: 'Hedef Hastane & Randevu',
      cell: app => (
        <>
          <div className="font-bold text-foreground">{app.destination.hospitalName}</div>
          <div className="text-xs text-foreground-muted">{app.destination.department}</div>
          <div className="text-xs font-mono text-emerald-600 font-bold mt-1">
            {app.destination.appointmentDate} • {app.destination.appointmentTime}
          </div>
          <div className="text-xs text-blue-600 font-medium">
            Önerilen Çıkış: {app.destination.calculatedPickupTime}
          </div>
        </>
      ),
    },
    {
      key: 'documents', header: 'Evrak Durumu',
      cell: app => (
        <>
          <div className="text-xs font-bold text-foreground">{app.documents.length} Belge</div>
          <div className="text-xs text-foreground-muted">
            {app.documents.filter(d => d.status === 'APPROVED').length} Onaylı / {app.documents.filter(d => d.status === 'REJECTED').length} Hatalı
          </div>
        </>
      ),
    },
    {
      key: 'status', header: 'Statü',
      cell: app => <Badge tone={statusTone(app.status)} dot>{app.status}</Badge>,
    },
  ]

  return (
    <div className="space-y-4">
      <FilterBar
        columns={1}
        hasActiveFilters={!!search || statusFilter !== 'ALL'}
        onClear={() => { setSearch(''); setStatusFilter('ALL') }}
        search={
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hasta adı, TCKN, Başvuru No veya hastane ara..."
            iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
          />
        }
      >
        <FilterField label="Durum">
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">Tümü ({applications.length})</option>
            <option value="PENDING">İnceleme Bekleyenler ({countBy('PENDING')})</option>
            <option value="MISSING">Eksik Belgeli ({countBy('MISSING')})</option>
            <option value="APPROVED">Onaylananlar ({countBy('APPROVED')})</option>
            <option value="REJECTED">Reddedilenler ({countBy('REJECTED')})</option>
          </Select>
        </FilterField>
      </FilterBar>

      <DataTable<AmbulanceApplication>
        showRowNumbers
        columns={columns}
        rows={pagedApplications}
        rowKey={app => app.id}
        page={page}
        limit={limit}
        total={filtered.length}
        totalPages={totalPages}
        onPageChange={setPage}
        onLimitChange={n => { setLimit(n); setPage(1) }}
        rowActions={app => (
          <Button variant="outline" size="sm" onClick={() => setSelectedApp(app)}>
            İncele &amp; Değerlendir
          </Button>
        )}
      />

      {selectedApp && (
        <Modal
          open={!!selectedApp}
          onClose={() => {
            setSelectedApp(null)
            setActiveModalAction('NONE')
          }}
          title={`Hasta Nakil Başvurusu: ${selectedApp.applicationNo}`}
          width={820}
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-surface-1 border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">{selectedApp.patient.fullName}</h3>
                  <Badge tone="success"><ShieldCheckIcon className="h-3 w-3" /> MERNİS Doğrulandı</Badge>
                </div>
                <p className="text-xs text-foreground-muted mt-0.5">
                  TCKN: {selectedApp.patient.tckn} • D.Tarihi: {selectedApp.patient.birthDate} ({selectedApp.patient.age} Yaş) • Cinsiyet: {selectedApp.patient.gender}
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs text-foreground-muted">Başvuru Sahibi</div>
                <div className="font-bold text-foreground">{selectedApp.applicant.fullName} ({selectedApp.applicant.relationship})</div>
                <div className="text-xs text-foreground-muted">{selectedApp.applicant.phone}</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
              <h4 className="text-sm font-bold text-foreground-strong flex items-center gap-1.5">
                <AlertCircleIcon className="w-4 h-4 text-danger" />
                Hastalık ve Sağlık İhtiyaçları
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-2.5 rounded-xl bg-surface-1">
                  <div className="text-xs text-foreground-muted">Teşhis / Hastalık</div>
                  <div className="font-bold text-foreground mt-0.5">{selectedApp.healthProfile.diagnosis}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-1">
                  <div className="text-xs text-foreground-muted">Nakil Gerekçesi</div>
                  <div className="font-bold text-foreground mt-0.5">{selectedApp.healthProfile.transferReason}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                <div className="p-2 rounded-xl bg-surface-1">
                  <div className="text-xs text-foreground-muted">Mobilite</div>
                  <div className="font-bold text-foreground mt-0.5">{selectedApp.healthProfile.mobilityStatus}</div>
                </div>
                <div className="p-2 rounded-xl bg-surface-1">
                  <div className="text-xs text-foreground-muted">Oksijen İhtiyacı</div>
                  <div className={`font-bold mt-0.5 ${selectedApp.healthProfile.needsOxygen ? 'text-rose-600' : 'text-foreground'}`}>
                    {selectedApp.healthProfile.needsOxygen ? `${selectedApp.healthProfile.oxygenFlowLpm} L/dk (Portatif)` : 'Gerekmiyor'}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-surface-1">
                  <div className="text-xs text-foreground-muted">Kilo</div>
                  <div className="font-bold text-foreground mt-0.5">{selectedApp.healthProfile.patientWeightKg} kg</div>
                </div>
                <div className="p-2 rounded-xl bg-surface-1">
                  <div className="text-xs text-foreground-muted">Sağlık Personeli Eşliği</div>
                  <div className="font-bold text-foreground mt-0.5">
                    {selectedApp.healthProfile.medicalStaffRequired ? 'Zorunlu (ATT/Paramedik)' : 'Gerekmiyor'}
                  </div>
                </div>
              </div>

              {selectedApp.healthProfile.specialEquipmentNotes && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs">
                  <strong>Özel Ekipman / Donanım Notu:</strong> {selectedApp.healthProfile.specialEquipmentNotes}
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
              <h4 className="text-sm font-bold text-foreground-strong">
                Alınacak Adres ve Bina Erişimi
              </h4>
              <p className="text-foreground text-xs font-medium">{selectedApp.pickupAddress.fullAddress}</p>
              
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2 rounded-xl bg-surface-1">
                  <div className="text-xs text-foreground-muted">Kat / Daire</div>
                  <div className="font-bold text-foreground">{selectedApp.pickupAddress.floorInfo}</div>
                </div>
                <div className="p-2 rounded-xl bg-surface-1">
                  <div className="text-xs text-foreground-muted">Asansör</div>
                  <div className="font-bold text-foreground">
                    {selectedApp.pickupAddress.buildingAccess.hasElevator ? 'Var (Sedye Uyumlu)' : 'Yok'}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-surface-1">
                  <div className="text-xs text-foreground-muted">Sokak / Yanaşma</div>
                  <div className="font-bold text-foreground">
                    {selectedApp.pickupAddress.buildingAccess.ambulanceStreetAccessible ? 'Ambulans Yanaşabilir' : 'Dar Sokak'}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-info-soft border border-[hsl(var(--info)/0.2)] space-y-2">
              <h4 className="text-sm font-bold text-info flex items-center gap-1.5">
                <HospitalIcon className="w-4 h-4 text-info" />
                Hedef Hastane ve Akıllı Randevu Zaman Hesabı
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-foreground-muted">Kurum:</span> <strong>{selectedApp.destination.hospitalName}</strong>
                </div>
                <div>
                  <span className="text-foreground-muted">Klinik & Hekim:</span> <strong>{selectedApp.destination.department} ({selectedApp.destination.doctorName})</strong>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-background border border-blue-500/30 grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-xs text-foreground-muted">Hastane Saati</div>
                  <div className="font-mono font-bold text-foreground">{selectedApp.destination.appointmentTime}</div>
                </div>
                <div>
                  <div className="text-xs text-foreground-muted">Tahmini Yol</div>
                  <div className="font-mono font-bold text-foreground">{selectedApp.destination.estimatedTravelMinutes} dk</div>
                </div>
                <div>
                  <div className="text-xs text-foreground-muted">Araca Alma & Güvenlik</div>
                  <div className="font-mono font-bold text-foreground">25 dk</div>
                </div>
                <div>
                  <div className="text-xs text-blue-600 font-bold">Önerilen Çıkış</div>
                  <div className="font-mono font-bold text-blue-600">{selectedApp.destination.calculatedPickupTime}</div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
              <h4 className="text-sm font-bold text-foreground-strong flex items-center justify-between">
                <span>Yüklenen Belgeler ({selectedApp.documents.length})</span>
              </h4>

              <div className="space-y-1.5">
                {selectedApp.documents.map(doc => (
                  <div key={doc.id} className="p-2.5 rounded-xl bg-surface-1 border border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileTextIcon className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="font-semibold text-foreground">{doc.name}</div>
                        <div className="text-xs text-foreground-muted">{doc.type} • {doc.fileSize}</div>
                      </div>
                    </div>
                    <Badge tone={docTone(doc.status)}>{doc.status}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 space-y-3 border-t border-border">
              {activeModalAction === 'NONE' && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button variant="outline" onClick={() => setActiveModalAction('MISSING_DOC')}>
                    Eksik Belge İste
                  </Button>
                  <Button variant="danger" onClick={() => setActiveModalAction('REJECT')}>
                    Reddet
                  </Button>
                  <Button variant="success" onClick={() => setActiveModalAction('APPROVE')}>
                    Başvuruyu Onayla
                  </Button>
                </div>
              )}

              {activeModalAction === 'APPROVE' && (
                <div className="space-y-3">
                  <Field label="Başvuru Onay Notu">
                    <Textarea
                      value={reviewNote}
                      onChange={e => setReviewNote(e.target.value)}
                      placeholder="Onay notu (örn: Sedyeli nakil onaylandı, AMB-01 planlandı)..."
                    />
                  </Field>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setActiveModalAction('NONE')}>İptal</Button>
                    <Button variant="success"
                      onClick={() => {
                        onApprove(selectedApp.id, reviewNote)
                        setSelectedApp(null)
                        setActiveModalAction('NONE')
                      }}
                    >
                      Onayı Kesinleştir
                    </Button>
                  </div>
                </div>
              )}

              {activeModalAction === 'MISSING_DOC' && (
                <div className="space-y-3">
                  <Field label="Eksik Belge Talebi" hint="Vatandaşa SMS/Push olarak iletilir.">
                    <Textarea
                      value={missingDocText}
                      onChange={e => setMissingDocText(e.target.value)}
                      placeholder="Örn: MHRS randevu fişini veya heyet raporunu yükleyiniz..."
                    />
                  </Field>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setActiveModalAction('NONE')}>İptal</Button>
                    <Button
                      onClick={() => {
                        onRequestDocument(selectedApp.id, missingDocText)
                        setSelectedApp(null)
                        setActiveModalAction('NONE')
                      }}
                    >
                      Eksik Evrak Talebini Gönder
                    </Button>
                  </div>
                </div>
              )}

              {activeModalAction === 'REJECT' && (
                <div className="space-y-3">
                  <Field label="Ret Gerekçesi" required>
                    <Textarea
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      placeholder="Örn: Hasta nakil kriterlerine uymamaktadır, ayakta hasta..."
                    />
                  </Field>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setActiveModalAction('NONE')}>İptal</Button>
                    <Button variant="danger"
                      onClick={() => {
                        onReject(selectedApp.id, rejectionReason)
                        setSelectedApp(null)
                        setActiveModalAction('NONE')
                      }}
                    >
                      Başvuruyu Reddet
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
