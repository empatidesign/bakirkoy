import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArchiveIcon, Undo2Icon, Trash2Icon, SearchIcon, Building2Icon, UsersIcon, LayersIcon } from 'lucide-react'
import {
  DataTable, FilterBar, Input, Badge, IconButton, Banner, EmptyState, ConfirmModal, SectionToolbar,
  type DataTableColumn, type SortState,
} from '@/design-system'
import type { FacilityModuleConfig } from '../moduleConfig'
import type { FacilityModuleService } from '../types'
import type { FacilityRecord, GroupRecord, BranchRecord } from '@/types/facility.types'
import type { PagedResult } from '@/types/common'

interface Props {
  config: FacilityModuleConfig
  service: FacilityModuleService
}

const fmtDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR') : '—')

export const FacilityArchiveTab = ({ config, service }: Props) => {
  const T = config.terminology

  const [facResult, setFacResult] = useState<PagedResult<FacilityRecord> | null>(null)
  const [facLoading, setFacLoading] = useState(true)
  const [facPage, setFacPage] = useState(1)
  const [facLimit, setFacLimit] = useState(10)
  const [facSearchInput, setFacSearchInput] = useState('')
  const [facSearch, setFacSearch] = useState('')
  const [facSort, setFacSort] = useState<SortState | null>({ key: 'deletedAt', dir: 'desc' })
  const [facPurgeId, setFacPurgeId] = useState<string | null>(null)
  const [facPurging, setFacPurging] = useState(false)

  const fetchFacilities = useCallback(async () => {
    setFacLoading(true)
    try {
      const params: Record<string, unknown> = { page: facPage, limit: facLimit }
      if (facSearch) params.search = facSearch
      if (facSort) { params.sort = facSort.key; params.order = facSort.dir }
      setFacResult(await service.facilities.getTrash(params))
    } catch {
      setFacResult(null)
    } finally {
      setFacLoading(false)
    }
  }, [service, facPage, facLimit, facSearch, facSort])
  useEffect(() => { fetchFacilities() }, [fetchFacilities])

  useEffect(() => {
    const t = setTimeout(() => { setFacSearch(facSearchInput); setFacPage(1) }, 350)
    return () => clearTimeout(t)
  }, [facSearchInput])

  const restoreFacility = async (id: string) => {
    await service.facilities.restore(id)
    toast.success(`${T.facilitySingular} geri yüklendi.`)
    fetchFacilities()
  }

  const purgeFacility = async (id: string) => {
    setFacPurging(true)
    try {
      await service.facilities.permanentDelete(id)
      toast.success(`${T.facilitySingular} kalıcı olarak silindi.`)
      setFacPurgeId(null)
      fetchFacilities()
    } finally {
      setFacPurging(false)
    }
  }

  const facColumns: DataTableColumn<FacilityRecord>[] = [
    { key: 'name', header: T.facilitySingular, sortable: true, sortKey: 'name', cell: (r) => <span className="type-body-strong">{r.name}</span> },
    { key: 'district', header: 'İlçe', cell: (r) => <span className="type-muted">{r.district ?? '—'}</span> },
    { key: 'capacity', header: 'Kapasite', align: 'center' as const, cell: (r) => <span className="tabular-nums">{r.capacity}</span> },
    { key: 'deletedBy', header: 'Silen', cell: (r) => <span className="type-muted">{r.deletedBy ?? '—'}</span> },
    { key: 'deletedAt', header: 'Silinme Tarihi', sortable: true, sortKey: 'deletedAt', cell: (r) => <span className="whitespace-nowrap type-muted">{fmtDateTime(r.deletedAt)}</span> },
  ]

  const [brResult, setBrResult] = useState<PagedResult<BranchRecord> | null>(null)
  const [brLoading, setBrLoading] = useState(true)
  const [brPage, setBrPage] = useState(1)
  const [brLimit, setBrLimit] = useState(10)
  const [brSearchInput, setBrSearchInput] = useState('')
  const [brSearch, setBrSearch] = useState('')
  const [brSort, setBrSort] = useState<SortState | null>({ key: 'deletedAt', dir: 'desc' })
  const [brPurgeId, setBrPurgeId] = useState<string | null>(null)
  const [brPurging, setBrPurging] = useState(false)

  const fetchBranches = useCallback(async () => {
    setBrLoading(true)
    try {
      const params: Record<string, unknown> = { page: brPage, limit: brLimit }
      if (brSearch) params.search = brSearch
      if (brSort) { params.sort = brSort.key; params.order = brSort.dir }
      setBrResult(await service.branches.getTrash(params))
    } catch {
      setBrResult(null)
    } finally {
      setBrLoading(false)
    }
  }, [service, brPage, brLimit, brSearch, brSort])
  useEffect(() => { fetchBranches() }, [fetchBranches])

  useEffect(() => {
    const t = setTimeout(() => { setBrSearch(brSearchInput); setBrPage(1) }, 350)
    return () => clearTimeout(t)
  }, [brSearchInput])

  const restoreBranch = async (id: string) => {
    await service.branches.restore(id)
    toast.success(`${T.branchSingular} geri yüklendi.`)
    fetchBranches()
  }

  const purgeBranch = async (id: string) => {
    setBrPurging(true)
    try {
      await service.branches.permanentDelete(id)
      toast.success(`${T.branchSingular} kalıcı olarak silindi.`)
      setBrPurgeId(null)
      fetchBranches()
    } finally {
      setBrPurging(false)
    }
  }

  const brColumns: DataTableColumn<BranchRecord>[] = [
    { key: 'name', header: T.branchSingular, sortable: true, sortKey: 'name', cell: (r) => <span className="type-body-strong">{r.name}</span> },
    { key: 'description', header: 'Açıklama', cell: (r) => <span className="type-muted line-clamp-1">{r.description ?? '—'}</span> },
    { key: 'deletedBy', header: 'Silen', cell: (r) => <span className="type-muted">{r.deletedBy ?? '—'}</span> },
    { key: 'deletedAt', header: 'Silinme Tarihi', sortable: true, sortKey: 'deletedAt', cell: (r) => <span className="whitespace-nowrap type-muted">{fmtDateTime(r.deletedAt)}</span> },
  ]

  const [grpResult, setGrpResult] = useState<PagedResult<GroupRecord> | null>(null)
  const [grpLoading, setGrpLoading] = useState(true)
  const [grpPage, setGrpPage] = useState(1)
  const [grpLimit, setGrpLimit] = useState(10)
  const [grpSearchInput, setGrpSearchInput] = useState('')
  const [grpSearch, setGrpSearch] = useState('')
  const [grpSort, setGrpSort] = useState<SortState | null>({ key: 'deletedAt', dir: 'desc' })
  const [grpPurgeId, setGrpPurgeId] = useState<string | null>(null)
  const [grpPurging, setGrpPurging] = useState(false)

  const fetchGroups = useCallback(async () => {
    setGrpLoading(true)
    try {
      const params: Record<string, unknown> = { page: grpPage, limit: grpLimit }
      if (grpSearch) params.search = grpSearch
      if (grpSort) { params.sort = grpSort.key; params.order = grpSort.dir }
      setGrpResult(await service.groups.getTrash(params))
    } catch {
      setGrpResult(null)
    } finally {
      setGrpLoading(false)
    }
  }, [service, grpPage, grpLimit, grpSearch, grpSort])
  useEffect(() => { fetchGroups() }, [fetchGroups])

  useEffect(() => {
    const t = setTimeout(() => { setGrpSearch(grpSearchInput); setGrpPage(1) }, 350)
    return () => clearTimeout(t)
  }, [grpSearchInput])

  const restoreGroup = async (id: string) => {
    await service.groups.restore(id)
    toast.success(`${T.groupSingular} geri yüklendi.`)
    fetchGroups()
  }

  const purgeGroup = async (id: string) => {
    setGrpPurging(true)
    try {
      await service.groups.permanentDelete(id)
      toast.success(`${T.groupSingular} kalıcı olarak silindi.`)
      setGrpPurgeId(null)
      fetchGroups()
    } finally {
      setGrpPurging(false)
    }
  }

  const grpColumns: DataTableColumn<GroupRecord>[] = [
    { key: 'name', header: T.groupSingular, sortable: true, sortKey: 'name', cell: (r) => <span className="type-body-strong">{r.name}</span> },
    { key: 'facilityName', header: T.facilitySingular, cell: (r) => <span className="type-muted">{r.facilityName ?? '—'}</span> },
    { key: 'branchName', header: T.branchSingular, cell: (r) => <span className="type-muted">{r.branchName ?? '—'}</span> },
    { key: 'type', header: 'Tür', cell: (r) => <Badge tone={r.type === 'akademi' ? 'primary' : 'info'}>{r.type === 'akademi' ? 'Akademi' : 'Kurs'}</Badge> },
    { key: 'deletedBy', header: 'Silen', cell: (r) => <span className="type-muted">{r.deletedBy ?? '—'}</span> },
    { key: 'deletedAt', header: 'Silinme Tarihi', sortable: true, sortKey: 'deletedAt', cell: (r) => <span className="whitespace-nowrap type-muted">{fmtDateTime(r.deletedAt)}</span> },
  ]

  return (
    <>
      <Banner tone="warning" variant="soft" icon={ArchiveIcon}>
        Silinen {T.facilitySingular.toLowerCase()}ler ve gruplar kalıcı olarak silinmez; buradan geri yüklenebilir. Kalıcı silme geri alınamaz.
      </Banner>

      <SectionToolbar icon={Building2Icon} title={`Silinen ${T.facilityPlural}`} subtitle={`Arşivlenmiş ${T.facilitySingular.toLowerCase()} kayıtları`} />

      <FilterBar
        search={
          <Input
            placeholder={`${T.facilitySingular} adı ara...`}
            value={facSearchInput}
            onChange={(e) => setFacSearchInput(e.target.value)}
            iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
          />
        }
        hasActiveFilters={!!facSearchInput}
        onClear={() => { setFacSearchInput(''); setFacSearch(''); setFacPage(1) }}
      />

      <DataTable<FacilityRecord>
        title={`Silinen ${T.facilityPlural}`}
        columns={facColumns}
        rows={facResult?.items ?? []}
        rowKey={(r) => r.id}
        loading={facLoading}
        page={facResult?.page ?? 1}
        totalPages={facResult?.totalPages ?? 1}
        total={facResult?.total ?? 0}
        onPageChange={setFacPage}
        limit={facLimit}
        onLimitChange={(n) => { setFacLimit(n); setFacPage(1) }}
        sort={facSort}
        onSortChange={(s) => { setFacSort(s); setFacPage(1) }}
        rowActions={(row) => (
          <>
            <IconButton tone="success" title="Geri yükle" onClick={() => restoreFacility(row.id)}>
              <Undo2Icon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="danger" title="Kalıcı sil" onClick={() => setFacPurgeId(row.id)}>
              <Trash2Icon className="h-4 w-4" />
            </IconButton>
          </>
        )}
        empty={
          <EmptyState
            icon={ArchiveIcon}
            title="Çöp kutusu boş"
            description={`Silinen ${T.facilitySingular.toLowerCase()}ler burada listelenir ve geri yüklenebilir.`}
          />
        }
      />

      <SectionToolbar icon={LayersIcon} title={`Silinen ${T.branchPlural}`} subtitle={`Arşivlenmiş ${T.branchSingular.toLowerCase()} kayıtları`} />

      <FilterBar
        search={
          <Input
            placeholder={`${T.branchSingular} adı ara...`}
            value={brSearchInput}
            onChange={(e) => setBrSearchInput(e.target.value)}
            iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
          />
        }
        hasActiveFilters={!!brSearchInput}
        onClear={() => { setBrSearchInput(''); setBrSearch(''); setBrPage(1) }}
      />

      <DataTable<BranchRecord>
        title={`Silinen ${T.branchPlural}`}
        columns={brColumns}
        rows={brResult?.items ?? []}
        rowKey={(r) => r.id}
        loading={brLoading}
        page={brResult?.page ?? 1}
        totalPages={brResult?.totalPages ?? 1}
        total={brResult?.total ?? 0}
        onPageChange={setBrPage}
        limit={brLimit}
        onLimitChange={(n) => { setBrLimit(n); setBrPage(1) }}
        sort={brSort}
        onSortChange={(s) => { setBrSort(s); setBrPage(1) }}
        rowActions={(row) => (
          <>
            <IconButton tone="success" title="Geri yükle" onClick={() => restoreBranch(row.id)}>
              <Undo2Icon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="danger" title="Kalıcı sil" onClick={() => setBrPurgeId(row.id)}>
              <Trash2Icon className="h-4 w-4" />
            </IconButton>
          </>
        )}
        empty={
          <EmptyState
            icon={ArchiveIcon}
            title="Çöp kutusu boş"
            description={`Silinen ${T.branchSingular.toLowerCase()}lar burada listelenir ve geri yüklenebilir.`}
          />
        }
      />

      <SectionToolbar icon={UsersIcon} title={`Silinen ${T.groupPlural}`} subtitle={`Arşivlenmiş ${T.groupSingular.toLowerCase()} kayıtları`} />

      <FilterBar
        search={
          <Input
            placeholder={`${T.groupSingular} adı ara...`}
            value={grpSearchInput}
            onChange={(e) => setGrpSearchInput(e.target.value)}
            iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
          />
        }
        hasActiveFilters={!!grpSearchInput}
        onClear={() => { setGrpSearchInput(''); setGrpSearch(''); setGrpPage(1) }}
      />

      <DataTable<GroupRecord>
        title={`Silinen ${T.groupPlural}`}
        columns={grpColumns}
        rows={grpResult?.items ?? []}
        rowKey={(r) => r.id}
        loading={grpLoading}
        page={grpResult?.page ?? 1}
        totalPages={grpResult?.totalPages ?? 1}
        total={grpResult?.total ?? 0}
        onPageChange={setGrpPage}
        limit={grpLimit}
        onLimitChange={(n) => { setGrpLimit(n); setGrpPage(1) }}
        sort={grpSort}
        onSortChange={(s) => { setGrpSort(s); setGrpPage(1) }}
        rowActions={(row) => (
          <>
            <IconButton tone="success" title="Geri yükle" onClick={() => restoreGroup(row.id)}>
              <Undo2Icon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="danger" title="Kalıcı sil" onClick={() => setGrpPurgeId(row.id)}>
              <Trash2Icon className="h-4 w-4" />
            </IconButton>
          </>
        )}
        empty={
          <EmptyState
            icon={ArchiveIcon}
            title="Çöp kutusu boş"
            description={`Silinen ${T.groupSingular.toLowerCase()}lar burada listelenir ve geri yüklenebilir.`}
          />
        }
      />

      <ConfirmModal
        open={!!facPurgeId}
        onClose={() => setFacPurgeId(null)}
        onConfirm={() => facPurgeId && purgeFacility(facPurgeId)}
        icon={Trash2Icon}
        tone="danger"
        title={`${T.facilitySingular} Kalıcı Sil`}
        description={`Bu ${T.facilitySingular.toLowerCase()} kalıcı olarak silinecek ve geri alınamayacak. Devam edilsin mi?`}
        confirmLabel="Evet, Kalıcı Sil"
        loading={facPurging}
      />

      <ConfirmModal
        open={!!brPurgeId}
        onClose={() => setBrPurgeId(null)}
        onConfirm={() => brPurgeId && purgeBranch(brPurgeId)}
        icon={Trash2Icon}
        tone="danger"
        title={`${T.branchSingular} Kalıcı Sil`}
        description={`Bu ${T.branchSingular.toLowerCase()} kalıcı olarak silinecek ve geri alınamayacak. Devam edilsin mi?`}
        confirmLabel="Evet, Kalıcı Sil"
        loading={brPurging}
      />

      <ConfirmModal
        open={!!grpPurgeId}
        onClose={() => setGrpPurgeId(null)}
        onConfirm={() => grpPurgeId && purgeGroup(grpPurgeId)}
        icon={Trash2Icon}
        tone="danger"
        title={`${T.groupSingular} Kalıcı Sil`}
        description={`Bu ${T.groupSingular.toLowerCase()} kalıcı olarak silinecek ve geri alınamayacak. Devam edilsin mi?`}
        confirmLabel="Evet, Kalıcı Sil"
        loading={grpPurging}
      />
    </>
  )
}
