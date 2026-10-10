import { useState, useEffect, useCallback, useRef, type Dispatch, type SetStateAction, type ReactNode } from 'react'
import { SearchIcon, Trash2Icon, PowerIcon, PowerOffIcon, CheckSquareIcon, PlusIcon, FileClockIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams, useLocation } from 'react-router-dom'
import {
  Button, SectionToolbar, FilterBar, FilterField, Input, Select, StatCard,
  DataTable, EmptyState, Drawer, Modal, ConfirmModal, RowActions,
  type DataTableColumn, type SortState,
} from '@/design-system'
import { cn } from '@/lib/utils'
import type { PagedResult } from '@/types/common'
import { useFormDraft, formatDraftAge } from '@/hooks/useFormDraft'

export interface StatConfig {
  label: string
  value: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  accent?: 'blue' | 'green' | 'orange' | 'violet' | 'primary'
}

export interface CrudListService<T> {
  getList: (params: Record<string, unknown>) => Promise<PagedResult<T>>
  remove?: (id: string) => Promise<void>
  toggleStatus?: (id: string) => Promise<unknown>
}

export interface CrudFormCtx<T, F> {
  form: F
  setForm: Dispatch<SetStateAction<F>>
  mode: 'create' | 'edit'
  editingId: string | null
  editingRow: T | null
  requestToggleStatus: () => void
  close: () => void
  refetch: () => void
}

export interface CrudFooterCtx<F> {
  form: F
  mode: 'create' | 'edit'
  editingId: string | null
  saving: boolean
  submit: () => void
  close: () => void
  refetch: () => void
}

export interface CrudAltViewApi<T, F> {
  openEdit: (row: T) => void
  openCreate: (seed?: Partial<F>) => void
  openView: (row: T) => void
  refetch: () => void
  loading: boolean
}

export interface CrudListTemplateProps<T, F> {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  resourceName: string
  listTitle?: string

  service: CrudListService<T>
  rowKey: (row: T) => string
  columns: DataTableColumn<T>[]
  showIndex?: boolean
  defaultSort?: SortState | null
  searchPlaceholder?: string
  pageSizeOptions?: number[]
  initialLimit?: number
  // Kullanıcı isteği (2026-10-05): "ada göre eklenme tarihine göre veya manuel sürükle bırak
  // ile sıralama" — verilirse filtre çubuğunda bir "Sıralama" seçici gösterilir (ör. Ad,
  // Eklenme Tarihi, Manuel). "Manuel" seçilince DataTable'da sürükle-bırak aktif olur ve
  // onReorder çağrılır; backend ApplySort içindeki "manual"/"sortorder" anahtarıyla eşleşir.
  sortOptions?: { key: string; label: string; dir?: 'asc' | 'desc'; manual?: boolean }[]
  onReorder?: (orderedIds: string[]) => Promise<void>
  // Kullanıcı isteği (2026-10-01): üst başlıktaki genel aramadan tıklanan bir sonuç bu listeye
  // önceden filtrelenmiş olarak gelebilsin diye eklendi. Verilmezse davranış tamamen eskisiyle
  // aynıdır (boş string).
  initialSearch?: string

  selectable?: boolean
  bulkActions?: (rows: T[], helpers: { clear: () => void; refresh: () => void }) => ReactNode
  // Kullanıcı isteği (2026-08-07): bazı listelerde toplu seçim (SMS/bildirim gönderme vb.)
  // gerekiyor ama üstteki istatistik şeridinde ayrıca bir "Seçili X" kartı istenmiyor —
  // caller kendi stats() dizisinde daha anlamlı bir kartı bu yuvaya koyabilsin diye.
  hideSelectedStat?: boolean

  extraParams?: Record<string, string>
  renderFilters?: () => ReactNode
  filterColumns?: 2 | 3 | 4 | 5 | 6
  hasActiveFilters?: boolean
  filterCount?: number
  onClearFilters?: () => void

  stats?: (ctx: { rows: T[]; total: number; loading: boolean }) => StatConfig[]

  emptyForm: F
  toForm: (row: T) => F
  isFormValid?: (form: F, mode: 'create' | 'edit') => boolean
  getFormErrors?: (form: F, mode: 'create' | 'edit') => string[]
  renderForm: (ctx: CrudFormCtx<T, F>) => ReactNode
  onCreate?: (form: F) => Promise<void>
  onUpdate?: (id: string, form: F) => Promise<void>
  renderFormFooter?: (ctx: CrudFooterCtx<F>) => ReactNode
  drawerWidth?: number
  viewable?: boolean
  renderView?: (row: T) => ReactNode
  viewWidth?: number

  canEdit?: (row: T) => boolean
  canDelete?: (row: T) => boolean
  isActive?: (row: T) => boolean
  canToggle?: (row: T) => boolean
  deleteConfirm?: { title?: string; description?: string }
  toggleConfirm?: (row: T, willActivate: boolean) => { title: string; description: string } | null
  extraRowActions?: (row: T) => ReactNode
  collapseRowActions?: boolean
  toggleOnColumnKey?: string

  emptyTitle?: string
  emptyDescription?: string

  onMutated?: () => void
  onDataLoad?: (rows: T[]) => void
  onSearchChange?: (term: string) => void
  rowFilter?: (row: T) => boolean
  highlightedRowKey?: string | null
  embedded?: boolean
  refreshSignal?: number
  createSignal?: number
  creatable?: boolean
  // Kullanıcı isteği (2026-10-04): "mavi butonu tabloda sütunların sağına ekle" — bazı
  // sayfalarda (ör. Etkinlik Programı, Seanslar) üst başlıktaki (SectionToolbar) "Yeni X Ekle"
  // butonu yerine, aynı buton doğrudan tablonun kendi araç çubuğunda (DataTable toolbarActions,
  // "Sütunlar" butonunun hemen solunda — tablonun sağ üst köşesi) gösterilsin isteniyor.
  // Varsayılan 'header' tüm diğer modüllerde eski davranışı (üst başlık yanı) korur.
  createButtonPlacement?: 'header' | 'table'
  formShell?: boolean
  createGate?: (ctx: { open: boolean; onContinue: (seed?: Partial<F>) => void; onCancel: () => void }) => ReactNode
  tone?: 'primary' | 'danger'
  extraHeaderActions?: ReactNode
  editRequestId?: string | null
  onEditRequestHandled?: () => void
  createRequestSeed?: Partial<F> | null
  onCreateRequestHandled?: () => void
  /** Kullanıcı isteği (2026-10-05): kaydedilmeden kapatılan formlar taslak olarak
   * localStorage'a yazılır, tekrar açıldığında geri yüklenebilir. Dosya/File alanı
   * taşıyan formlarda false geçilip kapatılabilir (JSON.stringify File'ı serileştiremez). */
  draftsEnabled?: boolean
  altView?: {
    toggleLabel: (active: boolean) => string
    toggleIcon?: React.ComponentType<{ className?: string }>
    pageSize?: number
    render: (rows: T[], api: CrudAltViewApi<T, F>) => ReactNode
  }
}

export function CrudListTemplate<T, F>(props: CrudListTemplateProps<T, F>) {
  const {
    icon, title, subtitle, resourceName, listTitle,
    service, rowKey, columns, showIndex = true, defaultSort = null, searchPlaceholder, pageSizeOptions, initialLimit = 10, initialSearch,
    selectable, bulkActions, hideSelectedStat, extraParams, renderFilters, filterColumns, hasActiveFilters, filterCount, onClearFilters,
    stats, emptyForm, toForm, isFormValid, getFormErrors, renderForm, onCreate, onUpdate, renderFormFooter, drawerWidth, viewable, renderView, viewWidth,
    canEdit, canDelete, isActive, canToggle, deleteConfirm, toggleConfirm, extraRowActions, collapseRowActions = true, toggleOnColumnKey,
    emptyTitle, emptyDescription, onMutated, onDataLoad, onSearchChange, rowFilter, highlightedRowKey, embedded, refreshSignal, createSignal, creatable = true, createButtonPlacement = 'header', formShell, createGate, tone = 'primary', extraHeaderActions, altView,
    editRequestId, onEditRequestHandled, createRequestSeed, onCreateRequestHandled, draftsEnabled = true, sortOptions, onReorder,
  } = props

  const createVariant = tone === 'danger' ? 'danger' : 'primary'
  const toneClass = tone === 'danger' ? 'tone-danger' : undefined

  const [result, setResult] = useState<PagedResult<T> | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(initialLimit)
  const [urlParams] = useSearchParams()
  const seedSearch = initialSearch ?? (embedded ? '' : urlParams.get('q') ?? '')
  const [searchInput, setSearchInput] = useState(seedSearch)
  const [search, setSearch] = useState(seedSearch)
  const [sort, setSort] = useState<SortState | null>(defaultSort)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Kullanıcı isteği (2026-10-05): sıralama seçici — sortOptions verilmişse, seçilen seçeneğin
  // "manual" bayrağı varsa DataTable'da sürükle-bırak aktif olur (reorder isteği gönderilir),
  // değilse normal sort state'i (backend'e sort/order parametresi) kullanılır.
  const activeSortOptionIndex = sortOptions?.findIndex((o) =>
    o.manual ? sort?.key === 'manual' : sort?.key === o.key && (o.dir ?? 'asc') === sort?.dir) ?? -1
  const activeSortOptionKey = activeSortOptionIndex >= 0 ? String(activeSortOptionIndex) : ''
  const [reordering, setReordering] = useState(false)

  const drawerBodyRef = useRef<HTMLDivElement>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingRow, setEditingRow] = useState<T | null>(null)
  const [form, setForm] = useState<F>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [toggleRow, setToggleRow] = useState<T | null>(null)
  const [toggleMsg, setToggleMsg] = useState<{ title: string; description: string } | null>(null)
  const [toggling, setToggling] = useState(false)

  const [bulkType, setBulkType] = useState<'delete' | 'activate' | 'deactivate' | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)

  const [viewRow, setViewRow] = useState<T | null>(null)
  const [gateOpen, setGateOpen] = useState(false)
  const [altActive, setAltActive] = useState(false)

  // Kullanıcı isteği (2026-10-05): kaydedilmeden kapatılan formlar taslak olarak kalsın.
  // resourceKey: sayfa yolu + kaynak adı ile her liste/sayfa kombinasyonu için benzersizdir.
  const location = useLocation()
  const draftResourceKey = `${location.pathname}::${resourceName}`
  const draftScope = editingId ?? 'create'
  const { pendingDraft, restoreDraft, discardDraft, notifyChange } = useFormDraft<F>({
    resourceKey: draftResourceKey,
    scope: draftScope,
    emptyForm,
    enabled: draftsEnabled,
  })

  const extraKey = JSON.stringify(extraParams ?? {})
  // Kullanıcı isteği (2026-10-05): manuel sürükle-bırak modunda sayfalama kapatılır (tüm kayıtlar
  // tek sayfada listelenir) — aksi halde sürükleyip bırakma yalnızca o sayfadaki göreli sırayı
  // değiştirir ve backend'deki mutlak SortOrder ataması (1,2,3...) diğer sayfalardaki kayıtlarla
  // çakışabilirdi. altView.pageSize ile aynı desen.
  const manualSortActive = activeSortOptionIndex >= 0 && !!sortOptions?.[activeSortOptionIndex]?.manual

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: manualSortActive ? 1 : page, limit: manualSortActive ? 500 : (altActive && altView ? (altView.pageSize ?? 200) : limit) }
      if (search) params.search = search
      if (sort) { params.sort = sort.key; params.order = sort.dir }
      if (extraParams) for (const [k, v] of Object.entries(extraParams)) if (v) params[k] = v
      const data = await service.getList(params)
      setResult(data)
      setSelected(new Set())
      onDataLoad?.(data.items)
      if (page > 1 && data.items.length === 0) {
        setPage(data.totalPages && data.totalPages > 0 ? data.totalPages : 1)
      }
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, search, sort, extraKey, refreshSignal, altActive])

  useEffect(() => { fetchList() }, [fetchList])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); onSearchChange?.(searchInput) }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onSearchChange çoğu kullanımda inline geçiliyor; eklenirse debounce her render'da sıfırlanır
  }, [searchInput])

  const rows = (result?.items ?? []).filter((r) => !rowFilter || rowFilter(r))
  const total = result?.total ?? 0
  const totalPages = result?.totalPages ?? 1

  const indexColumn: DataTableColumn<T> = {
    key: '__index',
    header: 'Sıra',
    align: 'center',
    width: 'w-12',
    hideable: false,
    cell: (_row, i) => <span className="tabular-nums text-foreground-muted">{(page - 1) * limit + i + 1}</span>,
  }
  const clickableColumns = toggleOnColumnKey && service.toggleStatus
    ? columns.map((column) => column.key !== toggleOnColumnKey ? column : {
        ...column,
        cell: (row: T, index: number) => {
          const enabled = !canToggle || canToggle(row)
          return (
            <button
              type="button"
              disabled={!enabled}
              title={enabled ? 'Durumu değiştir' : undefined}
              aria-label={enabled ? `${resourceName} durumunu değiştir` : undefined}
              className="rounded-[10px] transition-shadow enabled:cursor-pointer enabled:hover:ring-2 enabled:hover:ring-primary/20 disabled:cursor-default"
              onClick={() => requestToggle(row)}
            >
              {column.cell(row, index)}
            </button>
          )
        },
      })
    : columns
  const tableColumns = showIndex ? [indexColumn, ...clickableColumns] : clickableColumns

  const openAddDirect = (seed?: Partial<F>) => {
    setEditingId(null); setEditingRow(null)
    setForm(seed ? { ...emptyForm, ...seed } : emptyForm)
    setDrawerOpen(true)
  }
  const openAdd = () => { if (createGate) setGateOpen(true); else openAddDirect() }
  const openEdit = (row: T) => { setEditingId(rowKey(row)); setEditingRow(row); setForm(toForm(row)); setDrawerOpen(true) }
  // Taslak kasıtlı olarak SİLİNMEZ burada — kullanıcı formu kaydetmeden kapatırsa
  // (X'e basma, dışarı tıklama, sekme değiştirme) girdiği veriler localStorage'da kalır
  // ve bir sonraki açılışta "Taslağı Geri Yükle" bildirimiyle sunulur.
  const closeDrawer = () => { setDrawerOpen(false); setEditingId(null); setEditingRow(null); setForm(emptyForm); toast.dismiss() }

  // Form her değiştiğinde (drawer açıkken) debounce'lu taslak kaydı.
  useEffect(() => {
    if (!drawerOpen) return
    notifyChange(form)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, drawerOpen])

  useEffect(() => {
    if (createSignal && createSignal > 0) openAdd()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createSignal])

  useEffect(() => {
    if (!editRequestId) return
    const row = rows.find((r) => rowKey(r) === editRequestId)
    if (row) { openEdit(row); onEditRequestHandled?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRequestId, rows])

  useEffect(() => {
    if (!createRequestSeed) return
    openAddDirect(createRequestSeed)
    onCreateRequestHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createRequestSeed])

  const focusFirstInvalid = () => {
    const body = drawerBodyRef.current
    if (!body) return
    const controls = body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])'
    )
    const target = Array.from(controls).find((el) => el.value === '')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target.focus()
    }
  }

  const submit = async () => {
    const mode = editingId ? 'edit' : 'create'
    if (getFormErrors) {
      const errors = getFormErrors(form, mode)
      if (errors.length > 0) {
        errors.forEach((msg) => toast.warning(msg))
        focusFirstInvalid()
        return
      }
    } else if (isFormValid && !isFormValid(form, mode)) {
      toast.warning('Lütfen zorunlu alanları doldurun.')
      focusFirstInvalid()
      return
    }
    setSaving(true)
    try {
      if (editingId) await onUpdate?.(editingId, form)
      else await onCreate?.(form)
      discardDraft()
      closeDrawer(); fetchList(); onMutated?.()
    } finally { setSaving(false) }
  }

  const confirmDelete = async (id: string) => {
    setDeleting(true)
    try {
      await service.remove?.(id)
      toast.success(`${resourceName} silindi.`)
      setDeleteId(null); fetchList(); onMutated?.()
    } finally { setDeleting(false) }
  }

  const requestToggle = (row: T) => {
    const willActivate = !(isActive ? isActive(row) : true)
    const msg = toggleConfirm?.(row, willActivate) ?? null
    if (msg) { setToggleRow(row); setToggleMsg(msg) }
    else void runToggle(row)
  }

  const runToggle = async (row: T) => {
    const willActivate = !(isActive ? isActive(row) : true)
    setToggling(true)
    try {
      await service.toggleStatus?.(rowKey(row))
      toast.success(willActivate ? `${resourceName} aktif edildi.` : `${resourceName} pasife alındı.`)
      setToggleRow(null); setToggleMsg(null); fetchList(); onMutated?.()
    } finally { setToggling(false) }
  }

  const selectedRows = rows.filter(r => selected.has(rowKey(r)))

  // Kullanıcı isteği (2026-10-05): manuel sürükle-bırak sıralama — DataTable'dan gelen yeni
  // sıralı ID listesini backend reorder endpoint'ine gönderir, sonra listeyi yeniler.
  const handleReorder = async (orderedIds: string[]) => {
    if (!onReorder) return
    setReordering(true)
    try {
      await onReorder(orderedIds)
      await fetchList()
    } catch {
      toast.error('Sıra değiştirilemedi.')
    } finally {
      setReordering(false)
    }
  }

  const bulkTargets = (type: 'delete' | 'activate' | 'deactivate') => {
    if (type === 'delete') return selectedRows.filter(r => !canDelete || canDelete(r))
    const togglable = selectedRows.filter(r => !canToggle || canToggle(r))
    return type === 'activate'
      ? togglable.filter(r => (isActive ? !isActive(r) : false))
      : togglable.filter(r => (isActive ? isActive(r) : true))
  }

  const runBulk = async () => {
    if (!bulkType) return
    const targets = bulkTargets(bulkType)
    setBulkRunning(true)
    try {
      const results = bulkType === 'delete'
        ? await Promise.allSettled(targets.map(r => service.remove?.(rowKey(r))))
        : await Promise.allSettled(targets.map(r => service.toggleStatus?.(rowKey(r))))
      const failed = results.filter(r => r.status === 'rejected').length
      const okCount = results.length - failed
      const successLabel = bulkType === 'delete'
        ? `${okCount} kayıt silindi.`
        : bulkType === 'activate' ? `${okCount} kayıt aktif edildi.` : `${okCount} kayıt pasife alındı.`
      const failLabel = bulkType === 'delete'
        ? `${failed} kayıt silinemedi.`
        : bulkType === 'activate' ? `${failed} kayıt aktif edilemedi.` : `${failed} kayıt pasife alınamadı.`
      if (okCount > 0) toast.success(successLabel)
      if (failed > 0) toast.error(failLabel)
      setBulkType(null); setSelected(new Set()); fetchList(); onMutated?.()
    } finally { setBulkRunning(false) }
  }

  const bulkMessages = {
    delete: { title: 'Seçili Kayıtları Sil', description: `Seçili ${bulkTargets('delete').length} kaydı kalıcı listeden silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.` },
    activate: { title: 'Seçili Kayıtları Aktif Et', description: `Seçili kayıtlardan pasif olan ${bulkTargets('activate').length} tanesi aktif edilecek. Devam edilsin mi?` },
    deactivate: { title: 'Seçili Kayıtları Pasife Al', description: `Seçili kayıtlardan aktif olan ${bulkTargets('deactivate').length} tanesi pasife alınacak ve erişimleri engellenecek. Devam edilsin mi?` },
  }

  const selectionActions = (
    <div className="flex items-center gap-1.5">
      {bulkActions?.(selectedRows, { clear: () => setSelected(new Set()), refresh: () => { fetchList(); onMutated?.() } })}
      {service.toggleStatus && (
        <>
          <Button variant="outline" size="sm" onClick={() => setBulkType('activate')}>
            <PowerIcon className="h-3.5 w-3.5 text-success" /> Aktif Et
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkType('deactivate')}>
            <PowerOffIcon className="h-3.5 w-3.5 text-warning" /> Pasife Al
          </Button>
        </>
      )}
      {service.remove && (
        <Button variant="outline" size="sm" className="text-danger hover:bg-danger-soft" onClick={() => setBulkType('delete')}>
          <Trash2Icon className="h-3.5 w-3.5" /> Sil
        </Button>
      )}
      <Button variant="ghost" size="sm" className="ml-1" onClick={() => setSelected(new Set())}>
        Seçimi temizle
      </Button>
    </div>
  )

  const filtersActive = !!searchInput || !!hasActiveFilters
  const clearAll = () => { setSearchInput(''); setSearch(''); setPage(1); onSearchChange?.(''); onClearFilters?.() }

  const statCards = [
    ...(stats?.({ rows, total, loading }) ?? []).map((s, i) => (
      <StatCard key={`m${i}`} label={s.label} value={s.value} icon={s.icon} accent={s.accent ?? 'blue'} loading={loading} />
    )),
    ...(selectable && !hideSelectedStat ? [
      <StatCard key="sel" label={`Seçili ${resourceName}`} value={selected.size} icon={CheckSquareIcon} accent={tone === 'danger' ? 'primary' : 'violet'} />,
    ] : []),
  ]
  const statColsClass = ({ 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6' } as Record<number, string>)[Math.min(statCards.length, 6)] ?? 'lg:grid-cols-4'

  return (
    <>
      {!embedded && (
        <SectionToolbar
          icon={icon}
          title={title}
          subtitle={subtitle}
          actions={
            <div className="flex items-center gap-2">
              {altView && (
                <Button variant={altActive ? 'primary' : 'outline'} size="sm" onClick={() => setAltActive((v) => !v)}>
                  {altView.toggleIcon ? <altView.toggleIcon className="h-4 w-4" /> : null}
                  {altView.toggleLabel(altActive)}
                </Button>
              )}
              {extraHeaderActions}
              {creatable && createButtonPlacement === 'header' && <Button variant={createVariant} size="sm" onClick={openAdd} iconLeft={<PlusIcon className="h-3.5 w-3.5" />}>Yeni {resourceName}</Button>}
            </div>
          }
        />
      )}

      {!embedded && statCards.length > 0 && (
        <div className={cn('mt-[10px] flex gap-3 overflow-x-auto pb-1 [&>*]:w-[170px] [&>*]:flex-shrink-0 lg:grid lg:overflow-visible lg:pb-0 lg:[&>*]:w-auto', statColsClass)}>
          {statCards}
        </div>
      )}

      {altActive && altView ? (
        altView.render(rows, { openEdit, openCreate: openAddDirect, openView: (r) => setViewRow(r), refetch: fetchList, loading })
      ) : (
      <div className={cn('space-y-4', !embedded && statCards.length > 0 && 'mt-[15px]')}>
      <FilterBar
        columns={filterColumns ?? 3}
        search={
          <Input
            placeholder={searchPlaceholder ?? 'Tüm alanlarda ara...'}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
          />
        }
        filterCount={filterCount ?? Object.values(extraParams ?? {}).filter(Boolean).length}
        hasActiveFilters={filtersActive}
        onClear={clearAll}
      >
        {sortOptions && sortOptions.length > 0 && (
          <FilterField label="Sıralama">
            <Select
              value={activeSortOptionKey}
              onChange={(e) => {
                const opt = sortOptions[Number(e.target.value)]
                if (!opt) return
                setSort(opt.manual ? { key: 'manual', dir: 'asc' } : { key: opt.key, dir: opt.dir ?? 'asc' })
                setPage(1)
              }}
            >
              {sortOptions.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
            </Select>
          </FilterField>
        )}
        {renderFilters?.()}
      </FilterBar>

      <DataTable<T>
        key={tableColumns.map(c => c.key).join(',')}
        title={listTitle ?? `${resourceName} Listesi`}
        columns={tableColumns}
        rows={rows}
        rowKey={rowKey}
        loading={loading || reordering}
        selectable={selectable}
        selected={selectable ? selected : undefined}
        onSelectedChange={selectable ? setSelected : undefined}
        limit={manualSortActive ? rows.length || 1 : limit}
        onLimitChange={manualSortActive ? undefined : (n) => { setLimit(n); setPage(1) }}
        pageSizeOptions={pageSizeOptions}
        page={manualSortActive ? 1 : page}
        totalPages={manualSortActive ? 1 : totalPages}
        total={manualSortActive ? rows.length : total}
        onPageChange={manualSortActive ? undefined : setPage}
        sort={manualSortActive ? undefined : sort}
        onSortChange={manualSortActive ? undefined : (s) => { setSort(s); setPage(1) }}
        onReorder={manualSortActive && onReorder ? handleReorder : undefined}
        highlightedRowKey={highlightedRowKey}
        selectionActions={selectable ? selectionActions : undefined}
        toolbarActions={creatable && createButtonPlacement === 'table'
          ? <Button variant={createVariant} size="sm" onClick={openAdd} iconLeft={<PlusIcon className="h-3.5 w-3.5" />}>Yeni {resourceName}</Button>
          : undefined}
        rowActions={(row) => (
          <RowActions
            onView={viewable ? () => setViewRow(row) : undefined}
            onEdit={!canEdit || canEdit(row) ? () => openEdit(row) : undefined}
            onToggleStatus={service.toggleStatus ? () => requestToggle(row) : undefined}
            isActive={isActive ? isActive(row) : true}
            canToggle={canToggle ? canToggle(row) : true}
            onDelete={service.remove ? () => setDeleteId(rowKey(row)) : undefined}
            canDelete={canDelete ? canDelete(row) : true}
            extra={extraRowActions?.(row)}
            collapse={collapseRowActions}
          />
        )}
        empty={
          <EmptyState
            icon={icon}
            title={emptyTitle ?? `Henüz ${resourceName.toLocaleLowerCase('tr')} yok`}
            description={filtersActive ? 'Filtrelere uygun kayıt bulunamadı.' : (emptyDescription ?? `"+ ${resourceName} Ekle" butonunu kullanın`)}
            action={filtersActive ? <Button variant="outline" size="sm" onClick={clearAll}>Filtreleri temizle</Button> : undefined}
          />
        }
      />
      </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        icon={icon}
        width={drawerWidth}
        className={toneClass}
        bodyRef={drawerBodyRef}
        hideHeader={formShell}
        title={editingId ? `${resourceName} Düzenle` : `Yeni ${resourceName} Ekle`}
        subtitle={editingId ? 'Bilgileri güncelleyin' : `Yeni bir ${resourceName.toLocaleLowerCase('tr')} oluşturun`}
        footer={
          renderFormFooter
            ? renderFormFooter({ form, mode: editingId ? 'edit' : 'create', editingId, saving, submit, close: closeDrawer, refetch: fetchList })
            : (
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={closeDrawer}>İptal</Button>
                <Button
                  variant={createVariant}
                  className="flex-1"
                  isLoading={saving}
                  disabled={saving}
                  onClick={submit}
                >
                  {editingId ? 'Güncelle' : 'Kaydet'}
                </Button>
              </div>
            )
        }
      >
        {pendingDraft && (
          <div className="flex items-center justify-between gap-3 rounded-field border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning-soft))] px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileClockIcon className="h-4 w-4 flex-shrink-0 text-[hsl(var(--warning))]" />
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-foreground-strong">Kaydedilmemiş taslağınız var</p>
                <p className="text-[11px] text-foreground-muted">{formatDraftAge(pendingDraft.savedAt)} bırakılmış, devam edebilirsiniz.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={discardDraft}>
                <XIcon className="h-3.5 w-3.5" /> Sil
              </Button>
              <Button variant="primary" size="sm" onClick={() => restoreDraft(setForm)}>
                Devam Et
              </Button>
            </div>
          </div>
        )}
        {renderForm({
          form,
          setForm,
          mode: editingId ? 'edit' : 'create',
          editingId,
          editingRow,
          requestToggleStatus: () => { const row = editingRow; closeDrawer(); if (row) requestToggle(row) },
          close: () => { closeDrawer(); fetchList() },
          refetch: fetchList,
        })}
      </Drawer>

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && confirmDelete(deleteId)}
        className={toneClass}
        icon={Trash2Icon}
        tone="danger"
        title={deleteConfirm?.title ?? `${resourceName} Sil`}
        description={deleteConfirm?.description ?? `Bu kaydı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
        confirmLabel="Evet, Sil"
        loading={deleting}
      />

      <ConfirmModal
        open={!!toggleRow}
        onClose={() => { setToggleRow(null); setToggleMsg(null) }}
        onConfirm={() => toggleRow && runToggle(toggleRow)}
        className={toneClass}
        icon={PowerIcon}
        tone="primary"
        title={toggleMsg?.title ?? 'Durumu Değiştir'}
        description={toggleMsg?.description ?? ''}
        confirmLabel="Onayla"
        loading={toggling}
      />

      <ConfirmModal
        open={!!bulkType}
        onClose={() => setBulkType(null)}
        onConfirm={runBulk}
        className={toneClass}
        icon={bulkType === 'delete' ? Trash2Icon : PowerIcon}
        tone={bulkType === 'delete' ? 'danger' : 'primary'}
        title={bulkType ? bulkMessages[bulkType].title : ''}
        description={bulkType ? bulkMessages[bulkType].description : ''}
        confirmLabel={bulkType === 'delete' ? 'Evet, Sil' : 'Onayla'}
        loading={bulkRunning}
      />

      <Modal
        open={!!viewRow}
        onClose={() => setViewRow(null)}
        title={`${resourceName} Detayı`}
        width={viewWidth ?? 760}
        className={viewWidth ? 'max-w-[96vw]' : undefined}
        bodyClassName="px-6 py-5"
      >
        {renderView && viewRow ? (
          renderView(viewRow)
        ) : (
          <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
            {columns.map((col) => (
              <div key={col.key} className="flex items-center justify-between gap-4 border-b border-border py-3">
                <dt className="type-muted shrink-0">{col.header}</dt>
                <dd className="min-w-0 truncate text-right font-medium text-foreground-strong">{viewRow ? col.cell(viewRow, 0) : null}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>

      {createGate?.({
        open: gateOpen,
        onContinue: (seed) => { setGateOpen(false); openAddDirect(seed) },
        onCancel: () => setGateOpen(false),
      })}
    </>
  )
}
