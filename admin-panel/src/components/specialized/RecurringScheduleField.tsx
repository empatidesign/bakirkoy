import { PlusIcon, XIcon, AlertTriangleIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Field, IconButton, TimePicker, ToggleChip } from '@/design-system'

interface WorkingHours {
  weekdayOpen: string
  weekdayClose: string
  weekendOpen: string
  weekendClose: string
}

export interface DaySlot {
  startTime: string
  endTime: string
}

export interface DayPlan {
  day: string
  slots: DaySlot[]
}

interface Props {
  value: DayPlan[]
  onChange: (value: DayPlan[]) => void
  workingHours?: WorkingHours | null
  disabled?: boolean
  singleSlotPerDay?: boolean
}

export const WEEK_DAYS = [
  { key: 'monday', short: 'Pzt', label: 'Pazartesi' },
  { key: 'tuesday', short: 'Sal', label: 'Salı' },
  { key: 'wednesday', short: 'Çar', label: 'Çarşamba' },
  { key: 'thursday', short: 'Per', label: 'Perşembe' },
  { key: 'friday', short: 'Cum', label: 'Cuma' },
  { key: 'saturday', short: 'Cmt', label: 'Cumartesi' },
  { key: 'sunday', short: 'Paz', label: 'Pazar' },
]

const WEEKEND = new Set(['saturday', 'sunday'])

// Kullanıcı isteği (2026-10-07): "sultanşehirden olan izler burda olmasın" —
// 7 günlük rastgele mavi/violet/emerald/turuncu/rose/amber/gri rainbow paleti
// kaldırıldı. Kodda zaten hafta içi/hafta sonu için farklı çalışma saatleri
// ayrımı var (bkz. hoursFor); renk de bu anlamlı ayrımı yansıtıyor:
// hafta içi = kurumsal lacivert, hafta sonu = logo yeşili.
const DAY_TONE: Record<string, string> = {
  monday: 'text-[#0f4c81]', tuesday: 'text-[#0f4c81]', wednesday: 'text-[#0f4c81]',
  thursday: 'text-[#0f4c81]', friday: 'text-[#0f4c81]',
  saturday: 'text-[#5a8a2a]', sunday: 'text-[#5a8a2a]',
}
const DAY_DOT: Record<string, string> = {
  monday: 'bg-[#0f4c81]', tuesday: 'bg-[#0f4c81]', wednesday: 'bg-[#0f4c81]',
  thursday: 'bg-[#0f4c81]', friday: 'bg-[#0f4c81]',
  saturday: 'bg-[#5a8a2a]', sunday: 'bg-[#5a8a2a]',
}
export const DAY_CHIP: Record<string, string> = {
  monday:    'border-[#0f4c81]/20 bg-[#eef3f8] text-[#0f4c81]',
  tuesday:   'border-[#0f4c81]/20 bg-[#eef3f8] text-[#0f4c81]',
  wednesday: 'border-[#0f4c81]/20 bg-[#eef3f8] text-[#0f4c81]',
  thursday:  'border-[#0f4c81]/20 bg-[#eef3f8] text-[#0f4c81]',
  friday:    'border-[#0f4c81]/20 bg-[#eef3f8] text-[#0f4c81]',
  saturday:  'border-[#5a8a2a]/20 bg-[#f1f7e8] text-[#5a8a2a]',
  sunday:    'border-[#5a8a2a]/20 bg-[#f1f7e8] text-[#5a8a2a]',
}

const addHour = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${String(Math.min(23, (h || 0) + 1)).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`
}

const hoursFor = (hours: WorkingHours | null | undefined, dayKey: string) => {
  if (!hours) return null
  const open = WEEKEND.has(dayKey) ? hours.weekendOpen : hours.weekdayOpen
  const close = WEEKEND.has(dayKey) ? hours.weekendClose : hours.weekdayClose
  return open && close ? { open, close } : null
}

const slotWarn = (hours: WorkingHours | null | undefined, dayKey: string, slot: DaySlot) => {
  const h = hoursFor(hours, dayKey)
  if (!h) return null
  return slot.startTime < h.open || slot.endTime > h.close
    ? `Çalışma saatleri dışında (${h.open}-${h.close})`
    : null
}

// 2026-08-02 kullanıcı bildirimi: tekrarlı seans üretiminde de her gün için saat
// aralıklarında bitişin başlangıçtan sonra olduğu kontrol edilmiyordu.
const slotInvalid = (slot: DaySlot) =>
  !!slot.startTime && !!slot.endTime && slot.endTime <= slot.startTime

export const RecurringScheduleField = ({ value, onChange, workingHours, disabled, singleSlotPerDay }: Props) => {
  const dayActive = (day: string) => value.some((p) => p.day === day)

  const toggleDay = (day: string) => {
    if (value.some((p) => p.day === day)) {
      onChange(value.filter((p) => p.day !== day))
    } else {
      onChange([...value, { day, slots: [{ startTime: '09:00', endTime: '10:00' }] }])
    }
  }

  const addSlot = (day: string) =>
    onChange(value.map((p) => {
      if (p.day !== day) return p
      const start = p.slots[p.slots.length - 1]?.endTime ?? '09:00'
      return { ...p, slots: [...p.slots, { startTime: start, endTime: addHour(start) }] }
    }))

  const updateSlot = (day: string, idx: number, patch: Partial<DaySlot>) =>
    onChange(value.map((dp) => dp.day === day
      ? { ...dp, slots: dp.slots.map((s, i) => i === idx ? { ...s, ...patch } : s) }
      : dp))

  const removeSlot = (day: string, idx: number) =>
    onChange(value.map((dp) => dp.day === day
      ? { ...dp, slots: dp.slots.filter((_, i) => i !== idx) }
      : dp))

  return (
    <div className="space-y-3 rounded-card border border-border bg-surface-1 p-3">
      <Field label="Günler ve Saat Aralıkları" required hint={singleSlotPerDay ? 'Gün seçince o günün saat aralığını belirleyin' : 'Gün seçince o güne özel saat aralıkları ekleyin'}>
        <div className="flex flex-wrap gap-2">
          {WEEK_DAYS.map((d) => (
            <ToggleChip
              key={d.key}
              active={dayActive(d.key)}
              onClick={() => { if (!disabled) toggleDay(d.key) }}
              className={dayActive(d.key) ? DAY_CHIP[d.key] : undefined}
            >
              {d.short}
            </ToggleChip>
          ))}
        </div>
      </Field>
      {WEEK_DAYS.filter((d) => dayActive(d.key)).map((d) => {
        const plan = value.find((p) => p.day === d.key)
        if (!plan) return null
        return (
          <div key={d.key} className="space-y-2 rounded-card border border-border bg-surface-0 p-3">
            <div className="flex items-center justify-between">
              <p className={cn('flex items-center gap-2 type-body-strong', DAY_TONE[d.key])}>
                <span className={cn('h-2.5 w-2.5 rounded-full', DAY_DOT[d.key])} /> {d.label}
              </p>
              {!disabled && !singleSlotPerDay && (
                <Button variant="ghost" size="sm" onClick={() => addSlot(d.key)}>
                  <PlusIcon className="h-4 w-4" /> Saat Ekle
                </Button>
              )}
            </div>
            {plan.slots.map((slot, idx) => {
              const warn = slotWarn(workingHours, d.key, slot)
              const invalid = slotInvalid(slot)
              return (
                <div key={idx} className="flex items-center gap-2">
                  <TimePicker value={slot.startTime} onChange={(v) => updateSlot(d.key, idx, { startTime: v })} disabled={disabled} />
                  <span className="type-muted">—</span>
                  <TimePicker value={slot.endTime} onChange={(v) => updateSlot(d.key, idx, { endTime: v })} disabled={disabled} />
                  {invalid && (
                    <span title="Bitiş saati başlangıç saatinden sonra olmalıdır." className="text-[hsl(var(--danger))]">
                      <AlertTriangleIcon className="h-4 w-4" />
                    </span>
                  )}
                  {!invalid && warn && (
                    <span title={warn} className="text-[hsl(var(--warning))]">
                      <AlertTriangleIcon className="h-4 w-4" />
                    </span>
                  )}
                  {!disabled && !singleSlotPerDay && plan.slots.length > 1 && (
                    <IconButton tone="danger" title="Saat aralığını kaldır" onClick={() => removeSlot(d.key, idx)}>
                      <XIcon className="h-4 w-4" />
                    </IconButton>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
