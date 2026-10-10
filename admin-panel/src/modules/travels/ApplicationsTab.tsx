import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ClipboardListIcon, CheckCircle2Icon, ClockIcon, XCircleIcon, Users2Icon, XIcon, FileDownIcon, MapPinIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import { Badge, Select, FilterField, DatePicker, Combobox, IconButton, Button } from '@/design-system'
import { downloadBlob, maskTC } from '@/lib/utils'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import travelApplicationService from '@/services/travelApplication.service'
import travelService from '@/services/travel.service'
import { TravelApplicationForm } from './TravelApplicationForm'
import { TravelApplicationDetail } from './TravelApplicationDetail'
import { RejectReasonModal } from '@/components/specialized/RejectReasonModal'
import { emptyApplicationForm, applicationToForm, applicationStatusMeta } from './travelFormDefaults'
import type { TravelApplication, TravelApplicationFormData, TravelApplicationSummary, ApplicationStatus } from '@/types/travel.types'

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')
const fmtTravelDateRange = (start?: string | null, end?: string | null) => {
  if (!start) return '—'
  const s = fmtDate(start)
  if (!end || new Date(end).toDateString() === new Date(start).toDateString()) return s
  return `${s} – ${fmtDate(end)}`
}

interface Props {
  embedded?: boolean
  scope?: { travelId?: string; status?: ApplicationStatus }
  onMutated?: () => void
}

export const ApplicationsTab = ({ embedded, scope, onMutated }: Props = {}) => {
  const { can } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlTravelId = embedded ? '' : (searchParams.get('travelId') ?? '')

  const scopedTravelId = scope?.travelId ?? urlTravelId
  const scopedStatus = scope?.status

  const [statusFilter, setStatusFilter] = useState('')
  const [startFilter, setStartFilter] = useState('')
  const [endFilter, setEndFilter] = useState('')
  const [travelFilter, setTravelFilter] = useState<{ id: string; label: string }>({ id: '', label: '' })
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('')
  const [neighborhoodOptions, setNeighborhoodOptions] = useState<string[]>([])
  const [genderFilter, setGenderFilter] = useState('')
  const [exporting, setExporting] = useState(false)
  const [summary, setSummary] = useState<TravelApplicationSummary | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [rejectTarget, setRejectTarget] = useState<{ ids: string[]; clear?: () => void; refresh?: () => void } | null>(null)

  const loadSummary = useCallback(() => {
    const p: Record<string, unknown> = {}
    if (scopedTravelId) p.travelId = scopedTravelId
    travelApplicationService.getSummary(p).then(setSummary).catch(() => setSummary(null))
  }, [scopedTravelId])
  useEffect(() => { loadSummary() }, [loadSummary])

  useEffect(() => {
    travelApplicationService.getNeighborhoodOptions(scopedTravelId || undefined)
      .then(setNeighborhoodOptions)
      .catch(() => setNeighborhoodOptions([]))
  }, [scopedTravelId, refreshSignal])

  const handleMutated = () => { loadSummary(); onMutated?.() }

  const changeStatus = async (id: string, status: ApplicationStatus) => {
    await travelApplicationService.setStatus(id, status)
    toast.success(status === 'approved' ? 'Başvuru onaylandı.' : 'Başvuru durumu güncellendi.')
    setRefreshSignal((s) => s + 1)
    handleMutated()
  }

  const confirmReject = async (reason: string) => {
    if (!rejectTarget) return
    const results = await Promise.allSettled(rejectTarget.ids.map((id) => travelApplicationService.setStatus(id, 'rejected', reason)))
    const ok = results.filter((x) => x.status === 'fulfilled').length
    if (ok) toast.success(ok > 1 ? `${ok} başvuru reddedildi.` : 'Başvuru reddedildi.')
    if (results.length - ok > 0) toast.warning(`${results.length - ok} başvuru işlenemedi (koltuk/kapasite kuralı).`)
    rejectTarget.clear?.()
    if (rejectTarget.refresh) rejectTarget.refresh(); else setRefreshSignal((s) => s + 1)
    handleMutated()
    setRejectTarget(null)
  }

  const clearTravelFilter = () =>
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('travelId'); return n })

  const hasActiveFilters = !!statusFilter || !!startFilter || !!endFilter || !!travelFilter.id || !!neighborhoodFilter || !!genderFilter
  const extraParams: Record<string, string> = {}
  if (scopedTravelId) extraParams.travelId = scopedTravelId
  else if (travelFilter.id) extraParams.travelId = travelFilter.id
  if (scopedStatus) extraParams.status = scopedStatus
  else if (statusFilter) extraParams.status = statusFilter
  if (startFilter) extraParams.startDate = startFilter
  if (endFilter) extraParams.endDate = endFilter
  if (neighborhoodFilter) extraParams.neighborhood = neighborhoodFilter
  if (genderFilter) extraParams.gender = genderFilter

  const doExport = async () => {
    setExporting(true)
    try {
      const { blob, fileName } = await travelApplicationService.exportExcel(extraParams)
      downloadBlob(blob, fileName)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      {!embedded && urlTravelId && (
        <div className="flex items-center justify-between rounded-card border border-border bg-[hsl(var(--info-soft))] px-3 py-2">
          <span className="type-body-strong text-[hsl(var(--info))]">Belirli bir gezinin başvuruları gösteriliyor.</span>
          <Button variant="ghost" size="sm" onClick={clearTravelFilter}><XIcon className="h-4 w-4" /> Filtreyi kaldır</Button>
        </div>
      )}

      <CrudListTemplate<TravelApplication, TravelApplicationFormData>
        icon={ClipboardListIcon}
        title="Başvurular"
        subtitle="Gezi başvuruları ve onay yönetimi"
        resourceName="Başvuru"
        listTitle="Başvuru Listesi"
        searchPlaceholder="Ad, soyad, TC, telefon veya e-posta ara..."
        embedded={embedded}
        service={{
          getList: (p) => travelApplicationService.getList(p),
          remove: can('travels.delete') ? (id) => travelApplicationService.delete(id) : undefined,
        }}
        rowKey={(r) => r.id}
        selectable
        viewable
        drawerWidth={640}
        defaultSort={{ key: 'applicationDate', dir: 'desc' }}
        refreshSignal={refreshSignal}
        onMutated={handleMutated}
        extraParams={extraParams}
        extraHeaderActions={
          <Button variant="outline" size="sm" isLoading={exporting} onClick={doExport}>
            <FileDownIcon className="h-4 w-4" /> Excel'e Aktar
          </Button>
        }
        filterColumns={embedded ? 4 : 5}
        hasActiveFilters={hasActiveFilters}
        filterCount={[statusFilter, startFilter, endFilter, travelFilter.id, neighborhoodFilter, genderFilter].filter(Boolean).length}
        onClearFilters={() => { setStatusFilter(''); setStartFilter(''); setEndFilter(''); setTravelFilter({ id: '', label: '' }); setNeighborhoodFilter(''); setGenderFilter('') }}
        bulkActions={(rows, { clear, refresh }) => {
          const bulkSet = async (status: ApplicationStatus, label: string) => {
            const targets = rows.filter((r) => r.status !== status)
            if (targets.length === 0) { toast.info(`Seçili başvurular zaten ${label}.`); return }
            const results = await Promise.allSettled(targets.map((r) => travelApplicationService.setStatus(r.id, status)))
            const ok = results.filter((x) => x.status === 'fulfilled').length
            if (ok) toast.success(`${ok} başvuru ${label}.`)
            if (results.length - ok > 0) toast.warning(`${results.length - ok} başvuru işlenemedi (koltuk/kapasite kuralı).`)
            clear(); refresh(); loadSummary()
          }
          return (
            <>
              <Button variant="outline" size="sm" className="text-success hover:bg-success-soft" onClick={() => bulkSet('approved', 'onaylandı')}>
                <CheckCircle2Icon className="h-4 w-4" /> Onayla
              </Button>
              <Button variant="outline" size="sm" className="text-danger hover:bg-danger-soft" onClick={() => {
                const ids = rows.filter((r) => r.status !== 'rejected').map((r) => r.id)
                if (ids.length === 0) { toast.info('Seçili başvurular zaten reddedildi.'); return }
                setRejectTarget({ ids, clear, refresh })
              }}>
                <XCircleIcon className="h-4 w-4" /> Reddet
              </Button>
            </>
          )
        }}
        renderFilters={() => (
          <>
            {!scopedTravelId && (
              <FilterField label="Gezi">
                <Combobox
                  value={travelFilter.id}
                  displayValue={travelFilter.label}
                  onChange={(v, opt) => setTravelFilter({ id: v, label: opt?.label ?? '' })}
                  onSearch={(q) => travelService.getOptions(q, true)}
                  placeholder="Tüm geziler"
                  clearable
                />
              </FilterField>
            )}
            {!scopedStatus && (
              <FilterField label="Durum">
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">Tüm Durumlar</option>
                  <option value="pending">Gönderildi</option>
                  <option value="reviewing">İnceleniyor</option>
                  <option value="approved">Onaylandı</option>
                  <option value="rejected">Reddedildi</option>
                  <option value="waitlist">Yedek Liste</option>
                </Select>
              </FilterField>
            )}
            <FilterField label="Başlangıç">
              <DatePicker value={startFilter} max={endFilter || undefined} onChange={setStartFilter} clearable />
            </FilterField>
            <FilterField label="Bitiş">
              <DatePicker value={endFilter} min={startFilter || undefined} onChange={setEndFilter} clearable />
            </FilterField>
            <FilterField label="Mahalle">
              <Select value={neighborhoodFilter} onChange={(e) => setNeighborhoodFilter(e.target.value)} disabled={neighborhoodOptions.length === 0}>
                <option value="">{neighborhoodOptions.length === 0 ? 'Mahalle verisi yok' : 'Tüm Mahalleler'}</option>
                {neighborhoodOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Cinsiyet">
              <Select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
                <option value="">Tümü</option>
                <option value="female">Kadın</option>
                <option value="male">Erkek</option>
              </Select>
            </FilterField>
          </>
        )}
        stats={({ total }) => [
          { label: 'Toplam Başvuru', value: summary?.total ?? total, icon: ClipboardListIcon, accent: 'blue' },
          { label: 'Onaylandı', value: summary?.approved ?? 0, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'İnceleniyor', value: summary?.reviewing ?? 0, icon: ClockIcon, accent: 'orange' },
          { label: 'Reddedildi', value: summary?.rejected ?? 0, icon: XCircleIcon, accent: 'violet' },
          { label: 'Yedek Liste', value: summary?.waitlist ?? 0, icon: Users2Icon, accent: 'primary' },
        ]}
        columns={[
          {
            key: 'participant', header: 'Ad Soyad', sortable: true, sortKey: 'participantName',
            cell: (r) => (
              <div className="flex flex-col gap-0.5">
                <span className="type-body-strong">{r.participantName}</span>
                {r.isGuest && (
                  <span className="type-muted">Başvuran: {r.applicantName || '—'}</span>
                )}
              </div>
            ),
          },
          { key: 'travel', header: 'Gezi', cell: (r) => <span className="type-muted">{r.travelName}</span> },
          {
            key: 'travelDate', header: 'Gezi Tarihi', align: 'center', hideable: true, sortable: true, sortKey: 'travelStartDate',
            cell: (r) => <span className="whitespace-nowrap type-muted">{fmtTravelDateRange(r.travelStartDate, r.travelEndDate)}</span>,
          },
          { key: 'tckn', header: 'TC Kimlik', hideable: true, cell: (r) => <span className="tabular-nums type-muted">{maskTC(r.tckn)}</span> },
          { key: 'phone', header: 'Telefon', hideable: true, cell: (r) => <span className="tabular-nums type-muted">{r.phone || '—'}</span> },
          {
            key: 'address', header: 'Adres', hideable: true, defaultHidden: true,
            cell: (r) => r.address
              ? <span className="type-muted truncate max-w-[220px] inline-block" title={r.address}>{r.address}</span>
              : <span className="type-muted">—</span>,
          },
          {
            key: 'neighborhood', header: 'Mahalle', hideable: true, sortable: true, sortKey: 'neighborhood',
            cell: (r) => r.neighborhood
              ? <span className="inline-flex items-center gap-1 type-muted"><MapPinIcon className="h-3 w-3" />{r.neighborhood}</span>
              : <span className="type-muted">—</span>,
          },
          { key: 'gender', header: 'Cinsiyet', align: 'center', hideable: true, cell: (r) => <Badge tone={r.gender === 'female' ? 'info' : 'primary'}>{r.gender === 'female' ? 'Kadın' : 'Erkek'}</Badge> },
          { key: 'date', header: 'Başvuru', align: 'center', sortable: true, sortKey: 'applicationDate', cell: (r) => <span className="whitespace-nowrap type-muted">{fmtDate(r.applicationDate)}</span> },
          { key: 'seat', header: 'Koltuk', align: 'center', hideable: true, cell: (r) => <span className="tabular-nums">{r.seatNumber ? `#${r.seatNumber}` : '—'}</span> },
          { key: 'status', header: 'Durum', align: 'center', cell: (r) => { const m = applicationStatusMeta(r.status); return (
            <div className="leading-tight">
              <Badge tone={m.tone}>{m.label}</Badge>
              {r.status === 'rejected' && r.rejectionReason && <span className="mt-0.5 block max-w-48 truncate type-caption" title={r.rejectionReason}>{r.rejectionReason}</span>}
            </div>
          ) } },
        ]}
        emptyForm={{ ...emptyApplicationForm(), travelId: scopedTravelId, status: scopedStatus ?? 'pending' }}
        toForm={applicationToForm}
        getFormErrors={(f) => [
          !f.participantId && 'Katılımcı seçimi zorunludur.',
          !f.travelId && 'Gezi seçimi zorunludur.',
        ].filter(Boolean) as string[]}
        renderForm={({ form, setForm, mode, editingRow }) => <TravelApplicationForm form={form} setForm={setForm} mode={mode} editingRow={editingRow} />}
        renderView={(row) => <TravelApplicationDetail app={row} />}
        deleteConfirm={{ title: 'Başvuruyu Sil', description: 'Bu başvuruyu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.' }}
        creatable={can('travels.create')}
        canEdit={() => can('travels.edit')}
        canDelete={() => can('travels.delete')}
        onCreate={can('travels.create') ? (f) => travelApplicationService.create(f).then(() => undefined) : undefined}
        onUpdate={can('travels.edit') ? (id, f) => travelApplicationService.update(id, f).then(() => undefined) : undefined}
        extraRowActions={(row) => (
          <>
            <IconButton tone="success" title={row.status === 'rejected' ? 'Reddedilmiş başvuru doğrudan onaylanamaz.' : 'Onayla'} disabled={row.status === 'approved' || row.status === 'rejected'} onClick={() => changeStatus(row.id, 'approved')}>
              <CheckCircle2Icon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="danger" title="Reddet" disabled={row.status === 'rejected'} onClick={() => setRejectTarget({ ids: [row.id] })}>
              <XCircleIcon className="h-4 w-4" />
            </IconButton>
          </>
        )}
      />
      <RejectReasonModal open={!!rejectTarget} count={rejectTarget?.ids.length} onClose={() => setRejectTarget(null)} onConfirm={confirmReject} />
    </>
  )
}
