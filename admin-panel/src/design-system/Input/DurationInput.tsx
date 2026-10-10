import { NumberInput } from './NumberInput'

export interface DurationInputProps {
  value: number
  onChange: (minutes: number) => void
  maxHours?: number
  disabled?: boolean
}

export const DurationInput = ({ value, onChange, maxHours = 23, disabled }: DurationInputProps) => {
  const total = Math.max(0, value || 0)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  const emit = (h: number, m: number) => onChange(Math.max(0, h) * 60 + Math.min(59, Math.max(0, m)))

  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberInput value={hours} onChange={(h) => emit(h, minutes)} min={0} max={maxHours} suffix="saat" disabled={disabled} />
      <NumberInput value={minutes} onChange={(m) => emit(hours, m)} min={0} max={59} suffix="dk" disabled={disabled} />
    </div>
  )
}
