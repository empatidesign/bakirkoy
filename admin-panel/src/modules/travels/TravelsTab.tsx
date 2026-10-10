import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MapPinIcon, CheckCircle2Icon, PowerOffIcon, Users2Icon, ArmchairIcon,
  ClipboardListIcon, BusIcon, CopyIcon, CopyPlusIcon, EyeIcon, MessageSquareIcon, UsersRoundIcon, ClipboardCheckIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import { Badge, Button, Select, FilterField, DatePicker, IconButton, DrilldownCount, ToggleRow, isValidTckn, isValidEmail, AdminFormShell } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import { TravelSendMessageModal } from './TravelSendMessageModal'
import { TravelAttendanceMarkModal } from './TravelAttendanceMarkModal'
import { isResponsiblePersonValid } from '@/components/specialized/ResponsiblePersonField'
import travelService from '@/services/travel.service'
import { ApplicationsTab } from './ApplicationsTab'
import { TravelForm } from './TravelForm'
import { TravelDetailModal } from './TravelDetailModal'
import { TravelBusSeatModal } from './TravelBusSeatModal'
import { TravelPassengerListModal } from './TravelPassengerListModal'
import { TravelCopyModal } from './TravelCopyModal'
import { TravelBulkCopyModal } from './TravelBulkCopyModal'
import { TravelBulkTcknModal } from './TravelBulkTcknModal'
import { emptyTravelForm, travelToForm } from './travelFormDefaults'
import type { Travel, TravelFormData, TravelSummary } from '@/types/travel.types'

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')

interface Props {
  embedded?: boolean
  /** Bir Gezi (Route) altındaki Seferler gösteriliyorsa: route filtresi ve içerik kilidi. */
  scope?: { categoryId?: string; routeId?: string; routeName?: string }
}

export const TravelsTab = ({ embedded, scope }: Props = {}) => {
  const { can } = useAuth()
  const [, setSearchParams] = useSearchParams()
  const scopedCategoryId = scope?.categoryId ?? ''
  const scopedRouteId = scope?.routeId ?? ''
  // Kullanıcı isteği (2026-08-07): "başlangıç ve bitişte hep içinde bulunduğumuz yılın tarihleri
  // aktif olacak" — tarih filtreleri varsayılan olarak içinde bulunulan yılın 1 Ocak–31 Aralık
  // aralığına ayarlı gelir; kullanıcı isterse değiştirip önceki yıllara/geçmişe bakabilir.
  const currentYear = new Date().getFullYear()
  const [statusFilter, setStatusFilter] = useState('')
  const [startFilter, setStartFilter] = useState(`${currentYear}-01-01`)
  const [endFilter, setEndFilter] = useState(`${currentYear}-12-31`)
  // Kullanıcı isteği (2026-08-07): liste varsayılan olarak süresi geçmiş seferleri gizler.
  const [showPast, setShowPast] = useState(false)
  const [summary, setSummary] = useState<TravelSummary | null>(null)
  const [detailTravel, setDetailTravel] = useState<Travel | null>(null)
  const [seatTravel, setSeatTravel] = useState<Travel | null>(null)
  const [passengerTravel, setPassengerTravel] = useState<Travel | null>(null)
  const [attendanceTravel, setAttendanceTravel] = useState<Travel | null>(null)
  const [copySource, setCopySource] = useState<Travel | null>(null)
  const [bulkCopySource, setBulkCopySource] = useState<Travel | null>(null)
  const [bulkTcknTravel, setBulkTcknTravel] = useState<Travel | null>(null)
  const [messageTravel, setMessageTravel] = useState<Travel | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [broadcastIds, setBroadcastIds] = useState<string[] | null>(null)
  const [defaultCancellationHours, setDefaultCancellationHours] = useState(72)
  const [defaultCapacity, setDefaultCapacity] = useState(0)
  const [advanceBookingDays, setAdvanceBookingDays] = useState(0)

  useEffect(() => {
    travelService.getSettings()
      .then((s) => {
        setDefaultCancellationHours(Math.max(1, s.general.cancellationDeadlineDays * 24))
        setDefaultCapacity(Math.max(0, s.general.maxParticipants))
        setAdvanceBookingDays(Math.max(0, s.general.advanceBookingDays))
      })
      .catch(() => {})
  }, [])

  const defaultEmptyForm = useMemo(
    () => ({ ...emptyTravelForm(scopedRouteId), cancellationDeadlineHours: defaultCancellationHours, capacity: defaultCapacity }),
    [scopedRouteId, defaultCancellationHours, defaultCapacity],
  )

  const loadSummary = useCallback(() => {
    const p: Record<string, unknown> = {}
    if (scopedRouteId) p.routeId = scopedRouteId
    travelService.getSummary(p).then(setSummary).catch(() => setSummary(null))
  }, [scopedRouteId])
  useEffect(() => { loadSummary() }, [loadSummary])

  const navTo = (tab: string, travelId: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('tab', tab)
      n.set('travelId', travelId)
      return n
    })

  const onCopied = () => {
    toast.success('Sefer kopyalandı.')
    setCopySource(null)
    setRefreshSignal((s) => s + 1)
    loadSummary()
  }

  // "Aktif filtre" sayacı yalnızca kullanıcının VARSAYILAN olandan değiştirdiği filtreleri
  // sayar — başlangıç/bitiş tarihi varsayılan olarak içinde bulunulan yıla ayarlı geldiği için
  // bunlar "aktif filtre" sayılmaz (kullanıcı henüz elle değiştirmedi).
  const defaultStart = `${currentYear}-01-01`
  const defaultEnd = `${currentYear}-12-31`
  const startChanged = startFilter !== defaultStart
  const endChanged = endFilter !== defaultEnd
  const hasActiveFilters = !!statusFilter || startChanged || endChanged || showPast
  const extraParams: Record<string, string> = {}
  if (scopedCategoryId) extraParams.categoryId = scopedCategoryId
  if (scopedRouteId) extraParams.routeId = scopedRouteId
  if (statusFilter) extraParams.isActive = statusFilter
  if (startFilter) extraParams.startDate = startFilter
  if (endFilter) extraParams.endDate = endFilter
  // Kullanıcı isteği (2026-08-07): liste varsayılan olarak süresi geçmiş seferleri gizler
  // ("Geçmiş Seferleri Göster" filtresi açılmadıkça).
  if (!showPast) extraParams.hidePast = 'true'

  return (
    <>
      <CrudListTemplate<Travel, TravelFormData>
        icon={MapPinIcon}
        title={scopedRouteId ? 'Seferler' : 'Geziler'}
        subtitle={scopedRouteId ? `"${scope?.routeName}" gezisine tanımlı seferler` : 'Gezi kayıtları'}
        resourceName="Sefer"
        listTitle={scopedRouteId ? 'Sefer Listesi' : 'Gezi Listesi'}
        searchPlaceholder="Sefer kodu veya hedef ara..."
        service={{
          getList: (p) => travelService.getList(p),
          remove: can('travels.delete') ? (id) => travelService.delete(id) : undefined,
          toggleStatus: can('travels.edit') ? (id) => travelService.toggleStatus(id) : undefined,
        }}
        rowKey={(r) => r.id}
        selectable
        hideSelectedStat
        bulkActions={(rows) => (
          <Button variant="outline" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setBroadcastIds(rows.map((r) => r.id))}>
            SMS / Bildirim Gönder
          </Button>
        )}
        isActive={(r) => r.isActive}
        drawerWidth={780}
        defaultSort={{ key: 'startDate', dir: 'desc' }}
        refreshSignal={refreshSignal}
        onMutated={loadSummary}
        embedded={embedded && !scopedRouteId}
        extraParams={extraParams}
        filterColumns={3}
        hasActiveFilters={hasActiveFilters}
        filterCount={[statusFilter, startChanged, endChanged].filter(Boolean).length + (showPast ? 1 : 0)}
        onClearFilters={() => { setStatusFilter(''); setStartFilter(defaultStart); setEndFilter(defaultEnd); setShowPast(false) }}
        renderFilters={() => (
          <>
            <FilterField label="Durum">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tüm Durumlar</option>
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </Select>
            </FilterField>
            <FilterField label="Başlangıç (en erken)">
              <DatePicker value={startFilter} onChange={setStartFilter} clearable />
            </FilterField>
            <FilterField label="Bitiş (en geç)">
              <DatePicker value={endFilter} onChange={setEndFilter} clearable />
            </FilterField>
            <FilterField label="Geçmiş Seferler">
              <ToggleRow
                label="Geçmiş Seferleri Göster"
                description="Açıksa, bitiş tarihi geçmişte kalan seferler de listede görünür."
                checked={showPast}
                onChange={setShowPast}
              />
            </FilterField>
          </>
        )}
        columns={[
          { key: 'name', header: 'Gezi', sortable: true, sortKey: 'name', cell: (r) => (
            <div>
              <span className="type-body-strong">{r.name}</span>
              <span className="block type-caption tabular-nums">{r.code}</span>
            </div>
          ) },
          ...(scopedRouteId ? [] : [{ key: 'category', header: 'Kategori', cell: (r: Travel) => <Badge color={r.categoryColor}>{r.categoryName}</Badge> }]),
          { key: 'destination', header: 'Hedef', cell: (r) => <span className="type-muted">{r.destination || '—'}</span> },
          { key: 'date', header: 'Tarih', sortable: true, sortKey: 'startDate', cell: (r) => <span className="whitespace-nowrap type-muted">{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</span> },
          { key: 'capacity', header: 'Kontenjan', align: 'center', sortable: true, sortKey: 'capacity', cell: (r) => <span className="tabular-nums">{r.capacity.toLocaleString('tr-TR')}</span> },
          {
            key: 'registered', header: 'Kayıtlı', align: 'center',
            cell: (r) => (
              // Kullanıcı isteği (2026-08-05): sayıya tıklanınca artık liste/araç görünümü
              // arasında geçiş yapılabilen, Excel/Word export ve yazdır(PDF) seçenekli
              // TravelPassengerListModal açılıyor (bkz. o dosyadaki not).
              <button
                type="button"
                onClick={() => setPassengerTravel(r)}
                title="Yolcu listesini görüntüle"
                className="inline-flex items-center gap-1 rounded-field px-1.5 py-0.5 font-medium text-[hsl(var(--success))] tabular-nums transition-colors hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {r.registeredCount.toLocaleString('tr-TR')}
              </button>
            ),
          },
          {
            key: 'reserve', header: 'Yedek', align: 'center',
            cell: (r) => (
              <DrilldownCount count={r.reserveCount} title={`${r.name} — Yedek Liste`} subtitle="Bekleyen başvurular" icon={Users2Icon} triggerClassName="tabular-nums font-medium text-[hsl(var(--warning))]">
                <ApplicationsTab embedded scope={{ travelId: r.id, status: 'waitlist' }} onMutated={() => setRefreshSignal((s) => s + 1)} />
              </DrilldownCount>
            ),
          },
          { key: 'isActive', header: 'Durum', align: 'center', cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge> },
        ]}
        // Kullanıcı isteği (2026-08-07): "detaya inince sadece kendi grubundaki cartlar
        // istatistikler görünsün" — bir Gezi'nin (Route) veya Kategori'nin altındaki Seferler
        // görünümüne girildiğinde (scope set) çağıran bileşen (RoutesTab/CategoriesTab) zaten
        // kendi kapsam-özel stat kartlarını üstte gösteriyor; burada aynı sayıları TEKRAR
        // (bazen farklı/genel sayılarla, kafa karıştırıcı biçimde) göstermek yerine bu ikinci
        // kart satırı tamamen gizlenir. Ana Gezi Sistemi > Geziler sayfasında (scope yokken)
        // genel istatistikler burada gösterilmeye devam eder.
        stats={(scopedRouteId || scopedCategoryId) ? undefined : ({ total }) => [
          { label: 'Toplam Sefer', value: summary?.total ?? total, icon: MapPinIcon, accent: 'blue' },
          { label: 'Aktif', value: summary?.active ?? 0, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'Pasif', value: summary?.passive ?? 0, icon: PowerOffIcon, accent: 'orange' },
          { label: 'Toplam Kayıt', value: summary?.totalRegistered ?? 0, icon: Users2Icon, accent: 'violet' },
          { label: 'Toplam Kontenjan', value: summary?.totalCapacity ?? 0, icon: ArmchairIcon, accent: 'primary' },
          {
            label: 'Doluluk Oranı',
            value: summary && summary.totalCapacity > 0 ? `%${Math.round((summary.totalRegistered / summary.totalCapacity) * 100)}` : '%0',
            icon: ArmchairIcon,
            accent: 'blue',
          },
        ]}
        emptyForm={defaultEmptyForm}
        toForm={travelToForm}
        getFormErrors={(f, mode) => [
          !f.routeId && 'Gezi seçimi zorunludur.',
          !f.startDate && 'Başlangıç tarihi zorunludur.',
          !f.endDate && 'Bitiş tarihi zorunludur.',
          f.capacity <= 0 && 'Kapasite en az 1 olmalıdır.',
          (f.participationPeriod !== 'none' && f.participationLimit < 1) && 'Katılım limiti en az 1 olmalıdır.',
          // SORUN 3 düzeltmesi (2026-08-07, kullanıcı bulgusu — canlı testte kanıtlandı):
          // EmailInput'un kırmızı hata mesajı önceden yalnızca kozmetikti, submit'i hiç
          // engellemiyordu — geçersiz formatlı e-posta ("gecersiz-email-format" gibi)
          // sorunsuzca kaydediliyordu. Artık hem create hem edit'te kontrol ediliyor.
          !!f.crew.responsible.email && !isValidEmail(f.crew.responsible.email) && 'Sorumlu kişinin e-postası geçerli bir formatta olmalıdır.',
          ...(mode === 'create' ? [
            !!f.crew.driver.tckn && !isValidTckn(f.crew.driver.tckn) && 'Sürücü TC Kimlik Numarası geçersiz.',
            !isResponsiblePersonValid({ managerId: f.crew.responsible.id, manager: f.crew.responsible.name, managerPhone: f.crew.responsible.phone, tckn: f.crew.responsible.tckn, grantAccess: f.crew.responsible.grantAccess }) && 'Sorumlu kişi bilgileri eksik veya hatalı.',
          ] : []),
        ].filter(Boolean) as string[]}
        formShell
        renderForm={({ form, setForm, mode, editingRow }) => (
          <AdminFormShell
            icon={MapPinIcon}
            title={mode === 'edit' ? 'Sefer Bilgilerini Düzenle' : 'Yeni Sefer Ekle'}
            subtitle="Tarih, kapasite, araç ve ekip bilgileri"
            badge="Gezi Sistemi"
            tone="green"
          >
            <TravelForm
              form={form}
              setForm={setForm}
              mode={mode}
              editingRow={editingRow}
              lockedRouteId={scopedRouteId || undefined}
              lockedRouteName={scope?.routeName}
              advanceBookingDays={advanceBookingDays}
            />
          </AdminFormShell>
        )}
        deleteConfirm={{
          title: 'Seferi Sil',
          description: 'Bu sefer silinecek. Bu işlem geri alınamaz.',
        }}
        creatable={can('travels.create')}
        canEdit={() => can('travels.edit')}
        canDelete={() => can('travels.delete')}
        onCreate={can('travels.create') ? (f) => travelService.create(f).then(() => undefined) : undefined}
        onUpdate={can('travels.edit') ? (id, f) => travelService.update(id, f).then(() => undefined) : undefined}
        collapseRowActions
        extraRowActions={(row) => (
          <>
            <IconButton tone="default" title="Sefer detayları" onClick={() => setDetailTravel(row)}>
              <EyeIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Başvurular" onClick={() => navTo('applications', row.id)}>
              <ClipboardListIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone={row.attendanceTaken ? 'success' : 'primary'} title={row.attendanceTaken ? 'Yoklamayı Görüntüle' : 'Yoklama Al'} onClick={() => setAttendanceTravel(row)}>
              <ClipboardCheckIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Toplu T.C. ile yolcu ekle" onClick={() => setBulkTcknTravel(row)}>
              <UsersRoundIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Yolculara mesaj gönder (şablonlu)" onClick={() => setMessageTravel(row)}>
              <MessageSquareIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Araç koltuk / kontenjan düzeni" onClick={() => setSeatTravel(row)}>
              <BusIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Seferi kopyala" onClick={() => setCopySource(row)}>
              <CopyIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Çoklu sefer ekle — birden fazla tarihe aynı anda kopyala" onClick={() => setBulkCopySource(row)}>
              <CopyPlusIcon className="h-4 w-4" />
            </IconButton>
          </>
        )}
      />

      <TravelDetailModal travel={detailTravel} onClose={() => setDetailTravel(null)} />
      <TravelBusSeatModal travel={seatTravel} onClose={() => setSeatTravel(null)} />
      <TravelPassengerListModal travel={passengerTravel} onClose={() => setPassengerTravel(null)} />
      <TravelAttendanceMarkModal
        open={!!attendanceTravel}
        travel={attendanceTravel}
        onClose={() => setAttendanceTravel(null)}
        onSaved={() => setRefreshSignal((s) => s + 1)}
      />
      <TravelCopyModal travel={copySource} onClose={() => setCopySource(null)} onCopied={onCopied} />
      <TravelBulkCopyModal travel={bulkCopySource} onClose={() => setBulkCopySource(null)} onCopied={() => setRefreshSignal((s) => s + 1)} />
      <TravelBulkTcknModal travel={bulkTcknTravel} onClose={() => setBulkTcknTravel(null)} onDone={() => setRefreshSignal((s) => s + 1)} />
      <TravelSendMessageModal travel={messageTravel} onClose={() => setMessageTravel(null)} />
      <TravelSendMessageModal open={!!broadcastIds} target="travel" ids={broadcastIds ?? []} onClose={() => setBroadcastIds(null)} />
    </>
  )
}
