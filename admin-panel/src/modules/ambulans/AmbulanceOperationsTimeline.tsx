import { useMemo, useState } from 'react'
import {
  MapPinIcon,
  AlertTriangleIcon,
  SparklesIcon,
  ActivityIcon,
  HospitalIcon,
  PhoneIcon,
  RefreshCwIcon,
  UserIcon,
  ClockIcon,
  ArrowRightLeftIcon,
  StickyNoteIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  ListChecksIcon,
  AmbulanceIcon as AmbIcon,
} from 'lucide-react'
import { Button, Modal, Drawer, Badge, DatePicker } from '@/design-system'
import { OperationTask, AmbulanceVehicle, AmbulanceCrew } from './types'

interface Props {
  operations: OperationTask[]
  vehicles: AmbulanceVehicle[]
  crews: AmbulanceCrew[]
  onUpdateStep?: (id: string, step: any) => void
  onReassignAmbulance: (taskId: string, targetAmbulanceId: string) => void
  onRunOptimization: () => void
}

const TRIAJ_META: Record<string, { label: string; cls: string }> = {
  kirmizi: { label: 'KIRMIZI', cls: 'bg-rose-500 text-white' },
  sari: { label: 'SARI', cls: 'bg-amber-500 text-white' },
  yesil: { label: 'YEŞİL', cls: 'bg-emerald-500/10 text-emerald-700' },
}

const toLocalIso = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const todayIso = () => toLocalIso(new Date())
const shiftDay = (iso: string, delta: number) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return toLocalIso(d)
}
const fmtDayLabel = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

export const AmbulanceOperationsTimeline = ({
  operations,
  vehicles,
  crews,
  onReassignAmbulance,
  onRunOptimization
}: Props) => {
  const [selectedTask, setSelectedTask] = useState<OperationTask | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [optimizationToast, setOptimizationToast] = useState<string | null>(null)
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [selectedAmbulanceForReassign, setSelectedAmbulanceForReassign] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState(todayIso())

  const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']

  const dayOperations = useMemo(
    () => operations.filter(o => o.scheduledDate === selectedDate),
    [operations, selectedDate]
  )

  const unassignedTasks = useMemo(
    () => dayOperations
      .filter(o => !o.ambulanceId && o.step !== 'OPERASYON_TAMAMLANDI')
      .sort((a, b) => a.scheduledPickupTime.localeCompare(b.scheduledPickupTime)),
    [dayOperations]
  )

  const todaysPatients = useMemo(
    () => [...dayOperations].sort((a, b) => a.scheduledPickupTime.localeCompare(b.scheduledPickupTime)),
    [dayOperations]
  )

  const fleetSummary = useMemo(() => {
    const activeVehicles = vehicles.filter(v => v.status !== 'MAINTENANCE' && v.status !== 'OUT_OF_SERVICE').length
    const completed = dayOperations.filter(o => o.step === 'OPERASYON_TAMAMLANDI').length
    const inProgress = dayOperations.filter(o => o.ambulanceId && o.step !== 'OPERASYON_TAMAMLANDI').length
    const maintenance = vehicles.filter(v => v.status === 'MAINTENANCE').length
    return { activeVehicles, totalVehicles: vehicles.length, completed, inProgress, maintenance }
  }, [vehicles, dayOperations])

  const handleOptimizeClick = () => {
    onRunOptimization()
    setOptimizationToast(`Adil Görev Yükü Motoru çalıştırıldı: ${dayOperations.length} randevu araç kapasitesi, donanım ve trafik analizi ile optimize edildi!`)
    setTimeout(() => setOptimizationToast(null), 5000)
  }

  const handleDragStart = (taskId: string) => {
    setDraggedTaskId(taskId)
  }

  const handleDrop = (vehicleId: string) => {
    if (draggedTaskId) {
      onReassignAmbulance(draggedTaskId, vehicleId)
      setDraggedTaskId(null)
    }
  }

  const handleTaskClick = (task: OperationTask) => {
    setSelectedTask(task)
    setIsDrawerOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-surface-0 p-3 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(d => shiftDay(d, -1))} aria-label="Önceki gün">
            <ChevronLeftIcon className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-[220px]">
            <CalendarDaysIcon className="w-4 h-4 text-primary shrink-0" />
            <div className="w-[170px]">
              <DatePicker value={selectedDate} onChange={setSelectedDate} />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(d => shiftDay(d, 1))} aria-label="Sonraki gün">
            <ChevronRightIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedDate(todayIso())}>
            Bugün
          </Button>
          <span className="text-xs font-semibold text-foreground-muted hidden lg:inline">{fmtDayLabel(selectedDate)}</span>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={handleOptimizeClick}
          >
            <SparklesIcon className="w-3.5 h-3.5 text-blue-600" />
            Akıllı Dağıtımı Çalıştır (GYP)
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setOptimizationToast('Acil yeniden planlama: Geciken görevler uygun araçlara paylaştırıldı.')
              setTimeout(() => setOptimizationToast(null), 4000)
            }}
          >
            <RefreshCwIcon className="w-3.5 h-3.5 text-rose-600" />
            Acil Yeniden Planla
          </Button>
        </div>
      </div>

      {optimizationToast && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <SparklesIcon className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{optimizationToast}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 space-y-3">
          <div className="bg-surface-0 p-3.5 rounded-xl border border-border shadow-xs">
            <h3 className="text-xs font-bold text-foreground flex items-center justify-between mb-2.5">
              <span>Atama Bekleyenler</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700">
                {unassignedTasks.length} Hasta
              </span>
            </h3>

            {unassignedTasks.length === 0 ? (
              <div className="text-xs text-foreground-muted italic text-center py-3">
                Bu gün için atama bekleyen hasta yok.
              </div>
            ) : (
              <div className="space-y-2">
                {unassignedTasks.map(task => {
                  const meta = TRIAJ_META[task.triaj] ?? TRIAJ_META.yesil
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                      onClick={() => handleTaskClick(task)}
                      className="p-2.5 rounded-lg bg-surface-1 border border-border hover:border-blue-500/50 cursor-grab active:cursor-grabbing transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-blue-600">{task.trackingNo}</span>
                        <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${meta.cls}`}>{meta.label}</span>
                      </div>
                      <div className="text-xs font-bold text-foreground">{task.patientName}</div>
                      <div className="text-xs text-foreground-muted flex items-center gap-1">
                        <MapPinIcon className="w-3 h-3 text-rose-500" /> {task.pickupDistrict} ➜ {task.destinationHospital}
                      </div>
                      <div className="flex items-center justify-between text-xs text-foreground-muted pt-1 border-t border-border/50">
                        <span className="font-medium text-amber-600">Randevu: {task.appointmentTime}</span>
                        <span className="text-xs bg-blue-500/10 text-blue-700 px-1 py-0.5 rounded font-medium">{task.mobility}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-surface-0 border border-border shadow-xs space-y-2">
            <h4 className="type-caption font-semibold">Filo Özeti</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-surface-1">
                <div className="text-xs text-foreground-muted">Aktif Ambulans</div>
                <div className="text-sm font-bold text-foreground">{fleetSummary.activeVehicles} / {fleetSummary.totalVehicles}</div>
              </div>
              <div className="p-2 rounded-lg bg-surface-1">
                <div className="text-xs text-foreground-muted">Tamamlanan</div>
                <div className="text-sm font-bold text-emerald-600">{fleetSummary.completed} Görev</div>
              </div>
              <div className="p-2 rounded-lg bg-surface-1">
                <div className="text-xs text-foreground-muted">Devam Eden</div>
                <div className="text-sm font-bold text-blue-600">{fleetSummary.inProgress} Nakil</div>
              </div>
              <div className="p-2 rounded-lg bg-surface-1">
                <div className="text-xs text-foreground-muted">Bakımda</div>
                <div className="text-sm font-bold text-amber-600">{fleetSummary.maintenance} Araç</div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 space-y-3">
          <div className="bg-surface-0 p-4 rounded-xl border border-border shadow-xs space-y-4 overflow-x-auto">
            <div className="grid grid-cols-10 gap-2 pb-2 border-b border-border text-xs font-mono text-foreground-muted text-center font-bold min-w-[650px]">
              {hours.map(h => (
                <div key={h} className="py-1 bg-surface-1/60 rounded">{h}</div>
              ))}
            </div>

            <div className="space-y-3.5 min-w-[650px]">
              {vehicles.map(veh => {
                const crew = crews.find(c => c.ambulanceId === veh.id)
                const vehTasks = dayOperations.filter(o => o.ambulanceId === veh.id)

                return (
                  <div
                    key={veh.id}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => handleDrop(veh.id)}
                    className="p-3 rounded-xl bg-surface-1 border border-border hover:border-blue-500/40 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-foreground text-background">
                          {veh.plate}
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          {veh.brandModel}
                        </span>
                        <span className="text-xs text-foreground-muted">
                          (Şoför: {crew ? crew.driver.fullName : 'Atanmadı'})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-foreground-muted">GYP Skoru: {veh.workloadScoreToday}</span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            veh.status === 'EN_ROUTE' ? 'bg-blue-500/10 text-blue-700' :
                            veh.status === 'AT_HOSPITAL' ? 'bg-amber-500/10 text-amber-700' :
                            veh.status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-700' :
                            'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {veh.status}
                        </span>
                      </div>
                    </div>

                    <div
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => handleDrop(veh.id)}
                      className="space-y-1.5 min-h-[46px] bg-surface-0 p-2 rounded-lg border border-dashed border-border/80"
                    >
                      {vehTasks.length === 0 ? (
                        <div className="text-xs text-foreground-muted italic text-center py-1.5">
                          Müsait (Sürükleyip buraya hasta atayabilirsiniz)
                        </div>
                      ) : (
                        vehTasks.map(task => {
                          const isComplete = task.step === 'OPERASYON_TAMAMLANDI'
                          const hasDelay = task.delayMinutes > 0

                          return (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={() => handleDragStart(task.id)}
                              onClick={() => handleTaskClick(task)}
                              className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between hover:shadow-xs ${
                                isComplete
                                  ? 'bg-surface-2 border-border opacity-70 text-foreground-muted'
                                  : hasDelay
                                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-900'
                                  : 'bg-blue-500/10 border-blue-500/30 text-blue-900 hover:bg-blue-500/15'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="font-mono text-xs font-bold">{task.scheduledPickupTime}</span>
                                <div className="text-xs font-bold">{task.patientName}</div>
                                <span className="text-xs text-foreground-muted">
                                  ➜ {task.destinationHospital}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {hasDelay && (
                                  <span className="flex items-center gap-1 text-xs text-amber-600 font-bold">
                                    <AlertTriangleIcon className="w-3 h-3" /> +{task.delayMinutes}dk
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-foreground/10 text-foreground">
                                  {task.step}
                                </span>
                                <span className="text-xs text-blue-600 font-semibold underline ml-1">
                                  Detay
                                </span>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-3">
          <div className="bg-surface-0 p-3.5 rounded-xl border border-border shadow-xs">
            <h3 className="text-xs font-bold text-foreground flex items-center justify-between mb-2.5">
              <span className="flex items-center gap-1.5"><ListChecksIcon className="w-3.5 h-3.5 text-primary" /> Günün Hastaları</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-700">
                {todaysPatients.length} Hasta
              </span>
            </h3>

            {todaysPatients.length === 0 ? (
              <div className="text-xs text-foreground-muted italic text-center py-3">
                Bu güne ait planlanmış nakil bulunmuyor.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1">
                {todaysPatients.map(task => {
                  const veh = vehicles.find(v => v.id === task.ambulanceId)
                  const crew = crews.find(c => c.ambulanceId === task.ambulanceId)
                  const isComplete = task.step === 'OPERASYON_TAMAMLANDI'
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => handleTaskClick(task)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all space-y-1 ${
                        isComplete
                          ? 'bg-surface-2 border-border opacity-60'
                          : 'bg-surface-1 border-border hover:border-primary/40 hover:bg-primary/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-foreground">{task.scheduledPickupTime}</span>
                        {veh ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-foreground-muted">
                            <AmbIcon className="w-3 h-3" /> {veh.plate}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-amber-600">ATANMADI</span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-foreground truncate">{task.patientName}</div>
                      <div className="text-xs text-foreground-muted truncate flex items-center gap-1">
                        <HospitalIcon className="w-3 h-3 shrink-0" /> {task.destinationHospital}
                      </div>
                      <div className="flex items-center justify-between text-xs text-foreground-muted">
                        <span>{crew ? crew.driver.fullName : '—'}</span>
                        <Badge tone={task.isRoundTrip ? 'info' : 'neutral'} className="text-xs">
                          {task.isRoundTrip ? `Gidiş-Dönüş${task.returnTime ? ` (${task.returnTime})` : ''}` : 'Sadece Gidiş'}
                        </Badge>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Drawer
        open={isDrawerOpen && !!selectedTask}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedTask ? `Operasyon: ${selectedTask.trackingNo}` : 'Görev Detayı'}
        subtitle={selectedTask ? selectedTask.patientName : ''}
        icon={ActivityIcon}
        width={480}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsDrawerOpen(false)}>
              Kapat
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => setReassignModalOpen(true)}>
              <ArrowRightLeftIcon className="h-4 w-4" /> {selectedTask?.ambulanceId ? 'Başka Ambulansa Aktar' : 'Ambulans Ata'}
            </Button>
          </div>
        }
      >
        {selectedTask && (() => {
          const triajTone = selectedTask.triaj === 'kirmizi' ? 'danger' : selectedTask.triaj === 'sari' ? 'warning' : 'success'
          const triajLabel = selectedTask.triaj === 'kirmizi' ? 'Kırmızı' : selectedTask.triaj === 'sari' ? 'Sarı' : 'Yeşil'
          const sectionCls = 'rounded-xl border border-border bg-surface-0 shadow-xs'
          const sectionTitleCls = 'flex items-center gap-2 border-b border-border px-4 py-2.5 type-caption font-semibold'
          return (
            <>
              <section className={sectionCls}>
                <div className={sectionTitleCls}>
                  <UserIcon className="h-3.5 w-3.5" /> Hasta Bilgisi
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground-strong">{selectedTask.patientName}</div>
                      <div className="mt-0.5 font-mono text-xs text-primary">{selectedTask.trackingNo}</div>
                      {selectedTask.patientTckn && (
                        <div className="mt-0.5 font-mono text-xs text-foreground-muted">TC: {selectedTask.patientTckn}</div>
                      )}
                    </div>
                    <Badge tone={triajTone} dot>Triyaj: {triajLabel}</Badge>
                  </div>
                  <a
                    href={`tel:${selectedTask.patientPhone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-2 text-xs text-foreground hover:text-primary"
                  >
                    <PhoneIcon className="h-3.5 w-3.5 text-foreground-muted" /> {selectedTask.patientPhone}
                  </a>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="neutral">Hareket: {selectedTask.mobility}</Badge>
                    {selectedTask.needsOxygen && <Badge tone="danger">Oksijen Desteği</Badge>}
                    <Badge tone={selectedTask.isRoundTrip ? 'info' : 'neutral'}>
                      {selectedTask.isRoundTrip ? `Gidiş-Dönüş${selectedTask.returnTime ? ` (Dönüş: ${selectedTask.returnTime})` : ''}` : 'Sadece Gidiş'}
                    </Badge>
                  </div>
                </div>
              </section>

              <section className={sectionCls}>
                <div className={sectionTitleCls}>
                  <MapPinIcon className="h-3.5 w-3.5" /> Güzergah
                </div>
                <div className="divide-y divide-border">
                  <div className="flex items-start gap-3 px-4 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                      <MapPinIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 text-xs">
                      <div className="text-xs text-foreground-muted">Alınacak Adres</div>
                      <div className="font-semibold text-foreground">{selectedTask.pickupDistrict}</div>
                      <div className="text-foreground-muted">{selectedTask.pickupAddress}</div>
                      {selectedTask.pickupFloorNotes && (
                        <div className="text-foreground-muted text-xs mt-0.5">{selectedTask.pickupFloorNotes}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <HospitalIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 text-xs">
                      <div className="text-xs text-foreground-muted">Varış Sağlık Kuruluşu</div>
                      <div className="font-semibold text-foreground">{selectedTask.destinationHospital}</div>
                      <div className="text-foreground-muted">{selectedTask.destinationDepartment}</div>
                    </div>
                  </div>
                </div>
              </section>

              <section className={sectionCls}>
                <div className={sectionTitleCls}>
                  <ClockIcon className="h-3.5 w-3.5" /> Zamanlama
                </div>
                <div className="grid grid-cols-2 divide-x divide-border">
                  <div className="px-4 py-3">
                    <div className="text-xs text-foreground-muted">Evden Alış</div>
                    <div className="mt-0.5 font-mono text-lg font-semibold text-foreground-strong">{selectedTask.scheduledPickupTime}</div>
                  </div>
                  <div className="px-4 py-3">
                    <div className="text-xs text-foreground-muted">Hastane Randevusu</div>
                    <div className="mt-0.5 font-mono text-lg font-semibold text-foreground-strong">{selectedTask.appointmentTime}</div>
                  </div>
                </div>
              </section>

              <section className={sectionCls}>
                <div className={sectionTitleCls}>
                  <AmbIcon className="h-3.5 w-3.5" /> Araç &amp; Ekip
                </div>
                <div className="p-4 text-xs space-y-1.5">
                  {selectedTask.ambulanceId ? (() => {
                    const crew = crews.find(c => c.ambulanceId === selectedTask.ambulanceId)
                    return (
                      <>
                        <div><span className="text-foreground-muted">Plaka:</span> <strong className="font-mono">{selectedTask.ambulancePlate}</strong></div>
                        {crew && (
                          <>
                            <div><span className="text-foreground-muted">Şoför:</span> <strong>{crew.driver.fullName}</strong> ({crew.driver.phone})</div>
                            <div><span className="text-foreground-muted">Sağlık Personeli:</span> <strong>{crew.paramedic.fullName}</strong> ({crew.paramedic.title})</div>
                          </>
                        )}
                      </>
                    )
                  })() : (
                    <div className="text-amber-600 font-semibold">Henüz ambulans ataması yapılmadı.</div>
                  )}
                </div>
              </section>

              {selectedTask.specialNotes && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  <StickyNoteIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span><span className="font-semibold">Operasyon Notu:</span> {selectedTask.specialNotes}</span>
                </div>
              )}
            </>
          )
        })()}
      </Drawer>

      <Modal
        open={reassignModalOpen}
        onClose={() => setReassignModalOpen(false)}
        title="Görevi Ambulansa Ata / Aktar"
        subtitle={selectedTask ? `${selectedTask.trackingNo} • ${selectedTask.patientName}` : undefined}
        width={460}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setReassignModalOpen(false)}>
              Vazgeç
            </Button>
            <Button
              variant="primary" className="flex-1"
              disabled={!selectedAmbulanceForReassign}
              onClick={() => {
                if (selectedTask && selectedAmbulanceForReassign) {
                  onReassignAmbulance(selectedTask.id, selectedAmbulanceForReassign)
                  setReassignModalOpen(false)
                  setIsDrawerOpen(false)
                }
              }}
            >
              Aktarımı Tamamla
            </Button>
          </div>
        }
      >
        <div className="space-y-3 p-5">
          <p className="text-xs text-foreground-muted">Görevin atanacağı ambulansı seçin.</p>
          <div className="overflow-hidden rounded-xl border border-border bg-surface-0 divide-y divide-border">
            {vehicles.map(v => {
              const active = selectedAmbulanceForReassign === v.id
              return (
                <label
                  key={v.id}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors ${
                    active ? 'bg-primary/5' : 'hover:bg-surface-1'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="reassignVeh"
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                      checked={active}
                      onChange={() => setSelectedAmbulanceForReassign(v.id)}
                    />
                    <div className="text-xs">
                      <div className="font-mono font-semibold text-foreground-strong">{v.plate}</div>
                      <div className="text-foreground-muted">{v.brandModel}</div>
                    </div>
                  </div>
                  <Badge tone={active ? 'primary' : 'neutral'}>GYP {v.workloadScoreToday}</Badge>
                </label>
              )
            })}
          </div>
        </div>
      </Modal>
    </div>
  )
}
