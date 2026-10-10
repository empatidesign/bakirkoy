import { useMemo, useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon, FolderIcon, PencilIcon, UsersIcon, CalendarIcon, ShieldCheckIcon, ClockIcon, ZapIcon, PlusIcon, Loader2Icon, CalendarPlusIcon, CalendarCheckIcon, CopyIcon } from 'lucide-react'
import { Badge, IconButton, EmptyState, Card, Skeleton, Checkbox } from '@/design-system'
import type { GroupRecord } from '@/types/facility.types'

const DAY_TR: Record<string, string> = {
  monday: 'Pzt', tuesday: 'Sal', wednesday: 'Çar', thursday: 'Per',
  friday: 'Cum', saturday: 'Cmt', sunday: 'Paz',
}

interface Props {
  groups: GroupRecord[]
  loading?: boolean
  branchSingular: string
  groupSingular: string
  onEdit: (group: GroupRecord) => void
  onRoster: (group: GroupRecord) => void
  onAddSubGroup?: (parentGroup: GroupRecord) => void
  // Kullanıcı isteği (2026-10-01): "başka tesislerde de aynı saatlerde aynı günlerde
  // seansları olabilir" — ana grup/doğrudan seans niteliğindeki kayıt bu görünümden de
  // kopyalanabilsin.
  onCopy?: (group: GroupRecord) => void
  onGenerateSessions?: (group: GroupRecord) => void
  generatingId?: string | null
  // Kullanıcı bulgusu (2026-08-12): "Gruplara eklenmesi gerekiyordu" — Şube Görünümü
  // (hiyerarşi/ağaç görünümü) tablo görünümünden farklı bir bileşen olduğu için oradaki
  // checkbox + "Şablonlu Mesaj Gönder" toplu aksiyonu bu görünümde yoktu. selectedIds/
  // onToggleSelect burada da aynı imkânı sağlıyor; seçilebilir satırlar gerçek kayıt
  // olan (hasRealParent) ana gruplar, alt gruplar ve doğrudan seans niteliğindeki
  // (isLeafSession) satırlardır — sentetik "Ana Grup" konteynerleri (orphan bucket'lar)
  // seçilemez çünkü gerçek bir grup id'si temsil etmiyorlar.
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

interface Bucket {
  branchId: string
  branchName: string
  parentGroups: ParentBucket[]
}

interface ParentBucket {
  group: GroupRecord
  subGroups: GroupRecord[]
}

const pctOf = (reg: number, cap: number) => (cap > 0 ? Math.round((reg / cap) * 100) : 0)
const occTone = (pct: number): 'success' | 'warning' | 'danger' => (pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'success')
const occText = (pct: number) => (pct >= 90 ? 'text-danger' : pct >= 70 ? 'text-warning' : 'text-success')

export const FacilityGroupHierarchy = ({ groups, loading, branchSingular, groupSingular, onEdit, onRoster, onAddSubGroup, onCopy, onGenerateSessions, generatingId, selectedIds, onToggleSelect }: Props) => {
  const buckets = useMemo<Bucket[]>(() => {
    const parentGroups = groups.filter((g) => !g.parentGroupId)
    const subGroups = groups.filter((g) => !!g.parentGroupId)

    const map = new Map<string, Bucket>()
    for (const g of parentGroups) {
      const key = g.branchId || '—'
      if (!map.has(key)) map.set(key, { branchId: key, branchName: g.branchName || `${branchSingular} tanımsız`, parentGroups: [] })
      map.get(key)!.parentGroups.push({
        group: g,
        subGroups: subGroups.filter((s) => s.parentGroupId === g.id),
      })
    }

    const orphanSubGroups = subGroups.filter((s) => !parentGroups.find((p) => p.id === s.parentGroupId))
    for (const s of orphanSubGroups) {
      const key = s.branchId || '—'
      if (!map.has(key)) map.set(key, { branchId: key, branchName: s.branchName || `${branchSingular} tanımsız`, parentGroups: [] })
      const existing = map.get(key)!.parentGroups.find((p) => p.group.id === s.parentGroupId)
      if (!existing) {
        map.get(key)!.parentGroups.push({
          group: { id: s.parentGroupId!, name: s.parentGroupName ?? 'Ana Grup', branchId: s.branchId, branchName: s.branchName } as GroupRecord,
          subGroups: [s],
        })
      } else {
        existing.subGroups.push(s)
      }
    }

    return Array.from(map.values()).sort((a, b) => a.branchName.localeCompare(b.branchName, 'tr'))
  }, [groups, branchSingular])

  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set())
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set())

  const toggleBranch = (id: string) => setCollapsedBranches((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const toggleParent = (id: string) => setCollapsedParents((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })

  if (loading) return <Skeleton className="h-64 w-full" />

  if (buckets.length === 0) {
    return (
      <Card className="py-4">
        <EmptyState
          icon={FolderIcon}
          title={`Henüz ${groupSingular.toLocaleLowerCase('tr')} yok`}
          description={`${branchSingular} altında grup tanımlandığında burada listelenir.`}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {buckets.map((b) => {
        const openBranch = !collapsedBranches.has(b.branchId)
        // bkz. ParentGroupRow'daki isLeafSession notu: alt grubu olmayan ama kendi kontenjanı olan
        // ana gruplar aslında doğrudan seans niteliğinde — dal (branş) toplamına da dahil edilmeli,
        // yoksa eski/aktarılan veri ağırlıklı dallarda toplam hep 0 görünür.
        const countableGroups = b.parentGroups.flatMap((p) =>
          p.subGroups.length > 0 ? p.subGroups : (p.group.createdAt && (p.group.capacity || 0) > 0 ? [p.group] : []))
        const totalCap = countableGroups.reduce((s, g) => s + (g.capacity || 0), 0)
        const totalReg = countableGroups.reduce((s, g) => s + (g.registeredCount || 0), 0)
        const pct = pctOf(totalReg, totalCap)
        return (
          <div key={b.branchId} className="overflow-hidden rounded-card border border-border">
            <button
              type="button"
              onClick={() => toggleBranch(b.branchId)}
              className="flex w-full items-center gap-3 bg-surface-1 px-4 py-3 text-left transition-colors hover:bg-surface-2"
            >
              {openBranch ? <ChevronDownIcon className="h-4 w-4 text-foreground-muted" /> : <ChevronRightIcon className="h-4 w-4 text-foreground-muted" />}
              <FolderIcon className="h-4 w-4 flex-shrink-0 text-primary" />
              <span className="type-section flex-1 truncate">{b.branchName}</span>
              <span className="type-caption whitespace-nowrap">{b.parentGroups.length} ana grup · {b.parentGroups.flatMap((p) => p.subGroups).length} alt grup</span>
              {totalCap > 0 && <Badge tone={occTone(pct)}>{totalReg}/{totalCap} · %{pct}</Badge>}
            </button>
            {openBranch && (
              <div className="divide-y divide-border">
                {b.parentGroups.map((pb) => (
                  <ParentGroupRow
                    key={pb.group.id}
                    parentBucket={pb}
                    collapsed={collapsedParents.has(pb.group.id)}
                    onToggle={() => toggleParent(pb.group.id)}
                    onEdit={onEdit}
                    onRoster={onRoster}
                    onAddSubGroup={onAddSubGroup}
                    onCopy={onCopy}
                    onGenerateSessions={onGenerateSessions}
                    generatingId={generatingId}
                    groupSingular={groupSingular}
                    selectedIds={selectedIds}
                    onToggleSelect={onToggleSelect}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface ParentGroupRowProps {
  parentBucket: ParentBucket
  collapsed: boolean
  onToggle: () => void
  onEdit: (g: GroupRecord) => void
  onRoster: (g: GroupRecord) => void
  onAddSubGroup?: (g: GroupRecord) => void
  onCopy?: (g: GroupRecord) => void
  onGenerateSessions?: (g: GroupRecord) => void
  generatingId?: string | null
  groupSingular: string
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

const ParentGroupRow = ({ parentBucket, collapsed, onToggle, onEdit, onRoster, onAddSubGroup, onCopy, onGenerateSessions, generatingId, selectedIds, onToggleSelect }: ParentGroupRowProps) => {
  const { group: parent, subGroups } = parentBucket
  const hasRealParent = !!parent.createdAt
  // Kullanıcı bulgusu: eski veriden aktarılan gruplarda (Kaşif Çocuk, Spor, Havuz vb.) üst
  // seviyedeki kayıt genelde alt grubu olmayan, kendi kontenjanı/programı/kaydı olan bitmiş bir
  // SEANS'tır — boş bir "Ana Grup" konteyneri değildir. Bu durumda toplamlar (0 alt grup üzerinden
  // hesaplandığı için hep 0 çıkıyordu) kendi değerlerinden alınır ve "Alt Grup Ekle" yerine
  // doğrudan bir seans satırı gibi (kayıt/düzenleme erişimiyle) gösterilir.
  const isLeafSession = hasRealParent && subGroups.length === 0 && (parent.capacity || 0) > 0
  const totalCap = subGroups.length > 0 ? subGroups.reduce((s, g) => s + (g.capacity || 0), 0) : (isLeafSession ? parent.capacity || 0 : 0)
  const totalReg = subGroups.length > 0 ? subGroups.reduce((s, g) => s + (g.registeredCount || 0), 0) : (isLeafSession ? parent.registeredCount || 0 : 0)
  const pct = pctOf(totalReg, totalCap)

  return (
    <div>
      <div className="flex items-center gap-2 bg-surface-0 px-4 py-2.5 border-b border-border/50">
        {hasRealParent && onToggleSelect && (
          <Checkbox checked={!!selectedIds?.has(parent.id)} onCheckedChange={() => onToggleSelect(parent.id)} />
        )}
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {collapsed ? <ChevronRightIcon className="h-3.5 w-3.5 text-foreground-muted" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-foreground-muted" />}
          <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/10 flex-shrink-0">
            <FolderIcon className="h-3 w-3 text-primary" />
          </div>
          <span className="type-body-strong">{parent.name}</span>
          <Badge tone={parent.type === 'akademi' ? 'primary' : 'info'}>{parent.type === 'akademi' ? 'Akademi' : 'Kurs'}</Badge>
          {isLeafSession ? (
            <span className="inline-flex items-center rounded-full bg-success-soft px-1.5 py-0.5 text-[9px] font-semibold text-success">Seans (doğrudan)</span>
          ) : (
            <span className="type-caption text-foreground-muted">{subGroups.length} alt grup</span>
          )}
          {totalCap > 0 && <span className={`text-xs font-semibold tabular-nums ${occText(pct)}`}>{totalReg}/{totalCap}</span>}
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isLeafSession && (
            <IconButton tone="primary" title="Kayıtlar / Yedekler" onClick={() => onRoster(parent)}>
              <UsersIcon className="h-3.5 w-3.5" />
            </IconButton>
          )}
          {onAddSubGroup && hasRealParent && !isLeafSession && (
            <IconButton tone="primary" title="Alt Grup Ekle" onClick={() => onAddSubGroup(parent)}>
              <PlusIcon className="h-3.5 w-3.5" />
            </IconButton>
          )}
          {hasRealParent && (
            <IconButton title={isLeafSession ? 'Seansı Düzenle' : 'Ana Grubu Düzenle'} onClick={() => onEdit(parent)}>
              <PencilIcon className="h-3.5 w-3.5" />
            </IconButton>
          )}
          {onCopy && hasRealParent && (
            <IconButton tone="default" title="Başka tesis(ler)e kopyala — aynı program" onClick={() => onCopy(parent)}>
              <CopyIcon className="h-3.5 w-3.5" />
            </IconButton>
          )}
        </div>
      </div>
      {!collapsed && !isLeafSession && (
        <div className="divide-y divide-border/50">
          {subGroups.length === 0 ? (
            <div className="px-10 py-3 flex items-center gap-2">
              <span className="type-caption text-foreground-muted">Henüz alt grup yok.</span>
              {onAddSubGroup && hasRealParent && (
                <button
                  type="button"
                  className="type-caption text-primary font-medium hover:underline"
                  onClick={() => onAddSubGroup(parent)}
                >
                  Alt Grup Ekle
                </button>
              )}
            </div>
          ) : (
            subGroups.map((sg) => (
              <SubGroupRow
                key={sg.id}
                g={sg}
                onEdit={onEdit}
                onRoster={onRoster}
                onGenerateSessions={onGenerateSessions}
                generatingId={generatingId}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

const SubGroupRow = ({ g, onEdit, onRoster, onGenerateSessions, generatingId, selectedIds, onToggleSelect }: {
  g: GroupRecord
  onEdit: (g: GroupRecord) => void
  onRoster: (g: GroupRecord) => void
  onGenerateSessions?: (g: GroupRecord) => void
  generatingId?: string | null
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}) => {
  const pct = pctOf(g.registeredCount || 0, g.capacity || 0)
  const scheduleText = g.schedules && g.schedules.length > 0
    ? g.schedules.map((s) => `${DAY_TR[s.day.toLowerCase()] ?? s.day} ${s.start}–${s.end}`).join(', ')
    : g.days.length > 0 ? g.days.map((d) => DAY_TR[d.toLowerCase()] ?? d).join(', ') : null

  return (
    <div className="flex items-start gap-3 pl-10 pr-4 py-2.5 transition-colors hover:bg-surface-1">
      {onToggleSelect && (
        <div className="pt-0.5">
          <Checkbox checked={!!selectedIds?.has(g.id)} onCheckedChange={() => onToggleSelect(g.id)} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-body-strong">{g.name}</span>
          {g.gender !== 'mixed' && (
            <Badge tone={g.gender === 'female' ? 'primary' : 'info'}>{g.gender === 'female' ? 'Kadın' : 'Erkek'}</Badge>
          )}
          {g.autoApprove ? (
            <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ZapIcon className="h-2.5 w-2.5" /> Oto. Onay
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <ShieldCheckIcon className="h-2.5 w-2.5" /> Onay Gerekli
            </span>
          )}
          <Badge tone={!g.isActive ? 'neutral' : undefined}>{g.isActive ? 'Aktif' : 'Pasif'}</Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="type-caption">{g.ageMin}–{g.ageMax} yaş</span>
          {scheduleText && (
            <span className="inline-flex items-center gap-1 type-caption">
              <ClockIcon className="h-3 w-3 text-foreground-muted" />{scheduleText}
            </span>
          )}
          {g.periodStart && (
            <span className="inline-flex items-center gap-1 type-caption">
              <CalendarIcon className="h-3 w-3 text-foreground-muted" />
              {g.periodStart.slice(0, 10)}{g.periodEnd ? ` → ${g.periodEnd.slice(0, 10)}` : g.periodMonths ? ` · ${g.periodMonths} ay` : ''}
            </span>
          )}
          {g.instructorName && <span className="type-caption text-foreground-muted">{g.instructorName}</span>}
        </div>
      </div>

      <div className="hidden text-right sm:block shrink-0">
        <p className="type-caption">Kontenjan</p>
        <p className="text-sm font-semibold tabular-nums">
          <span className={occText(pct)}>{g.registeredCount || 0}</span>
          <span className="text-foreground-muted">/{g.capacity || 0}</span>
        </p>
      </div>

      <div className="hidden text-right md:block shrink-0">
        <p className="type-caption">Yedek</p>
        <p className="text-sm font-semibold tabular-nums text-warning">{g.waitlistCount || 0}</p>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        {onGenerateSessions && g.schedules && g.schedules.length > 0 && (
          // Kullanıcı bulgusu (2026-08-05): "seans oluştur sekmesi var seans oluşturulmuş ise
          // seans oluştur yerine altındaki seans sayısı yazmalı" — seans zaten oluşturulmuşsa
          // (sessionCount > 0) buton yerine gerçek seans sayısını gösteren bir rozet render
          // ediliyor; tıklanabilirlik korunuyor (backend generateSessions idempotent — mevcut
          // seansları atlayıp sadece eksik olanları ekliyor, bkz. handleGenerate 'atlandı' mesajı),
          // böylece kullanıcı programı uzattığında/yeni tarih eklendiğinde yine tek tıkla senkron
          // edebilir.
          g.sessionCount && g.sessionCount > 0 ? (
            <button
              type="button"
              title={`${g.sessionCount} seans oluşturulmuş — tekrar senkronlamak için tıklayın`}
              disabled={generatingId === g.id}
              onClick={() => g.periodStart && onGenerateSessions(g)}
              className="inline-flex h-8 items-center gap-1 rounded-field border border-success/30 bg-success/10 px-2 text-[12px] font-semibold text-success transition-colors hover:bg-success/20 disabled:opacity-60"
            >
              {generatingId === g.id ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheckIcon className="h-3.5 w-3.5" />}
              {g.sessionCount}
            </button>
          ) : (
            <IconButton
              tone={g.periodStart ? 'primary' : 'default'}
              title={g.periodStart ? 'Seans Oluştur' : 'Önce dönem başlangıcı giriniz'}
              disabled={generatingId === g.id || !g.periodStart}
              onClick={() => g.periodStart && onGenerateSessions(g)}
            >
              {generatingId === g.id ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <CalendarPlusIcon className="h-4 w-4" />}
            </IconButton>
          )
        )}
        <IconButton tone="primary" title="Kayıtlar / Yedekler" onClick={() => onRoster(g)}><UsersIcon className="h-4 w-4" /></IconButton>
        <IconButton title="Düzenle" onClick={() => onEdit(g)}><PencilIcon className="h-4 w-4" /></IconButton>
      </div>
    </div>
  )
}
