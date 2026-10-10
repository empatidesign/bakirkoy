import { forwardRef, useState } from 'react'
import { FingerprintIcon } from 'lucide-react'
import { Input, type InputProps } from './Input'

export const isValidTckn = (value: string): boolean => {
  const d = value.replace(/\D/g, '')
  if (d.length !== 11 || d[0] === '0') return false
  const n = d.split('').map(Number)
  const oddSum = n[0] + n[2] + n[4] + n[6] + n[8]
  const evenSum = n[1] + n[3] + n[5] + n[7]
  if (((oddSum * 7 - evenSum) % 10 + 10) % 10 !== n[9]) return false
  const firstTen = n.slice(0, 10).reduce((acc, cur) => acc + cur, 0)
  return firstTen % 10 === n[10]
}

export interface TcknInputProps extends Omit<InputProps, 'onChange' | 'value' | 'sanitize' | 'type'> {
  value: string
  onChange: (digits: string) => void
}

export const TcknInput = forwardRef<HTMLInputElement, TcknInputProps>(
  ({ value, onChange, onBlur, error, iconLeft, placeholder = '11 haneli T.C. kimlik no', ...props }, ref) => {
    const [touched, setTouched] = useState(false)
    const invalid = touched && value.length === 11 && !isValidTckn(value)
    const incomplete = touched && value.length > 0 && value.length < 11
    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        sanitize="digits"
        maxLength={11}
        value={value}
        placeholder={placeholder}
        iconLeft={iconLeft ?? <FingerprintIcon className="h-3.5 w-3.5" />}
        error={error ?? (invalid ? 'Geçersiz T.C. kimlik numarası.' : incomplete ? 'T.C. kimlik no 11 haneli olmalıdır.' : undefined)}
        onChange={e => onChange(e.target.value)}
        onBlur={e => { setTouched(true); onBlur?.(e) }}
        {...props}
      />
    )
  }
)

TcknInput.displayName = 'TcknInput'
