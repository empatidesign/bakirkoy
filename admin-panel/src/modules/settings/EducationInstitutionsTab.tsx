import { useState, useEffect, useCallback, useRef } from 'react'
import {
  SchoolIcon, PlusIcon, PencilIcon, Trash2Icon, SearchIcon,
  FilterXIcon, SlidersHorizontalIcon, GraduationCapIcon,
  BookOpenIcon, LibraryBigIcon, LandmarkIcon, WrenchIcon, BookMarkedIcon,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Field, Input, Select, Modal } from '@/design-system'
import { DataTable, type DataTableColumn, type SortState } from '@/design-system/DataTable'
import educationService from '@/services/education.service'
import type {
  EducationInstitution,
  EducationInstitutionForm,
  InstitutionType,
  DegreeLevel,
} from '@/types/education.types'


const INSTITUTION_TYPES: { value: InstitutionType; label: string; icon: LucideIcon; color: string; bg: string }[] = [
  { value: 'Ilkokul',           label: 'İlkokul',            icon: BookOpenIcon,    color: '#d97706', bg: '#fef3c7' },
  { value: 'Ortaokul',          label: 'Ortaokul',           icon: LibraryBigIcon,  color: '#7c3aed', bg: '#ede9fe' },
  { value: 'Lise',              label: 'Lise',               icon: LandmarkIcon,    color: '#2563eb', bg: '#dbeafe' },
  { value: 'Universite',        label: 'Üniversite',         icon: GraduationCapIcon, color: '#059669', bg: '#d1fae5' },
  { value: 'MeslekYuksekokulu', label: 'Meslek Yüksekokulu', icon: WrenchIcon,      color: '#dc2626', bg: '#fee2e2' },
  { value: 'Diger',             label: 'Diğer',              icon: BookMarkedIcon,  color: '#64748b', bg: '#f1f5f9' },
]

const TYPE_MAP = Object.fromEntries(INSTITUTION_TYPES.map((t) => [t.value, t]))


const DEGREE_OPTIONS: { value: DegreeLevel | ''; label: string }[] = [
  { value: '',            label: 'Seçiniz' },
  { value: 'Onlisans',    label: 'Ön Lisans' },
  { value: 'Lisans',      label: 'Lisans' },
  { value: 'YuksekLisans',label: 'Yüksek Lisans' },
  { value: 'Doktora',     label: 'Doktora' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Tüm Durumlar' },
  { value: 'true', label: 'Aktif' },
  { value: 'false', label: 'Pasif' },
]

const EMPTY_FORM: EducationInstitutionForm = {
  type: '', name: '', faculty: '', department: '', degreeLevel: '',
}

const isHigherEd = (t: InstitutionType | '') =>
  t === 'Universite' || t === 'MeslekYuksekokulu'

const LIMIT = 25


export const EducationInstitutionsTab = () => {
  const [rows, setRows]     = useState<EducationInstitution[]>([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [sort, setSort]     = useState<SortState | null>({ key: 'name', dir: 'asc' })
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [typeFilter,   setTypeFilter]   = useState('')
  const [nameFilter,   setNameFilter]   = useState('')
  const [facFilter,    setFacFilter]    = useState('')
  const [deptFilter,   setDeptFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showFilters,  setShowFilters]  = useState(false)

  const nameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const facDebounce  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deptDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [nameQ,  setNameQ]  = useState('')
  const [facQ,   setFacQ]   = useState('')
  const [deptQ,  setDeptQ]  = useState('')

  const debounce = (
    setter: (v: string) => void,
    ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
    v: string,
  ) => {
    if (ref.current) clearTimeout(ref.current)
    ref.current = setTimeout(() => { setter(v); setPage(1) }, 350)
  }

  const clearFilters = () => {
    setTypeFilter(''); setNameFilter(''); setFacFilter(''); setDeptFilter(''); setStatusFilter('')
    setNameQ(''); setFacQ(''); setDeptQ(''); setPage(1)
  }

  const hasActive = !!(typeFilter || nameQ || facQ || deptQ || statusFilter)
  const showFacFilters = !typeFilter || isHigherEd(typeFilter as InstitutionType)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        page,
        limit: LIMIT,
        sort: sort?.key,
        order: sort?.dir,
      }
      if (typeFilter)   params.type       = typeFilter
      if (nameQ)        params.name       = nameQ
      if (facQ)         params.faculty    = facQ
      if (deptQ)        params.department = deptQ
      if (statusFilter) params.isActive   = statusFilter

      const res = await educationService.getInstitutions(params)
      setRows(res.items)
      setTotal(res.total)
    } catch { void 0 }
    finally { setLoading(false) }
  }, [page, typeFilter, nameQ, facQ, deptQ, statusFilter, sort])

  useEffect(() => { void load() }, [load])

  const [modalOpen,   setModalOpen]   = useState(false)
  const [editTarget,  setEditTarget]  = useState<EducationInstitution | null>(null)
  const [form,        setForm]        = useState<EducationInstitutionForm>(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EducationInstitution | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setModalOpen(true) }
  const openEdit   = (r: EducationInstitution) => {
    setEditTarget(r)
    setForm({
      type: r.type,
      name: r.name,
      faculty: r.faculty ?? '',
      department: r.department ?? '',
      degreeLevel: r.degreeLevel ?? '',
    })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.type || !form.name.trim()) return
    setSaving(true)
    try {
      if (editTarget) {
        await educationService.updateInstitution(editTarget.id, form)
        toast.success('Kurum güncellendi.')
      } else {
        await educationService.createInstitution(form)
        toast.success('Kurum eklendi.')
      }
      setModalOpen(false)
      void load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Kurum kaydedilemedi.')
    } finally { setSaving(false) }
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await educationService.deleteInstitution(deleteTarget.id)
      toast.success('Kurum silindi.')
      setDeleteTarget(null)
      void load()
    } catch { void 0 } finally { setDeleting(false) }
  }

  const doBulkDelete = async () => {
    if (selected.size === 0) return
    setBulkDeleting(true)
    try {
      await Promise.all([...selected].map((id) => educationService.deleteInstitution(id)))
      toast.success(`${selected.size} kurum silindi.`)
      setSelected(new Set())
      void load()
    } catch { void 0 } finally { setBulkDeleting(false) }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const offset = (page - 1) * LIMIT


  const columns: DataTableColumn<EducationInstitution>[] = [
    {
      key: 'no',
      header: '#',
      width: '48px',
      cell: (_, i) => (
        <span className="type-caption text-foreground-subtle">{offset + i + 1}</span>
      ),
    },
    {
      key: 'type',
      header: 'Tür',
      sortable: true,
      sortKey: 'type',
      width: '140px',
      cell: (r) => {
        const meta = TYPE_MAP[r.type]
        return (
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold"
            style={{ color: meta?.color, backgroundColor: meta?.bg }}
          >
            {meta && <meta.icon className="h-3 w-3 shrink-0" />}
            {r.typeLabel}
          </span>
        )
      },
    },
    {
      key: 'name',
      header: 'Kurum Adı',
      sortable: true,
      sortKey: 'name',
      cell: (r) => (
        <div>
          <p className="type-body-strong text-foreground-strong">{r.name}</p>
          {r.faculty && (
            <p className="type-caption text-foreground-muted mt-0.5">
              {r.faculty}
              {r.department ? <span className="text-foreground-subtle"> › {r.department}</span> : null}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'faculty',
      header: 'Fakülte',
      sortable: true,
      sortKey: 'faculty',
      defaultHidden: false,
      cell: (r) => r.faculty
        ? <span className="type-body text-foreground-default">{r.faculty}</span>
        : <span className="type-caption text-foreground-subtle">—</span>,
    },
    {
      key: 'department',
      header: 'Bölüm',
      sortable: true,
      sortKey: 'department',
      cell: (r) => r.department
        ? <span className="type-body text-foreground-default">{r.department}</span>
        : <span className="type-caption text-foreground-subtle">—</span>,
    },
    {
      key: 'degreeLevel',
      header: 'Öğrenim Derecesi',
      width: '160px',
      cell: (r) => r.degreeLevelLabel
        ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-[#eef3f8] px-2 py-0.5 text-[11px] font-semibold text-[#0f4c81]">
            <GraduationCapIcon className="h-3 w-3" />
            {r.degreeLevelLabel}
          </span>
        )
        : <span className="type-caption text-foreground-subtle">—</span>,
    },
    {
      key: 'isActive',
      header: 'Durum',
      width: '80px',
      align: 'center',
      cell: (r) => (
        <Badge tone={r.isActive ? 'success' : 'neutral'}>
          {r.isActive ? 'Aktif' : 'Pasif'}
        </Badge>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">

      <div className="flex items-center justify-between gap-4 border-b border-border bg-surface-1 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
            <SchoolIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-foreground-strong">Eğitim Kurumları</p>
            <p className="type-caption text-foreground-muted">{total} kayıt</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              hasActive
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-border bg-card text-foreground-muted hover:bg-surface-1'
            }`}
          >
            <SlidersHorizontalIcon className="h-3.5 w-3.5" />
            Filtrele
            {hasActive && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                {[typeFilter, nameQ, facQ, deptQ, statusFilter].filter(Boolean).length}
              </span>
            )}
          </button>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <PlusIcon className="h-4 w-4" /> Kurum Ekle
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-b border-border px-5 py-2.5">
        <button
          type="button"
          onClick={() => { setTypeFilter(''); setPage(1) }}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
            !typeFilter ? 'bg-foreground-strong text-white' : 'bg-surface-1 text-foreground-muted hover:bg-surface-2'
          }`}
        >
          Tümü
        </button>
        {INSTITUTION_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setTypeFilter(t.value); setPage(1) }}
            className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              typeFilter === t.value ? 'text-white' : 'bg-surface-1 text-foreground-muted hover:bg-surface-2'
            }`}
            style={typeFilter === t.value ? { backgroundColor: t.color } : undefined}
          >
            <t.icon className="h-3.5 w-3.5 shrink-0" /> {t.label}
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="border-b border-border bg-surface-0 px-5 py-2.5">
          <div className={`grid gap-2 ${showFacFilters ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3'}`} style={{ maxWidth: '130%' }}>
            <Field label="Kurum Adı">
              <Input
                iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
                placeholder="Kurum ara..."
                value={nameFilter}
                onChange={(e) => { setNameFilter(e.target.value); debounce(setNameQ, nameDebounce, e.target.value) }}
              />
            </Field>
            {showFacFilters && (
              <>
                <Field label="Fakülte">
                  <Input
                    iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
                    placeholder="Fakülte ara..."
                    value={facFilter}
                    onChange={(e) => { setFacFilter(e.target.value); debounce(setFacQ, facDebounce, e.target.value) }}
                  />
                </Field>
                <Field label="Bölüm">
                  <Input
                    iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
                    placeholder="Bölüm ara..."
                    value={deptFilter}
                    onChange={(e) => { setDeptFilter(e.target.value); debounce(setDeptQ, deptDebounce, e.target.value) }}
                  />
                </Field>
              </>
            )}
            <Field label="Durum">
              <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
          </div>
          {hasActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2 gap-1">
              <FilterXIcon className="h-3.5 w-3.5" />
              Filtreleri temizle
            </Button>
          )}
        </div>
      )}

      <DataTable<EducationInstitution>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        selectionActions={
          <Button
            variant="danger"
            size="sm"
            isLoading={bulkDeleting}
            onClick={() => void doBulkDelete()}
          >
            <Trash2Icon className="h-3.5 w-3.5" />
            {selected.size} Kurumu Sil
          </Button>
        }
        sort={sort}
        onSortChange={setSort}
        page={page}
        totalPages={totalPages}
        total={total}
        limit={LIMIT}
        onPageChange={setPage}
        rowActions={(r) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              title="Düzenle"
              onClick={() => openEdit(r)}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-1 text-foreground-muted hover:bg-surface-2 hover:text-foreground-strong"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Sil"
              onClick={() => setDeleteTarget(r)}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-danger-soft text-danger hover:bg-danger-soft/70"
            >
              <Trash2Icon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        actionsHeader="İşlemler"
        empty={
          <div className="flex flex-col items-center gap-3 py-14">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2">
              <SchoolIcon className="h-6 w-6 text-foreground-subtle" />
            </div>
            <p className="type-body text-foreground-muted">
              {hasActive ? 'Filtrelere uygun kurum bulunamadı.' : 'Henüz kurum eklenmemiş.'}
            </p>
            {hasActive && (
              <button type="button" onClick={clearFilters} className="type-body text-primary hover:underline">
                Filtreleri temizle
              </button>
            )}
          </div>
        }
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Kurumu Düzenle' : 'Yeni Kurum Ekle'}
        width={520}
        bodyClassName="p-5"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Vazgeç</Button>
            <Button
              variant="primary"
              className="flex-1"
              isLoading={saving}
              disabled={!form.type || !form.name.trim()}
              onClick={() => void save()}
            >
              Kaydet
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Kurum Türü" required>
            <Select
              value={form.type}
              onChange={(e) => setForm((p) => ({
                ...p,
                type: e.target.value as InstitutionType,
                faculty: '',
                department: '',
                degreeLevel: '',
              }))}
              placeholder="Tür seçin"
            >
              {INSTITUTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>

          <Field label="Kurum Adı" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder={
                form.type === 'Universite'        ? 'Örn: İstanbul Teknik Üniversitesi' :
                form.type === 'MeslekYuksekokulu' ? 'Örn: Bakırköy Meslek Yüksekokulu' :
                form.type === 'Lise'              ? 'Örn: Bakırköy Anadolu Lisesi' :
                'Kurum adını girin'
              }
            />
          </Field>

          {isHigherEd(form.type) && (
            <>
              <Field label="Fakülte / Yüksekokul" hint="Üniversite veya MYO için fakülte / yüksekokul adı">
                <Input
                  value={form.faculty}
                  onChange={(e) => setForm((p) => ({ ...p, faculty: e.target.value }))}
                  placeholder="Örn: Mühendislik Fakültesi"
                />
              </Field>
              <Field label="Bölüm / Program" hint="Fakülte altındaki bölüm veya program adı">
                <Input
                  value={form.department}
                  onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                  placeholder="Örn: Bilgisayar Mühendisliği"
                />
              </Field>
              <Field label="Öğrenim Derecesi" hint="Bu kayıt hangi derece seviyesine ait?">
                <Select
                  value={form.degreeLevel}
                  onChange={(e) => setForm((p) => ({ ...p, degreeLevel: e.target.value as DegreeLevel | '' }))}
                >
                  {DEGREE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>
            </>
          )}

          {form.name && (
            <div
              className="flex items-center gap-3 rounded-xl p-3"
              style={{
                background: TYPE_MAP[form.type as InstitutionType]?.bg ?? '#f1f5f9',
                border: `1px solid ${TYPE_MAP[form.type as InstitutionType]?.color ?? '#94a3b8'}30`,
              }}
            >
              {(() => { const t = TYPE_MAP[form.type as InstitutionType]; const Icon = t?.icon ?? SchoolIcon; return <Icon className="h-6 w-6 shrink-0" style={{ color: t?.color ?? '#64748b' }} /> })()}
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-foreground-strong">{form.name}</p>
                {form.faculty && (
                  <p className="type-caption text-foreground-muted truncate">
                    {form.faculty}{form.department ? ` › ${form.department}` : ''}
                  </p>
                )}
                {form.degreeLevel && (
                  <p className="type-caption text-[#0f4c81] mt-0.5">
                    {DEGREE_OPTIONS.find((d) => d.value === form.degreeLevel)?.label}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Kurum Silinsin mi?"
        width={380}
        bodyClassName="p-5"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>İptal</Button>
            <Button variant="danger" className="flex-1" isLoading={deleting} onClick={() => void doDelete()}>Sil</Button>
          </div>
        }
      >
        <p className="type-body text-foreground-default">
          <span className="font-semibold">{deleteTarget?.name}</span>
          {deleteTarget?.faculty && ` — ${deleteTarget.faculty}`}
          {deleteTarget?.department && ` › ${deleteTarget.department}`}
          {' '}kalıcı olarak silinecek. Emin misiniz?
        </p>
      </Modal>
    </div>
  )
}
