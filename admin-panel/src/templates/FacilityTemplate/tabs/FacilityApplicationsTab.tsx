import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  FileTextIcon, ClockIcon, CheckCircle2Icon, XCircleIcon,
  EyeIcon, CheckIcon, XIcon, DownloadIcon, SearchIcon, ExternalLinkIcon,
  UserIcon, PhoneIcon, MailIcon, CalendarIcon, LayersIcon, MessageSquareIcon,
  Trash2Icon, HistoryIcon,
} from 'lucide-react'
import {
  DataTable, FilterBar, FilterField, Input, Select, StatCard, Badge, Banner,
  IconButton, Button, Modal, DatePicker, EmptyState, Field, ConfirmModal,
  type DataTableColumn, type SortState,
} from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import { useUiStandards } from '@/design-system/UiStandards/UiStandards'
import { FacilitySendMessageModal } from '../FacilitySendMessageModal'
import { AttendanceHistoryModal } from '../AttendanceHistoryModal'
import { formatDate, downloadBlob } from '@/lib/utils'
import type { FacilityModuleConfig } from '../moduleConfig'
import type { FacilityModuleService, BulkApproveResult } from '../types'
import type { FacilityApplication, ApplicationStatus, BranchRecord, GroupRecord } from '@/types/facility.types'

interface Props {
  config: FacilityModuleConfig
  service: FacilityModuleService
  facilityId: string
  scope?: { groupId?: string; status?: ApplicationStatus }
  embedded?: boolean
  onMutated?: () => void
  // Kullanıcı isteği (2026-10-01): üst başlıktaki genel aramadan bir başvuru sonucuna tıklandığında
  // doğrudan bu tesis + bu kişi adı/TC'siyle önceden filtrelenmiş olarak açılsın.
  initialSearch?: string
}

const STATUS_META: Record<ApplicationStatus, { label: string; tone: 'warning' | 'success' | 'danger' | 'info' }> = {
  pending: { label: 'Beklemede', tone: 'warning' },
  approved: { label: 'Onaylı', tone: 'success' },
  waitlist: { label: 'Yedek', tone: 'info' },
  rejected: { label: 'Reddedildi', tone: 'danger' },
  expired: { label: 'Süresi Doldu', tone: 'danger' },
}

export const FacilityApplicationsTab = ({ config, service, facilityId, scope, embedded, onMutated, initialSearch }: Props) => {
  const T = config.terminology
  const pilot = useUiStandards()
  const { can } = useAuth()
  const canDelete = can('service-facilities.edit')
  const lockedGroupId = scope?.groupId ?? ''
  const lockedStatus = scope?.status ?? ''
  const [rows, setRows] = useState<FacilityApplication[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [search, setSearch] = useState(initialSearch ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch ?? '')
  const [branch, setBranch] = useState('')
  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  const [sort, setSort] = useState<SortState | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [viewing, setViewing] = useState<FacilityApplication | null>(null)
  const [viewActBusy, setViewActBusy] = useState<'approve' | 'reject' | null>(null)
  const [branchOptions, setBranchOptions] = useState<BranchRecord[]>([])
  const [groupOptions, setGroupOptions] = useState<GroupRecord[]>([])
  const [approving, setApproving] = useState<FacilityApplication | null>(null)
  const [approveGroupId, setApproveGroupId] = useState('')
  const [approveBusy, setApproveBusy] = useState(false)
  const [bulkPreview, setBulkPreview] = useState<BulkApproveResult | null>(null)
  const [bulkIds, setBulkIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ url: string; label: string; fileName?: string } | null>(null)
  const [templateMessageIds, setTemplateMessageIds] = useState<string[] | null>(null)
  const [deleting, setDeleting] = useState<FacilityApplication | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [viewingRegistrationId, setViewingRegistrationId] = useState<string | null | undefined>(undefined)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    service.branches.getList({ page: 1, limit: 200 }).then((r) => setBranchOptions(r.items)).catch(() => setBranchOptions([]))
  }, [service])

  useEffect(() => {
    service.groups.getList({ page: 1, limit: 200, facilityId }).then((r) => setGroupOptions(r.items)).catch(() => setGroupOptions([]))
  }, [service, facilityId])

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await service.applications.getList({
        facilityId, page, limit, search: debouncedSearch,
        branchId: branch, groupId: lockedGroupId || undefined,
        status: lockedStatus || status, date,
        sort: sort?.key, order: sort?.dir,
      })
      setRows(res.items)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch {
      setRows([]); setTotal(0); setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [service, facilityId, page, limit, debouncedSearch, branch, lockedGroupId, lockedStatus, status, date, sort])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    if (!viewing || (viewing.status !== 'approved' && viewing.status !== 'waitlist')) {
      setViewingRegistrationId(undefined)
      return
    }
    let active = true
    setViewingRegistrationId(undefined)
    setHistoryOpen(false)
    service.applications.getRegistrationId(viewing.id)
      .then((id) => { if (active) setViewingRegistrationId(id) })
      .catch(() => { if (active) setViewingRegistrationId(null) })
    return () => { active = false }
  }, [viewing, service])

  const hasActiveFilters = embedded ? false : (!!branch || !!status || !!date)
  const clearFilters = () => { setBranch(''); setStatus(''); setDate(''); setPage(1) }

  const notifyMutated = () => { onMutated?.(); }

  const reject = async (row: FacilityApplication) => {
    await service.applications.reject(row.id)
    toast.success('Başvuru reddedildi.')
    fetch()
    notifyMutated()
  }

  const rejectViewing = async () => {
    if (!viewing) return
    setViewActBusy('reject')
    try {
      await service.applications.reject(viewing.id)
      toast.success('Başvuru reddedildi.')
      setViewing(null)
      fetch()
      notifyMutated()
    } finally {
      setViewActBusy(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await service.applications.remove(deleting.id)
      toast.success('Başvuru silindi.')
      setDeleting(null)
      setViewing(null)
      fetch()
      notifyMutated()
    } finally {
      setDeleteBusy(false)
    }
  }

  const openApprove = (row: FacilityApplication) => {
    setViewing(null)
    setApproving(row)
    setApproveGroupId(row.groupId ?? '')
  }

  const approveGroups = approving
    ? groupOptions.filter((g) => g.branchId === approving.branchId && g.isActive)
    : []

  const approveGroup = approveGroups.find((g) => g.id === approveGroupId)
  const apMainFull = !!approveGroup && approveGroup.capacity > 0 && approveGroup.registeredCount >= approveGroup.capacity
  const apReserveFull = !!approveGroup && approveGroup.reserveCapacity > 0 && approveGroup.waitlistCount >= approveGroup.reserveCapacity
  const apBothFull = apMainFull && apReserveFull

  const confirmApprove = async () => {
    if (!approving || !approveGroupId) return
    setApproveBusy(true)
    try {
      await service.applications.approve(approving.id, approveGroupId)
      toast.success('Başvuru işleme alındı.')
      setApproving(null)
      fetch()
      notifyMutated()
    } finally {
      setApproveBusy(false)
    }
  }

  const hasPendingSelected = rows.some((r) => selected.has(r.id) && r.status === 'pending')

  const openBulkApprove = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setBulkBusy(true)
    try {
      const preview = await service.applications.bulkApprove(ids, true)
      setBulkIds(ids)
      setBulkPreview(preview)
    } finally {
      setBulkBusy(false)
    }
  }

  const confirmBulkApprove = async () => {
    setBulkBusy(true)
    try {
      const res = await service.applications.bulkApprove(bulkIds, false)
      const parts: string[] = []
      if (res.approved) parts.push(`${res.approved} asıl`)
      if (res.waitlisted) parts.push(`${res.waitlisted} yedek`)
      if (res.rejected) parts.push(`${res.rejected} iptal`)
      toast.success(parts.length ? `İşlem tamamlandı: ${parts.join(' · ')}` : 'İşlem tamamlandı.')
      setBulkPreview(null)
      setSelected(new Set())
      fetch()
      notifyMutated()
    } finally {
      setBulkBusy(false)
    }
  }

  const exportCsv = () => {
    const picked = rows.filter((r) => selected.has(r.id))
    if (picked.length === 0) return
    const head = ['Ad Soyad', 'TC Kimlik', 'Telefon', 'E-posta', T.branchSingular, 'Grup', 'Başvuru Tarihi', 'Durum', 'Evrak Eksik']
    const lines = picked.map((r) => [r.fullName, r.tckn, r.phone, r.email ?? '', r.branchName, r.groupName ?? '', formatDate(r.appliedAt), STATUS_META[r.status].label, r.hasMissingDocuments ? 'Evet' : 'Hayır'])
    const csv = [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `basvurular-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doExportExcel = async () => {
    setExporting(true)
    try {
      const { blob, fileName } = await service.applications.exportExcel({
        facilityId, search: debouncedSearch,
        branchId: branch, groupId: lockedGroupId || undefined,
        status: lockedStatus || status, date,
      })
      downloadBlob(blob, fileName)
      toast.success('Excel dosyası indirildi.')
    } finally {
      setExporting(false)
    }
  }

  const columns: DataTableColumn<FacilityApplication>[] = [
    {
      key: 'seq', header: 'Sıra No', align: 'center', width: 'w-14',
      cell: (_r, idx) => (
        <span className="text-[13px] font-bold tabular-nums text-foreground-strong">
          {(page - 1) * limit + idx + 1}
        </span>
      ),
    },
    {
      key: 'fullName', header: 'Ad Soyad', sortable: true, sortKey: 'fullName',
      cell: (r) => (
        <div>
          <p className="type-body-strong">{r.fullName}</p>
          <p className="type-caption">{r.tckn}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Telefon', cell: (r) => r.phone },
    {
      key: 'branchGroup', header: `${T.branchSingular} / Grup`,
      cell: (r) => (
        <div className="space-y-0.5">
          <p className="text-[12px] font-semibold text-foreground">{r.branchName}</p>
          {r.groupName && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--accent-violet-soft))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--accent-violet))]">
              <LayersIcon className="h-2.5 w-2.5" />{r.groupName}
            </span>
          )}
        </div>
      ),
    },
    { key: 'appliedAt', header: 'Başvuru Tarihi', sortable: true, sortKey: 'appliedAt', cell: (r) => formatDate(r.appliedAt) },
    {
      key: 'status', header: 'Durum', cell: (r) => (
        <div className="flex flex-col gap-1">
          <Badge tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</Badge>
          {r.hasMissingDocuments && <Badge tone="warning">Evrak Eksik</Badge>}
        </div>
      ),
    },
  ]

  return (
    <>
      {!embedded && (
        <div className={pilot ? 'pilot-stat-grid pilot-stat-grid-4' : 'grid grid-cols-4 gap-3'}>
          <StatCard label="Toplam Başvuru" value={total} icon={FileTextIcon} accent="blue" loading={loading} />
          <StatCard label="Beklemede" value={rows.filter((r) => r.status === 'pending').length} icon={ClockIcon} accent="orange" loading={loading} />
          <StatCard label="Onaylı" value={rows.filter((r) => r.status === 'approved').length} icon={CheckCircle2Icon} accent="green" loading={loading} />
          <StatCard label="Reddedildi" value={rows.filter((r) => r.status === 'rejected').length} icon={XCircleIcon} accent="violet" loading={loading} />
        </div>
      )}

      {!embedded && (
        <FilterBar
          columns={3}
          searchLabel="Başvuru Ara"
          search={<Input placeholder="Ad, TC veya telefon ara..." value={search} onChange={(e) => setSearch(e.target.value)} iconLeft={<SearchIcon className="h-3.5 w-3.5" />} />}
          filterCount={(branch ? 1 : 0) + (status ? 1 : 0) + (date ? 1 : 0)}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
        >
          {!lockedGroupId && (
            <FilterField label={T.branchSingular}>
              <Select searchable searchPlaceholder="Ara..." value={branch} onChange={(e) => { setBranch(e.target.value); setPage(1) }}>
                <option value="">Tümü</option>
                {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </FilterField>
          )}
          {!lockedStatus && (
            <FilterField label="Durum">
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
                <option value="">Tümü</option>
                <option value="pending">Beklemede</option>
                <option value="approved">Onaylı</option>
                <option value="waitlist">Yedek</option>
                <option value="rejected">Reddedildi</option>
                <option value="expired">Süresi Doldu</option>
              </Select>
            </FilterField>
          )}
          <FilterField label="Başvuru Tarihi">
            <DatePicker value={date} onChange={(v) => { setDate(v); setPage(1) }} clearable />
          </FilterField>
        </FilterBar>
      )}

      <DataTable<FacilityApplication>
        title={`${T.facilitySingular} Başvuruları`}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        toolbarActions={
          <Button variant="outline" size="sm" isLoading={exporting} onClick={doExportExcel}>
            <DownloadIcon className="h-4 w-4" /> Excel'e Aktar (Gruplara Göre)
          </Button>
        }
        selectionActions={
          <>
            <Button variant="primary" size="sm" disabled={!hasPendingSelected} isLoading={bulkBusy && !bulkPreview} onClick={openBulkApprove}>
              <CheckIcon className="h-4 w-4" /> Toplu Onayla
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}><DownloadIcon className="h-4 w-4" /> Excel'e Aktar</Button>
            <Button variant="primary" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setTemplateMessageIds(rows.filter((r) => selected.has(r.id)).map((r) => r.id))}>
              SMS / Bildirim Gönder
            </Button>
          </>
        }
        sort={sort}
        onSortChange={setSort}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        limit={limit}
        onLimitChange={(l) => { setLimit(l); setPage(1) }}
        rowActions={(r) => (
          <>
            <IconButton tone="default" title="Görüntüle" onClick={() => setViewing(r)}><EyeIcon className="h-4 w-4" /></IconButton>
            <IconButton tone="success" title="Onayla" disabled={r.status !== 'pending'} onClick={() => openApprove(r)}><CheckIcon className="h-4 w-4" /></IconButton>
            <IconButton tone="danger" title="Reddet" disabled={r.status !== 'pending'} onClick={() => reject(r)}><XIcon className="h-4 w-4" /></IconButton>
            {canDelete && (
              <IconButton tone="danger" title="Sil" onClick={() => setDeleting(r)}><Trash2Icon className="h-4 w-4" /></IconButton>
            )}
          </>
        )}
        empty={<EmptyState icon={FileTextIcon} title="Başvuru bulunamadı" description="Bu tesise henüz başvuru yapılmadı veya filtrelere uygun kayıt yok." />}
      />

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        width={600}
        footer={
          viewing?.status === 'pending' ? (
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setViewing(null)} disabled={!!viewActBusy}>İptal</Button>
              <Button variant="danger" isLoading={viewActBusy === 'reject'} disabled={!!viewActBusy} onClick={() => rejectViewing()}>
                <XIcon className="h-4 w-4" /> Reddet
              </Button>
              <Button variant="primary" disabled={!!viewActBusy} onClick={() => viewing && openApprove(viewing)}>
                <CheckIcon className="h-4 w-4" /> Onayla
              </Button>
              {!!viewingRegistrationId && (
                <Button variant="outline" onClick={() => setHistoryOpen(true)}>
                  <HistoryIcon className="h-4 w-4" /> Yoklama Geçmişi
                </Button>
              )}
              {canDelete && (
                <Button variant="outline" disabled={!!viewActBusy} onClick={() => viewing && setDeleting(viewing)}>
                  <Trash2Icon className="h-4 w-4" /> Sil
                </Button>
              )}
            </div>
          ) : (
            <div className="flex justify-end">
              {canDelete && (
                <Button variant="outline" className="mr-auto" onClick={() => viewing && setDeleting(viewing)}>
                  <Trash2Icon className="h-4 w-4" /> Sil
                </Button>
              )}
              {!!viewingRegistrationId && (
                <Button variant="outline" onClick={() => setHistoryOpen(true)}>
                  <HistoryIcon className="h-4 w-4" /> Yoklama Geçmişi
                </Button>
              )}
              <Button variant="ghost" onClick={() => setViewing(null)}>Kapat</Button>
            </div>
          )
        }
      >
        {viewing && (
          <div className="flex flex-col">
            <div className="relative overflow-hidden ds-hero">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
              <div className="absolute bottom-0 left-8 h-16 w-16 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />
              <div className="relative flex items-center gap-4 px-6 py-5">
                <span
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white shadow-lg"
                  style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.35)' }}
                >
                  {viewing.fullName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-white">{viewing.fullName}</p>
                  <p className="mt-0.5 text-[12px] text-white/70">{viewing.tckn}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">
                      {STATUS_META[viewing.status].label}
                    </span>
                    {viewing.hasMissingDocuments && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/30 px-2.5 py-1 text-xs font-semibold text-white">
                        ⚠ Evrak Eksik
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { icon: PhoneIcon, bg: 'bg-[hsl(var(--success-soft))]', ic: 'text-[hsl(var(--success))]', label: 'Telefon', value: viewing.phone },
                  ...(viewing.guardianPhone ? [{ icon: PhoneIcon, bg: 'bg-[hsl(var(--accent-pink-soft))]', ic: 'text-[hsl(var(--accent-pink))]', label: 'Veli Telefonu', value: viewing.guardianPhone }] : []),
                  { icon: MailIcon, bg: 'bg-[hsl(var(--info-soft))]', ic: 'text-[hsl(var(--info))]', label: 'E-posta', value: viewing.email || '—' },
                  { icon: LayersIcon, bg: 'bg-[hsl(var(--accent-orange-soft))]', ic: 'text-[hsl(var(--accent-orange))]', label: T.branchSingular, value: viewing.branchName },
                  { icon: UserIcon, bg: 'bg-[hsl(var(--accent-violet-soft))]', ic: 'text-[hsl(var(--accent-violet))]', label: 'Grup', value: viewing.groupName || '—' },
                  { icon: CalendarIcon, bg: 'bg-[hsl(var(--accent-blue-soft))]', ic: 'text-[hsl(var(--accent-blue))]', label: 'Başvuru Tarihi', value: formatDate(viewing.appliedAt) },
                ].map(({ icon: Icon, bg, ic, label, value }) => (
                  <div key={label} className="flex items-center gap-3 rounded-lg border border-border bg-[hsl(var(--card))] px-3.5 py-3 shadow-sm">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                      <Icon className={`h-4 w-4 ${ic}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">{label}</p>
                      <p className="truncate text-sm font-semibold text-foreground-default">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-lg border border-border bg-[hsl(var(--card))] shadow-sm">
                <div className="flex items-center gap-2 border-b border-border bg-[hsl(var(--info-soft))]/60 px-4 py-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[hsl(var(--info-soft))]">
                    <FileTextIcon className="h-3.5 w-3.5 text-[hsl(var(--info))]" />
                  </div>
                  <p className="text-sm font-semibold text-foreground-strong">Yüklenen Evraklar</p>
                </div>
                <div className="p-4">
                  {viewing.documents && viewing.documents.length > 0 ? (
                    <div className="space-y-2">
                      {viewing.documents.map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-[hsl(var(--card))] px-3.5 py-3 shadow-sm">
                          <span className="flex min-w-0 items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--info-soft))]">
                              <FileTextIcon className="h-4 w-4 text-[hsl(var(--info))]" />
                            </div>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-foreground-strong truncate">{d.label || d.type || 'Evrak'}</span>
                              {d.fileName && <span className="block text-[11px] text-foreground-muted truncate">{d.fileName}</span>}
                            </span>
                          </span>
                          {d.url ? (
                            <Button variant="outline" size="sm" onClick={() => setPreviewDoc({ url: d.url!, label: d.label || d.type || 'Evrak', fileName: d.fileName })}>
                              <EyeIcon className="h-4 w-4" /> Görüntüle
                            </Button>
                          ) : (
                            <Badge tone="neutral">Bağlantı yok</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-2 text-sm text-foreground-muted">Bu başvuruda yüklenmiş evrak bulunmuyor.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.label ?? 'Belge Görüntüle'}
        width={860}
        footer={
          <div className="flex items-center justify-between gap-2">
            <a href={previewDoc?.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 type-caption text-primary hover:underline">
              <ExternalLinkIcon className="h-3.5 w-3.5" /> Yeni sekmede aç
            </a>
            <div className="flex items-center gap-2">
              <a href={previewDoc?.url} download={previewDoc?.fileName}>
                <Button variant="outline" size="sm"><DownloadIcon className="h-4 w-4" /> İndir</Button>
              </a>
              <Button variant="ghost" onClick={() => setPreviewDoc(null)}>Kapat</Button>
            </div>
          </div>
        }
      >
        {previewDoc && (() => {
          const ext = (previewDoc.fileName ?? previewDoc.url).split('.').pop()?.toLowerCase() ?? ''
          const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)
          const isPdf = ext === 'pdf'
          if (isImage) {
            return (
              <div className="flex items-center justify-center p-4">
                <img src={previewDoc.url} alt={previewDoc.label} className="max-h-[70vh] max-w-full rounded-card object-contain" />
              </div>
            )
          }
          if (isPdf) {
            return <iframe src={previewDoc.url} title={previewDoc.label} className="w-full rounded-card" style={{ height: '70vh', border: 'none' }} />
          }
          return (
            <div className="flex flex-col items-center justify-center gap-4 p-10">
              <FileTextIcon className="h-16 w-16 text-foreground-muted" />
              <p className="type-body text-center">{previewDoc.fileName ?? previewDoc.label}</p>
              <p className="type-caption">Bu dosya türü tarayıcıda önizlenemiyor.</p>
              <a href={previewDoc.url} download={previewDoc.fileName}>
                <Button variant="primary"><DownloadIcon className="h-4 w-4" /> Dosyayı İndir</Button>
              </a>
            </div>
          )
        })()}
      </Modal>

      <Modal
        open={!!approving}
        onClose={() => setApproving(null)}
        title="Başvuruyu Onayla"
        width={520}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setApproving(null)} disabled={approveBusy}>İptal</Button>
            <Button variant="primary" disabled={!approveGroupId || apBothFull} isLoading={approveBusy} onClick={confirmApprove}>
              <CheckIcon className="h-4 w-4" /> {apMainFull && !apBothFull ? 'Yedeğe Al' : 'Onayla'}
            </Button>
          </div>
        }
      >
        {approving && (
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between rounded-card border border-border bg-surface-1 px-4 py-3">
              <div>
                <p className="type-body-strong">{approving.fullName}</p>
                <p className="type-caption">{approving.tckn} · {approving.branchName}</p>
              </div>
            </div>
            {!approving.groupId && (
              <p className="type-caption text-warning">Bu başvuru bir gruba bağlı değil. Onaylamak için bir grup seçin.</p>
            )}
            <Field label="Grup" required>
              <Select searchable searchPlaceholder="Grup ara..." value={approveGroupId} onChange={(e) => setApproveGroupId(e.target.value)} placeholder="Grup seçin">
                {approveGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} · Asıl {g.registeredCount.toLocaleString('tr-TR')}/{g.capacity.toLocaleString('tr-TR')} · Yedek {g.waitlistCount.toLocaleString('tr-TR')}/{g.reserveCapacity.toLocaleString('tr-TR')}
                  </option>
                ))}
              </Select>
            </Field>
            {apBothFull && (
              <Banner tone="danger" variant="soft">
                Bu grubun hem kontenjanı hem yedek listesi dolu. Bu kişi onaylanamaz.
              </Banner>
            )}
            {apMainFull && !apBothFull && (
              <Banner tone="warning" variant="soft">
                Kontenjan dolu. Onaylarsanız bu kişi <strong>yedek listeye</strong> ({approveGroup!.waitlistCount + 1}. sıra) eklenecek.
              </Banner>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!bulkPreview}
        onClose={() => setBulkPreview(null)}
        title="Toplu Onay"
        width={480}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setBulkPreview(null)} disabled={bulkBusy}>Vazgeç</Button>
            <Button
              variant="primary"
              isLoading={bulkBusy}
              disabled={!bulkPreview || bulkPreview.approved + bulkPreview.waitlisted + bulkPreview.rejected === 0}
              onClick={confirmBulkApprove}
            >
              <CheckIcon className="h-4 w-4" /> Onayla
            </Button>
          </div>
        }
      >
        {bulkPreview && (
          <div className="space-y-4 p-6">
            <p className="type-body">Seçilen başvurular <strong>başvuru sırasına göre</strong> değerlendirilecek:</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-card border border-border bg-success-soft px-3 py-3 text-center">
                <p className="type-kpi-value text-success">{bulkPreview.approved}</p>
                <p className="type-caption">Asıl</p>
              </div>
              <div className="rounded-card border border-border bg-info-soft px-3 py-3 text-center">
                <p className="type-kpi-value text-info">{bulkPreview.waitlisted}</p>
                <p className="type-caption">Yedek</p>
              </div>
              <div className="rounded-card border border-border bg-danger-soft px-3 py-3 text-center">
                <p className="type-kpi-value text-danger">{bulkPreview.rejected}</p>
                <p className="type-caption">İptal</p>
              </div>
            </div>
            {(bulkPreview.waitlisted > 0 || bulkPreview.rejected > 0) && (
              <Banner tone="warning" variant="soft">
                Kontenjan dolu. Başvuru sırasına göre kontenjan kadarı <strong>asıl</strong>
                {bulkPreview.waitlisted > 0 && <>, {bulkPreview.waitlisted} kişi <strong>yedek listeye</strong></>}
                {bulkPreview.rejected > 0 && <>, {bulkPreview.rejected} kişi kontenjan dolduğu için <strong>iptal</strong></>} olacak.
              </Banner>
            )}
            {bulkPreview.skipped > 0 && (
              <p className="type-caption text-foreground-muted">{bulkPreview.skipped} kayıt işlenemedi (uygun değil veya zaten işlenmiş).</p>
            )}
          </div>
        )}
      </Modal>

      <FacilitySendMessageModal open={!!templateMessageIds} module={config.routeId} target="application" ids={templateMessageIds ?? []} service={service} onClose={() => setTemplateMessageIds(null)} onSent={() => { fetch(); notifyMutated() }} />

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        icon={Trash2Icon}
        tone="danger"
        title="Başvuruyu Sil"
        description={
          deleting
            ? `${deleting.fullName} adlı kişinin başvurusu kalıcı olarak silinecek${deleting.status === 'approved' || deleting.status === 'waitlist' ? '. Kişi programdan da çıkarılacak' : ''}. Bu işlem geri alınamaz. Devam edilsin mi?`
            : ''
        }
        confirmLabel="Evet, Sil"
        loading={deleteBusy}
      />

      {historyOpen && viewingRegistrationId && viewing && (
        <AttendanceHistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          service={service}
          registrationId={viewingRegistrationId}
          participantName={viewing.fullName}
          onRevised={() => { fetch(); notifyMutated() }}
        />
      )}
    </>
  )
}
