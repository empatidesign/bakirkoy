import { cn } from '@/lib/utils'
import { Input } from '@/design-system/Input'

const DEFAULT_PRESETS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#ca8a04']
const HEX = /^#[0-9a-fA-F]{6}$/

export const isHexColor = (v: string) => HEX.test(v)

export interface ColorSwatchPickerProps {
  value: string
  onChange: (hex: string) => void
  presets?: string[]
  disabled?: boolean
  className?: string
}

export const ColorSwatchPicker = ({ value, onChange, presets = DEFAULT_PRESETS, disabled, className }: ColorSwatchPickerProps) => (
  <div className={cn('space-y-2', className)}>
    <div className="flex items-center gap-2">
      <span className="h-9 w-9 shrink-0 rounded-field border border-border" style={{ backgroundColor: HEX.test(value) ? value : 'transparent' }} />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#2563eb" className="font-mono" disabled={disabled} />
    </div>
    <div className="flex flex-wrap gap-2">
      {presets.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          onClick={() => onChange(c)}
          title={c}
          className={cn('h-6 w-6 rounded-field border border-border transition', value.toLowerCase() === c && 'ring-2 ring-[hsl(var(--ring))] ring-offset-1')}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  </div>
)
