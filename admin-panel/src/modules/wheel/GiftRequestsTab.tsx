import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ClipboardListIcon, ClockIcon, CheckCircle2Icon, XCircleIcon, AwardIcon, MessageSquareIcon, TruckIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Select, Combobox, FilterField, IconButton, Modal, ConfirmModal, Textarea, Button, Badge, Banner,
  SegmentedControl, type SegmentOption,
} from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import { useAuth } from '@/framework/auth/AuthContext'
import giftRequestService from '@/services/giftRequest.service'
import giftService from '@/services/gift.service'
import { refreshSidebarBadges } from '@/lib/sidebarBadge'
import type { SelectOption } from '@/types/common'
import type { GiftRequest, GiftRequestSummary } from '@/types/giftRequest.types'
import {
  GIFT_REQUEST_STATUS_LABELS, GIFT_REQUEST_STATUS_TONE, GIFT_REQUEST_STATUS_OPTIONS,
  GIFT_REQUEST_SOURCE_LABELS, GIFT_REQUEST_SOURCE_TONE,
} from '@/types/giftRequest.types'
import { giftRequestColumns } from './giftRequestColumns'
import { WheelSendMessageModal } from './WheelSendMessageModal'

type NoForm = Record<string, never>

const fmtDateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString('tr-TR') : '—')

const Info = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="min-w-0">
    <p className="type-caption">{label}</p>
    <p className="truncate text-foreground-strong">{value}</p>
  </div>
)

interface GiftRequestsTabProps {
  scope?: { giftId: string }
  embedded?: boolean
  onMutated?: () => void
}

export const GiftRequestsTab = ({ scope, embedded = false, onMutated }: GiftRequestsTabProps = {}) => {
  const { can } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const [highlightKey, setHighlightKey] = useState<string | null>(null)

  const lockedGiftId = scope?.giftId
  const [giftFilter, setGiftFilter] = useState(lockedGiftId ?? '')
  const [statusFilter, setStatusFilter] = useState('')
  const [giftOptions, setGiftOptions] = useState<SelectOption[]>([])
  const [summary, setSummary] = useState<GiftRequestSummary | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)

  useEffect(() => {
    if (highlightId) setHighlightKey(highlightId)
  }, [highlightId])

  useEffect(() => {
    if (!highlightKey) return
    const timer = setTimeout(() => {
      setHighlightKey(null)
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev)
        n.delete('highlight')
        return n
      }, { replace: true })
    }, 3200)
    return () => clearTimeout(timer)
  }, [highlightKey, setSearchParams])

  const scrollToHighlight = useCallback(() => {
    if (!highlightId) return
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-row-key="${highlightId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [highlightId])

  const [approveRow, setApproveRow] = useState<GiftRequest | null>(null)
  const [rejectRow, setRejectRow] = useState<GiftRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [deliverRow, setDeliverRow] = useState<GiftRequest | null>(null)
  const [deliverNote, setDeliverNote] = useState('')
  const [working, setWorking] = useState(false)
  const [templateIds, setTemplateIds] = useState<string[] | null>(null)
  const [bulkAction, setBulkAction] = useState<{ type: 'approve' | 'reject'; rows: GiftRequest[]; clear: () => void; refresh: () => void } | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  useEffect(() => {
    if (embedded) return
    let active = true
    giftService.getOptions()
      .then((o) => { if (active) setGiftOptions(o) })
      .catch(() => { if (active) setGiftOptions([]) })
    return () => { active = false }
  }, [embedded])

  const fetchSummary = useCallback(async () => {
    const params: Record<string, string> = {}
    if (giftFilter) params.giftId = giftFilter
    try { setSummary(await giftRequestService.getSummary(params)) }
    catch { setSummary(null) }
  }, [giftFilter])
  useEffect(() => { fetchSummary() }, [fetchSummary])

  const handleMutated = useCallback(() => {
    fetchSummary(); refreshSidebarBadges(); onMutated?.()
  }, [fetchSummary, onMutated])

  const doApprove = async () => {
    if (!approveRow) return
    setWorking(true)
    try {
      await giftRequestService.approve(approveRow.id)
      toast.success(approveRow.isWinner ? 'Kazanan talep onaylandı.' : 'Talep onaylandı.')
      setApproveRow(null); setRefreshSignal((s) => s + 1); handleMutated()
    } finally { setWorking(false) }
  }

  const doReject = async () => {
    if (!rejectRow) return
    setWorking(true)
    try {
      await giftRequestService.reject(rejectRow.id, rejectReason.trim() || undefined)
      toast.success('Talep reddedildi.')
      setRejectRow(null); setRejectReason(''); setRefreshSignal((s) => s + 1); handleMutated()
    } finally { setWorking(false) }
  }

  const doDeliver = async () => {
    if (!deliverRow) return
    setWorking(true)
    try {
      await giftRequestService.deliver(deliverRow.id, deliverNote.trim() || undefined)
      toast.success('Hediye teslim edildi olarak işaretlendi.')
      setDeliverRow(null); setDeliverNote(''); setRefreshSignal((s) => s + 1); handleMutated()
    } finally { setWorking(false) }
  }

  const runBulkAction = async () => {
    if (!bulkAction) return
    setBulkBusy(true)
    try {
      const targets = bulkAction.rows.filter((r) => r.status === 'pending')
      const results = await Promise.allSettled(
        targets.map((r) => (bulkAction.type === 'approve' ? giftRequestService.approve(r.id) : giftRequestService.reject(r.id))),
      )
      const ok = results.filter((x) => x.status === 'fulfilled').length
      const label = bulkAction.type === 'approve' ? 'onaylandı' : 'reddedildi'
      if (ok) toast.success(`${ok} talep ${label}.`)
      if (results.length - ok > 0) toast.warning(`${results.length - ok} talep işlenemedi.`)
      bulkAction.clear(); bulkAction.refresh(); handleMutated()
      setBulkAction(null)
    } finally { setBulkBusy(false) }
  }

  const statusSegments: SegmentOption[] = [
    { value: '', label: `Tümü · ${(summary?.total ?? 0).toLocaleString('tr-TR')}`, tone: 'blue' },
    { value: 'pending', label: `Bekleyen · ${(summary?.pending ?? 0).toLocaleString('tr-TR')}`, tone: 'orange' },
    { value: 'approved', label: `Onaylanan · ${(summary?.approved ?? 0).toLocaleString('tr-TR')}`, tone: 'green' },
    { value: 'rejected', label: `Reddedilen · ${(summary?.rejected ?? 0).toLocaleString('tr-TR')}`, tone: 'red' },
  ]

  const extraParams: Record<string, string> = {}
  if (giftFilter) extraParams.giftId = giftFilter
  if (statusFilter) extraParams.status = statusFilter

  return (
    <>
      {embedded && (
        <div className="mb-4">
          <SegmentedControl columns={4} value={statusFilter} onChange={setStatusFilter} options={statusSegments} />
        </div>
      )}
      <CrudListTemplate<GiftRequest, NoForm>
        icon={ClipboardListIcon}
        title="Hediye Talepleri"
        subtitle="Kullanıcıların hediye taleplerini inceleyin; kazananları onaylayın veya reddedin"
        resourceName="Talep"
        listTitle="Talep Listesi"
        creatable={false}
        embedded={embedded}
        service={{ getList: (p) => giftRequestService.getList(p) }}
        rowKey={(r) => r.id}
        columns={giftRequestColumns}
        defaultSort={{ key: 'requestedAt', dir: 'desc' }}
        searchPlaceholder="Ad, soyad, TC veya telefon ara..."
        refreshSignal={refreshSignal}
        highlightedRowKey={highlightKey}
        onDataLoad={scrollToHighlight}
        onMutated={handleMutated}
        filterColumns={2}
        extraParams={extraParams}
        hasActiveFilters={(!embedded && !!giftFilter) || !!statusFilter}
        onClearFilters={() => { if (!embedded) setGiftFilter(''); setStatusFilter('') }}
        renderFilters={embedded ? undefined : () => (
          <>
            <FilterField label="Hediye">
              <Combobox
                value={giftFilter}
                displayValue={giftOptions.find((o) => o.value === giftFilter)?.label}
                options={giftOptions}
                onChange={(v) => setGiftFilter(v)}
                clearable
                placeholder="Tüm Hediyeler"
                emptyText="Hediye bulunamadı"
              />
            </FilterField>
            <FilterField label="Durum">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tüm Durumlar</option>
                {GIFT_REQUEST_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
          </>
        )}
        stats={({ total }) => [
          { label: 'Toplam Talep', value: summary?.total ?? total, icon: ClipboardListIcon, accent: 'blue' },
          { label: 'Bekleyen', value: summary?.pending ?? 0, icon: ClockIcon, accent: 'orange' },
          { label: 'Onaylanan', value: summary?.approved ?? 0, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'Reddedilen', value: summary?.rejected ?? 0, icon: XCircleIcon, accent: 'primary' },
          { label: 'Kazanan', value: summary?.winners ?? 0, icon: AwardIcon, accent: 'violet' },
        ]}
        emptyForm={{} as NoForm}
        toForm={() => ({} as NoForm)}
        canEdit={() => false}
        viewable
        selectable
        bulkActions={(rows, { clear, refresh }) => (
          <>
            <Button variant="outline" size="sm" className="text-success hover:bg-success-soft"
              disabled={!rows.some((r) => r.status === 'pending')}
              onClick={() => setBulkAction({ type: 'approve', rows, clear, refresh })}>
              <CheckCircle2Icon className="h-4 w-4" /> Toplu Onayla
            </Button>
            <Button variant="outline" size="sm" className="text-danger hover:bg-danger-soft"
              disabled={!rows.some((r) => r.status === 'pending')}
              onClick={() => setBulkAction({ type: 'reject', rows, clear, refresh })}>
              <XCircleIcon className="h-4 w-4" /> Toplu Reddet
            </Button>
            {can('wheel.edit') && (
              <Button variant="primary" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setTemplateIds(rows.map((r) => r.id))}>
                SMS / Bildirim Gönder
              </Button>
            )}
          </>
        )}
        renderView={(row) => (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <Info label="Sıra No" value={`#${row.orderNumber}`} />
              <Info label="Durum" value={<Badge tone={GIFT_REQUEST_STATUS_TONE[row.status]}>{GIFT_REQUEST_STATUS_LABELS[row.status]}</Badge>} />
              <Info label="Ad Soyad" value={row.citizenName} />
              <Info label="TC Kimlik" value={row.citizenTc} />
              <Info label="Telefon" value={row.citizenPhone || '—'} />
              <Info label="Hediye" value={`${row.giftName} · ${(row.giftPoints ?? 0).toLocaleString('tr-TR')} Puan`} />
              <Info label="Kaynak" value={<Badge tone={GIFT_REQUEST_SOURCE_TONE[row.source]}>{GIFT_REQUEST_SOURCE_LABELS[row.source]}</Badge>} />
              <Info label="Talep Tarihi" value={fmtDateTime(row.requestedAt)} />
              <Info label="Kazanan" value={row.isWinner ? 'Evet' : 'Hayır'} />
            </div>
            {row.status === 'approved' && (
              <Banner tone="success" variant="soft" icon={CheckCircle2Icon}>
                {row.approvedBy ? `${row.approvedBy} tarafından onaylandı` : 'Onaylandı'} · {fmtDateTime(row.approvedAt)}
              </Banner>
            )}
            {row.status === 'approved' && row.deliveredAt && (
              <Banner tone="info" variant="soft" icon={TruckIcon}>
                {row.deliveredBy ? `${row.deliveredBy} tarafından teslim edildi` : 'Teslim edildi'} · {fmtDateTime(row.deliveredAt)}
                {row.deliveryNote ? ` · Not: ${row.deliveryNote}` : ''}
              </Banner>
            )}
            {row.status === 'rejected' && (
              <Banner tone="danger" variant="soft" icon={XCircleIcon}>
                {row.rejectedBy ? `${row.rejectedBy} tarafından reddedildi` : 'Reddedildi'} · {fmtDateTime(row.rejectedAt)}
                {row.rejectReason ? ` · Sebep: ${row.rejectReason}` : ''}
              </Banner>
            )}
          </div>
        )}
        renderForm={() => null}
        extraRowActions={(row) => (
          <>
            <IconButton tone="success" title="Onayla" disabled={row.status !== 'pending'} onClick={() => setApproveRow(row)}>
              <CheckCircle2Icon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="danger" title="Reddet" disabled={row.status !== 'pending'} onClick={() => setRejectRow(row)}>
              <XCircleIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="primary" title="Teslim Edildi Olarak İşaretle" disabled={row.status !== 'approved' || !!row.deliveredAt} onClick={() => setDeliverRow(row)}>
              <TruckIcon className="h-4 w-4" />
            </IconButton>
          </>
        )}
      />

      <ConfirmModal
        open={!!approveRow}
        onClose={() => setApproveRow(null)}
        onConfirm={doApprove}
        icon={approveRow?.isWinner ? AwardIcon : CheckCircle2Icon}
        tone="primary"
        title={approveRow?.isWinner ? 'Kazananı Onayla' : 'Talebi Onayla'}
        description={approveRow
          ? `${approveRow.citizenName} adlı kullanıcının "${approveRow.giftName}" talebi onaylanacak. Devam edilsin mi?`
          : ''}
        confirmLabel="Onayla"
        loading={working}
      />

      <Modal
        open={!!rejectRow}
        onClose={() => { setRejectRow(null); setRejectReason('') }}
        title="Talebi Reddet"
        subtitle={rejectRow ? `${rejectRow.citizenName} · ${rejectRow.giftName}` : undefined}
        width={460}
        bodyClassName="px-6 py-5"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setRejectRow(null); setRejectReason('') }}>Vazgeç</Button>
            <Button variant="danger" className="flex-1" isLoading={working} disabled={working} onClick={doReject}>Reddet</Button>
          </div>
        }
      >
        <Textarea
          rows={3}
          placeholder="Red nedeni (opsiyonel) — kullanıcıya iletilebilir"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>

      <Modal
        open={!!deliverRow}
        onClose={() => { setDeliverRow(null); setDeliverNote('') }}
        title="Hediyeyi Teslim Edildi Olarak İşaretle"
        subtitle={deliverRow ? `${deliverRow.citizenName} · ${deliverRow.giftName}` : undefined}
        width={460}
        bodyClassName="px-6 py-5"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setDeliverRow(null); setDeliverNote('') }}>Vazgeç</Button>
            <Button variant="primary" className="flex-1" isLoading={working} disabled={working} onClick={doDeliver}>Teslim Edildi</Button>
          </div>
        }
      >
        <Textarea
          rows={3}
          placeholder="Teslimat notu (opsiyonel) — örn. kargo takip no, teslim alan kişi"
          value={deliverNote}
          onChange={(e) => setDeliverNote(e.target.value)}
        />
      </Modal>
      <ConfirmModal
        open={!!bulkAction}
        onClose={() => setBulkAction(null)}
        onConfirm={runBulkAction}
        icon={bulkAction?.type === 'approve' ? CheckCircle2Icon : XCircleIcon}
        tone={bulkAction?.type === 'approve' ? 'primary' : 'danger'}
        title={bulkAction?.type === 'approve' ? 'Seçili Talepleri Onayla' : 'Seçili Talepleri Reddet'}
        description={bulkAction
          ? `Seçili ${bulkAction.rows.filter((r) => r.status === 'pending').length} bekleyen talep ${bulkAction.type === 'approve' ? 'onaylanacak' : 'reddedilecek'}. Devam edilsin mi?`
          : ''}
        confirmLabel={bulkAction?.type === 'approve' ? 'Onayla' : 'Reddet'}
        loading={bulkBusy}
      />

      <WheelSendMessageModal open={!!templateIds} ids={templateIds ?? []} onClose={() => setTemplateIds(null)} />
    </>
  )
}
