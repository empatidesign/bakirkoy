import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  TrophyIcon, CoinsIcon, HistoryIcon, GiftIcon,
  CheckCircle2Icon, XCircleIcon, SearchIcon, ArrowUpIcon, ArrowDownIcon,
  PackageIcon, UserIcon, PhoneIcon, PlusCircleIcon,
} from 'lucide-react'
import {
  PageHeader, Tabs, Badge, Button, Input, Select, StatCard, FilterBar, FilterField,
  DataTable, EmptyState, ConfirmModal, Drawer, Field, Textarea, ToggleRow,
  DatePicker, AdminFormShell, type DataTableColumn, type SortState,
} from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import { useAuth } from '@/framework/auth/AuthContext'
import { RewardImageUploader } from '@/components/specialized/RewardImageUploader'
import { AwardPointsDrawer } from './AwardPointsDrawer'
import loyaltyService from '@/services/loyalty.service'
import type { LoyaltyRule, LoyaltyTransaction, LoyaltyRuleForm, Reward, RewardForm, RewardRedemption } from '@/types/loyalty.types'
import { ACTION_KEY_LABELS } from '@/types/loyalty.types'
import { formatDate } from '@/lib/utils'

const EMPTY_RULE_FORM: LoyaltyRuleForm = { actionKey: '', label: '', points: 10, isActive: true, description: '' }
const EMPTY_REWARD_FORM: RewardForm = { name: '', pointsRequired: 100, stock: 10, description: '', imageUrl: '', isActive: true }

const TABS = [
  { key: 'rules', label: 'Puan Kuralları' },
  { key: 'transactions', label: 'İşlem Geçmişi' },
  { key: 'rewards', label: 'Hediye Kataloğu' },
  { key: 'redemptions', label: 'Hediye Talepleri' },
]

export const LoyaltyPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') ?? ''
  const activeTab = TABS.some((t) => t.key === rawTab) ? rawTab : 'rules'
  const [pendingCount, setPendingCount] = useState<number>(0)

  useEffect(() => {
    loyaltyService.getPendingRedemptionCount()
      .then((n) => setPendingCount(n))
      .catch(() => void 0)
  }, [])

  const setTab = (key: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('tab', key)
      return n
    })

  const tabsWithCount = TABS.map((t) =>
    t.key === 'redemptions' && activeTab !== 'redemptions'
      ? { ...t, count: pendingCount }
      : t
  )

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={TrophyIcon}
          title="Sadakat Sistemi"
          subtitle="Puan kuralları, işlem geçmişi ve hediye kataloğunu yönetin"
          breadcrumb="Sadakat / Sadakat Sistemi"
        />

        <Tabs tabs={tabsWithCount} value={activeTab} onValueChange={setTab} />

        <div className="pilot-content flex-1 overflow-auto">
          {activeTab === 'rules' && <RulesTab />}
          {activeTab === 'transactions' && <TransactionsTab />}
          {activeTab === 'rewards' && <RewardsTab />}
          {activeTab === 'redemptions' && <RedemptionsTab onCountChange={setPendingCount} />}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}

// Denetimde bulundu (2026-09-20): loyalty.view yetkisi olan bir kullanıcı loyalty.edit/
// create/delete yetkisi olmasa da kural/hediye ekleme, düzenleme, silme ve aktif-pasif
// butonlarını görüyordu (tek CRUD sayfası diğer tüm modüllerin aksine can() kullanmıyordu)
// — backend 403 döndürüyor ama UI yanlış imkan vaadi ediyordu.
const RulesTab = () => {
  const { can } = useAuth()
  const [status, setStatus] = useState('')

  return (
    <CrudListTemplate<LoyaltyRule, LoyaltyRuleForm>
      icon={CoinsIcon}
      title="Puan Kuralları"
      subtitle="Hangi eylemlerin kaç puan kazandıracağını belirleyin"
      resourceName="Kural"
      creatable={can('loyalty.create')}
      service={{
        getList: (p) => loyaltyService.getRules(p),
        remove: can('loyalty.delete') ? (id) => loyaltyService.deleteRule(id) : undefined,
      }}
      rowKey={(r) => r.id}
      searchPlaceholder="Kural adı veya anahtar ara..."
      columns={[
        {
          key: 'actionKey',
          header: 'Eylem Anahtarı',
          cell: (r) => (
            <span className="rounded-field bg-surface-1 px-2 py-0.5 font-mono text-[11px] text-foreground-muted">
              {r.actionKey}
            </span>
          ),
        },
        {
          key: 'label',
          header: 'Etiket',
          sortable: true,
          sortKey: 'label',
          cell: (r) => <span className="type-body-strong">{r.label}</span>,
        },
        {
          key: 'points',
          header: 'Puan',
          align: 'right',
          cell: (r) => (
            <Badge tone="primary">{r.points} puan</Badge>
          ),
        },
        {
          key: 'isActive',
          header: 'Durum',
          cell: (r) => (
            <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge>
          ),
        },
        {
          key: 'description',
          header: 'Açıklama',
          cell: (r) => <span className="type-caption text-foreground-muted">{r.description ?? '—'}</span>,
        },
      ]}
      extraParams={{ isActive: status }}
      hasActiveFilters={!!status}
      filterCount={status ? 1 : 0}
      onClearFilters={() => setStatus('')}
      filterColumns={3}
      renderFilters={() => (
        <FilterField label="Durum">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tümü</option>
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </Select>
        </FilterField>
      )}
      stats={({ rows, total }) => [
        { label: 'Toplam Kural', value: total, icon: CoinsIcon, accent: 'blue' },
        { label: 'Aktif', value: rows.filter((r) => r.isActive).length, icon: CheckCircle2Icon, accent: 'green' },
        { label: 'Pasif', value: rows.filter((r) => !r.isActive).length, icon: XCircleIcon, accent: 'orange' },
      ]}
      selectable
      emptyForm={EMPTY_RULE_FORM}
      toForm={(r) => ({
        actionKey: r.actionKey,
        label: r.label,
        points: r.points,
        isActive: r.isActive,
        description: r.description ?? '',
      })}
      isFormValid={(f) => !!f.label.trim() && f.points >= 0}
      onCreate={can('loyalty.create') ? async (f) => {
        await loyaltyService.createRule(f)
        toast.success('Kural oluşturuldu.')
      } : undefined}
      onUpdate={can('loyalty.edit') ? async (id, f) => {
        await loyaltyService.updateRule(id, f)
        toast.success('Kural güncellendi.')
      } : undefined}
      canEdit={() => can('loyalty.edit')}
      canDelete={() => can('loyalty.delete')}
      isActive={(r) => r.isActive}
      deleteConfirm={{ title: 'Kuralı Sil', description: 'Bu puan kuralını kalıcı olarak silmek istediğinizden emin misiniz?' }}
      renderForm={({ form, setForm, mode }) => (
        <div className="flex flex-col gap-4 p-1">
          {mode === 'create' && (
            <Field label="Eylem Anahtarı" required hint="örn: daily_login, quiz_complete">
              <Input
                value={form.actionKey}
                onChange={(e) => setForm((p) => ({ ...p, actionKey: e.target.value }))}
                placeholder="örn: event_join"
              />
            </Field>
          )}
          <Field label="Etiket" required>
            <Input
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              placeholder="Kural adı"
            />
          </Field>
          <Field label="Puan" required>
            <Input
              type="number"
              value={form.points.toString()}
              onChange={(e) => setForm((p) => ({ ...p, points: Number(e.target.value) }))}
              min={0}
            />
          </Field>
          <Field label="Açıklama">
            <Textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              placeholder="Bu kural hakkında kısa açıklama"
            />
          </Field>
          {mode === 'edit' && (
            <ToggleRow
              label="Kural Aktif"
              description="Kapatıldığında bu eylem için puan verilmez"
              checked={form.isActive}
              onChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
            />
          )}
        </div>
      )}
    />
  )
}

const TransactionsTab = () => {
  const navigate = useNavigate()
  const [rows, setRows] = useState<LoyaltyTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [actionKey, setActionKey] = useState('')
  const [type, setType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [awardDrawerOpen, setAwardDrawerOpen] = useState(false)
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<SortState | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await loyaltyService.getTransactions({
        page,
        limit,
        search: debouncedSearch || undefined,
        actionKey: actionKey || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        sort: sort?.key,
        order: sort?.dir,
      })
      setRows(res.items)
      setTotal(res.total)
      setTotalPages(res.totalPages ?? Math.ceil(res.total / limit))
    } catch {
      setRows([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [page, limit, debouncedSearch, actionKey, dateFrom, dateTo, sort])

  useEffect(() => { void fetchData() }, [fetchData])

  const hasActiveFilters = !!actionKey || !!type || !!dateFrom || !!dateTo
  const clearFilters = () => { setActionKey(''); setType(''); setDateFrom(''); setDateTo(''); setPage(1) }

  const filteredRows = type
    ? rows.filter((r) => (type === 'Earn' ? (r.points ?? 0) >= 0 : (r.points ?? 0) < 0))
    : rows

  const offset = (page - 1) * limit

  const earnCount = rows.filter((r) => (r.points ?? 0) >= 0).length
  const spentCount = rows.filter((r) => (r.points ?? 0) < 0).length
  const totalEarned = rows.filter((r) => (r.points ?? 0) > 0).reduce((s, r) => s + r.points, 0)

  const columns: DataTableColumn<LoyaltyTransaction>[] = [
    {
      key: 'no',
      header: '#',
      width: 'w-[48px]',
      cell: (_, i) => (
        <span className="tabular-nums text-[11px] font-semibold text-foreground-subtle">{offset + i + 1}</span>
      ),
    },
    {
      key: 'participant',
      header: 'Vatandaş',
      width: 'w-[200px]',
      cell: (t) => (
        <button
          type="button"
          onClick={() => navigate(`/participants?highlight=${t.participantId}`)}
          className="flex flex-col gap-0.5 text-left group"
        >
          <span className="inline-flex items-center gap-1.5 type-body-strong text-primary group-hover:underline">
            <UserIcon className="h-3.5 w-3.5 shrink-0" />
            {t.participantName ?? '—'}
          </span>
          {t.participantPhone && (
            <span className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
              <PhoneIcon className="h-3 w-3 shrink-0" />
              {t.participantPhone}
            </span>
          )}
        </button>
      ),
    },
    {
      key: 'label',
      header: 'İşlem',
      cell: (t) => (
        <div>
          <p className="type-body-strong">{t.label}</p>
          <p className="type-caption text-foreground-muted">{ACTION_KEY_LABELS[t.actionKey] ?? t.actionKey}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Tür',
      width: 'w-[90px]',
      cell: (t) => {
        const isEarn = (t.points ?? 0) >= 0
        return (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isEarn ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {isEarn ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />}
            {isEarn ? 'Kazanım' : 'Harcama'}
          </span>
        )
      },
    },
    {
      key: 'points',
      header: 'Puan',
      align: 'right',
      width: 'w-[80px]',
      sortable: true,
      sortKey: 'points',
      cell: (t) => {
        const isEarn = (t.points ?? 0) >= 0
        return (
          <span className={`type-body-strong ${isEarn ? 'text-green-600' : 'text-red-500'}`}>
            {isEarn ? '+' : ''}{(t.points ?? 0).toLocaleString('tr-TR')}
          </span>
        )
      },
    },
    {
      key: 'balanceAfter',
      header: 'Kalan Bakiye',
      align: 'right',
      width: 'w-[100px]',
      cell: (t) => (
        <span className="inline-flex items-center gap-1 tabular-nums text-[12px] font-semibold text-foreground-strong">
          <CoinsIcon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          {(t.balanceAfter ?? 0).toLocaleString('tr-TR')} p
        </span>
      ),
    },
    {
      key: 'earnedAt',
      header: 'Tarih & Saat',
      sortable: true,
      sortKey: 'earnedAt',
      width: 'w-[130px]',
      cell: (t) => (
        <span className="flex flex-col gap-0.5">
          <span className="type-caption text-foreground-default">{formatDate(t.earnedAt)}</span>
          <span className="text-[11px] text-foreground-muted tabular-nums">
            {new Date(t.earnedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>
      ),
    },
  ]

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-4 gap-3">
          <StatCard label="Toplam İşlem" value={total} icon={HistoryIcon} accent="blue" loading={loading} />
          <StatCard label="Kazanım" value={earnCount} icon={ArrowUpIcon} accent="green" loading={loading} />
          <StatCard label="Harcama" value={spentCount} icon={ArrowDownIcon} accent="orange" loading={loading} />
          <StatCard label="Toplam Kazanılan" value={`${totalEarned.toLocaleString('tr-TR')} p`} icon={CoinsIcon} accent="violet" loading={loading} />
        </div>
        <Button variant="primary" iconLeft={<PlusCircleIcon className="h-4 w-4" />} onClick={() => setAwardDrawerOpen(true)}>
          Manuel Puan Ver
        </Button>
      </div>

      <FilterBar
        columns={4}
        search={
          <Input
            placeholder="Vatandaş adı veya işlem ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
          />
        }
        filterCount={(actionKey ? 1 : 0) + (type ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)}
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      >
        <FilterField label="Eylem Türü">
          <Select value={actionKey} onChange={(e) => { setActionKey(e.target.value); setPage(1) }}>
            <option value="">Tümü</option>
            {Object.entries(ACTION_KEY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="İşlem Türü">
          <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1) }}>
            <option value="">Tümü</option>
            <option value="Earn">Kazanım</option>
            <option value="Spent">Harcama</option>
          </Select>
        </FilterField>
        <FilterField label="Başlangıç Tarihi">
          <DatePicker value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1) }} clearable />
        </FilterField>
        <FilterField label="Bitiş Tarihi">
          <DatePicker value={dateTo} onChange={(v) => { setDateTo(v); setPage(1) }} clearable />
        </FilterField>
      </FilterBar>

      <div className="mt-[15px] mx-[10px] rounded-[10px] overflow-hidden border border-border shadow-sm">
        <DataTable<LoyaltyTransaction>
          title="İşlem Geçmişi"
          columns={columns}
          rows={filteredRows}
          rowKey={(t) => t.id}
          loading={loading}
          sort={sort}
          onSortChange={setSort}
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={(l) => { setLimit(l); setPage(1) }}
          empty={
            <EmptyState
              icon={HistoryIcon}
              title="İşlem bulunamadı"
              description="Vatandaşlar puan kazandıkça veya harcadıkça burada görünür."
            />
          }
        />
      </div>

      <AwardPointsDrawer
        open={awardDrawerOpen}
        onClose={() => setAwardDrawerOpen(false)}
        onAwarded={() => void fetchData()}
      />
    </>
  )
}

const RewardsTab = () => {
  const { can } = useAuth()
  const [status, setStatus] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Reward | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await loyaltyService.deleteReward(deleteTarget.id)
      toast.success('Hediye silindi.')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <CrudListTemplate<Reward, RewardForm>
        icon={GiftIcon}
        title="Hediye Kataloğu"
        subtitle="Vatandaşların puanlarıyla talep edebileceği hediyeleri yönetin"
        resourceName="Hediye"
        creatable={can('loyalty.create')}
        service={{
          getList: (p) => loyaltyService.getRewards(p),
          toggleStatus: can('loyalty.edit') ? (id) => loyaltyService.toggleRewardStatus(id) : undefined,
          remove: can('loyalty.delete') ? (id) => loyaltyService.deleteReward(id) : undefined,
        }}
        rowKey={(r) => r.id}
        searchPlaceholder="Hediye adı ara..."
        columns={[
          {
            key: 'image',
            header: '',
            width: 'w-[56px]',
            cell: (r) => r.imageUrl ? (
              <img
                src={r.imageUrl}
                alt={r.name}
                className="h-10 w-10 rounded-lg object-cover border border-border"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef3f8] border border-[#0f4c81]/15">
                <GiftIcon className="h-5 w-5 text-[#0f4c81]" />
              </span>
            ),
          },
          {
            key: 'name',
            header: 'Hediye Adı',
            sortable: true,
            sortKey: 'name',
            cell: (r) => (
              <div>
                <p className="type-body-strong">{r.name}</p>
                {r.description && (
                  <p className="type-caption text-foreground-muted truncate max-w-[240px]">{r.description}</p>
                )}
              </div>
            ),
          },
          {
            key: 'pointsRequired',
            header: 'Gerekli Puan',
            align: 'right',
            width: 'w-[110px]',
            cell: (r) => <Badge tone="primary">{r.pointsRequired} p</Badge>,
          },
          {
            key: 'stock',
            header: 'Stok',
            align: 'right',
            width: 'w-[80px]',
            cell: (r) => (
              <span className={`tabular-nums text-[13px] font-semibold ${r.stock <= 5 ? 'text-danger' : 'text-foreground-strong'}`}>
                {r.stock}
              </span>
            ),
          },
          {
            key: 'isActive',
            header: 'Durum',
            width: 'w-[90px]',
            cell: (r) => (
              <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge>
            ),
          },
        ]}
        extraParams={{ isActive: status }}
        hasActiveFilters={!!status}
        filterCount={status ? 1 : 0}
        onClearFilters={() => setStatus('')}
        filterColumns={3}
        renderFilters={() => (
          <FilterField label="Durum">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tümü</option>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </Select>
          </FilterField>
        )}
        stats={({ rows, total }) => [
          { label: 'Toplam Hediye', value: total, icon: GiftIcon, accent: 'violet' },
          { label: 'Aktif', value: rows.filter((r) => r.isActive).length, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'Pasif', value: rows.filter((r) => !r.isActive).length, icon: XCircleIcon, accent: 'orange' },
          { label: 'Stok Kritik', value: rows.filter((r) => r.stock <= 5 && r.isActive).length, icon: PackageIcon, accent: 'primary' },
        ]}
        selectable
        formShell
        emptyForm={EMPTY_REWARD_FORM}
        toForm={(r) => ({
          name: r.name,
          pointsRequired: r.pointsRequired,
          stock: r.stock,
          description: r.description ?? '',
          imageUrl: r.imageUrl ?? '',
          isActive: r.isActive,
        })}
        isFormValid={(f) => !!f.name.trim() && f.pointsRequired > 0 && f.stock >= 0}
        onCreate={can('loyalty.create') ? async (f) => {
          await loyaltyService.createReward(f)
          toast.success('Hediye oluşturuldu.')
        } : undefined}
        onUpdate={can('loyalty.edit') ? async (id, f) => {
          await loyaltyService.updateReward(id, f)
          toast.success('Hediye güncellendi.')
        } : undefined}
        canEdit={() => can('loyalty.edit')}
        canDelete={() => can('loyalty.delete')}
        isActive={(r) => r.isActive}
        deleteConfirm={{ title: 'Hediyeyi Sil', description: 'Bu hediyeyi kalıcı olarak silmek istediğinizden emin misiniz?' }}
        renderForm={({ form, setForm, mode }) => (
          <AdminFormShell
            icon={GiftIcon}
            title={mode === 'create' ? 'Yeni Hediye Ekle' : 'Hediyeyi Düzenle'}
            subtitle={mode === 'create' ? 'Yeni bir hediye oluşturun' : 'Hediye bilgilerini güncelleyin'}
            tone="violet"
          >
            <Field label="Görsel">
              <RewardImageUploader
                value={form.imageUrl}
                onChange={(url) => setForm((p) => ({ ...p, imageUrl: url }))}
                onUpload={(file) => loyaltyService.uploadRewardImage(file)}
              />
            </Field>
            <Field label="Hediye Adı" required>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Hediye adı"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gerekli Puan" required>
                <Input
                  type="number"
                  value={form.pointsRequired.toString()}
                  onChange={(e) => setForm((p) => ({ ...p, pointsRequired: Number(e.target.value) }))}
                  min={1}
                />
              </Field>
              <Field label="Stok" required>
                <Input
                  type="number"
                  value={form.stock.toString()}
                  onChange={(e) => setForm((p) => ({ ...p, stock: Number(e.target.value) }))}
                  min={0}
                />
              </Field>
            </div>
            <Field label="Açıklama">
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="Hediye hakkında kısa açıklama"
              />
            </Field>
            {mode === 'edit' && (
              <ToggleRow
                label="Hediye Aktif"
                description="Kapatıldığında vatandaşlar bu hediyeyi talep edemez"
                checked={form.isActive}
                onChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
              />
            )}
          </AdminFormShell>
        )}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        loading={deleting}
        title="Hediyeyi Sil"
        description={`"${deleteTarget?.name}" hediyesini kalıcı olarak silmek istediğinizden emin misiniz?`}
        tone="danger"
        confirmLabel="Sil"
      />
    </>
  )
}

const RedemptionsTab = ({ onCountChange }: { onCountChange: (n: number) => void }) => {
  const [rows, setRows] = useState<RewardRedemption[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [cancelTarget, setCancelTarget] = useState<RewardRedemption | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [sort, setSort] = useState<SortState | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await loyaltyService.getRedemptions({
        page,
        limit,
        search: debouncedSearch || undefined,
        status: status || undefined,
        sort: sort?.key,
        order: sort?.dir,
      })
      setRows(res.items)
      setTotal(res.total)
      setTotalPages(res.totalPages ?? Math.ceil(res.total / limit))
      onCountChange(res.items.filter((r: RewardRedemption) => r.status === 'Pending').length)
    } catch {
      setRows([]); setTotal(0); setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [page, limit, debouncedSearch, status, sort, onCountChange])

  useEffect(() => { void fetchData() }, [fetchData])

  const handleCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await loyaltyService.cancelRedemption(cancelTarget.id, cancelReason || undefined)
      toast.success('Talep iptal edildi, puan iade edildi.')
      setCancelTarget(null)
      setCancelReason('')
      void fetchData()
    } finally {
      setCancelling(false)
    }
  }

  const STATUS_BADGE: Record<string, { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
    Pending:   { tone: 'warning', label: 'Bekliyor' },
    Completed: { tone: 'success', label: 'Tamamlandı' },
    Cancelled: { tone: 'danger',  label: 'İptal' },
  }

  const columns: DataTableColumn<RewardRedemption>[] = [
    {
      key: 'rewardName',
      header: 'Hediye',
      sortable: true,
      sortKey: 'rewardName',
      cell: (r) => (
        <span className="inline-flex items-center gap-2.5">
          {r.rewardImageUrl ? (
            <img
              src={r.rewardImageUrl}
              alt={r.rewardName}
              className="h-10 w-10 rounded-lg object-cover border border-border shrink-0"
            />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef3f8] border border-[#0f4c81]/15">
              <GiftIcon className="h-5 w-5 text-[#0f4c81]" />
            </span>
          )}
          <span className="type-body-strong">{r.rewardName}</span>
        </span>
      ),
    },
    {
      key: 'participantName',
      header: 'Vatandaş',
      cell: (r) => <span className="type-body">{r.participantName}</span>,
    },
    {
      key: 'pointsSpent',
      header: 'Puan',
      align: 'right',
      sortable: true,
      sortKey: 'pointsSpent',
      cell: (r) => <Badge tone="primary">{r.pointsSpent} p</Badge>,
    },
    {
      key: 'status',
      header: 'Durum',
      cell: (r) => {
        const s = STATUS_BADGE[r.status] ?? { tone: 'neutral' as const, label: r.status }
        return <Badge tone={s.tone}>{s.label}</Badge>
      },
    },
    {
      key: 'redeemedAt',
      header: 'Talep Tarihi',
      sortable: true,
      sortKey: 'redeemedAt',
      cell: (r) => (
        <span className="flex flex-col gap-0.5">
          <span className="type-caption text-foreground-default">{formatDate(r.redeemedAt)}</span>
          <span className="text-[11px] text-foreground-muted tabular-nums">
            {new Date(r.redeemedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>
      ),
    },
  ]

  const pendingCount = rows.filter((r) => r.status === 'Pending').length
  const cancelledCount = rows.filter((r) => r.status === 'Cancelled').length
  const totalPoints = rows.filter((r) => r.status !== 'Cancelled').reduce((s, r) => s + r.pointsSpent, 0)

  return (
    <>
      <div className="mb-4 grid grid-cols-4 gap-3">
        <StatCard label="Toplam Talep" value={total} icon={GiftIcon} accent="violet" loading={loading} />
        <StatCard label="Bekleyen" value={pendingCount} icon={PackageIcon} accent="orange" loading={loading} />
        <StatCard label="İptal" value={cancelledCount} icon={XCircleIcon} accent="blue" loading={loading} />
        <StatCard label="Harcanan Puan" value={totalPoints} icon={CoinsIcon} accent="primary" loading={loading} />
      </div>

      <FilterBar
        columns={3}
        search={
          <Input
            placeholder="Vatandaş adı veya hediye ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
          />
        }
        filterCount={status ? 1 : 0}
        hasActiveFilters={!!status}
        onClear={() => { setStatus(''); setPage(1) }}
      >
        <FilterField label="Durum">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
            <option value="">Tümü</option>
            <option value="Pending">Bekleyen</option>
            <option value="Completed">Tamamlandı</option>
            <option value="Cancelled">İptal</option>
          </Select>
        </FilterField>
      </FilterBar>

      <DataTable<RewardRedemption>
        title="Hediye Talepleri"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        sort={sort}
        onSortChange={setSort}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        limit={limit}
        onLimitChange={(l) => { setLimit(l); setPage(1) }}
        rowActions={(r) =>
          r.status === 'Pending' ? (
            <button
              type="button"
              onClick={() => { setCancelTarget(r); setCancelReason('') }}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <XCircleIcon className="h-3.5 w-3.5" />
              İptal Et
            </button>
          ) : null
        }
        empty={
          <EmptyState
            icon={GiftIcon}
            title="Talep bulunamadı"
            description="Vatandaşlar hediye talep ettiğinde burada görünür."
          />
        }
      />

      <Drawer
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Talebi İptal Et"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setCancelTarget(null)}>Vazgeç</Button>
            <Button variant="danger" className="flex-1" isLoading={cancelling} onClick={() => void handleCancel()}>
              İptal Et &amp; Puanı İade Et
            </Button>
          </div>
        }
      >
        <div className="space-y-4 p-1">
          <p className="type-body text-foreground-muted">
            <span className="font-semibold text-foreground-strong">{cancelTarget?.rewardName}</span> talebini iptal edeceksiniz.
            Vatandaşın <span className="font-semibold text-primary">{cancelTarget?.pointsSpent} puanı</span> iade edilecek.
          </p>
          <Field label="İptal Nedeni (opsiyonel)">
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="İptal sebebi yazın..."
            />
          </Field>
        </div>
      </Drawer>
    </>
  )
}
