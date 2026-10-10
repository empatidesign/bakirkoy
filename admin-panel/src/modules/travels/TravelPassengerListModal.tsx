import { useEffect, useMemo, useState } from 'react'
import {
  UsersIcon, ListIcon, BusIcon, PrinterIcon, PhoneIcon, MapPinIcon, ArmchairIcon, WandSparklesIcon, CalendarDaysIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import excelIcon from '@/assets/icons/excel.png'
import wordIcon from '@/assets/icons/word.png'
import { Modal, Badge, EmptyState, Button, SegmentedControl, Skeleton, Select, Banner } from '@/design-system'
import { downloadBlob, maskTC } from '@/lib/utils'
import { BusBoardingBoard, generateBusSeatPositions, getBusTemplate, isPassengerSeat } from '@/components/specialized/seating'
import travelApplicationService from '@/services/travelApplication.service'
import travelBusService from '@/services/travelBus.service'
import { applicationToForm } from './travelFormDefaults'
import type { Travel, TravelApplication, TravelBusSeating } from '@/types/travel.types'

/**
 * Kullanıcı isteği (2026-08-05): "Ankara gezisinde burda yolcuları tıkladığımızda arabada mı
 * ya da listeli mi modalda görebileyim gerekğinde liste veya araç görünüşü olarak yazdırabilir
 * veya export pdf/excel duruma göre alabileyim". Önceden "Kayıtlı" sayısına tıklayınca sadece
 * (koltuk düzeninden bağımsız) ham başvuru tablosu (DrilldownCount+ApplicationsTab) açılıyordu;
 * araç/koltuk görünümü ayrı bir buton+modaldı (TravelBusSeatModal, sadece düzenleme amaçlı).
 * Bu modal ikisini tek bir yerde, görünüm anahtarıyla (Liste ↔ Araç) birleştirir ve export
 * seçeneklerini (Excel — mevcut backend endpoint; Word koltuk planı — mevcut backend endpoint;
 * yazdır/PDF — backend'de hiç PDF export altyapısı yoktu, yeni bir bağımlılık eklemek yerine
 * tarayıcının native yazdırma diyaloğu kullanıldı, kullanıcı "PDF olarak kaydet" seçeneğiyle
 * PDF üretebilir) tek noktadan sunar.
 */

type ViewMode = 'list' | 'bus'
type SeatAssignment = { busId: string; seatNumber: string }
const hasSeatAssignment = (application: Pick<TravelApplication, 'busId' | 'seatNumber'>) =>
  !!application.busId && !!application.seatNumber?.trim()

const STATUS_LABEL: Record<string, string> = {
  pending: 'Gönderildi',
  reviewing: 'İnceleniyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  waitlist: 'Yedek Liste',
}

const PrintStyles = () => (
  <style>{`
    @media print {
      body * { visibility: hidden; }
      #travel-passenger-print, #travel-passenger-print * { visibility: visible; }
      #travel-passenger-print { position: absolute; left: 0; top: 0; width: 100%; }
    }
  `}</style>
)

export const TravelPassengerListModal = ({ travel, onClose }: { travel: Travel | null; onClose: () => void }) => {
  const [view, setView] = useState<ViewMode>('list')
  const [loading, setLoading] = useState(false)
  const [applications, setApplications] = useState<TravelApplication[]>([])
  const [seating, setSeating] = useState<TravelBusSeating[]>([])
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingWord, setExportingWord] = useState(false)
  const [placementOpen, setPlacementOpen] = useState(false)
  const [assignments, setAssignments] = useState<Record<string, SeatAssignment>>({})
  const [savingPlacement, setSavingPlacement] = useState(false)

  const loadData = async (travelId: string) => {
    const [apps, seat] = await Promise.all([
      travelApplicationService.getList({ travelId, status: 'approved', page: 1, limit: 500 }),
      travelBusService.getTravelSeating(travelId).catch(() => [] as TravelBusSeating[]),
    ])
    setApplications(apps.items)
    setSeating(seat)
  }

  useEffect(() => {
    if (!travel) { setApplications([]); setSeating([]); setView('list'); return }
    let active = true
    setLoading(true)
    Promise.all([
      travelApplicationService.getList({ travelId: travel.id, status: 'approved', page: 1, limit: 500 }),
      travelBusService.getTravelSeating(travel.id).catch(() => [] as TravelBusSeating[]),
    ])
      .then(([apps, seat]) => {
        if (!active) return
        setApplications(apps.items)
        setSeating(seat)
      })
      .catch(() => { if (active) { setApplications([]); setSeating([]) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [travel])

  const hasBuses = seating.length > 0
  const seatBuses = useMemo(() => seating.filter((b) => b.vehicleType === 'bus'), [seating])

  const availableSeats = useMemo(() => seatBuses.flatMap((bus) => {
    const occupiedLabels = new Set(bus.occupants.map((o) => o.seatNumber))
    return generateBusSeatPositions(getBusTemplate(bus.templateId))
      .filter((p) => isPassengerSeat(p.zone))
      .filter((p) => {
        const status = bus.seatStates[p.id]?.status ?? 'available'
        return status === 'available' && !occupiedLabels.has(p.label)
      })
      .map((p) => ({ busId: bus.busId, busName: bus.name, seatNumber: p.label, row: p.row, zone: p.zone, index: p.index }))
  }), [seatBuses])

  const openPlacement = () => {
    setAssignments(Object.fromEntries(applications.map((a) => [a.id, {
      busId: a.busId ?? '', seatNumber: a.seatNumber ?? '',
    }])))
    setPlacementOpen(true)
  }

  const autoPlace = () => {
    const next: Record<string, SeatAssignment> = Object.fromEntries(applications.map((a) => [a.id, {
      busId: a.busId ?? '', seatNumber: a.seatNumber ?? '',
    }]))
    const waiting = applications.filter((a) => !hasSeatAssignment(a))
    const byGender = {
      female: waiting.filter((a) => a.gender === 'female'),
      male: waiting.filter((a) => a.gender !== 'female'),
    }
    const groups = new Map<string, typeof availableSeats>()
    const groupGender = new Map<string, 'female' | 'male' | 'mixed'>()
    seatBuses.forEach((bus) => {
      const positions = generateBusSeatPositions(getBusTemplate(bus.templateId))
      bus.occupants.forEach((occupant) => {
        const position = positions.find((p) => p.label === occupant.seatNumber)
        if (!position || !isPassengerSeat(position.zone) || (occupant.gender !== 'female' && occupant.gender !== 'male')) return
        const key = `${bus.busId}|${position.row}|${position.zone}`
        const current = groupGender.get(key)
        groupGender.set(key, !current || current === occupant.gender ? occupant.gender : 'mixed')
      })
    })
    availableSeats.forEach((s) => {
      const key = `${s.busId}|${s.row}|${s.zone}`
      groups.set(key, [...(groups.get(key) ?? []), s])
    })
    const orderedGroups = [...groups.values()].sort((a, b) => a.length - b.length)
    let placed = 0
    for (const group of orderedGroups) {
      const key = `${group[0].busId}|${group[0].row}|${group[0].zone}`
      const currentGroupGender = groupGender.get(key)
      if (currentGroupGender === 'mixed') continue
      const gender: 'female' | 'male' = currentGroupGender ?? (byGender.female.length >= byGender.male.length ? 'female' : 'male')
      const preferred = byGender[gender].length > 0 ? byGender[gender] : byGender[gender === 'female' ? 'male' : 'female']
      if (currentGroupGender && preferred !== byGender[gender]) continue
      for (const seat of group.sort((a, b) => a.index - b.index)) {
        const app = preferred.shift()
        if (!app) break
        next[app.id] = { busId: seat.busId, seatNumber: seat.seatNumber }
        placed += 1
      }
    }
    setAssignments(next)
    const remaining = waiting.length - placed
    if (remaining > 0) toast.warning(`${placed} kişi yerleştirildi; ${remaining} kişi için uygun koltuk kalmadı.`)
    else toast.success(`${placed} kişi kadın–erkek yan yana gelmeyecek şekilde yerleştirildi.`)
  }

  const savePlacement = async () => {
    if (!travel) return
    const changed = applications.filter((a) => {
      const value = assignments[a.id] ?? { busId: '', seatNumber: '' }
      return value.busId !== (a.busId ?? '') || value.seatNumber !== (a.seatNumber ?? '')
    })
    if (changed.length === 0) { setPlacementOpen(false); return }
    const values = changed
      .map((a) => assignments[a.id])
      .filter((value) => value?.busId && value.seatNumber)
      .map((value) => `${value.busId}|${value.seatNumber}`)
    if (new Set(values).size !== values.length) { toast.error('Aynı koltuk birden fazla yolcuya seçilemez.'); return }
    setSavingPlacement(true)
    try {
      for (const app of changed) {
        const value = assignments[app.id] ?? { busId: '', seatNumber: '' }
        await travelApplicationService.update(app.id, {
          ...applicationToForm(app), busId: value.busId, seatNumber: value.seatNumber,
        })
      }
      await loadData(travel.id)
      setPlacementOpen(false)
      toast.success(`${changed.length} yolcunun koltuğu kaydedildi.`)
    } finally {
      setSavingPlacement(false)
    }
  }

  const doExcelExport = async () => {
    if (!travel) return
    setExportingExcel(true)
    try {
      const { blob, fileName } = await travelApplicationService.exportExcel({ travelId: travel.id })
      downloadBlob(blob, fileName)
    } finally {
      setExportingExcel(false)
    }
  }

  const doWordExport = async () => {
    if (!travel) return
    setExportingWord(true)
    try {
      const { blob, fileName } = await travelBusService.exportWordSeating(travel.id)
      downloadBlob(blob, fileName)
    } finally {
      setExportingWord(false)
    }
  }

  const doPrint = () => window.print()

  return (
    <>
      <PrintStyles />
      <Modal
        open={!!travel}
        onClose={onClose}
        header={
          <div className="flex items-start gap-3 pr-10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
              <UsersIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-foreground-strong">{travel?.name ?? 'Yolcu Listesi'}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 type-caption text-foreground-muted">
                <span className="font-medium">Yolcu ve koltuk yönetimi</span>
                {travel?.startDate && <span className="inline-flex items-center gap-1"><CalendarDaysIcon className="h-3.5 w-3.5" /> {new Date(travel.startDate).toLocaleDateString('tr-TR')}</span>}
                <span>{applications.length} onaylı yolcu</span>
              </div>
            </div>
          </div>
        }
        width={1000}
        className="max-w-[96vw]"
      >
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-2.5 shadow-sm">
            <SegmentedControl
              value={view}
              onChange={(v) => setView(v as ViewMode)}
              options={[
                { value: 'list', label: 'Liste', icon: ListIcon },
                { value: 'bus', label: 'Araç Görünümü', icon: BusIcon },
              ]}
            />
            <div className="flex flex-wrap items-center gap-2">
              {applications.length > 0 && (
                <div className="mr-1 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent-blue/40 bg-accent-blue-soft px-2.5 py-1 type-caption font-semibold text-accent-blue">♂ Erkek {applications.filter((a) => a.gender !== 'female').length}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent-pink/40 bg-accent-pink-soft px-2.5 py-1 type-caption font-semibold text-accent-pink">♀ Kadın {applications.filter((a) => a.gender === 'female').length}</span>
                </div>
              )}
              <Button variant="outline" size="sm" className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" isLoading={exportingExcel} onClick={doExcelExport}>
                <img src={excelIcon} alt="" className="h-4 w-4" /> Excel
              </Button>
              {view === 'bus' && (
                <>
                  <Button variant="primary" size="sm" className="shadow-sm" onClick={openPlacement} disabled={seatBuses.length === 0 || applications.length === 0}>
                    <ArmchairIcon className="h-4 w-4" /> Yolcuları Yerleştir
                  </Button>
                  <Button variant="outline" size="sm" className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" isLoading={exportingWord} onClick={doWordExport} disabled={!hasBuses}>
                    <img src={wordIcon} alt="" className="h-4 w-4" /> Word
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" className="bg-surface-1" onClick={doPrint}>
                <PrinterIcon className="h-4 w-4" /> Yazdır / PDF
              </Button>
            </div>
          </div>

          <div id="travel-passenger-print">
            {loading ? (
              <Skeleton className="h-64 w-full rounded-card" />
            ) : applications.length === 0 ? (
              <EmptyState icon={UsersIcon} title="Yolcu yok" description="Bu gezi için onaylı başvuru bulunmuyor." />
            ) : view === 'list' ? (
              <div className="overflow-hidden rounded-card border border-border">
                {applications.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-1 px-4 py-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="type-body-strong truncate">{a.participantName}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className={a.gender === 'female'
                          ? 'rounded-full border border-accent-pink/40 bg-accent-pink-soft px-2 py-0.5 type-caption font-semibold text-accent-pink'
                          : 'rounded-full border border-accent-blue/40 bg-accent-blue-soft px-2 py-0.5 type-caption font-semibold text-accent-blue'}>
                          {a.gender === 'female' ? '♀ Kadın' : '♂ Erkek'}
                        </span>
                        <span className="type-caption tabular-nums text-foreground-muted">{maskTC(a.tckn)}</span>
                        {a.phone && (
                          <span className="type-caption inline-flex items-center gap-0.5 text-foreground-muted">
                            <PhoneIcon className="h-3 w-3" /> {a.phone}
                          </span>
                        )}
                        {a.neighborhood && (
                          <span className="type-caption inline-flex items-center gap-0.5 text-foreground-muted">
                            <MapPinIcon className="h-3 w-3" /> {a.neighborhood}
                          </span>
                        )}
                        {a.busName && (
                          <span className="type-caption inline-flex items-center gap-0.5 text-foreground-muted">
                            <BusIcon className="h-3 w-3" /> {a.busName}
                          </span>
                        )}
                        {a.seatNumber && (
                          <span className="type-caption inline-flex items-center gap-0.5 text-foreground-muted">
                            <ArmchairIcon className="h-3 w-3" /> {a.seatNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge tone={a.status === 'approved' ? 'success' : 'neutral'}>{STATUS_LABEL[a.status] ?? a.status}</Badge>
                  </div>
                ))}
              </div>
            ) : !hasBuses ? (
              <EmptyState icon={BusIcon} title="Araç atanmamış" description="Bu geziye henüz araç tanımlanmadı." />
            ) : (
              <div className="space-y-5">
                {seating.map((bus) => {
                  const occupantGenders: Record<string, 'male' | 'female'> = Object.fromEntries(
                    bus.occupants.map((o) => [o.seatNumber, o.gender === 'female' ? 'female' : 'male'] as const),
                  )
                  return (
                    <div key={bus.busId} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-1 px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary"><BusIcon className="h-4 w-4" /></div>
                          <div><p className="type-body-strong">{bus.name}</p><p className="type-caption text-foreground-muted">{bus.plateNumber || 'Plaka belirtilmemiş'}</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-accent-blue/30 bg-accent-blue-soft px-2.5 py-1 type-caption font-semibold text-accent-blue">♂ {bus.occupants.filter((o) => o.gender !== 'female').length}</span>
                          <span className="rounded-full border border-accent-pink/30 bg-accent-pink-soft px-2.5 py-1 type-caption font-semibold text-accent-pink">♀ {bus.occupants.filter((o) => o.gender === 'female').length}</span>
                          <Badge tone="info">{bus.occupiedCount} / {bus.capacity} dolu</Badge>
                        </div>
                      </div>
                      {bus.vehicleType === 'capacity' ? (
                        <p className="p-4 type-caption text-foreground-muted">Kontenjanlı araç — koltuk düzeni yok, sadece toplam kişi sayısı sınırlıdır.</p>
                      ) : (
                        <BusBoardingBoard
                          templateId={bus.templateId}
                          seatStates={Object.fromEntries(Object.entries(bus.seatStates).map(([id, state]) => {
                            const label = generateBusSeatPositions(getBusTemplate(bus.templateId)).find((p) => p.id === id)?.label
                            const occupant = bus.occupants.find((o) => o.seatNumber === label)
                            return [id, occupant ? { ...state, participantName: occupant.name || 'Yolcu' } : state]
                          }))}
                          occupantGenders={occupantGenders}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>
      <Modal
        open={placementOpen}
        onClose={() => setPlacementOpen(false)}
        title="Yolcuları Koltuklara Yerleştir"
        subtitle="Otomatik dağıtın veya listeden her yolcu için koltuğu tek tek seçin"
        width={760}
        className="max-w-[96vw]"
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPlacementOpen(false)}>İptal</Button><Button variant="primary" isLoading={savingPlacement} onClick={savePlacement}>Yerleşimi Kaydet</Button></div>}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <Banner tone="info" variant="soft" icon={WandSparklesIcon}>
            Otomatik yerleştirme yalnızca koltuğu olmayan yolcuları boş koltuklara dağıtır; mevcut yerleşimleri değiştirmez. Aynı koltuk grubunda kadın ve erkek yan yana getirilmez.
          </Banner>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card p-3">
            <div>
              <p className="type-body-strong">Yerleşim Özeti</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Badge tone="info">Erkek {applications.filter((a) => a.gender !== 'female').length}</Badge>
                <Badge tone="info">Kadın {applications.filter((a) => a.gender === 'female').length}</Badge>
                <Badge tone="neutral">Koltuksuz {applications.filter((a) => !hasSeatAssignment(a)).length}</Badge>
              </div>
            </div>
            <Button variant="primary" onClick={autoPlace} disabled={applications.every(hasSeatAssignment)}>
              <WandSparklesIcon className="h-4 w-4" /> Tümünü Otomatik Yerleştir
            </Button>
          </div>
          <div className="overflow-hidden rounded-card border border-border">
            <div className="hidden grid-cols-[56px_1fr_110px_260px] items-center gap-3 border-b border-border bg-surface-1 px-4 py-2.5 sm:grid">
              <span className="type-caption font-semibold text-foreground-muted">Sıra No</span>
              <span className="type-caption font-semibold text-foreground-muted">Yolcu</span>
              <span className="type-caption font-semibold text-foreground-muted">Cinsiyet</span>
              <span className="type-caption font-semibold text-foreground-muted">Araç ve Koltuk</span>
            </div>
            {applications.map((app, index) => {
              const selected = assignments[app.id]
              const selectedValue = selected?.busId && selected.seatNumber ? `${selected.busId}|${selected.seatNumber}` : ''
              const usedByOther = new Set(Object.entries(assignments).filter(([id]) => id !== app.id).map(([, a]) => `${a.busId}|${a.seatNumber}`))
              return (
                <div key={app.id} className="grid gap-3 border-b border-border bg-card px-4 py-3 last:border-b-0 sm:grid-cols-[56px_1fr_110px_260px] sm:items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold tabular-nums text-primary">{index + 1}</div>
                  <div className="min-w-0">
                    <p className="truncate type-body-strong">{app.participantName}</p>
                    <p className="type-caption text-foreground-muted">{maskTC(app.tckn)}</p>
                  </div>
                  <div><Badge tone="info">{app.gender === 'female' ? 'Kadın' : 'Erkek'}</Badge></div>
                  <Select value={selectedValue} onChange={(e) => {
                    const [busId = '', seatNumber = ''] = e.target.value.split('|')
                    setAssignments((prev) => ({ ...prev, [app.id]: { busId, seatNumber } }))
                  }}>
                    <option value="">Koltuk seçilmedi</option>
                    {app.busId && app.seatNumber && <option value={`${app.busId}|${app.seatNumber}`}>{app.busName} · Koltuk {app.seatNumber} (mevcut)</option>}
                    {availableSeats.filter((s) => !usedByOther.has(`${s.busId}|${s.seatNumber}`)).map((s) => <option key={`${s.busId}-${s.seatNumber}`} value={`${s.busId}|${s.seatNumber}`}>{s.busName} · Koltuk {s.seatNumber}</option>)}
                  </Select>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>
    </>
  )
}
