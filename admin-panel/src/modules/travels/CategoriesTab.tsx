import { useCallback, useEffect, useState } from 'react'
import {
  TagIcon, MapPinIcon, Users2Icon, ArmchairIcon, PercentIcon,
  EyeIcon, PencilIcon, Trash2Icon, ArrowLeftIcon, PlusIcon,
  CheckCircle2Icon, PowerOffIcon, PowerIcon, SearchIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  SectionToolbar, StatCard, Badge, Button, IconButton, Input, Select, Drawer, ConfirmModal,
  EmptyState, Label, Textarea, ColorSwatchPicker, DataTable, isHexColor, type DataTableColumn,
} from '@/design-system'
import travelCategoryService from '@/services/travelCategory.service'
import { useAuth } from '@/framework/auth/AuthContext'
import { TravelsTab } from './TravelsTab'
import { emptyCategoryForm, categoryToForm } from './travelFormDefaults'
import type { TravelCategory, TravelCategoryFormData } from '@/types/travel.types'

type StatusFilter = 'all' | 'active' | 'passive'

const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

// Denetimde bulundu (2026-09-20): bu tab CrudListTemplate kullanmadığı (elle kurulmuş bir
// liste/drawer) için diğer tüm CategoriesTab'lerin (quiz, events) aksine can() ile hiç
// korunmuyordu — travels.view yetkisi olan biri düzenle/sil/aktif-pasif/ekle butonlarını
// görüyor, tıklarsa backend 403 veriyor ama UI yanlış imkan vaadi ediyordu.
export const CategoriesTab = () => {
  const { can } = useAuth()
  const [list, setList] = useState<TravelCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [drilled, setDrilled] = useState<TravelCategory | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TravelCategory | null>(null)
  const [form, setForm] = useState<TravelCategoryFormData>(emptyCategoryForm())
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<TravelCategory | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggleTarget, setToggleTarget] = useState<TravelCategory | null>(null)
  const [toggling, setToggling] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    travelCategoryService.getList({ page: 1, limit: 100, search })
      .then((r) => {
        setList(r.items)
        setDrilled((d) => (d ? r.items.find((c) => c.id === d.id) ?? null : d))
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }, [search])
  useEffect(() => { load() }, [load])

  const openAdd = () => { setEditing(null); setForm(emptyCategoryForm()); setFormOpen(true) }
  const openEdit = (c: TravelCategory) => { setEditing(c); setForm(categoryToForm(c)); setFormOpen(true) }

  const valid = !!form.name.trim() && isHexColor(form.color)
  const save = async () => {
    if (!valid) return
    setSaving(true)
    try {
      if (editing) { await travelCategoryService.update(editing.id, form); toast.success('Kategori güncellendi.') }
      else { await travelCategoryService.create(form); toast.success('Kategori eklendi.') }
      setFormOpen(false); load()
    } finally { setSaving(false) }
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await travelCategoryService.delete(deleteTarget.id)
      toast.success('Kategori silindi.')
      if (drilled?.id === deleteTarget.id) setDrilled(null)
      setDeleteTarget(null); load()
    } finally { setDeleting(false) }
  }

  const doToggle = async () => {
    if (!toggleTarget) return
    setToggling(true)
    try {
      await travelCategoryService.toggleStatus(toggleTarget.id)
      toast.success(toggleTarget.isActive ? 'Kategori pasife alındı.' : 'Kategori aktif edildi.')
      setToggleTarget(null); load()
    } finally { setToggling(false) }
  }

  const filtered = list.filter((c) => status === 'all' || (status === 'active' ? c.isActive : !c.isActive))
  const activeCount = list.filter((c) => c.isActive).length

  const setSelectedStatus = async (makeActive: boolean) => {
    const picked = list.filter((c) => selected.has(c.id))
    const blocked = makeActive ? [] : picked.filter((c) => c.isActive && c.travelCount > 0)
    const targets = picked.filter((c) => c.isActive !== makeActive && (makeActive || c.travelCount === 0))

    if (targets.length === 0) {
      toast.info(blocked.length > 0 ? 'Gezisi bulunan kategoriler pasife alınamaz.' : 'Seçili kategoriler zaten istenen durumda.')
      return
    }

    setBulkBusy(true)
    try {
      const results = await Promise.allSettled(targets.map((c) => travelCategoryService.toggleStatus(c.id)))
      const updated = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - updated
      if (updated > 0) toast.success(`${updated} kategori ${makeActive ? 'aktif' : 'pasif'} edildi.`)
      if (blocked.length > 0) toast.warning(`${blocked.length} kategori, içinde gezi bulunduğu için atlandı.`)
      if (failed > 0) toast.error(`${failed} kategori güncellenemedi.`)
      setSelected(new Set())
      load()
    } finally {
      setBulkBusy(false)
    }
  }

  const columns: DataTableColumn<TravelCategory>[] = [
    {
      key: 'name', header: 'Kategori', cell: (c) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-3 w-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: c.color }} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground-strong">{c.name}</p>
            <p className="max-w-[320px] truncate text-xs text-foreground-muted">{c.description || 'Açıklama eklenmemiş'}</p>
          </div>
        </div>
      ),
    },
    { key: 'travelCount', header: 'Gezi', align: 'center', cell: (c) => <span className="tabular-nums font-medium">{c.travelCount}</span> },
    { key: 'registered', header: 'Kayıtlı', align: 'center', cell: (c) => <span className="tabular-nums">{c.totalRegistered.toLocaleString('tr-TR')}</span> },
    { key: 'capacity', header: 'Kontenjan', align: 'center', cell: (c) => <span className="tabular-nums">{c.totalCapacity.toLocaleString('tr-TR')}</span> },
    {
      key: 'fill', header: 'Doluluk', align: 'center', cell: (c) => {
        const fill = c.totalCapacity > 0 ? Math.round((c.totalRegistered / c.totalCapacity) * 100) : 0
        return <Badge tone={fill >= 90 ? 'danger' : fill >= 60 ? 'warning' : 'neutral'}>%{fill}</Badge>
      },
    },
    { key: 'status', header: 'Durum', align: 'center', cell: (c) => <Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? 'Aktif' : 'Pasif'}</Badge> },
  ]

  const formDrawer = (
    <Drawer
      open={formOpen}
      onClose={() => setFormOpen(false)}
      title={editing ? 'Kategoriyi Düzenle' : 'Yeni Kategori'}
      subtitle="Gezilerin sınıflandırıldığı kategori"
      width={460}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>İptal</Button>
          <Button size="sm" onClick={save} isLoading={saving} disabled={!valid}>Kaydet</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <Label required>Kategori Adı</Label>
          <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Örn. Kültürel Gezi" />
        </div>
        <div>
          <Label>Açıklama</Label>
          <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} placeholder="Kategori hakkında kısa açıklama" />
        </div>
        <div>
          <Label required>Renk</Label>
          <ColorSwatchPicker value={form.color} onChange={(c) => setForm((p) => ({ ...p, color: c }))} />
        </div>
        {isHexColor(form.color) && form.name.trim() && (
          <div
            className="rounded-xl p-4 flex items-center gap-4"
            style={{ background: `rgba(${hexToRgb(form.color)}, 0.08)`, border: `1px solid rgba(${hexToRgb(form.color)}, 0.2)` }}
          >
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `rgba(${hexToRgb(form.color)}, 0.15)` }}
            >
              <TagIcon className="h-5 w-5" style={{ color: form.color }} />
            </div>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: form.color }}>{form.name}</p>
              <p className="text-[11px] text-[hsl(var(--foreground-muted))] mt-0.5">Önizleme</p>
            </div>
            <div className="ml-auto">
              <Badge color={form.color}>{form.name}</Badge>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )

  const confirms = (
    <>
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        icon={Trash2Icon}
        tone="danger"
        title="Kategoriyi Sil"
        description={`"${deleteTarget?.name ?? ''}" kategorisini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
        confirmLabel="Evet, Sil"
        loading={deleting}
      />
      <ConfirmModal
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={doToggle}
        icon={PowerIcon}
        tone="primary"
        title={toggleTarget?.isActive ? 'Kategoriyi Pasife Al' : 'Kategoriyi Aktif Et'}
        description={toggleTarget?.isActive
          ? `"${toggleTarget?.name}" pasife alınacak; yeni gezilerde seçilemez.`
          : `"${toggleTarget?.name}" yeniden aktif edilecek.`}
        confirmLabel={toggleTarget?.isActive ? 'Pasife Al' : 'Aktif Et'}
        loading={toggling}
      />
    </>
  )

  if (drilled) {
    const fill = drilled.totalCapacity > 0 ? Math.round((drilled.totalRegistered / drilled.totalCapacity) * 100) : 0
    const rgb = isHexColor(drilled.color) ? hexToRgb(drilled.color) : '59, 130, 246'
    return (
      <>
        <div className="space-y-4">
          <div
            className="rounded-xl p-5 flex flex-wrap items-center justify-between gap-4"
            style={{ background: `rgba(${rgb}, 0.06)`, border: `1px solid rgba(${rgb}, 0.15)` }}
          >
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setDrilled(null)}>
                <ArrowLeftIcon className="h-4 w-4" /> Geri
              </Button>
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `rgba(${rgb}, 0.15)` }}
              >
                <TagIcon className="h-5 w-5" style={{ color: drilled.color }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-bold" style={{ color: drilled.color }}>{drilled.name}</h2>
                  <Badge tone={drilled.isActive ? 'success' : 'neutral'}>{drilled.isActive ? 'Aktif' : 'Pasif'}</Badge>
                </div>
                <p className="text-[12px] text-[hsl(var(--foreground-muted))] mt-0.5">{drilled.description || 'Bu kategoriye tanımlı geziler'}</p>
              </div>
            </div>
            {can('travels.edit') && (
              <Button variant="outline" size="sm" onClick={() => openEdit(drilled)}>
                <PencilIcon className="h-4 w-4" /> Düzenle
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Toplam Gezi" value={drilled.travelCount} icon={MapPinIcon} accent="blue" />
            <StatCard label="Toplam Kontenjan" value={drilled.totalCapacity} icon={ArmchairIcon} accent="violet" />
            <StatCard label="Kayıtlı Kişi" value={drilled.totalRegistered} icon={Users2Icon} accent="green" />
            <StatCard label="Doluluk" value={`%${fill}`} icon={PercentIcon} accent="orange" />
          </div>

          <TravelsTab embedded scope={{ categoryId: drilled.id }} />
        </div>
        {formDrawer}
        {confirms}
      </>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <SectionToolbar
          icon={TagIcon}
          title="Gezi Kategorileri"
          subtitle="Gezilerin sınıflandırıldığı kategoriler"
          actions={
            can('travels.create') ? (
              <Button size="sm" onClick={openAdd} iconLeft={<PlusIcon className="h-4 w-4" />}>Kategori Ekle</Button>
            ) : undefined
          }
        />

        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Toplam Kategori" value={list.length} icon={TagIcon} accent="blue" loading={loading} />
          <StatCard label="Aktif Kategori" value={activeCount} icon={CheckCircle2Icon} accent="green" loading={loading} />
          <StatCard label="Pasif Kategori" value={list.length - activeCount} icon={PowerOffIcon} accent="orange" loading={loading} />
        </div>

        <div className="flex flex-col gap-2 rounded-card border border-border bg-[hsl(var(--primary)/0.035)] p-4 sm:flex-row sm:items-end sm:gap-2.5">
          <div className="w-full sm:w-80 sm:flex-none">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle">Kategori</p>
            <Input
              tone="white"
              className="border-[hsl(var(--border))]"
              placeholder="Kategori ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
            />
          </div>
          <div className="w-full sm:w-40 sm:flex-none">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle">Durum</p>
            <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              <option value="active">Aktif</option>
              <option value="passive">Pasif</option>
            </Select>
          </div>
        </div>

        <DataTable
          title="Kategori Listesi"
          columns={columns}
          rows={filtered}
          rowKey={(c) => c.id}
          loading={loading}
          showRowNumbers
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          selectionActions={
            <div className="flex flex-wrap items-center gap-1.5">
              {can('travels.edit') && (
                <>
                  <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void setSelectedStatus(true)}>
                    <CheckCircle2Icon className="h-3.5 w-3.5" /> Tümünü Aktif Et
                  </Button>
                  <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void setSelectedStatus(false)}>
                    <PowerOffIcon className="h-3.5 w-3.5" /> Tümünü Pasif Et
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelected(new Set())}>Seçimi Temizle</Button>
            </div>
          }
          total={filtered.length}
          limit={100}
          rowActions={(c) => (
            <div className="flex items-center justify-end gap-1">
              <IconButton tone="default" title="Gezileri gör" onClick={() => setDrilled(c)}><EyeIcon className="h-4 w-4" /></IconButton>
              {can('travels.edit') && (
                <IconButton tone="primary" title="Düzenle" onClick={() => openEdit(c)}><PencilIcon className="h-4 w-4" /></IconButton>
              )}
              {can('travels.edit') && (
                <IconButton tone={c.isActive ? 'warning' : 'success'} title={c.isActive ? 'Pasife al' : 'Aktif et'} disabled={c.isActive && c.travelCount > 0} onClick={() => setToggleTarget(c)}>
                  {c.isActive ? <PowerOffIcon className="h-4 w-4" /> : <PowerIcon className="h-4 w-4" />}
                </IconButton>
              )}
              {can('travels.delete') && (
                <IconButton tone="danger" title={c.travelCount > 0 ? 'Gezisi olan kategori silinemez' : 'Sil'} disabled={c.travelCount > 0} onClick={() => setDeleteTarget(c)}><Trash2Icon className="h-4 w-4" /></IconButton>
              )}
            </div>
          )}
          empty={
            <EmptyState
              icon={TagIcon}
              title="Kategori bulunamadı"
              description={search || status !== 'all' ? 'Aramaya/filtreye uygun kategori yok.' : '"Kategori Ekle" butonu ile ilk kategoriyi oluşturun.'}
              action={can('travels.create') ? <Button variant="outline" size="sm" onClick={openAdd}>Kategori Ekle</Button> : undefined}
            />
          }
        />
      </div>
      {formDrawer}
      {confirms}
    </>
  )
}
