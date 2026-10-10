import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { UsersIcon, CheckCircle2Icon, AlertCircleIcon, XCircleIcon, PlusIcon, CalendarClockIcon, FolderIcon, ChevronRightIcon, ArrowLeftIcon, ClockIcon, ToggleLeftIcon, ToggleRightIcon, MessageSquareIcon, UserIcon, CopyIcon, UserPlusIcon } from 'lucide-react'
import { Badge, FilterField, Select, IconButton, Button, Drawer, DrilldownCount, ToggleRow, DatePicker } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import { FacilitySendMessageModal } from '../FacilitySendMessageModal'
import { FacilityGroupCopyModal } from '../FacilityGroupCopyModal'
import type { FacilityModuleConfig } from '../moduleConfig'
import type { FacilityModuleService } from '../types'
import type { GroupRecord, GroupForm, BranchRecord, InstructorOption, RequiredDocument, DaySchedule, FacilityRecord } from '@/types/facility.types'
import { GroupFormFields } from '../GroupFormFields'
import { FacilityRosterModal } from '../FacilityRosterModal'
import { FacilityMemberTransferModal } from '../FacilityMemberTransferPanel'
import { FacilityGroupHierarchy } from '../FacilityGroupHierarchy'
import { FacilityApplicationsTab } from './FacilityApplicationsTab'
import { makeEmptyGroupForm, groupRecordToForm, getGroupFormErrors, isGroupPeriodValid, saveGroupUpdate } from '../groupForm.utils'


interface Props {
  config: FacilityModuleConfig
  service: FacilityModuleService
  facilityId: string
  facilityCapacity?: number
  parentGroupId?: string
  onNavigateToSubGroups?: (group: GroupRecord) => void
  onNavigateBack?: () => void
  onNavigateToSessions?: (group: GroupRecord) => void
  // Kullanıcı isteği (2026-10-01): üst başlıktaki genel aramadan bir grup sonucuna tıklandığında
  // doğrudan bu tesis + bu grup adıyla önceden filtrelenmiş olarak açılsın.
  initialSearch?: string
  // Kullanıcı isteği (2026-10-01): grup/seans kopyalama — tek bir hedef tesise kopyalandığında,
  // kopya başka bir tesiste oluşmuş olabilir (bu sekme yalnızca `facilityId` tesisini gösterir).
  // Böyle bir durumda üst bileşen (FacilityModule) o tesise geçip düzenleme çekmecesini açar.
  onCopiedToOtherFacility?: (targetFacilityId: string, groupId: string) => void
  // FacilityModule, kopyalama sonrası farklı bir tesise geçtiğinde bu prop ile hangi kaydın
  // düzenleme çekmecesinde açılacağını bildirir (bkz. yukarıdaki onCopiedToOtherFacility).
  initialEditRequestId?: string | null
  onInitialEditRequestHandled?: () => void
}

const GroupBulkActions = ({
  rows,
  service,
  onClear,
  onRefresh,
}: {
  rows: GroupRecord[]
  service: FacilityModuleService
  onClear: () => void
  onRefresh: () => void
}) => {
  const [busy, setBusy] = useState<'active' | 'passive' | null>(null)
  const bulkToggle = async (activate: boolean) => {
    setBusy(activate ? 'active' : 'passive')
    try {
      await Promise.all(rows.map((r) => service.groups.toggleStatus(r.id)))
      toast.success(`${rows.length} grup ${activate ? 'aktif' : 'pasif'} yapıldı.`)
      onClear(); onRefresh()
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" isLoading={busy === 'active'} disabled={!!busy} onClick={() => bulkToggle(true)}>
        <ToggleRightIcon className="h-4 w-4 text-[hsl(var(--success))]" /> Aktif Yap
      </Button>
      <Button variant="outline" size="sm" isLoading={busy === 'passive'} disabled={!!busy} onClick={() => bulkToggle(false)}>
        <ToggleLeftIcon className="h-4 w-4 text-foreground-subtle" /> Pasif Yap
      </Button>
    </div>
  )
}

const DAY_TR: Record<string, string> = {
  monday: 'Pzt', tuesday: 'Sal', wednesday: 'Çar', thursday: 'Per',
  friday: 'Cum', saturday: 'Cmt', sunday: 'Paz',
}

const DAY_BG: Record<string, string> = {
  monday:    'bg-[hsl(var(--accent-blue-soft))] text-[hsl(var(--accent-blue))]',
  tuesday:   'bg-[hsl(var(--accent-violet-soft))] text-[hsl(var(--accent-violet))]',
  wednesday: 'bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]',
  thursday:  'bg-[hsl(var(--accent-orange-soft))] text-[hsl(var(--accent-orange))]',
  friday:    'bg-[hsl(var(--accent-pink-soft))] text-[hsl(var(--accent-pink))]',
  saturday:  'bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]',
  sunday:    'bg-surface-2 text-foreground-muted',
}
const DAY_TIME: Record<string, string> = {
  monday:    'text-[hsl(var(--accent-blue))]',
  tuesday:   'text-[hsl(var(--accent-violet))]',
  wednesday: 'text-[hsl(var(--success))]',
  thursday:  'text-[hsl(var(--accent-orange))]',
  friday:    'text-[hsl(var(--accent-pink))]',
  saturday:  'text-[hsl(var(--warning))]',
  sunday:    'text-foreground-subtle',
}

// Kullanıcı isteği (2026-10-06): yazı tipi çok büyük/kalın görünüyordu — tablonun geri
// kalanıyla (ör. yaş/cinsiyet rozetleri text-[10px]/[9px]) aynı küçük ölçeğe çekildi,
// font-bold yerine font-medium kullanıldı.
const ScheduleBadges = ({ schedules, days }: { schedules: DaySchedule[]; days: string[] }) => {
  if (schedules && schedules.length > 0) {
    return (
      <div className="flex flex-col gap-1">
        {schedules.map((s, i) => (
          <span key={i} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium w-fit ${DAY_BG[s.day.toLowerCase()] ?? 'bg-surface-2 text-foreground-muted'}`}>
            <span className="font-semibold">{DAY_TR[s.day.toLowerCase()] ?? s.day}</span>
            <span className={`tabular-nums ${DAY_TIME[s.day.toLowerCase()] ?? 'text-foreground-subtle'}`}>{s.start}–{s.end}</span>
          </span>
        ))}
      </div>
    )
  }
  if (days.length === 0) return <span className="type-muted">—</span>
  return (
    <div className="flex flex-col gap-1">
      {days.map((d) => (
        <span key={d} className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold w-fit ${DAY_BG[d.toLowerCase()] ?? 'bg-surface-2 text-foreground-muted'}`}>
          {DAY_TR[d.toLowerCase()] ?? d}
        </span>
      ))}
    </div>
  )
}

// Kullanıcı isteği (2026-10-06): "grup isimlerindeki fitness pilates vs grup ismi ve
// yanında hangi spor olduğu yazsın" — eski/elle girilmiş grup adlarının çoğunda spor
// türü isme gömülü (ör. "... (FİTNES)"), bazılarında hiç yok. Adın sonundaki parantezli
// türü varsa ayrıştırıp ayrı bir rozet olarak göster, adın kendisinden kaldır; yoksa
// branş adını (ör. "Yüzme", "Wushu Kung-Fu") rozet olarak göster.
const KNOWN_SPORT_TYPES = ['FİTNES', 'FITNES', 'PİLATES', 'PILATES', 'YÜRÜYÜŞ', 'YURUYUS', 'ZUMBA', 'STEP', 'AEROBİK', 'AEROBIC', 'YOGA']

const splitGroupNameAndSport = (name: string, branchName: string): { cleanName: string; sportLabel: string | null } => {
  const match = name.match(/\(([^)]*)\)\s*$/)
  if (match) {
    const inner = match[1].trim()
    const upper = inner.toLocaleUpperCase('tr')
    const found = KNOWN_SPORT_TYPES.find((s) => upper.includes(s))
    if (found) {
      return { cleanName: name.slice(0, match.index).trim(), sportLabel: inner }
    }
  }
  // İsme gömülü tür yoksa, branş adı (ör. "Yüzme") zaten spor dalını taşıyor —
  // jenerik/placeholder branş adlarını ("Sultangazi Belediyesi Spor Salonları...")
  // tekrar göstermenin anlamı yok.
  const isGenericBranch = !branchName || branchName.length > 30
  return { cleanName: name, sportLabel: isGenericBranch ? null : branchName }
}

const occupancyTone = (registered: number, capacity: number): 'success' | 'warning' | 'danger' => {
  if (capacity > 0 && registered >= capacity) return 'danger'
  if (capacity > 0 && registered / capacity >= 0.8) return 'warning'
  return 'success'
}

export const FacilityGroupsTab = ({ config, service, facilityId, facilityCapacity, parentGroupId, onNavigateToSubGroups, onNavigateBack, onNavigateToSessions, initialSearch, onCopiedToOtherFacility, initialEditRequestId, onInitialEditRequestHandled }: Props) => {
  const T = config.terminology
  const [branches, setBranches] = useState<BranchRecord[]>([])
  const [type, setType] = useState('')
  const [branch, setBranch] = useState('')
  const [gender, setGender] = useState('')
  const [status, setStatus] = useState('')
  const [showPast, setShowPast] = useState(false)
  const currentYear = new Date().getFullYear()
  const defaultStart = `${currentYear}-01-01`
  const defaultEnd = `${currentYear}-12-31`
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [rosterGroup, setRosterGroup] = useState<GroupRecord | null>(null)
  const [templateMessageIds, setTemplateMessageIds] = useState<string[] | null>(null)
  // Kullanıcı isteği (2026-10-06): seçili gruplara TC ile tek/toplu üye veya yedek aktarımı.
  const [transferGroups, setTransferGroups] = useState<GroupRecord[] | null>(null)
  const [hierarchySelectedIds, setHierarchySelectedIds] = useState<Set<string>>(new Set())
  const toggleHierarchySelect = (id: string) => setHierarchySelectedIds((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const [instructors, setInstructors] = useState<InstructorOption[]>([])
  const [documentLibrary, setDocumentLibrary] = useState<RequiredDocument[]>([])
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  const [allGroups, setAllGroups] = useState<GroupRecord[]>([])
  const [parentGroupRecord, setParentGroupRecord] = useState<GroupRecord | null>(null)
  const [subGroupTarget, setSubGroupTarget] = useState<GroupRecord | null>(null)
  const [subGroupForm, setSubGroupForm] = useState<GroupForm | null>(null)
  const [subGroupSaving, setSubGroupSaving] = useState(false)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [editRequestId, setEditRequestId] = useState<string | null>(null)
  // Kullanıcı isteği (2026-10-01): grup/seans kopyalama — bir ana grup veya doğrudan
  // seans niteliğindeki kayıt, aynı gün/saat programıyla başka tesis(ler)e kopyalanabilir.
  const [copyTarget, setCopyTarget] = useState<GroupRecord | null>(null)
  const [allFacilities, setAllFacilities] = useState<FacilityRecord[]>([])

  const loadInstructors = useCallback(() => {
    service.instructors.getOptions().then(setInstructors).catch(() => setInstructors([]))
  }, [service])

  // Kullanıcı isteği (2026-10-01): kopyalama sonrası FacilityModule farklı bir tesise
  // geçtiğinde, yeni kopyanın düzenleme çekmecesini bu sekmede de otomatik açabilsin diye
  // dışarıdan gelen initialEditRequestId içerideki editRequestId state'ine aktarılır.
  useEffect(() => {
    if (initialEditRequestId) {
      setEditRequestId(initialEditRequestId)
      onInitialEditRequestHandled?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditRequestId])

  const handleGenerate = useCallback((r: GroupRecord) => {
    setGeneratingId(r.id)
    service.sessions.generateSessions(r.id)
      .then((result) => {
        toast.success(`${result.generated} seans oluşturuldu${result.skipped > 0 ? `, ${result.skipped} atlandı` : ''}.`)
      })
      .catch(() => undefined)
      .finally(() => setGeneratingId(null))
  }, [service])

  useEffect(() => {
    service.branches.getList({ page: 1, limit: 1000 }).then((res) => {
      if (res?.items && res.items.length > 0) {
        setBranches(res.items)
      } else {
        service.branches.getOptions().then((items) => setBranches(
          items.map((b) => ({ ...b, isActive: true, createdAt: '' })),
        )).catch(() => setBranches([]))
      }
    }).catch(() => {
      service.branches.getOptions().then((items) => setBranches(
        items.map((b) => ({ ...b, isActive: true, createdAt: '' })),
      )).catch(() => setBranches([]))
    })
    service.settings.getGeneral().then((s) => {
      setDocumentLibrary(s.requiredDocuments ?? [])
    }).catch(() => setDocumentLibrary([]))
    loadInstructors()
    service.facilities.getOptions().then(setAllFacilities).catch(() => setAllFacilities([]))
  }, [service, loadInstructors])

  useEffect(() => {
    if (!parentGroupId) { setParentGroupRecord(null); return }
    service.groups.getList({ facilityId, page: 1, limit: 200 })
      .then((r) => setParentGroupRecord(r.items.find((g) => g.id === parentGroupId) ?? null))
      .catch(() => setParentGroupRecord(null))
  }, [parentGroupId, facilityId, service.groups])

  useEffect(() => {
    service.groups.getList({ facilityId, page: 1, limit: 500 })
      .then((r) => setAllGroups(r.items))
      .catch(() => setAllGroups([]))
  }, [facilityId, refreshSignal, service.groups])

  const makeEmptyForm = useCallback((overrides?: Partial<GroupForm>): GroupForm => makeEmptyGroupForm(config, facilityId, overrides),
    [config, facilityId])

  const openSubGroupDrawer = useCallback((parent: GroupRecord) => {
    setSubGroupTarget(parent)
    setSubGroupForm(makeEmptyForm({
      facilityId: parent.facilityId,
      branchId: parent.branchId,
      parentGroupId: parent.id,
      type: parent.type,
      residencyMode: parent.residencyMode ?? 'anyone',
    }))
  }, [makeEmptyForm])

  const saveSubGroup = useCallback(async () => {
    if (!subGroupTarget || !subGroupForm) return
    setSubGroupSaving(true)
    try {
      await service.groups.createSubGroup(subGroupTarget.id, subGroupForm)
      toast.success(`${T.groupSingular} eklendi.`)
      setSubGroupTarget(null)
      setSubGroupForm(null)
      setRefreshSignal((s) => s + 1)
    } finally {
      setSubGroupSaving(false)
    }
  }, [subGroupTarget, subGroupForm, service.groups, T.groupSingular])

  const isSubFormValid = (f: GroupForm) =>
    !!f.name.trim() && !!f.capacity.trim()
    && (!facilityCapacity || Number(f.capacity) <= facilityCapacity)
    && isGroupPeriodValid(f)
    && (!f.documentsRequired || f.requiredDocumentIds.length > 0)

  const emptyForm = makeEmptyForm(parentGroupId ? {
    parentGroupId,
    branchId: parentGroupRecord?.branchId ?? '',
    type: parentGroupRecord?.type ?? 'kurs',
    residencyMode: parentGroupRecord?.residencyMode ?? 'anyone',
  } : undefined)

  const startChanged = startDate !== defaultStart
  const endChanged = endDate !== defaultEnd
  const hasActiveFilters = !!type || !!branch || !!gender || !!status || showPast || startChanged || endChanged
  const clearFilters = () => { setType(''); setBranch(''); setGender(''); setStatus(''); setShowPast(false); setStartDate(defaultStart); setEndDate(defaultEnd) }

  return (
    <>
    {parentGroupId && onNavigateBack && (
      <div className="flex items-center gap-2 mb-2 px-1">
        <button
          type="button"
          onClick={onNavigateBack}
          className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span className="font-medium">{T.groupPlural}</span>
        </button>
        <ChevronRightIcon className="h-3.5 w-3.5 text-foreground-muted" />
        <span className="text-sm font-semibold text-foreground">
          {parentGroupRecord?.name ?? '...'}
        </span>
      </div>
    )}
    <CrudListTemplate<GroupRecord, GroupForm>
      icon={UsersIcon}
      title={parentGroupRecord ? parentGroupRecord.name : T.groupPlural}
      subtitle={parentGroupRecord
        ? `${parentGroupRecord.branchName ?? T.branchSingular} · Seanslar`
        : `${T.facilitySingular} derslerini/programlarını yönetin`}
      resourceName={parentGroupId ? 'Seans' : T.groupSingular}
      emptyTitle={parentGroupId ? 'Henüz seans yok' : undefined}
      emptyDescription={parentGroupId ? '"+ Seans Ekle" butonunu kullanın' : undefined}
      service={{
        getList: (p) => service.groups.getList(p),
        remove: (id) => service.groups.remove(id),
        toggleStatus: (id) => service.groups.toggleStatus(id),
      }}
      rowKey={(r) => r.id}
      searchPlaceholder={`${T.groupSingular} adı ara...`}
      initialSearch={initialSearch}
      extraParams={parentGroupId
        ? { facilityId, type, branchId: branch, gender, isActive: status, parentGroupId }
        : { facilityId, type, branchId: branch, gender, isActive: status, isParent: 'true', startDate, endDate, ...(!showPast ? { hidePast: 'true' } : {}) }}
      rowFilter={undefined}
      hasActiveFilters={hasActiveFilters}
      filterCount={[type, branch, gender, status].filter(Boolean).length + (showPast ? 1 : 0) + (startChanged ? 1 : 0) + (endChanged ? 1 : 0)}
      onClearFilters={clearFilters}
      filterColumns={parentGroupId ? 4 : 6}
      // Kullanıcı isteği (2026-10-05): gruplar VE seanslar ada/eklenme tarihine veya manuel
      // sürükle-bırak ile sıralanabilsin. Seanslar (parentGroupId dolu) ve ana gruplar
      // (parentGroupId boş) backend'de bağımsız sıralama alanlarına sahip (bkz. GetMaxSortOrderAsync).
      sortOptions={[
        { key: 'name', label: 'Ada Göre' },
        { key: 'createdAt', label: 'Eklenme Tarihine Göre', dir: 'desc' },
        { key: 'manual', label: 'Manuel Sıralama', manual: true },
      ]}
      onReorder={(orderedIds) => service.groups.reorder(facilityId, parentGroupId ?? null, orderedIds)}
      refreshSignal={refreshSignal}
      editRequestId={editRequestId}
      onEditRequestHandled={() => setEditRequestId(null)}
      renderFilters={() => (
        <>
          {!parentGroupId && (
            <>
              <FilterField label="Başlangıç (en erken)">
                <DatePicker value={startDate} onChange={setStartDate} clearable />
              </FilterField>
              <FilterField label="Bitiş (en geç)">
                <DatePicker value={endDate} onChange={setEndDate} clearable />
              </FilterField>
            </>
          )}
          <FilterField label="Tür">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Tümü</option>
              <option value="kurs">Kurs</option>
              <option value="akademi">Akademi</option>
            </Select>
          </FilterField>
          <FilterField label={T.branchSingular}>
            <Select searchable searchPlaceholder="Ara..." value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Tümü</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Cinsiyet">
            <Select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Tümü</option>
              <option value="mixed">Karma</option>
              <option value="male">Erkek</option>
              <option value="female">Kadın</option>
            </Select>
          </FilterField>
          <FilterField label="Durum">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tümü</option>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </Select>
          </FilterField>
          {!parentGroupId && (
            <FilterField label="Geçmiş Dönemler">
              <ToggleRow
                label="Geçmiş Dönemleri Göster"
                description="Açıksa, bitiş tarihi geçmişte kalan gruplar/dönemler de listede görünür."
                checked={showPast}
                onChange={setShowPast}
              />
            </FilterField>
          )}
        </>
      )}
      columns={parentGroupId ? [
        {
          key: 'name',
          header: 'Grup Adı',
          sortable: true,
          sortKey: 'name',
          cell: (r) => (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Kullanıcı isteği (2026-10-04): grup/tesis adının bir bağlantı (link) olduğu
                  belli olsun diye tıklanabilir adlar her zaman mavi (text-primary) gösterilir,
                  sadece hover'da değil — aksi halde siyah metinle aynı göründüğü için tıklanabilir
                  olduğu anlaşılmıyordu. */}
              <button
                type="button"
                title="Seansı düzenle"
                onClick={() => setEditRequestId(r.id)}
                className="type-body-strong text-left text-primary hover:underline cursor-pointer"
              >
                {r.name}
              </button>
              <span className="inline-flex items-center rounded-full bg-surface-1 border border-border px-1.5 py-px text-[10px] font-semibold tabular-nums text-foreground-muted">
                {r.ageMin}–{r.ageMax} yaş
              </span>
              {r.gender !== 'mixed' && (
                <Badge tone={r.gender === 'female' ? 'primary' : 'info'} className="text-[9px]">
                  {r.gender === 'female' ? 'Kadın' : 'Erkek'}
                </Badge>
              )}
            </div>
          ),
        },
        {
          key: 'days',
          header: 'Seans Günleri',
          cell: (r) => <ScheduleBadges schedules={r.schedules} days={r.days} />,
        },
        {
          key: 'period',
          header: 'Dönem',
          cell: (r) => {
            if (r.periodStart) return (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <CalendarClockIcon className="h-3 w-3 text-foreground-muted shrink-0" />
                  <span className="text-[10px] text-foreground-muted tabular-nums">
                    {r.periodStart.slice(0, 10)}{r.periodEnd ? ` → ${r.periodEnd.slice(0, 10)}` : ''}
                  </span>
                </div>
                {r.applicationStartDate && (
                  <div className="text-[10px] text-foreground-muted tabular-nums">
                    Başvuru: {r.applicationStartDate.slice(0, 10)}{r.applicationEndDate ? ` → ${r.applicationEndDate.slice(0, 10)}` : ''}
                  </div>
                )}
              </div>
            )
            if (r.periodType === 'recurring' && r.periodMonths) return (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <CalendarClockIcon className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-[10px] text-primary font-medium">
                    {r.periodMonths} aylık · {Math.floor(12 / Number(r.periodMonths)) || 1} dönem (1 yıl)
                  </span>
                </div>
                {r.applicationStartDate && (
                  <div className="text-[10px] text-foreground-muted tabular-nums">
                    Başvuru: {r.applicationStartDate.slice(0, 10)}
                  </div>
                )}
              </div>
            )
            if (r.periodUnit === 'day' && r.periodDays) return (
              <div className="flex items-center gap-1">
                <CalendarClockIcon className="h-3 w-3 text-primary shrink-0" />
                <span className="text-[10px] text-primary font-medium">
                  {r.periodDays} günlük{r.periodStart ? ` · ${r.periodStart.slice(0, 10)}` : ''}
                </span>
              </div>
            )
            if (r.schedules && r.schedules.length > 0) return (
              <span className="text-[10px] text-warning font-medium">Dönem girilmemiş</span>
            )
            return <span className="type-muted">—</span>
          },
        },
        {
          key: 'capacity',
          header: 'Kontenjan',
          align: 'center' as const,
          cell: (r) => (
            <span className="tabular-nums text-sm font-medium text-foreground-default">
              {r.capacity}
            </span>
          ),
        },
        {
          key: 'empty',
          header: 'Boş',
          align: 'center' as const,
          cell: (r) => {
            const empty = Math.max(0, r.capacity - r.registeredCount)
            return (
              <button type="button" title="Kayıtlı listesini gör" className="cursor-pointer hover:opacity-80" onClick={() => setRosterGroup(r)}>
                <Badge tone={empty === 0 ? 'danger' : empty <= 2 ? 'warning' : 'success'}>
                  {empty}
                </Badge>
              </button>
            )
          },
        },
        {
          key: 'registeredCount',
          header: 'Asıl',
          align: 'center' as const,
          cell: (r) => (
            <button type="button" title="Kayıtlı listesini gör" className="cursor-pointer hover:opacity-80" onClick={() => setRosterGroup(r)}>
              <Badge tone={occupancyTone(r.registeredCount, r.capacity)}>{r.registeredCount}</Badge>
            </button>
          ),
        },
        {
          key: 'waitlist',
          header: 'Yedek',
          align: 'center' as const,
          cell: (r) => (
            <button
              type="button"
              title="Yedek listesini gör"
              onClick={() => setRosterGroup(r)}
              className={`cursor-pointer tabular-nums text-sm font-medium hover:underline ${r.waitlistCount > r.reserveCapacity ? 'text-danger' : r.waitlistCount > 0 ? 'text-warning' : 'text-foreground-muted'}`}
            >
              {r.waitlistCount} / {r.reserveCapacity}
            </button>
          ),
        },
        {
          key: 'pendingCount',
          header: 'Bekleyen',
          align: 'center' as const,
          cell: (r) => (
            <DrilldownCount
              count={r.pendingCount ?? 0}
              title={`${r.name} — Bekleyen Başvurular`}
              subtitle="Onay/red bekleyen başvurular — buradan onaylayabilirsiniz"
              icon={UserIcon}
              triggerClassName="text-warning"
            >
              <FacilityApplicationsTab
                config={config}
                service={service}
                facilityId={facilityId}
                embedded
                scope={{ groupId: r.id, status: 'pending' }}
                onMutated={() => setRefreshSignal((s) => s + 1)}
              />
            </DrilldownCount>
          ),
        },
        { key: 'isActive', header: 'Durum', cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge> },
      ] : [
        {
          // Kullanıcı isteği (2026-10-06): tesis adı zaten sayfa başlığında görünüyor,
          // burada tekrar etmesine gerek yok. Yazı tipi tablonun geri kalanıyla aynı
          // ölçeğe (type-body-strong, alt seans listesindeki gibi) çekildi — önceki
          // font-semibold + büyük boyut "çok büyük" görünüyordu. Grup adının sonundaki
          // spor türü ("... (FİTNES)") varsa adtan ayrılıp küçük bir rozette gösterilir;
          // yoksa branş adı (ör. "Yüzme") aynı rozette gösterilir.
          key: 'name',
          header: 'Grup Adı',
          sortable: true,
          sortKey: 'name',
          cell: (r) => {
            const { cleanName, sportLabel } = splitGroupNameAndSport(r.name, r.branchName)
            return (
              <button
                type="button"
                title={`${r.branchName} — ${r.name}`}
                onClick={() => onNavigateToSubGroups?.(r)}
                className="flex items-center gap-1.5 flex-wrap min-w-[16rem] max-w-md text-left hover:underline cursor-pointer"
              >
                <span className="type-body-strong text-primary whitespace-normal break-words">{cleanName}</span>
                {sportLabel && (
                  <Badge tone="info" className="text-[9px] shrink-0">{sportLabel}</Badge>
                )}
              </button>
            )
          },
        },
        {
          // Kullanıcı isteği (2026-10-06): her grubun gün/saat programı ayrı, kendi
          // sütununda görünsün (önceden yalnızca alt seans listesinde vardı).
          key: 'days',
          header: 'Gün / Saat',
          cell: (r) => <ScheduleBadges schedules={r.schedules} days={r.days} />,
        },
        {
          key: 'period',
          header: 'Dönem',
          cell: (r) => r.periodType === 'recurring'
            ? <span className="type-caption text-primary font-medium">Sürekli</span>
            : r.periodStart
              ? <span className="whitespace-nowrap type-muted tabular-nums text-[11px]">{r.periodStart.slice(0, 10)}{r.periodEnd ? ` → ${r.periodEnd.slice(0, 10)}` : ''}</span>
              : <span className="type-muted">—</span>,
        },
        { key: 'type', header: 'Tür', cell: (r) => <Badge tone={r.type === 'akademi' ? 'primary' : 'info'}>{r.type === 'akademi' ? 'Akademi' : 'Kurs'}</Badge> },
        {
          key: 'capacity',
          header: 'Kontenjan',
          align: 'center' as const,
          cell: (r) => {
            const total = (r.subGroupCount ?? 0) > 0 ? (r.subGroupCapacity ?? 0) : r.capacity
            return <span className="tabular-nums">{total}</span>
          },
        },
        {
          key: 'registeredCount',
          header: 'Aktif',
          align: 'center' as const,
          cell: (r) => {
            const total = (r.subGroupCount ?? 0) > 0 ? (r.subGroupRegistered ?? 0) : r.registeredCount
            return <Badge tone={total > 0 ? 'success' : 'neutral'}>{total}</Badge>
          },
        },
        {
          key: 'empty',
          header: 'Boş',
          align: 'center' as const,
          cell: (r) => {
            const hasSubs = (r.subGroupCount ?? 0) > 0
            const cap = hasSubs ? (r.subGroupCapacity ?? 0) : r.capacity
            const used = hasSubs ? (r.subGroupRegistered ?? 0) : r.registeredCount
            const empty = Math.max(0, cap - used)
            return <Badge tone={empty === 0 ? 'danger' : empty <= 2 ? 'warning' : 'success'}>{empty}</Badge>
          },
        },
        {
          key: 'waitlistCount',
          header: 'Yedek',
          align: 'center' as const,
          cell: (r) => {
            if ((r.subGroupCount ?? 0) > 0) {
              const sub = r.subGroupWaitlist ?? 0
              return <span className={`tabular-nums ${sub > 0 ? 'text-warning' : 'text-foreground-muted'}`}>{sub}</span>
            }
            const over = r.waitlistCount > r.reserveCapacity
            return (
              <span
                className={`tabular-nums whitespace-nowrap ${over ? 'text-danger' : r.waitlistCount > 0 ? 'text-warning' : 'text-foreground-muted'}`}
                title={over ? `Yedek kontenjanı (${r.reserveCapacity}) aşılmış: ${r.waitlistCount} aktif yedek kayıt var` : undefined}
              >
                {r.waitlistCount} / {r.reserveCapacity}
              </span>
            )
          },
        },
        {
          key: 'subGroupCount',
          header: 'Seanslar',
          align: 'center' as const,
          cell: (r) => {
            const subCount = r.subGroupCount ?? 0
            const isLeafSession = subCount === 0 && r.capacity > 0
            if (isLeafSession) {
              return (
                <button
                  type="button"
                  title="Bu grup zaten kendi kontenjanı/programı olan bir seanstır. Detayları görüntülemek/düzenlemek için tıklayın."
                  onClick={() => setEditRequestId(r.id)}
                  className="cursor-pointer whitespace-nowrap hover:opacity-80"
                >
                  <Badge tone="success">Doğrudan seans</Badge>
                </button>
              )
            }
            return (
              <button
                type="button"
                onClick={() => onNavigateToSubGroups?.(r)}
                className="cursor-pointer whitespace-nowrap hover:opacity-80"
              >
                <Badge tone={subCount > 0 ? 'primary' : 'neutral'}>{subCount > 0 ? `${subCount} seans` : 'Seans oluştur'}</Badge>
              </button>
            )
          },
        },
        { key: 'isActive', header: 'Durum', cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge> },
      ]}
      stats={({ rows, total, loading }) => {
        if (parentGroupId) {
          const subs = allGroups.filter((g) => g.parentGroupId === parentGroupId)
          return [
            { label: 'Toplam Kontenjan', value: subs.reduce((s, r) => s + r.capacity, 0), icon: UsersIcon, accent: 'blue' },
            { label: 'Toplam Asıl', value: subs.reduce((s, r) => s + r.registeredCount, 0), icon: CheckCircle2Icon, accent: 'green' },
            { label: 'Toplam Yedek', value: subs.reduce((s, r) => s + r.waitlistCount, 0), icon: AlertCircleIcon, accent: 'orange' },
            { label: 'Seans Sayısı', value: loading ? total : subs.length, icon: XCircleIcon, accent: 'violet' },
          ]
        }
        return [
          { label: `Toplam ${T.groupSingular}`, value: total, icon: UsersIcon, accent: 'blue' },
          { label: 'Aktif', value: rows.filter((r) => r.isActive).length, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'Dolu', value: rows.filter((r) => r.capacity > 0 && r.registeredCount >= r.capacity).length, icon: AlertCircleIcon, accent: 'orange' },
          { label: 'Pasif', value: rows.filter((r) => !r.isActive).length, icon: XCircleIcon, accent: 'violet' },
        ]
      }}
      emptyForm={emptyForm}
      // Kullanıcı isteği (2026-10-04): "tesis girişinde de ... üst tarafta seans ve grup
      // ekleme seçeneği burda olsun" — "Yeni Grup/Seans" butonu tablonun kendi araç
      // çubuğuna (Sütunlar butonunun soluna) taşındı.
      createButtonPlacement="table"
      toForm={(r) => groupRecordToForm(r, emptyForm)}
      isFormValid={(f, mode) => getGroupFormErrors(f, mode, T.groupSingular, facilityCapacity).length === 0}
      getFormErrors={(f, mode) => getGroupFormErrors(f, mode, T.groupSingular, facilityCapacity)}
      onCreate={async (f) => {
        if (f.parentGroupId) await service.groups.createSubGroup(f.parentGroupId, f)
        else await service.groups.create(f)
        toast.success(`${T.groupSingular} eklendi.`)
      }}
      onUpdate={(id, f) => saveGroupUpdate(service, id, f)}
      selectable
      bulkActions={(rows, { clear, refresh }) => (
        <>
          <GroupBulkActions rows={rows} service={service} onClear={clear} onRefresh={refresh} />
          <Button variant="outline" size="sm" iconLeft={<UserPlusIcon className="h-4 w-4" />} onClick={() => setTransferGroups(rows)}>
            TC ile Üye / Yedek Ekle
          </Button>
          <Button variant="primary" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setTemplateMessageIds(rows.map((r) => r.id))}>
            SMS / Bildirim Gönder
          </Button>
        </>
      )}
      isActive={(r) => r.isActive}
      drawerWidth={620}
      deleteConfirm={{ title: `${T.groupSingular} Sil`, description: 'Bu grubu silmek istediğinizden emin misiniz?' }}
      collapseRowActions
      extraRowActions={(r) => {
        const hasSubs = !r.parentGroupId && allGroups.some((g) => g.parentGroupId === r.id)
        const isLeafSession = !r.parentGroupId && !hasSubs && r.capacity > 0
        return (
          <>
            {!r.parentGroupId && !isLeafSession && (
              <IconButton
                tone="primary"
                title="Seans Oluştur"
                onClick={() => openSubGroupDrawer(r)}
              >
                <PlusIcon className="h-4 w-4" />
              </IconButton>
            )}
            {(r.parentGroupId || isLeafSession) && (
              <IconButton
                tone="default"
                title="Seansları Görüntüle"
                onClick={() => onNavigateToSessions?.(r)}
              >
                <ClockIcon className="h-4 w-4" />
              </IconButton>
            )}
            {(r.parentGroupId || isLeafSession) && (
              <IconButton tone="primary" title="Kayıtlar / Yedekler" onClick={() => setRosterGroup(r)}>
                <UsersIcon className="h-4 w-4" />
              </IconButton>
            )}
            {/* Kullanıcı isteği (2026-10-01): "başka tesislerde de aynı saatlerde aynı
                günlerde seansları olabilir" — ana grup/doğrudan seans kaydı, aynı program
                ile başka tesis(ler)e kopyalanabilsin. Alt gruplar (ParentGroupId dolu)
                backend'de doğrudan kopyalanamaz (SUBGROUP_COPY_NOT_ALLOWED) — önce ana
                grup kopyalanmalı, bu yüzden burada gösterilmiyor. */}
            {!r.parentGroupId && (
              <IconButton tone="default" title={`${T.groupSingular} Kopyala — başka tesis(ler)e aynı program ile`} onClick={() => setCopyTarget(r)}>
                <CopyIcon className="h-4 w-4" />
              </IconButton>
            )}
          </>
        )
      }}
      renderForm={({ form, setForm, mode, editingRow }) => (
        <GroupFormFields
          config={config}
          form={form}
          setForm={setForm}
          branches={branches}
          instructors={instructors}
          documentLibrary={documentLibrary}
          facilityCapacity={facilityCapacity}
          mode={mode}
          isSubGroup={!!form.parentGroupId}
          editingRow={editingRow}
          service={service}
          allFacilities={allFacilities}
          allGroups={allGroups}
        />
      )}
      altView={{
        toggleLabel: (active) => (active ? 'Tablo Görünümü' : `${T.branchSingular} Görünümü`),
        toggleIcon: FolderIcon,
        pageSize: 500,
        render: (rows, api) => (
          <>
            {hierarchySelectedIds.size > 0 && (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-field border border-primary/30 bg-primary/5 px-3 py-2">
                <span className="type-caption font-semibold text-primary">{hierarchySelectedIds.size} {T.groupSingular.toLocaleLowerCase('tr')} seçili</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setHierarchySelectedIds(new Set())}>Temizle</Button>
                  <Button variant="outline" size="sm" iconLeft={<UserPlusIcon className="h-4 w-4" />} onClick={() => setTransferGroups(rows.filter((g) => hierarchySelectedIds.has(g.id)))}>
                    TC ile Üye / Yedek Ekle
                  </Button>
                  <Button variant="primary" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setTemplateMessageIds([...hierarchySelectedIds])}>
                    SMS / Bildirim Gönder
                  </Button>
                </div>
              </div>
            )}
            <FacilityGroupHierarchy
              groups={rows}
              loading={api.loading}
              branchSingular={T.branchSingular}
              groupSingular={T.groupSingular}
              onEdit={api.openEdit}
              onRoster={(g) => setRosterGroup(g)}
              onAddSubGroup={openSubGroupDrawer}
              onCopy={(g) => setCopyTarget(g)}
              onGenerateSessions={handleGenerate}
              generatingId={generatingId}
              selectedIds={hierarchySelectedIds}
              onToggleSelect={toggleHierarchySelect}
            />
          </>
        ),
      }}
    />

    {rosterGroup && (
      <FacilityRosterModal
        open={!!rosterGroup}
        onClose={() => setRosterGroup(null)}
        service={service}
        module={config.routeId}
        groupId={rosterGroup.id}
        groupName={rosterGroup.name}
        capacity={rosterGroup.capacity}
        periodType={rosterGroup.periodType}
        periodStart={rosterGroup.periodStart}
        periodMonths={rosterGroup.periodMonths}
        groupType={rosterGroup.type}
      />
    )}

    <Drawer
      open={!!subGroupTarget}
      onClose={() => { setSubGroupTarget(null); setSubGroupForm(null) }}
      title={`Seans Oluştur — ${subGroupTarget?.name ?? ''}`}
      width={620}
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => { setSubGroupTarget(null); setSubGroupForm(null) }}>İptal</Button>
          <Button
            variant="primary"
            isLoading={subGroupSaving}
            disabled={!subGroupForm || !isSubFormValid(subGroupForm)}
            onClick={saveSubGroup}
          >
            Seansı Kaydet
          </Button>
        </div>
      }
    >
      {subGroupForm && (
        <GroupFormFields
          config={config}
          form={subGroupForm}
          setForm={(updater) => setSubGroupForm((prev) => prev ? (typeof updater === 'function' ? updater(prev) : updater) : prev)}
          branches={branches}
          instructors={instructors}
          documentLibrary={documentLibrary}
          facilityCapacity={facilityCapacity}
          mode="create"
          isSubGroup
        />
      )}
    </Drawer>
    <FacilitySendMessageModal open={!!templateMessageIds} module={config.routeId} target="group" ids={templateMessageIds ?? []} service={service} onClose={() => setTemplateMessageIds(null)} onSent={() => { setRefreshSignal((s) => s + 1); setHierarchySelectedIds(new Set()) }} />
    <FacilityMemberTransferModal
      open={!!transferGroups}
      onClose={() => setTransferGroups(null)}
      groups={transferGroups ?? []}
      service={service}
      onDone={() => setRefreshSignal((s) => s + 1)}
    />

    <FacilityGroupCopyModal
      group={copyTarget}
      service={service}
      facilities={allFacilities}
      groupLabel={T.groupSingular}
      onClose={() => setCopyTarget(null)}
      onSingleCopyCreated={(targetFacilityId, groupId) => {
        if (targetFacilityId === facilityId) {
          // Aynı tesise kopyalandı — bu listede zaten görünecek, sadece yenile ve aç.
          setRefreshSignal((s) => s + 1)
          setEditRequestId(groupId)
        } else {
          // Kullanıcı isteği: tek hedefe kopyalandığında yeni kopya hemen düzenlenebilsin diye
          // sağdaki düzenleme çekmecesi otomatik açılsın (EventsTab.copyEvent ile aynı desen).
          // Hedef başka bir tesis olduğu için bu sekme o kaydı göstermez — üst bileşen
          // (FacilityModule) seçili tesisi değiştirip aynı mekanizmayı orada tetikler.
          onCopiedToOtherFacility?.(targetFacilityId, groupId)
        }
      }}
    />
    </>
  )
}
