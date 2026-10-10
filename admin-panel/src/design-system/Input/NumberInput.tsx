import { forwardRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Input, type InputProps } from './Input'

export interface NumberInputProps extends Omit<InputProps, 'onChange' | 'value' | 'sanitize' | 'type'> {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  suffix?: string
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, min, max, suffix, className, onBlur, onFocus, ...rest }, ref) => {
    const [draft, setDraft] = useState<string | null>(null)

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.select()
      onFocus?.(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      if (raw === '') {
        setDraft('')
        return
      }
      let n = Number(raw)
      if (Number.isNaN(n)) return
      if (typeof max === 'number' && n > max) n = max
      setDraft(String(n))
      onChange(n)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      let n: number
      if (draft === '' || draft === null) {
        n = draft === '' ? (typeof min === 'number' ? min : 0) : Number(value)
      } else {
        n = Number(draft)
      }
      if (Number.isNaN(n)) n = typeof min === 'number' ? min : 0
      if (typeof max === 'number' && n > max) n = max
      if (typeof min === 'number' && n < min) n = min
      onChange(n)
      setDraft(null)
      onBlur?.(e)
    }

    const display = draft ?? String(value)

    const field = (
      <Input
        ref={ref}
        sanitize="digits"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        className={cn(suffix && 'pr-12', className)}
        {...rest}
      />
    )
    if (!suffix) return field
    return (
      <div className="relative">
        {field}
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center type-caption text-foreground-muted">{suffix}</span>
      </div>
    )
  },
)

NumberInput.displayName = 'NumberInput'
