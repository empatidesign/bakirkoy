import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  BriefcaseIcon, UserPlusIcon, PlayIcon, SquareIcon, EyeIcon, PencilIcon, Trash2Icon,
  PowerIcon, PowerOffIcon, ClockIcon, UsersRoundIcon, RefreshCwIcon, CalendarCheckIcon, UserCheckIcon,
  MapPinIcon, MapPinOffIcon, LocateFixedIcon, HistoryIcon, AlertTriangleIcon,
  QrCodeIcon,
} from 'lucide-react'
import {
  SectionToolbar, StatCard, DataTable, Button, IconButton, Badge, Card, Modal, ConfirmModal,
  EmptyState, Field, Input, Select, Textarea, type DataTableColumn,
} from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import libraryService from '@/services/library.service'
import type { LibraryStaff, LibraryShift, MesaiSummary, MyMesai, MyMesaiMonthSummary } from '@/types/library.types'
import { fmtTime, fmtDuration, fmtDate, initiationLabel } from './libraryHelpers'
import { StaffFormDrawer } from './StaffFormDrawer'
import { StaffDetailModal } from './StaffDetailModal'
import { ShiftEditModal } from './ShiftEditModal'
import { StaffDoorQrModal } from './StaffDoorQrModal'
import { getCurrentPosition, queryLocationPermission, type GeoPosition } from '@/lib/geolocation'

const LOCATION_CONSENT_BADGE: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral'; icon: typeof MapPinIcon }> = {
  granted: { label: 'Konum açık', tone: 'success', icon: MapPinIcon },
  denied: { label: 'Konum kapalı', tone: 'warning', icon: MapPinOffIcon },
  prompt: { label: 'Konum bekleniyor', tone: 'neutral', icon: MapPinIcon },
  unknown: { label: 'Konum bilinmiyor', tone: 'neutral', icon: MapPinOffIcon },
}

const consentBadge = (status?: string | null) =>
  LOCATION_CONSENT_BADGE[status ?? 'unknown'] ?? LOCATION_CONSENT_BADGE.unknown

export const MesaiTab = ({ libraryId }: { libraryId: string }) => {
  const { can } = useAuth()
  const canManage = can('library-mesai.edit')

  const [mine, setMine] = useState<MyMesai | null>(null)
  const [summary, setSummary] = useState<MesaiSummary | null>(null)
  const [active, setActive] = useState<LibraryShift[]>([])
  const [staff, setStaff] = useState<LibraryStaff[]>([])
  const [loading, setLoading] = useState(true)

  const [selfStartOpen, setSelfStartOpen] = useState(false)
  const [selfLocation, setSelfLocation] = useState('')
  const [selfNotes, setSelfNotes] = useState('')
  const [selfEndOpen, setSelfEndOpen] = useState(false)
  const [selfBusy, setSelfBusy] = useState(false)
  const [selfGeo, setSelfGeo] = useState<GeoPosition | null>(null)
  const [selfGeoStatus, setSelfGeoStatus] = useState<'idle' | 'locating' | 'ok' | 'denied' | 'unavailable'>('idle')

  const [startState, setStartState] = useState<{ open: boolean; staff: LibraryStaff | null }>({ open: false, staff: null })
  const [startStaffId, setStartStaffId] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [starting, setStarting] = useState(false)

  const [staffForm, setStaffForm] = useState<{ open: boolean; editing: LibraryStaff | null }>({ open: false, editing: null })
  const [detail, setDetail] = useState<LibraryStaff | null>(null)
  const [ending, setEnding] = useState<LibraryShift | null>(null)
  const [removing, setRemoving] = useState<LibraryStaff | null>(null)
  const [toggling, setToggling] = useState<LibraryStaff | null>(null)
  const [busy, setBusy] = useState(false)

  const [myShifts, setMyShifts] = useState<LibraryShift[]>([])
  const [myShiftsLoading, setMyShiftsLoading] = useState(false)
  // Kişinin kendi aylık özeti (kullanıcı isteği 2026-09-25): ay seçilir, toplam saat/gün,
  // kütüphane bazında toplam ve o ayın tüm giriş-çıkışları gösterilir.
  const nowTr = new Date()
  const [myMonth, setMyMonth] = useState(`${nowTr.getFullYear()}-${String(nowTr.getMonth() + 1).padStart(2, '0')}`)
  const [myMonthSummary, setMyMonthSummary] = useState<MyMesaiMonthSummary | null>(null)
  const [editingMineShift, setEditingMineShift] = useState<LibraryShift | null>(null)
  const [doorQrOpen, setDoorQrOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const tasks: Promise<unknown>[] = [libraryService.shifts.getMine(libraryId).then(setMine)]
      if (canManage) {
        tasks.push(
          libraryService.shifts.getSummary(libraryId).then(setSummary),
          libraryService.shifts.getActive(libraryId).then(setActive),
          libraryService.staff.getEligible(libraryId).then(setStaff),
        )
      }
      await Promise.all(tasks)
    } catch {
      setMine(null); setSummary(null); setActive([]); setStaff([])
    } finally { setLoading(false) }
  }, [libraryId, canManage])
  useEffect(() => { load() }, [load])

  const loadMyShifts = useCallback(async () => {
    setMyShiftsLoading(true)
    try {
      const [y, m] = myMonth.split('-').map(Number)
      const res = await libraryService.shifts.getMyMonthSummary(y, m)
      setMyMonthSummary(res)
      setMyShifts(res.shifts)
    } catch {
      setMyShifts([])
      setMyMonthSummary(null)
    } finally {
      setMyShiftsLoading(false)
    }
  }, [myMonth])
  useEffect(() => { if (mine?.staff) loadMyShifts() }, [mine?.staff, loadMyShifts])

  const myStaffId = mine?.staff?.id
  const myConsentStatus = mine?.staff?.locationConsentStatus
  useEffect(() => {
    if (!myStaffId) return
    let alive = true
    queryLocationPermission().then((status) => {
      if (!alive) return
      if (status !== (myConsentStatus ?? 'unknown')) {
        libraryService.staff.setMyLocationConsent(status).catch(() => {})
      }
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStaffId])

  const startMine = async () => {
    setSelfBusy(true)
    try {
      await libraryService.shifts.startMine(libraryId, {
        location: selfLocation, notes: selfNotes,
        latitude: selfGeo?.latitude, longitude: selfGeo?.longitude,
      })
      toast.success('Mesainiz başlatıldı.')
      setSelfStartOpen(false); setSelfLocation(''); setSelfNotes(''); setSelfGeo(null); setSelfGeoStatus('idle'); await load(); await loadMyShifts()
    } finally { setSelfBusy(false) }
  }

  const openSelfStart = async () => {
    setSelfStartOpen(true)
    setSelfGeoStatus('locating')
    const res = await getCurrentPosition()
    if (res.ok) {
      setSelfGeo(res.position)
      setSelfGeoStatus('ok')
      libraryService.staff.setMyLocationConsent('granted').catch(() => {})
    } else {
      setSelfGeo(null)
      setSelfGeoStatus(res.reason === 'denied' ? 'denied' : 'unavailable')
      if (res.reason === 'denied') libraryService.staff.setMyLocationConsent('denied').catch(() => {})
    }
  }

  const endMine = async () => {
    setSelfBusy(true)
    try {
      await libraryService.shifts.endMine(libraryId)
      toast.success('Mesainiz bitirildi.')
      setSelfEndOpen(false); await load(); await loadMyShifts()
    } finally { setSelfBusy(false) }
  }

  const pickable = staff.filter((s) => s.isActive && !s.activeShiftId)

  const openStart = (s: LibraryStaff | null) => {
    setStartState({ open: true, staff: s }); setStartStaffId(s?.id ?? ''); setLocation(''); setNotes('')
  }
  const closeStart = () => setStartState({ open: false, staff: null })

  const submitStart = async () => {
    if (!startStaffId) return
    setStarting(true)
    try {
      await libraryService.shifts.start(libraryId, { staffId: startStaffId, location, notes })
      toast.success('Mesai başlatıldı.'); closeStart(); await load()
    } finally { setStarting(false) }
  }

  const endShift = async () => {
    if (!ending) return
    setBusy(true)
    try {
      await libraryService.shifts.end(ending.id)
      toast.success(`${ending.staffName} mesaisi bitirildi.`); setEnding(null); await load()
    } finally { setBusy(false) }
  }

  const removeStaff = async () => {
    if (!removing) return
    setBusy(true)
    try {
      await libraryService.staff.delete(removing.id)
      toast.success('Personel silindi.'); setRemoving(null); await load()
    } finally { setBusy(false) }
  }

  const runToggle = async () => {
    if (!toggling) return
    setBusy(true)
    try {
      await libraryService.staff.toggleStatus(toggling.id)
      toast.success(toggling.isActive ? 'Personel pasife alındı.' : 'Personel aktif edildi.'); setToggling(null); await load()
    } finally { setBusy(false) }
  }

  const submitMineShiftEdit = async (shiftId: string, startIso: string, endIso: string, reason: string) => {
    await libraryService.shifts.editMine(shiftId, { startTime: startIso, endTime: endIso, reason })
    toast.success('Mesai saatiniz güncellendi.')
    await loadMyShifts()
  }

  const activeColumns: DataTableColumn<LibraryShift>[] = [
    { key: 'staff', header: 'Personel', cell: (r) => <span className="type-body-strong">{r.staffName}</span> },
    { key: 'start', header: 'Başlangıç', cell: (r) => <span className="tabular-nums type-muted"><ClockIcon className="mr-1 inline h-3 w-3 text-success" />{fmtTime(r.startTime)}</span> },
    { key: 'duration', header: 'Çalışma Süresi', cell: (r) => <span className="tabular-nums text-foreground-strong">{fmtDuration(r.workedMinutes ?? 0)}</span> },
    { key: 'by', header: 'Başlatan', cell: (r) => <span className="type-muted">{initiationLabel(r.initiationType, r.initiatedByName)}</span> },
    { key: 'status', header: 'Durum', align: 'center', cell: () => <Badge tone="success">Çalışıyor</Badge> },
  ]

  const myShiftColumns: DataTableColumn<LibraryShift>[] = [
    { key: 'library', header: 'Kütüphane', cell: (r) => <span className="type-body-strong">{r.libraryName}</span> },
    { key: 'date', header: 'Tarih', cell: (r) => <span className="type-muted">{fmtDate(r.startTime)}</span> },
    {
      key: 'time', header: 'Giriş – Çıkış', cell: (r) => (
        <span className="tabular-nums type-muted">
          {fmtTime(r.startTime)} – {r.endTime ? fmtTime(r.endTime) : 'devam ediyor'}
          {r.autoClosedAtCutoff && (
            <span title="Gün sonu otomatik kapatıldı">
              <AlertTriangleIcon className="ml-1 inline h-3 w-3 text-warning" />
            </span>
          )}
        </span>
      ),
    },
    { key: 'duration', header: 'Süre', cell: (r) => r.workedMinutes == null
      ? <span className="tabular-nums type-caption text-foreground-subtle" title="Kaynak sistemde bu kaydın çıkış zamanı toplu/otomatik kapatma olduğu için gerçek süre hesaplanamadı.">Süre bilinmiyor</span>
      : <span className="tabular-nums text-foreground-strong">{fmtDuration(r.workedMinutes)}</span> },
    {
      key: 'status', header: 'Durum', align: 'center', cell: (r) => (
        <div className="flex flex-col items-center gap-0.5">
          <Badge tone={r.status === 'active' ? 'success' : 'neutral'}>{r.status === 'active' ? 'Çalışıyor' : 'Bitti'}</Badge>
          {r.wasEdited && <Badge tone="warning">Düzenlendi</Badge>}
        </div>
      ),
    },
  ]

  const staffColumns: DataTableColumn<LibraryStaff>[] = [
    {
      key: 'name', header: 'Personel', cell: (r) => (
        <div className="min-w-0">
          <p className="type-body-strong truncate">{r.fullName}</p>
          <p className="type-caption truncate">{r.phone || r.email || '—'}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Rol', cell: (r) => <span className="type-muted">{r.roleName || '—'}</span> },
    {
      key: 'location', header: 'Konum Servisi', align: 'center', cell: (r) => {
        const badge = consentBadge(r.locationConsentStatus)
        return <Badge tone={badge.tone}><badge.icon className="mr-1 inline h-3 w-3" />{badge.label}</Badge>
      },
    },
    {
      key: 'status', header: 'Durum', align: 'center', cell: (r) => r.activeShiftId
        ? <Badge tone="success">Mesaide</Badge>
        : <Badge tone={r.isActive ? 'neutral' : 'warning'}>{r.isActive ? 'Müsait' : 'Pasif'}</Badge>,
    },
  ]

  return (
    <div className="space-y-4">
      <SectionToolbar
        icon={BriefcaseIcon}
        title="Mesai / Vardiya"
        subtitle={canManage ? 'Kütüphane personeli ve aktif mesailer' : 'Kendi mesainizi başlatın ve bitirin'}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCwIcon className="h-4 w-4" /> Yenile</Button>
            {canManage && (
              <>
                <Button variant="outline" size="sm" onClick={() => setStaffForm({ open: true, editing: null })}><UserPlusIcon className="h-4 w-4" /> Personel Ekle</Button>
                <Button variant="primary" size="sm" disabled={pickable.length === 0} title={pickable.length === 0 ? 'Mesai başlatılabilecek müsait personel yok' : undefined} onClick={() => openStart(null)}>
                  <PlayIcon className="h-4 w-4" /> Mesai Başlat
                </Button>
              </>
            )}
          </div>
        }
      />

      {mine?.staff && (
        <Card padded className="flex flex-col gap-3 border-l-[3px] border-l-primary sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <UserCheckIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="type-section">Mesaim — {mine.staff.fullName}</p>
                {(() => {
                  const badge = consentBadge(mine.staff.locationConsentStatus)
                  return <Badge tone={badge.tone}><badge.icon className="mr-1 inline h-3 w-3" />{badge.label}</Badge>
                })()}
              </div>
              {mine.activeShift
                ? <p className="type-caption tabular-nums">Çalışıyor · başlangıç {fmtTime(mine.activeShift.startTime)} · {fmtDuration(mine.activeShift.workedMinutes ?? 0)}</p>
                : <p className="type-caption">Şu an mesaide değilsiniz.</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setDoorQrOpen(true)}><QrCodeIcon className="h-4 w-4" /> Kapı QR'ım</Button>
            {mine.activeShift
              ? <Button variant="danger" size="sm" isLoading={selfBusy} onClick={() => setSelfEndOpen(true)}><SquareIcon className="h-4 w-4" /> Mesaimi Bitir</Button>
              : <Button variant="primary" size="sm" disabled={!mine.staff.isActive} title={!mine.staff.isActive ? 'Personel kaydınız pasif' : undefined} onClick={openSelfStart}><PlayIcon className="h-4 w-4" /> Mesaimi Başlat</Button>}
          </div>
        </Card>
      )}

      {!canManage && !mine?.staff && !loading && (
        <Card className="py-4">
          <EmptyState icon={BriefcaseIcon} title="Mesai kaydınız yok" description="Bu kütüphanede personel kaydınız bulunmuyor. Mesai başlatmak için yöneticinize başvurun." />
        </Card>
      )}

      {mine?.staff && (
        <Card padded className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="type-section">Aylık Mesai Özetim</p>
            <div className="w-48">
              <Select value={myMonth} onChange={(e) => setMyMonth(String(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => {
                  const d = new Date(nowTr.getFullYear(), nowTr.getMonth() - i, 1)
                  const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                  return <option key={v} value={v}>{d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</option>
                })}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Toplam Süre" value={fmtDuration(myMonthSummary?.totalMinutes ?? 0)} icon={ClockIcon} accent="blue" loading={myShiftsLoading} />
            <StatCard label="Çalışılan Gün" value={myMonthSummary?.workedDays ?? 0} icon={CalendarCheckIcon} accent="green" loading={myShiftsLoading} />
            <StatCard label="Günlük Ortalama" value={fmtDuration(myMonthSummary && myMonthSummary.workedDays ? Math.round(myMonthSummary.totalMinutes / myMonthSummary.workedDays) : 0)} icon={BriefcaseIcon} accent="violet" loading={myShiftsLoading} />
            <StatCard label="Otomatik Kapanan (23:00)" value={myMonthSummary?.autoClosedCount ?? 0} icon={AlertTriangleIcon} accent="orange" loading={myShiftsLoading} />
          </div>
          {(myMonthSummary?.byLibrary.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {myMonthSummary!.byLibrary.map((b) => (
                <Badge key={b.libraryId} tone="primary">{b.libraryName}: {fmtDuration(b.totalMinutes)} · {b.shiftCount} mesai</Badge>
              ))}
            </div>
          )}
        </Card>
      )}

      {mine?.staff && (
        <DataTable<LibraryShift>
          title="Mesai Geçmişim"
          showRowNumbers
          columns={myShiftColumns}
          rows={myShifts}
          rowKey={(r) => r.id}
          loading={myShiftsLoading}
          total={myShifts.length}
          rowActions={mine.staff.canEditOwnShifts ? (r) => (
            r.status === 'ended'
              ? <IconButton tone="primary" title="Giriş/çıkış saatini düzenle" onClick={() => setEditingMineShift(r)}><PencilIcon className="h-4 w-4" /></IconButton>
              : undefined
          ) : undefined}
          empty={<EmptyState icon={HistoryIcon} title="Mesai kaydınız yok" description="Henüz tamamlanmış bir mesai kaydınız bulunmuyor." />}
        />
      )}

      {canManage && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Aktif Mesai" value={summary?.activeShifts ?? 0} icon={BriefcaseIcon} accent="green" loading={loading} />
            <StatCard label="Bugünkü Mesai" value={summary?.todayShifts ?? 0} icon={CalendarCheckIcon} accent="blue" loading={loading} />
            <StatCard label="Çalışabilen Personel" value={summary?.eligibleStaff ?? 0} icon={UsersRoundIcon} accent="violet" loading={loading} />
          </div>

          <DataTable<LibraryShift>
            title="Aktif Mesailer"
            showRowNumbers
            columns={activeColumns}
            rows={active}
            rowKey={(r) => r.id}
            loading={loading}
            total={active.length}
            rowActions={(r) => (
              <IconButton tone="danger" title="Mesai bitir" onClick={() => setEnding(r)}><SquareIcon className="h-4 w-4" /></IconButton>
            )}
            empty={<EmptyState icon={BriefcaseIcon} title="Aktif mesai yok" description="Şu anda mesaide personel bulunmuyor." />}
          />

          <DataTable<LibraryStaff>
            title="Kütüphane Personeli"
            showRowNumbers
            columns={staffColumns}
            rows={staff}
            rowKey={(r) => r.id}
            loading={loading}
            total={staff.length}
            rowActions={(r) => (
              <>
                <Button variant="outline" size="sm" disabled={!r.isActive || !!r.activeShiftId} title={!r.isActive ? 'Personel pasif' : r.activeShiftId ? 'Zaten mesaide' : 'Mesai başlat'} onClick={() => openStart(r)}>
                  <PlayIcon className="h-4 w-4" /> Mesai Başlat
                </Button>
                <IconButton title="Geçmiş / detay" onClick={() => setDetail(r)}><EyeIcon className="h-4 w-4" /></IconButton>
                <IconButton tone="primary" title="Düzenle" onClick={() => setStaffForm({ open: true, editing: r })}><PencilIcon className="h-4 w-4" /></IconButton>
                <IconButton title={r.isActive ? 'Pasife al' : 'Aktif et'} onClick={() => setToggling(r)}>{r.isActive ? <PowerOffIcon className="h-4 w-4" /> : <PowerIcon className="h-4 w-4" />}</IconButton>
                <IconButton tone="danger" title="Sil" onClick={() => setRemoving(r)}><Trash2Icon className="h-4 w-4" /></IconButton>
              </>
            )}
            empty={<EmptyState icon={UsersRoundIcon} title="Personel yok" description="Bu kütüphanede çalışabilecek personel ekleyin." />}
          />
        </>
      )}

      <Modal
        open={startState.open}
        onClose={closeStart}
        title="Mesai Başlat"
        subtitle={startState.staff?.fullName ?? 'Personel seçin'}
        width={460}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={closeStart}>İptal</Button>
            <Button variant="primary" className="flex-1" isLoading={starting} disabled={!startStaffId} onClick={submitStart}><PlayIcon className="h-4 w-4" /> Başlat</Button>
          </div>
        }
      >
        <div className="space-y-4 p-6">
          {!startState.staff && (
            <Field label="Personel" required>
              <Select value={startStaffId} onChange={(e) => setStartStaffId(e.target.value)}>
                <option value="">Personel seçin</option>
                {pickable.map((s) => <option key={s.id} value={s.id}>{s.fullName}{s.roleName ? ` · ${s.roleName}` : ''}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Konum" hint="Görev yeri / kat (opsiyonel)">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Örn. Zemin Kat Danışma" />
          </Field>
          <Field label="Not">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Mesai notu (opsiyonel)" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={selfStartOpen}
        onClose={() => setSelfStartOpen(false)}
        title="Mesaimi Başlat"
        subtitle={mine?.staff?.fullName}
        width={440}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setSelfStartOpen(false)}>İptal</Button>
            <Button variant="primary" className="flex-1" isLoading={selfBusy} onClick={startMine}><PlayIcon className="h-4 w-4" /> Başlat</Button>
          </div>
        }
      >
        <div className="space-y-4 p-6">
          {selfGeoStatus === 'locating' && (
            <div className="flex items-center gap-2 rounded-field bg-primary-soft px-3 py-2 text-sm text-primary">
              <LocateFixedIcon className="h-4 w-4 animate-pulse" /> Konumunuz alınıyor…
            </div>
          )}
          {selfGeoStatus === 'ok' && selfGeo && (
            <div className="flex items-center gap-2 rounded-field bg-success-soft px-3 py-2 text-sm text-success">
              <MapPinIcon className="h-4 w-4" /> Konumunuz alındı (±{Math.round(selfGeo.accuracy)}m hassasiyet). Kütüphaneye uzaklığınız mesai başlatılırken kontrol edilecek.
            </div>
          )}
          {selfGeoStatus === 'denied' && (
            <div className="flex items-center gap-2 rounded-field bg-warning-soft px-3 py-2 text-sm text-warning">
              <MapPinOffIcon className="h-4 w-4" /> Konum izni reddedildi. Kütüphanede konum doğrulaması zorunluysa mesai başlatamazsınız; tarayıcı ayarlarından izin verip tekrar deneyin.
            </div>
          )}
          {selfGeoStatus === 'unavailable' && (
            <div className="flex items-center gap-2 rounded-field bg-warning-soft px-3 py-2 text-sm text-warning">
              <MapPinOffIcon className="h-4 w-4" /> Konum alınamadı. Cihazınızın konum servisi açık değilse mesai başlatılamayabilir.
            </div>
          )}
          <Field label="Konum" hint="Görev yeri / kat (opsiyonel)">
            <Input value={selfLocation} onChange={(e) => setSelfLocation(e.target.value)} placeholder="Örn. Zemin Kat Danışma" />
          </Field>
          <Field label="Not">
            <Textarea rows={2} value={selfNotes} onChange={(e) => setSelfNotes(e.target.value)} placeholder="Mesai notu (opsiyonel)" />
          </Field>
        </div>
      </Modal>

      <StaffFormDrawer
        open={staffForm.open}
        libraryId={libraryId}
        editing={staffForm.editing}
        onClose={() => setStaffForm({ open: false, editing: null })}
        onSaved={load}
      />

      <StaffDetailModal staff={detail} onClose={() => setDetail(null)} canEdit={canManage} />

      <ShiftEditModal shift={editingMineShift} onClose={() => setEditingMineShift(null)} onSubmit={submitMineShiftEdit} requireReason />

      <StaffDoorQrModal open={doorQrOpen} onClose={() => setDoorQrOpen(false)} />

      <ConfirmModal
        open={selfEndOpen}
        onClose={() => setSelfEndOpen(false)}
        onConfirm={endMine}
        loading={selfBusy}
        tone="danger"
        title="Mesaimi Bitir"
        description="Mesainiz bitirilecek ve çalışma süreniz kaydedilecek. Devam edilsin mi?"
        confirmLabel="Mesaimi Bitir"
      />

      <ConfirmModal
        open={!!ending}
        onClose={() => setEnding(null)}
        onConfirm={endShift}
        loading={busy}
        tone="danger"
        title="Mesai Bitir"
        description={`"${ending?.staffName}" personelinin mesaisi bitirilecek ve çalışma süresi kaydedilecek. Devam edilsin mi?`}
        confirmLabel="Mesai Bitir"
      />

      <ConfirmModal
        open={!!toggling}
        onClose={() => setToggling(null)}
        onConfirm={runToggle}
        loading={busy}
        tone="primary"
        title={toggling?.isActive ? 'Personeli Pasife Al' : 'Personeli Aktif Et'}
        description={toggling?.isActive ? `"${toggling?.fullName}" pasife alınacak; mesai başlatamaz.` : `"${toggling?.fullName}" yeniden aktif edilecek.`}
        confirmLabel="Onayla"
      />

      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={removeStaff}
        loading={busy}
        tone="danger"
        title="Personeli Sil"
        description={`"${removing?.fullName}" silinecek. Bu işlem geri alınamaz.`}
        confirmLabel="Evet, Sil"
      />
    </div>
  )
}
