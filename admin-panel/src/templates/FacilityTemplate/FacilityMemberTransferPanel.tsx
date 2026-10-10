import { useState } from 'react'
import { toast } from 'sonner'
import {
  XIcon, Loader2Icon, CheckCircle2Icon, XCircleIcon, SearchXIcon, AlertCircleIcon, ClockIcon,
  UserIcon, UsersIcon, ShuffleIcon, UserCheckIcon, UserPlusIcon,
} from 'lucide-react'
import { Button, IconButton, Textarea, Badge, Select, SegmentedControl, TcknInput, isValidTckn, Modal } from '@/design-system'
import type { FacilityModuleService } from './types'
import type { BulkPreRegisterResult, RegistrationTarget } from '@/types/facility.types'

// Kullanıcı isteği (2026-10-06): Kadın-Aile ve diğer tesis modüllerinde gruplara/seanslara TC kimlik
// numarasıyla tek tek veya toplu üye aktarımı yapılabilsin; yedek listeye de aynı şekilde eklenebilsin.
// Aynı panel tek grup (Kayıtlar ve Yedekler modalı) ve çoklu grup (Gruplar / Seans Takvimi toplu işlem)
// için kullanılır: seçilen TC listesi her gruba sırayla aktarılır.

export interface MemberTransferGroup {
  id: string
  name: string
  type?: string
  periodType?: string | null
  periodStart?: string | null
  periodMonths?: number | null
}

export const STATUS_META: Record<BulkPreRegisterResult['rows'][number]['status'], { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral'; icon: typeof CheckCircle2Icon }> = {
  registered: { label: 'Asıl olarak eklendi', tone: 'success', icon: CheckCircle2Icon },
  waitlisted: { label: 'Yedeğe eklendi', tone: 'warning', icon: ClockIcon },
  already_registered: { label: 'Zaten kayıtlı', tone: 'neutral', icon: AlertCircleIcon },
  not_found: { label: 'Sistemde bu TC ile katılımcı yok', tone: 'danger', icon: SearchXIcon },
  invalid: { label: 'Geçersiz TC (11 hane değil)', tone: 'danger', icon: XCircleIcon },
  failed: { label: 'Eklenemedi', tone: 'danger', icon: XCircleIcon },
}

const TONE_TEXT: Record<'success' | 'warning' | 'danger' | 'neutral', string> = {
  success: 'text-[hsl(var(--success))]',
  warning: 'text-[hsl(var(--warning))]',
  danger: 'text-[hsl(var(--danger))]',
  neutral: 'text-foreground-muted',
}

export const TARGET_OPTIONS = [
  { value: 'auto', label: 'Otomatik', description: 'Asıl dolarsa yedeğe', icon: ShuffleIcon },
  { value: 'main', label: 'Asıl Liste', description: 'Doluysa eklenmez', icon: UserCheckIcon, tone: 'green' as const },
  { value: 'reserve', label: 'Yedek Liste', description: 'Yedeğin sonuna', icon: UserPlusIcon, tone: 'orange' as const },
]

const addMonths = (d: Date, m: number) => {
  const r = new Date(d)
  r.setMonth(r.getMonth() + m)
  return r
}
const fmtTr = (d: Date) => d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const toIso = (d: Date) => d.toISOString().slice(0, 10)

const recurringPeriods = (startIso?: string | null, months?: number): { index: number; start: string; end: string; startIso: string }[] => {
  if (!startIso || !months || months <= 0) return []
  const start = new Date(`${startIso}T00:00:00`)
  if (Number.isNaN(start.getTime())) return []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let current = 0
  while (addMonths(start, (current + 1) * months) <= today && current < 240) current++
  const count = Math.min(current + 2, 60)
  const out: { index: number; start: string; end: string; startIso: string }[] = []
  for (let i = 0; i < count; i++) {
    const ps = addMonths(start, i * months)
    const pe = addMonths(start, (i + 1) * months)
    pe.setDate(pe.getDate() - 1)
    out.push({ index: i + 1, start: fmtTr(ps), end: fmtTr(pe), startIso: toIso(ps) })
  }
  return out
}

export const parseTcknList = (raw: string) => raw.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean)

export const ResultList = ({ result }: { result: BulkPreRegisterResult }) => (
  <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Badge tone="success">{result.registered} asıl eklendi</Badge>
      {result.waitlisted > 0 && <Badge tone="warning">{result.waitlisted} yedeğe eklendi</Badge>}
      {result.alreadyRegistered > 0 && <Badge tone="neutral">{result.alreadyRegistered} zaten kayıtlı</Badge>}
      {result.notFound > 0 && <Badge tone="danger">{result.notFound} TC sistemde yok</Badge>}
      {result.failed > 0 && <Badge tone="danger">{result.failed} hata</Badge>}
    </div>
    <div className="max-h-48 overflow-y-auto rounded-md border border-border/60">
      {result.rows.map((row, i) => {
        const meta = STATUS_META[row.status] ?? STATUS_META.failed
        const Icon = meta.icon
        return (
          <div key={`${row.tckn}-${i}`} className="flex items-center gap-2 border-b border-border/40 px-3 py-1.5 last:border-b-0">
            <Icon className={`h-3.5 w-3.5 shrink-0 ${TONE_TEXT[meta.tone]}`} />
            <span className="text-xs font-medium tabular-nums text-foreground-strong">{row.tckn}</span>
            {row.fullName && <span className="text-xs text-foreground-muted truncate">{row.fullName}</span>}
            <span className="ml-auto text-[11px] text-foreground-muted shrink-0">{row.reason ?? meta.label}</span>
          </div>
        )
      })}
    </div>
  </div>
)

interface PanelProps {
  groups: MemberTransferGroup[]
  service: FacilityModuleService
  onDone: () => void
  /** Kapalı başlayıp "TC ile Üye Ekle" butonu gösterir; false ise doğrudan açık render edilir (modal içinde). */
  collapsible?: boolean
  onClose?: () => void
}

export const FacilityMemberTransferPanel = ({ groups, service, onDone, collapsible = true, onClose }: PanelProps) => {
  const [open, setOpen] = useState(!collapsible)
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [target, setTarget] = useState<RegistrationTarget>('auto')
  const [single, setSingle] = useState('')
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [results, setResults] = useState<{ group: MemberTransferGroup; result: BulkPreRegisterResult | null; error?: string }[]>([])
  const [selectedPeriodStart, setSelectedPeriodStart] = useState('')

  const only = groups.length === 1 ? groups[0] : null
  const periods = only?.periodType === 'recurring' ? recurringPeriods(only.periodStart, only.periodMonths ?? undefined) : []
  const hasAkademi = groups.some((g) => g.type === 'akademi')

  const tckns = mode === 'single' ? (single ? [single] : []) : parseTcknList(raw)
  const singleInvalid = mode === 'single' && (single.length !== 11 || !isValidTckn(single))
  const canSubmit = !busy && groups.length > 0 && tckns.length > 0 && !(mode === 'single' && singleInvalid)

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setResults([])
    const out: typeof results = []
    let added = 0
    let reserved = 0
    let problems = 0
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]
      if (groups.length > 1) setProgress(`${i + 1}/${groups.length}: ${g.name}`)
      try {
        const res = await service.registrations.bulkPreRegister(g.id, tckns, only ? selectedPeriodStart || undefined : undefined, target)
        out.push({ group: g, result: res })
        added += res.registered
        reserved += res.waitlisted
        problems += res.notFound + res.failed
      } catch {
        out.push({ group: g, result: null, error: 'Aktarım başarısız oldu.' })
        problems += tckns.length
      }
    }
    setResults(out)
    setProgress(null)
    setBusy(false)
    if (added + reserved > 0) {
      toast.success(`${added} asıl, ${reserved} yedek olmak üzere ${added + reserved} kayıt eklendi.`)
      if (mode === 'single') setSingle('')
      onDone()
    }
    if (problems > 0) toast.warning(`${problems} kayıt işlenemedi, aşağıdaki listeden inceleyin.`)
  }

  const reset = () => {
    setRaw(''); setSingle(''); setResults([]); setSelectedPeriodStart(''); setTarget('auto')
    if (collapsible) setOpen(false)
    onClose?.()
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" iconLeft={<UserPlusIcon className="h-4 w-4" />} onClick={() => setOpen(true)}>
        TC ile Üye / Yedek Ekle
      </Button>
    )
  }

  return (
    <div className="w-full rounded-lg border border-border bg-[hsl(var(--card))] p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground-strong">TC Kimlik ile Üye Aktarımı</p>
          <p className="text-[11px] text-foreground-muted">
            Sistemde kayıtlı katılımcıları TC kimlik numarasıyla tek tek veya toplu olarak asıl ya da yedek listeye ekleyin.
            Kişiler tekrar başvurmaz; yaş/ikamet, katılım limiti ve aynı gün çakışma kuralları yine uygulanır.
            {groups.length > 1 && ` Seçili ${groups.length} grubun her birine aynı liste aktarılır.`}
          </p>
        </div>
        {(collapsible || onClose) && (
          <IconButton tone="default" title="Kapat" onClick={reset}><XIcon className="h-4 w-4" /></IconButton>
        )}
      </div>

      {groups.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {groups.map((g) => <Badge key={g.id} tone="neutral">{g.name}</Badge>)}
        </div>
      )}

      <div className="mb-3 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <p className="mb-1 text-[11px] font-medium text-foreground-muted">Ekleme şekli</p>
          <SegmentedControl
            value={mode}
            onChange={(v) => setMode(v as 'single' | 'bulk')}
            disabled={busy}
            columns={2}
            options={[
              { value: 'single', label: 'Tek TC', icon: UserIcon },
              { value: 'bulk', label: 'Toplu TC', icon: UsersIcon },
            ]}
          />
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium text-foreground-muted">Hangi listeye eklensin?</p>
          <SegmentedControl value={target} onChange={(v) => setTarget(v as RegistrationTarget)} disabled={busy} columns={3} options={TARGET_OPTIONS} />
        </div>
      </div>

      {target === 'reserve' && hasAkademi && (
        <p className="mb-3 text-[11px] text-[hsl(var(--warning))]">Akademi gruplarında yedek liste yoktur; bu gruplara yedek ekleme yapılamaz.</p>
      )}

      {periods.length > 0 && (
        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-medium text-foreground-muted">
            Hangi dönemde/yılda başlamışlarsa o dönemi seçin (boş bırakılırsa güncel dönem kullanılır)
          </label>
          <Select value={selectedPeriodStart} onChange={(e) => setSelectedPeriodStart(e.target.value)} disabled={busy}>
            <option value="">Güncel dönem (bugün)</option>
            {periods.map((p) => (
              <option key={p.startIso} value={p.startIso}>{p.index}. Dönem — {p.start} – {p.end}</option>
            ))}
          </Select>
        </div>
      )}

      {mode === 'single' ? (
        <TcknInput value={single} onChange={setSingle} disabled={busy} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
      ) : (
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={'12345678901\n23456789012\n34567890123'}
          rows={4}
          disabled={busy}
        />
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-foreground-muted">
          {progress ?? (mode === 'bulk' && tckns.length > 0 ? `${tckns.length} TC algılandı` : '')}
        </span>
        <Button size="sm" onClick={submit} disabled={!canSubmit} iconLeft={busy ? <Loader2Icon className="h-4 w-4 animate-spin" /> : undefined}>
          {busy
            ? 'Ekleniyor...'
            : `${mode === 'bulk' && tckns.length ? `${tckns.length} Kişiyi ` : ''}${target === 'reserve' ? 'Yedeğe Ekle' : target === 'main' ? 'Asıla Ekle' : 'Ekle'}`}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {results.map(({ group, result, error }) => (
            <div key={group.id} className="space-y-1.5">
              {results.length > 1 && <p className="text-xs font-semibold text-foreground-strong">{group.name}</p>}
              {result ? <ResultList result={result} /> : <p className="text-xs text-[hsl(var(--danger))]">{error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Gruplar / Seans Takvimi toplu işlemi: seçili gruplara TC ile üye/yedek aktarımı. */
export const FacilityMemberTransferModal = ({ open, onClose, groups, service, onDone }: {
  open: boolean
  onClose: () => void
  groups: MemberTransferGroup[]
  service: FacilityModuleService
  onDone?: () => void
}) => (
  <Modal
    open={open}
    onClose={onClose}
    width={760}
    title="TC ile Üye / Yedek Aktar"
    subtitle={groups.length === 1 ? groups[0].name : `${groups.length} grup seçili`}
    footer={<div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Kapat</Button></div>}
  >
    {open && <FacilityMemberTransferPanel groups={groups} service={service} onDone={onDone ?? (() => {})} collapsible={false} />}
  </Modal>
)
