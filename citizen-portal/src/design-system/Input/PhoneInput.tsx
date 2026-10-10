import { forwardRef } from 'react'
import { Input, type InputProps } from './Input'
import { formatPhone } from '@/lib/utils'

const normalize = (raw: string): string => {
  let d = raw.replace(/\D/g, '')
  // admin-panel/PhoneInput.tsx ile aynı düzeltme: ülke kodlu ("+905..."/"905...")
  // veya fazla haneli girdilerde son 10 haneye indirgenmeden başa '0' eklenip
  // sondan kırpma yapılırsa numara bozuk görünür. Bkz. AdminUserRepository yorumu
  // (telefonlar DB'de tek formatta değil) — aynı risk citizen tarafında da geçerli.
  if (d.length > 10) d = d.slice(-10)
  if (d.length > 0 && d[0] !== '0') d = '0' + d
  return d.slice(0, 11)
}

export interface PhoneInputProps extends Omit<InputProps, 'onChange' | 'value' | 'sanitize' | 'type'> {
  value: string
  onChange: (digits: string) => void
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, placeholder = '0(5XX) XXX XX XX', ...props }, ref) => (
    <Input
      ref={ref}
      type="tel"
      inputMode="numeric"
      placeholder={placeholder}
      value={value ? formatPhone(value) : ''}
      onChange={e => onChange(normalize(e.target.value))}
      {...props}
    />
  )
)

PhoneInput.displayName = 'PhoneInput'
