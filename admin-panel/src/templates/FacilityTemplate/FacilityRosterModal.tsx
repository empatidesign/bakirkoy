import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  UsersIcon, UserCheckIcon, UserPlusIcon, ArrowUpIcon, ArrowDownIcon, XIcon,
  ChevronUpIcon, ChevronDownIcon, ClockIcon, AlertCircleIcon, ShieldIcon, CheckIcon, MessageSquareIcon, GripVerticalIcon,
  Loader2Icon,
  HistoryIcon, FileDownIcon,
} from 'lucide-react'
import { Modal, Button, IconButton, EmptyState, Skeleton, ConfirmModal, Checkbox, Textarea, SegmentedControl } from '@/design-system'
import { downloadBlob } from '@/lib/utils'
import { AttendanceHistoryModal } from './AttendanceHistoryModal'
import { FacilitySendMessageModal } from './FacilitySendMessageModal'
import { FacilityMemberTransferPanel, ResultList, TARGET_OPTIONS } from './FacilityMemberTransferPanel'
import { useAuth } from '@/framework/auth/AuthContext'
import type { FacilityModuleService } from './types'
import type { RegistrationRecord, BulkPreRegisterResult, RegistrationTarget } from '@/types/facility.types'

interface Props {
  open: boolean
  onClose: () => void
  service: FacilityModuleService
  module: string
  groupId: string
  groupName: string
  capacity: number
  periodType?: string | null
  periodStart?: string | null
  periodMonths?: number | null
  groupType?: string
}

const AbsencePill = ({ label, value, warn }: { label: string; value: number; warn?: boolean }) => (
  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
    warn && value > 0 ? 'bg-[hsl(var(--danger-soft))] text-[hsl(var(--danger))]' : 'bg-surface-2 text-foreground-muted'
  }`}>
    {warn && value > 0 && <AlertCircleIcon className="h-3 w-3" />}
    {label}: {value}
  </span>
)

const MainSection = ({ count, capLabel, items, onRemove, onDemote, onHistory, busy, selected, onToggle }: {
  count: number
  capLabel?: string
  items: RegistrationRecord[]
  onRemove: (r: RegistrationRecord) => void
  onDemote: (r: RegistrationRecord) => void
  onHistory: (r: RegistrationRecord) => void
  busy: boolean
  selected: Set<string>
  onToggle: (id: string) => void
}) => (
  <div className="overflow-hidden rounded-lg border border-border bg-[hsl(var(--card))] shadow-sm">
    <div className="flex min-h-[58px] items-center gap-3 border-b border-border bg-[hsl(var(--success-soft))]/60 px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--success-soft))]">
        <UserCheckIcon className="h-4 w-4 text-[hsl(var(--success))]" />
      </div>
      <p className="text-sm font-semibold text-foreground-strong">Asıl Katılımcılar</p>
      <span className="inline-flex items-center rounded-full bg-[hsl(var(--success-soft))] px-2 py-0.5 text-xs font-bold text-[hsl(var(--success))]">
        {count}{capLabel ?? ''}
      </span>
      <span className="ml-auto flex items-center gap-1 text-[11px] text-foreground-muted">
        <ClockIcon className="h-3 w-3" />
        Devamsızlık saatleri
      </span>
    </div>
    {items.length === 0 ? (
      <div className="px-4 py-8 text-center">
        <UserCheckIcon className="mx-auto mb-2 h-8 w-8 text-foreground-subtle" />
        <p className="text-sm text-foreground-muted">Henüz asıl katılımcı yok.</p>
      </div>
    ) : (
      <div className="divide-y divide-border/60">
        {items.map((r, idx) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-1/40 transition-colors">
            <Checkbox checked={selected.has(r.id)} onCheckedChange={() => onToggle(r.id)} />
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold tabular-nums text-foreground-muted">
              {idx + 1}
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #16a34a, #059669)' }}>
              {r.fullName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground-strong truncate">{r.fullName}</p>
              <p className="text-[11px] text-foreground-muted truncate">{r.tckn}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <AbsencePill label="Devamsızlık" value={r.absenceUsed} warn />
              <AbsencePill label="Üst üste" value={r.consecutiveAbsenceUsed} warn={r.consecutiveAbsenceUsed >= 2} />
            </div>
            <IconButton tone="default" title="Yedeğe Al" disabled={busy} onClick={() => onDemote(r)}>
              <ArrowDownIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Yoklama Geçmişi" disabled={busy} onClick={() => onHistory(r)}>
              <HistoryIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="danger" title="Programdan Çıkar" disabled={busy} onClick={() => onRemove(r)}>
              <XIcon className="h-4 w-4" />
            </IconButton>
          </div>
        ))}
      </div>
    )}
  </div>
)

const ReserveSection = ({ items, onPromote, onRemove, onMoveUp, onMoveDown, onReorderDrop, onHistory, busy, canReorder, selected, onToggle }: {
  items: RegistrationRecord[]
  onPromote?: (r: RegistrationRecord) => void
  onRemove: (r: RegistrationRecord) => void
  onMoveUp?: (r: RegistrationRecord) => void
  onMoveDown?: (r: RegistrationRecord) => void
  onReorderDrop: (fromId: string, toId: string) => void
  onHistory: (r: RegistrationRecord) => void
  busy: boolean
  canReorder: boolean
  selected: Set<string>
  onToggle: (id: string) => void
}) => {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  return (
  <div className="overflow-hidden rounded-lg border border-border bg-[hsl(var(--card))] shadow-sm">
    <div className="flex min-h-[58px] items-center gap-3 border-b border-border bg-surface-1 px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
        <UserPlusIcon className="h-4 w-4 text-foreground-muted" />
      </div>
      <p className="text-sm font-semibold text-foreground-strong">Yedek Liste</p>
      <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-foreground-muted">
        {items.length}
      </span>
      {canReorder && items.length > 1 && (
        <span className="ml-auto flex items-center gap-1 rounded-md bg-[hsl(var(--warning-soft))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--warning))]">
          <ShieldIcon className="h-3 w-3" />
          Sürükle-bırak ile sırala
        </span>
      )}
    </div>
    {items.length === 0 ? (
      <div className="px-4 py-8 text-center">
        <UserPlusIcon className="mx-auto mb-2 h-8 w-8 text-foreground-subtle" />
        <p className="text-sm text-foreground-muted">Yedek listede kimse yok.</p>
      </div>
    ) : (
      <div className="divide-y divide-border/60">
        {items.map((r, idx) => (
          <div
            key={r.id}
            draggable={canReorder && !busy}
            onDragStart={() => setDragId(r.id)}
            onDragOver={(e) => { if (canReorder) { e.preventDefault(); setOverId(r.id) } }}
            onDragEnd={() => { setDragId(null); setOverId(null) }}
            onDrop={(e) => { e.preventDefault(); if (dragId && dragId !== r.id) onReorderDrop(dragId, r.id); setDragId(null); setOverId(null) }}
            className={`flex items-center gap-3 px-4 py-3 transition-colors ${overId === r.id && dragId !== r.id ? 'bg-primary/10' : 'hover:bg-surface-1/40'} ${dragId === r.id ? 'opacity-50' : ''}`}
          >
            {canReorder && (
              <span className="cursor-grab text-foreground-subtle active:cursor-grabbing" title="Sürükle">
                <GripVerticalIcon className="h-4 w-4" />
              </span>
            )}
            <Checkbox checked={selected.has(r.id)} onCheckedChange={() => onToggle(r.id)} />
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold tabular-nums text-foreground-muted">
              {r.waitlistOrder || idx + 1}
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #94a3b8, #64748b)', color: '#fff' }}>
              {r.fullName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground-strong truncate">{r.fullName}</p>
              <p className="text-[11px] text-foreground-muted truncate">{r.tckn}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <AbsencePill label="Devamsızlık" value={r.absenceUsed} />
              <AbsencePill label="Üst üste" value={r.consecutiveAbsenceUsed} />
            </div>
            {canReorder && (
              <div className="flex flex-col gap-0.5">
                <button
                  disabled={busy || idx === 0}
                  onClick={() => onMoveUp?.(r)}
                  className="flex h-5 w-5 items-center justify-center rounded text-foreground-muted hover:bg-surface-2 hover:text-foreground-strong disabled:opacity-30 transition-colors"
                >
                  <ChevronUpIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled={busy || idx === items.length - 1}
                  onClick={() => onMoveDown?.(r)}
                  className="flex h-5 w-5 items-center justify-center rounded text-foreground-muted hover:bg-surface-2 hover:text-foreground-strong disabled:opacity-30 transition-colors"
                >
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {onPromote && (
              <IconButton tone="success" title="Asıla Al" disabled={busy} onClick={() => onPromote(r)}>
                <ArrowUpIcon className="h-4 w-4" />
              </IconButton>
            )}
            <IconButton tone="default" title="Yoklama Geçmişi" disabled={busy} onClick={() => onHistory(r)}>
              <HistoryIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="danger" title="Programdan Çıkar" disabled={busy} onClick={() => onRemove(r)}>
              <XIcon className="h-4 w-4" />
            </IconButton>
          </div>
        ))}
      </div>
    )}
  </div>
  )
}

const PendingSection = ({ items, onApprove, onRemove, busy, selected, onToggle }: {
  items: RegistrationRecord[]
  onApprove: (r: RegistrationRecord) => void
  onRemove: (r: RegistrationRecord) => void
  busy: boolean
  selected: Set<string>
  onToggle: (id: string) => void
}) => (
  <div className="overflow-hidden rounded-lg border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--card))] shadow-sm">
    <div className="flex items-center gap-3 border-b border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-soft))]/60 px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--warning-soft))]">
        <ClockIcon className="h-4 w-4 text-[hsl(var(--warning))]" />
      </div>
      <p className="text-sm font-semibold text-foreground-strong">Onay Bekleyenler</p>
      <span className="inline-flex items-center rounded-full bg-[hsl(var(--warning-soft))] px-2 py-0.5 text-xs font-bold text-[hsl(var(--warning))]">
        {items.length}
      </span>
    </div>
    <div className="divide-y divide-border/50">
      {items.map((r) => (
        <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
          <Checkbox checked={selected.has(r.id)} onCheckedChange={() => onToggle(r.id)} />
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--warning-soft))] text-[11px] font-bold tabular-nums text-[hsl(var(--warning))]">
            <ClockIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="type-body-strong truncate">{r.fullName}</p>
            <p className="type-caption">{r.phone}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <IconButton tone="success" title="Onayla ve Asıla Al" disabled={busy} onClick={() => onApprove(r)}>
              <CheckIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="danger" title="Reddet / Çıkar" disabled={busy} onClick={() => onRemove(r)}>
              <XIcon className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      ))}
    </div>
  </div>
)

// Kullanıcı isteği: eski/kağıt kayıtlardan üye taşırken sadece TC değil, kişinin daha önce
// kullandığı devamsızlık hakkı ve hak-edişinin ne zaman biteceği de birlikte girilebilsin —
// aktarılan üye sıfırdan değil kaldığı yerden devam etsin. Format: her satır
// "TC,devamsızlık,ardışık devamsızlık,bitiş tarihi(YYYY-AA-GG)" — devamsızlık/tarih alanları
// opsiyonel, boş bırakılabilir. Kullanıcı isteği (2026-10-06): yedek listeye de aynı şekilde aktarılabilsin.
interface ParsedImportRow { tckn: string; absenceUsed?: number; consecutiveAbsenceUsed?: number; periodEnd?: string }

const parseImportRows = (raw: string): ParsedImportRow[] =>
  raw.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/[,;\t]/).map((p) => p.trim())
    const tckn = (parts[0] ?? '').replace(/\D/g, '')
    const absenceUsed = parts[1] ? Number(parts[1]) : undefined
    const consecutiveAbsenceUsed = parts[2] ? Number(parts[2]) : undefined
    const periodEnd = parts[3] || undefined
    return { tckn, absenceUsed, consecutiveAbsenceUsed, periodEnd }
  })

const BulkImportPanel = ({ groupId, service, onDone, groupType }: {
  groupId: string
  service: FacilityModuleService
  onDone: () => void
  groupType?: string
}) => {
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<BulkPreRegisterResult | null>(null)
  const [target, setTarget] = useState<RegistrationTarget>('auto')
  const isAkademi = groupType === 'akademi'

  const parsed = parseImportRows(raw)

  const submit = async () => {
    if (parsed.length === 0) return
    setBusy(true)
    setResult(null)
    try {
      const res = await service.registrations.bulkImport(groupId, parsed, target)
      setResult(res)
      if (res.registered + res.waitlisted > 0) {
        toast.success(`${res.registered} asıl, ${res.waitlisted} yedek olmak üzere ${res.registered + res.waitlisted} kişi aktarıldı.`)
        onDone()
      }
      if (res.failed > 0) toast.warning(`${res.failed} satır aktarılamadı, aşağıdaki listeden inceleyin.`)
    } catch {
      toast.error('Toplu aktarım başarısız oldu.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setRaw(''); setResult(null); setTarget('auto'); setOpen(false) }

  if (!open) {
    return (
      <Button variant="outline" size="sm" iconLeft={<FileDownIcon className="h-4 w-4 rotate-180" />} onClick={() => setOpen(true)}>
        Eski Kayıtları Aktar
      </Button>
    )
  }

  return (
    <div className="w-full rounded-lg border border-border bg-[hsl(var(--card))] p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground-strong">Eski Kayıtları Toplu Aktar</p>
          <p className="text-[11px] text-foreground-muted">
            Her satıra: <code className="rounded bg-surface-1 px-1">TC,devamsızlık,ardışık devamsızlık,bitiş tarihi(YYYY-AA-GG)</code> — TC dışındaki
            alanlar opsiyonel. Katılımcı sistemde kayıtlı olmasa bile eklenir; devamsızlık hakkı ve hak-ediş
            bitiş tarihi girildiği gibi korunur (sıfırdan başlamaz).
            {isAkademi && ' Bu bir Akademi grubu — aktarılan kişiler sürekli üye olur, devamsızlık nedeniyle otomatik çıkarılmaz.'}
          </p>
        </div>
        <IconButton tone="default" title="Kapat" onClick={reset}><XIcon className="h-4 w-4" /></IconButton>
      </div>

      <div className="mb-3">
        <p className="mb-1 text-[11px] font-medium text-foreground-muted">Hangi listeye aktarılsın?</p>
        <SegmentedControl value={target} onChange={(v) => setTarget(v as RegistrationTarget)} disabled={busy} columns={3} options={TARGET_OPTIONS} />
      </div>

      <Textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={'12345678901,2,1,2027-01-15\n23456789012,,,2026-12-31\n34567890123'}
        rows={4}
        disabled={busy}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-foreground-muted">{parsed.length > 0 ? `${parsed.length} satır algılandı` : ''}</span>
        <Button size="sm" onClick={submit} disabled={busy || parsed.length === 0} iconLeft={busy ? <Loader2Icon className="h-4 w-4 animate-spin" /> : undefined}>
          {busy ? 'Aktarılıyor...' : `${parsed.length || ''} Kişiyi ${target === 'reserve' ? 'Yedeğe ' : ''}Aktar`}
        </Button>
      </div>

      {result && (
        <div className="mt-3 border-t border-border pt-3">
          <ResultList result={result} />
        </div>
      )}
    </div>
  )
}

export const FacilityRosterModal = ({ open, onClose, service, module, groupId, groupName, capacity, periodType, periodStart, periodMonths, groupType }: Props) => {

  const { state } = useAuth()
  const isSuperAdmin = state.status === 'authenticated' && state.user?.isSuperAdmin === true
  const [roster, setRoster] = useState<RegistrationRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<RegistrationRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [templateMessageIds, setTemplateMessageIds] = useState<string[] | null>(null)
  const [historyTarget, setHistoryTarget] = useState<RegistrationRecord | null>(null)
  const [exporting, setExporting] = useState(false)

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    setSelected(new Set())
    try { setRoster(await service.registrations.getRoster(groupId)) }
    catch { setRoster([]) }
    finally { setLoading(false) }
  }, [service, groupId])

  useEffect(() => { if (open && groupId) load() }, [open, groupId, load])

  const doExportRoster = async () => {
    setExporting(true)
    try {
      const { blob, fileName } = await service.registrations.exportRoster(groupId)
      downloadBlob(blob, fileName)
      toast.success('Katılımcı listesi indirildi.')
    } finally {
      setExporting(false)
    }
  }

  const promote = async (r: RegistrationRecord) => {
    setBusy(true)
    try {
      await service.registrations.promote(r.id)
      toast.success(`${r.fullName} asıl listeye alındı.`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    setBusy(true)
    try {
      await service.registrations.remove(removeTarget.id, 'Yönetici tarafından çıkarıldı')
      toast.success('Kayıt programdan çıkarıldı.')
      setRemoveTarget(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const demote = async (r: RegistrationRecord) => {
    setBusy(true)
    try {
      await service.registrations.demote(r.id)
      toast.success(`${r.fullName} yedek listeye alındı.`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const applyOrder = async (orderedIds: string[]) => {
    setBusy(true)
    try {
      await service.registrations.reorderWaitlist(groupId, orderedIds)
      await load()
    } catch {
      toast.error('Sıra değiştirilemedi.')
    } finally {
      setBusy(false)
    }
  }

  const reorder = async (fromId: string, direction: 'up' | 'down') => {
    const ids = reserve.map((r) => r.id)
    const idx = ids.indexOf(fromId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= ids.length) return
    ;[ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]]
    await applyOrder(ids)
  }

  const reorderByDrop = async (fromId: string, toId: string) => {
    const ids = reserve.map((r) => r.id)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from < 0 || to < 0 || from === to) return
    ids.splice(to, 0, ids.splice(from, 1)[0])
    await applyOrder(ids)
  }

  const pending = roster.filter((r) => r.status === 'pending')
  const main = roster.filter((r) => r.kind === 'main' && r.status !== 'pending')
  const reserve = roster.filter((r) => r.kind === 'reserve' && r.status !== 'pending').sort((a, b) => a.waitlistOrder - b.waitlistOrder)

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        width={1380}
        className="max-w-[calc(100vw-2rem)]"
        hideCloseButton
        footer={<div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Kapat</Button></div>}
      >
        <div className="-m-5 flex min-h-full flex-col">
          <div className="relative overflow-hidden ds-hero">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-15"
              style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
            <div className="absolute bottom-0 left-6 h-16 w-16 rounded-full opacity-10"
              style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />
            <div className="relative flex min-h-[84px] items-center gap-4 border-b border-white/15 px-6 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
                style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}>
                <UsersIcon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white">Kayıtlar ve Yedekler</p>
                <p className="text-[12px] text-white/70 mt-0.5">{groupName}</p>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2">
                {pending.length > 0 && (
                  <div className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                    style={{ background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)' }}>
                    <ClockIcon className="h-4 w-4 text-amber-300" />
                    <span className="text-xs font-semibold text-amber-200">{pending.length} Bekliyor</span>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <UserCheckIcon className="h-4 w-4 text-emerald-300" />
                  <span className="text-xs font-semibold text-white">{main.length.toLocaleString('tr-TR')}{capacity > 0 ? `/${capacity.toLocaleString('tr-TR')}` : ''} Asıl</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <UserPlusIcon className="h-4 w-4 text-slate-300" />
                  <span className="text-xs font-semibold text-white">{reserve.length} Yedek</span>
                </div>
                <button
                  type="button"
                  onClick={doExportRoster}
                  disabled={exporting || loading || roster.length === 0}
                  aria-label="Excel İndir"
                  title="Katılımcı listesini Excel olarak indir"
                  className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/30 bg-white/15 text-white shadow-sm transition-colors hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:opacity-50"
                >
                  {exporting ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <FileDownIcon className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Kapat"
                  title="Kapat"
                  className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/30 bg-white/15 text-white shadow-sm transition-colors hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/60"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary-soft/40 px-4 py-2.5">
              <span className="rounded-full bg-[hsl(var(--primary)/0.12)] px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--primary))]">{selected.size} seçili</span>
              <Button variant="primary" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setTemplateMessageIds(Array.from(selected))}>
                SMS / Bildirim Gönder
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Seçimi Temizle</Button>
            </div>
          )}

          <div className="px-4 pt-3 space-y-2">
            <FacilityMemberTransferPanel
              groups={[{ id: groupId, name: groupName, type: groupType, periodType, periodStart, periodMonths }]}
              service={service}
              onDone={load}
            />
            <BulkImportPanel groupId={groupId} service={service} onDone={load} groupType={groupType} />
          </div>

          <div className="px-4 pt-4 pb-5 space-y-3">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-48 w-full" />

                <Skeleton className="h-32 w-full" />
              </div>
            ) : roster.length === 0 ? (
              <EmptyState icon={UsersIcon} title="Kayıt yok" description="Bu grupta kayıtlı katılımcı bulunmuyor." />
            ) : (
              <>
                {pending.length > 0 && (
                  <PendingSection
                    items={pending}
                    onApprove={promote}
                    onRemove={setRemoveTarget}
                    busy={busy}
                    selected={selected}
                    onToggle={toggleOne}
                  />
                )}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <MainSection
                    count={main.length}
                    capLabel={capacity > 0 ? `/${capacity.toLocaleString('tr-TR')}` : ''}
                    items={main}
                    onRemove={setRemoveTarget}
                    onDemote={demote}
                    onHistory={setHistoryTarget}
                    busy={busy}
                    selected={selected}
                    onToggle={toggleOne}
                  />
                  <ReserveSection
                    items={reserve}
                    onPromote={promote}
                    onRemove={setRemoveTarget}
                    onMoveUp={(r) => reorder(r.id, 'up')}
                    onMoveDown={(r) => reorder(r.id, 'down')}
                    onReorderDrop={reorderByDrop}
                    onHistory={setHistoryTarget}
                    busy={busy}
                    canReorder={isSuperAdmin}
                    selected={selected}
                    onToggle={toggleOne}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
        title="Programdan Çıkar"
        description={removeTarget ? `${removeTarget.fullName} programdan çıkarılsın mı? Asıl bir kayıt çıkarılırsa ilk yedek otomatik asıla alınır.` : ''}
        tone="danger"
        loading={busy}
      />

      <FacilitySendMessageModal
        open={!!templateMessageIds}
        module={module}
        target="registration"
        ids={templateMessageIds ?? []}
        service={service}
        onClose={() => setTemplateMessageIds(null)}
        onSent={load}
      />

      {historyTarget && (
        <AttendanceHistoryModal
          open={!!historyTarget}
          onClose={() => setHistoryTarget(null)}
          service={service}
          registrationId={historyTarget.id}
          participantName={historyTarget.fullName}
          onRevised={load}
        />
      )}
    </>
  )
}
