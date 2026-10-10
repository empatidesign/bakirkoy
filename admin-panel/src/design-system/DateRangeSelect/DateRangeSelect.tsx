import { useState } from 'react'
import { CalendarRangeIcon } from 'lucide-react'
import { Select } from '@/design-system/Select'
import { DatePicker } from '@/design-system/DatePicker'
import { cn } from '@/lib/utils'

export type DateRangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom'

export interface DateRangeValue {
  preset: DateRangePreset
  from?: string
  to?: string
}

export interface DateRangeSelectProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  className?: string
}

export const DATE_RANGE_PRESET_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Bugün' },
  { value: 'yesterday', label: 'Dün' },
  { value: 'week', label: 'Bu Hafta' },
  { value: 'month', label: 'Bu Ay' },
  { value: 'year', label: 'Bu Yıl' },
  { value: 'custom', label: 'Özel Tarih Aralığı' },
]

const todayIso = () => new Date().toISOString().slice(0, 10)

export const DateRangeSelect = ({ value, onChange, className }: DateRangeSelectProps) => {
  const [customFrom, setCustomFrom] = useState(value.from ?? todayIso())
  const [customTo, setCustomTo] = useState(value.to ?? todayIso())

  const setPreset = (preset: string) => {
    if (preset === 'custom') {
      onChange({ preset: 'custom', from: customFrom, to: customTo })
    } else {
      onChange({ preset: preset as DateRangePreset })
    }
  }

  const setFrom = (v: string) => {
    setCustomFrom(v)
    onChange({ preset: 'custom', from: v, to: customTo })
  }
  const setTo = (v: string) => {
    setCustomTo(v)
    onChange({ preset: 'custom', from: customFrom, to: v })
  }

  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center', className)}>
      <div className="flex items-center gap-2">
        <span className="flex h-[var(--control-h)] w-6 shrink-0 items-center justify-center text-foreground-muted">
          <CalendarRangeIcon className="h-4 w-4" />
        </span>
        <div className="w-[180px]">
          <Select value={value.preset} onChange={(e) => setPreset(e.target.value)}>
            {DATE_RANGE_PRESET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </div>
      {value.preset === 'custom' && (
        <div className="flex items-center gap-2">
          <div className="w-[140px]"><DatePicker value={customFrom} onChange={setFrom} max={customTo} clearable={false} /></div>
          <span className="type-muted">—</span>
          <div className="w-[140px]"><DatePicker value={customTo} onChange={setTo} min={customFrom} clearable={false} /></div>
        </div>
      )}
    </div>
  )
}
