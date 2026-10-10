import { useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2Icon, ClockIcon, SearchIcon, XCircleIcon } from 'lucide-react'
import { Avatar, Badge, BulkActions, Checkbox, Input, type BulkAction } from '@/design-system'
import { cn } from '@/lib/utils'

/** Yoklama tablosu (tesis + gezi ortak): satır/tümünü seç, seçilenlere toplu durum, arama, durum sayaçları. */
export type AttendanceMark = 'present' | 'late' | 'absent'

export interface AttendanceTableRow {
  id: string
  name: string
  /** İsmin altındaki ikincil bilgi (TC, devamsızlık vb.) */
  meta?: ReactNode
  /** İsmin yanındaki rozetler (Yedek, QR ile giriş vb.) */
  badges?: ReactNode
}

interface Props {
  rows: AttendanceTableRow[]
  marks: Record<string, AttendanceMark | 'none'>
  onChange: (ids: string[], status: AttendanceMark) => void
  editable: boolean
  lateEnabled?: boolean
}

const markOf = (m: AttendanceMark | 'none' | undefined): AttendanceMark => (m && m !== 'none' ? m : 'absent')

const STATUS: Record<AttendanceMark, { label: string; icon: typeof CheckCircle2Icon; tone: 'success' | 'warning' | 'danger'; active: string }> = {
  present: { label: 'Geldi', icon: CheckCircle2Icon, tone: 'success', active: 'bg-[hsl(var(--success))] text-white border-[hsl(var(--success))]' },
  late: { label: 'Geç', icon: ClockIcon, tone: 'warning', active: 'bg-[hsl(var(--warning))] text-white border-[hsl(var(--warning))]' },
  absent: { label: 'Gelmedi', icon: XCircleIcon, tone: 'danger', active: 'bg-[hsl(var(--danger))] text-white border-[hsl(var(--danger))]' },
}

export const AttendanceTable = ({ rows, marks, onChange, editable, lateEnabled = true }: Props) => {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const statuses: AttendanceMark[] = lateEnabled ? ['present', 'late', 'absent'] : ['present', 'absent']

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    return q ? rows.filter((r) => r.name.toLocaleLowerCase('tr').includes(q)) : rows
  }, [rows, query])

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0 }
    rows.forEach((r) => { c[markOf(marks[r.id])]++ })
    return c
  }, [rows, marks])

  const visibleSelected = visible.filter((r) => selected.has(r.id)).length
  const allState: boolean | 'indeterminate' =
    visible.length > 0 && visibleSelected === visible.length ? true : visibleSelected > 0 ? 'indeterminate' : false

  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s)
      if (allState === true) visible.forEach((r) => next.delete(r.id))
      else visible.forEach((r) => next.add(r.id))
      return next
    })

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const bulk: BulkAction[] = statuses.map((st) => ({
    key: st,
    label: `${STATUS[st].label} işaretle`,
    icon: STATUS[st].icon,
    tone: STATUS[st].tone,
    onClick: () => { onChange([...selected], st); setSelected(new Set()) },
  }))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {statuses.map((st) => (
            <Badge key={st} tone={STATUS[st].tone}>{STATUS[st].label}: {counts[st]}</Badge>
          ))}
          <Badge tone="neutral">Toplam: {rows.length}</Badge>
        </div>
        <Input
          size="sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="İsim ara…"
          iconLeft={<SearchIcon className="h-4 w-4" />}
          className="w-full sm:w-56"
          aria-label="Katılımcı ara"
        />
      </div>

      {editable && <BulkActions count={selected.size} actions={bulk} onClear={() => setSelected(new Set())} />}

      <div className="overflow-hidden rounded-card border border-border bg-white">
        <div className="max-h-[52vh] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface-1">
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
                {editable && (
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox checked={allState} onCheckedChange={toggleAll} aria-label="Tümünü seç" disabled={visible.length === 0} />
                  </th>
                )}
                <th className="px-3 py-2.5">Katılımcı</th>
                <th className="px-3 py-2.5 text-right">Durum</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-8 text-center type-caption">Aramayla eşleşen katılımcı yok.</td></tr>
              )}
              {visible.map((r) => {
                const mark = markOf(marks[r.id])
                const isSel = selected.has(r.id)
                return (
                  <tr key={r.id} className={cn('border-b border-border last:border-0 transition-colors', isSel ? 'bg-[hsl(var(--primary-soft))]' : 'hover:bg-surface-1')}>
                    {editable && (
                      <td className="px-3 py-2.5">
                        <Checkbox checked={isSel} onCheckedChange={() => toggle(r.id)} aria-label={`${r.name} seç`} />
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={r.name} size="sm" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="type-body-strong truncate">{r.name}</span>
                            {r.badges}
                          </div>
                          {r.meta && <div className="mt-0.5 flex flex-wrap items-center gap-1.5">{r.meta}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {editable ? (
                        <div role="radiogroup" aria-label={`${r.name} durumu`} className="inline-flex gap-1">
                          {statuses.map((st) => (
                            <button
                              key={st}
                              type="button"
                              role="radio"
                              aria-checked={mark === st}
                              onClick={() => onChange([r.id], st)}
                              className={cn(
                                'h-8 min-h-0 rounded-field border px-2.5 text-xs font-semibold transition-colors',
                                mark === st ? STATUS[st].active : 'border-border bg-white text-foreground-muted hover:bg-surface-1',
                              )}
                            >
                              {STATUS[st].label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Badge tone={STATUS[mark].tone}>{STATUS[mark].label}</Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
