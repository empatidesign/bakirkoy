import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MapPinIcon, CheckCircle2Icon, PowerOffIcon, ArrowLeftIcon, BusIcon, EyeIcon, MessageSquareIcon,
  Users2Icon, ArmchairIcon, StarIcon, ChevronRightIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import { Badge, Button, IconButton, AdminFormShell, StatCard, FilterField, Select } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import { TravelSendMessageModal } from './TravelSendMessageModal'
import travelRouteService from '@/services/travelRoute.service'
import travelService from '@/services/travel.service'
import travelCategoryService from '@/services/travelCategory.service'
import { RouteForm } from './RouteForm'
import { TravelsTab } from './TravelsTab'
import { emptyRouteForm, routeToForm } from './travelFormDefaults'
import type { TravelRoute, TravelRouteFormData, TravelSummary } from '@/types/travel.types'
import type { SelectOption } from '@/types/common'

export const RoutesTab = () => {
  const { can } = useAuth()
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [drilled, setDrilled] = useState<TravelRoute | null>(null)
  const [defaultAgeRange, setDefaultAgeRange] = useState<{ minAge: number; maxAge: number } | null>(null)
  const [broadcastIds, setBroadcastIds] = useState<string[] | null>(null)
  const [summary, setSummary] = useState<TravelSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>([])

  useEffect(() => {
    travelCategoryService.getOptions().then(setCategoryOptions).catch(() => setCategoryOptions([]))
  }, [])

  const extraParams = useMemo(() => {
    const p: Record<string, string> = {}
    if (categoryFilter) p.categoryId = categoryFilter
    if (statusFilter) p.isActive = statusFilter
    return p
  }, [categoryFilter, statusFilter])
  const filterCount = (categoryFilter ? 1 : 0) + (statusFilter ? 1 : 0)

  useEffect(() => {
    travelService.getSettings()
      .then((s) => setDefaultAgeRange({ minAge: s.general.minAge, maxAge: s.general.maxAge }))
      .catch(() => {})
  }, [])

  const loadSummary = useCallback((routeId?: string) => {
    setSummaryLoading(true)
    travelService.getSummary(routeId ? { routeId } : {})
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false))
  }, [])
  useEffect(() => { loadSummary(drilled?.id) }, [loadSummary, drilled?.id, refreshSignal])

  const defaultEmptyRouteForm = useMemo(
    () => defaultAgeRange
      ? { ...emptyRouteForm(), minAge: defaultAgeRange.minAge, maxAge: defaultAgeRange.maxAge }
      : emptyRouteForm(),
    [defaultAgeRange],
  )

  const loadOne = useCallback(async (id: string) => {
    try {
      const r = await travelRouteService.getById(id)
      setDrilled(r)
    } catch {
    }
  }, [])

  if (drilled) {
    return (
      <div className="space-y-4">
        <div className="rounded-card border border-border bg-[hsl(var(--primary)/0.035)] px-5 py-4">
          <nav aria-label="Sayfa yolu" className="mb-3 flex items-center gap-1.5 type-breadcrumb">
            <button type="button" className="inline-flex items-center gap-1.5 rounded-field px-1.5 py-1 font-medium text-foreground-muted transition-colors hover:bg-primary/10 hover:text-primary" onClick={() => setDrilled(null)}>
              <ArrowLeftIcon className="h-3.5 w-3.5" /> Geziler
            </button>
            <ChevronRightIcon className="h-3.5 w-3.5 text-foreground-subtle" />
            <span className="truncate font-semibold text-foreground-strong">{drilled.name}</span>
          </nav>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[16px] font-bold text-foreground-strong">{drilled.name}</h2>
              <Badge tone={drilled.isActive ? 'success' : 'neutral'}>{drilled.isActive ? 'Aktif' : 'Pasif'}</Badge>
              <Badge color={drilled.categoryColor}>{drilled.categoryName}</Badge>
            </div>
            <p className="mt-0.5 type-muted">{drilled.destination || 'Hedef belirtilmemiş'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Tüm Kayıtlar" value={summary?.totalRegistered ?? 0} icon={Users2Icon} accent="violet" loading={summaryLoading} />
          <StatCard label="Bugüne Kadar Düzenlenen Seferler" value={summary?.heldToDate ?? 0} icon={CheckCircle2Icon} accent="green" loading={summaryLoading} />
          <StatCard label="Yaklaşan Seferler" value={summary?.upcoming ?? 0} icon={MapPinIcon} accent="blue" loading={summaryLoading} />
          <StatCard label="Toplam Kontenjan" value={summary?.totalCapacity ?? 0} icon={BusIcon} accent="orange" loading={summaryLoading} />
          <StatCard label="Doluluk Oranı" value={summary && summary.totalCapacity > 0 ? `%${Math.round((summary.totalRegistered / summary.totalCapacity) * 100)}` : '%0'} icon={ArmchairIcon} accent="primary" loading={summaryLoading} />
          <StatCard
            label="Memnuniyet Oranı"
            value={summary && summary.totalReviews > 0 ? `${summary.averageRating.toFixed(1)} / 5` : '—'}
            icon={StarIcon}
            accent="orange"
            loading={summaryLoading}
            hint={summary && summary.totalReviews > 0 ? `${summary.totalReviews} değerlendirme` : 'Henüz değerlendirme yok'}
          />
        </div>

        <TravelsTab embedded scope={{ routeId: drilled.id, routeName: drilled.name }} />
      </div>
    )
  }

  return (
    <>
    <CrudListTemplate<TravelRoute, TravelRouteFormData>
      icon={MapPinIcon}
      title="Geziler"
      subtitle="Lokasyon bazlı gezi kayıtları — her gezi altında birden çok sefer (tarih) açılabilir"
      resourceName="Gezi"
      listTitle="Gezi Listesi"
      searchPlaceholder="Gezi adı, hedef veya başvuran adı/TC ara..."
      service={{
        getList: (p) => travelRouteService.getList(p),
        remove: can('travels.delete') ? (id) => travelRouteService.delete(id) : undefined,
        toggleStatus: can('travels.edit') ? (id) => travelRouteService.toggleStatus(id) : undefined,
      }}
      rowKey={(r) => r.id}
      selectable
      bulkActions={(rows) => (
        <Button variant="outline" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setBroadcastIds(rows.map((r) => r.id))}>
          SMS / Bildirim Gönder
        </Button>
      )}
      isActive={(r) => r.isActive}
      drawerWidth={780}
      defaultSort={{ key: 'name', dir: 'asc' }}
      refreshSignal={refreshSignal}
      extraParams={extraParams}
      filterColumns={3}
      hasActiveFilters={filterCount > 0}
      filterCount={filterCount}
      onClearFilters={() => { setCategoryFilter(''); setStatusFilter('') }}
      renderFilters={() => (
        <>
          <FilterField label="Kategori">
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Tüm Kategoriler</option>
              {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Durum">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tüm Durumlar</option>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </Select>
          </FilterField>
        </>
      )}
      hideSelectedStat
      stats={({ total }) => [
        { label: 'Toplam Gezi', value: summary?.totalRoutes ?? total, icon: MapPinIcon, accent: 'blue' },
        { label: 'Toplam Sefer', value: summary?.total ?? 0, icon: BusIcon, accent: 'violet' },
        { label: 'Aktif Sefer', value: summary?.active ?? 0, icon: CheckCircle2Icon, accent: 'green' },
        { label: 'Pasif Sefer', value: summary?.passive ?? 0, icon: PowerOffIcon, accent: 'orange' },
        { label: 'Toplam Kayıt', value: summary?.totalRegistered ?? 0, icon: Users2Icon, accent: 'primary' },
        {
          label: 'Doluluk Oranı',
          value: summary && summary.totalCapacity > 0 ? `%${Math.round((summary.totalRegistered / summary.totalCapacity) * 100)}` : '%0',
          icon: ArmchairIcon,
          accent: 'blue',
        },
      ]}
      columns={[
        { key: 'name', header: 'Gezi', sortable: true, sortKey: 'name', cell: (r) => (
          <button type="button" className="type-body-strong text-left hover:underline" onClick={() => loadOne(r.id)}>
            {r.name}
          </button>
        ) },
        { key: 'category', header: 'Kategori', cell: (r) => <Badge color={r.categoryColor}>{r.categoryName}</Badge> },
        { key: 'destination', header: 'Hedef', cell: (r) => <span className="type-muted">{r.destination || '—'}</span> },
        { key: 'age', header: 'Yaş', align: 'center', cell: (r) => <span className="whitespace-nowrap type-muted">{r.minAge}–{r.maxAge}</span> },
        { key: 'travelCount', header: 'Sefer Sayısı', align: 'center', cell: (r) => <span className="tabular-nums font-medium">{r.travelCount}</span> },
        { key: 'activeTravelCount', header: 'Aktif Sefer', align: 'center', cell: (r) => <span className="tabular-nums font-medium text-[hsl(var(--success))]">{r.activeTravelCount}</span> },
        { key: 'isActive', header: 'Durum', align: 'center', cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge> },
      ]}
      emptyForm={defaultEmptyRouteForm}
      toForm={routeToForm}
      getFormErrors={(f) => [
        !f.name.trim() && 'Gezi adı zorunludur.',
        !f.categoryId && 'Kategori seçimi zorunludur.',
        !f.destination.trim() && 'Hedef zorunludur.',
      ].filter(Boolean) as string[]}
      formShell
      renderForm={({ form, setForm, mode }) => (
        <AdminFormShell
          icon={MapPinIcon}
          title={mode === 'edit' ? 'Gezi Bilgilerini Düzenle' : 'Yeni Gezi Ekle'}
          subtitle="Lokasyon, açıklama, görsel ve katılım koşulları"
          badge="Gezi Sistemi"
          tone="green"
        >
          <RouteForm form={form} setForm={setForm} />
        </AdminFormShell>
      )}
      deleteConfirm={{
        title: 'Geziyi Sil',
        description: 'Bu gezi silinecek. Bağlı seferi olan geziler silinemez.',
      }}
      creatable={can('travels.create')}
      canEdit={() => can('travels.edit')}
      canDelete={(r) => can('travels.delete') && r.travelCount === 0}
      onCreate={can('travels.create') ? (f) => travelRouteService.create(f).then(() => { setRefreshSignal((s) => s + 1); toast.success('Gezi eklendi. Şimdi altına sefer ekleyebilirsiniz.') }) : undefined}
      onUpdate={can('travels.edit') ? (id, f) => travelRouteService.update(id, f).then(() => undefined) : undefined}
      extraRowActions={(row) => (
        <IconButton tone="default" title="Seferleri gör" onClick={() => loadOne(row.id)}>
          <EyeIcon className="h-4 w-4" />
        </IconButton>
      )}
    />
    <TravelSendMessageModal open={!!broadcastIds} target="travelRoute" ids={broadcastIds ?? []} onClose={() => setBroadcastIds(null)} />
    </>
  )
}
