import { PlusIcon, XIcon, AlertTriangleIcon } from 'lucide-react'
import { ToggleChip, TimePicker, Button, IconButton } from '@/design-system'
import { cn } from '@/lib/utils'

export interface ScheduleSlot {
  startTime: string
  endTime: string
}

export interface DaySchedule {
  day: string
  slots: ScheduleSlot[]
}

export interface WeekdayDef {
  key: string
  label: string
  short: string
  chipClass?: string
  toneClass?: string
  dotClass?: string
}

export const TR_WEEKDAYS: WeekdayDef[] = [
  { key: 'Pazartesi', label: 'Pazartesi', short: 'Pazartesi' },
  { key: 'Salı', label: 'Salı', short: 'Salı' },
  { key: 'Çarşamba', label: 'Çarşamba', short: 'Çarşamba' },
  { key: 'Perşembe', label: 'Perşembe', short: 'Perşembe' },
  { key: 'Cuma', label: 'Cuma', short: 'Cuma' },
  { key: 'Cumartesi', label: 'Cumartesi', short: 'Cumartesi' },
  { key: 'Pazar', label: 'Pazar', short: 'Pazar' },
]

const addHour = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${String(Math.min(23, (h || 0) + 1)).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`
}

interface Props {
  value: DaySchedule[]
  onChange: (next: DaySchedule[]) => void
  weekdays?: WeekdayDef[]
  multiSlot?: boolean
  disabled?: boolean
  slotWarning?: (dayKey: string, slot: ScheduleSlot) => string | null
  defaultSlot?: ScheduleSlot
  emptyHint?: string
}

export const WeeklyScheduleField = ({
  value, onChange, weekdays = TR_WEEKDAYS, multiSlot, disabled,
  slotWarning, defaultSlot = { startTime: '09:00', endTime: '10:00' },
  emptyHint = 'Gün seçildiğinde saat aralıkları burada görünür.',
}: Props) => {
  const isActive = (key: string) => value.some((p) => p.day === key)

  const toggleDay = (key: string) =>
    onChange(isActive(key)
      ? value.filter((p) => p.day !== key)
      : [...value, { day: key, slots: [{ ...defaultSlot }] }])

  const addSlot = (key: string) =>
    onChange(value.map((p) => {
      if (p.day !== key) return p
      const start = p.slots[p.slots.length - 1]?.endTime ?? defaultSlot.startTime
      return { ...p, slots: [...p.slots, { startTime: start, endTime: addHour(start) }] }
    }))

  const updateSlot = (key: string, idx: number, patch: Partial<ScheduleSlot>) =>
    onChange(value.map((p) => p.day === key ? { ...p, slots: p.slots.map((s, i) => i === idx ? { ...s, ...patch } : s) } : p))

  const removeSlot = (key: string, idx: number) =>
    onChange(value.map((p) => p.day === key ? { ...p, slots: p.slots.filter((_, i) => i !== idx) } : p))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {weekdays.map((d) => (
          <ToggleChip
            key={d.key}
            active={isActive(d.key)}
            disabled={disabled}
            onClick={() => toggleDay(d.key)}
            className={isActive(d.key) ? d.chipClass : undefined}
          >
            {d.short}
          </ToggleChip>
        ))}
      </div>

      {value.length === 0 ? (
        <p className="type-caption">{emptyHint}</p>
      ) : (
        weekdays.filter((d) => isActive(d.key)).map((d) => {
          const plan = value.find((p) => p.day === d.key)
          if (!plan) return null
          return (
            <div key={d.key} className="space-y-2 rounded-card border border-border bg-surface-0 p-3">
              <div className="flex items-center justify-between">
                <p className={cn('flex items-center gap-2 type-body-strong', d.toneClass)}>
                  {d.dotClass && <span className={cn('h-2.5 w-2.5 rounded-full', d.dotClass)} />}
                  {d.label}
                </p>
                {multiSlot && (
                  <Button variant="ghost" size="sm" disabled={disabled} onClick={() => addSlot(d.key)}>
                    <PlusIcon className="h-4 w-4" /> Saat Ekle
                  </Button>
                )}
              </div>
              {plan.slots.map((slot, idx) => {
                const warn = slotWarning?.(d.key, slot)
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <TimePicker value={slot.startTime} onChange={(v) => updateSlot(d.key, idx, { startTime: v })} disabled={disabled} />
                    <span className="type-muted">—</span>
                    <TimePicker value={slot.endTime} onChange={(v) => updateSlot(d.key, idx, { endTime: v })} disabled={disabled} />
                    {warn && <span title={warn} className="shrink-0 text-warning"><AlertTriangleIcon className="h-4 w-4" /></span>}
                    {multiSlot && plan.slots.length > 1 && (
                      <IconButton tone="danger" title="Saat aralığını kaldır" disabled={disabled} onClick={() => removeSlot(d.key, idx)}>
                        <XIcon className="h-4 w-4" />
                      </IconButton>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}
