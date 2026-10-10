import { forwardRef } from 'react'
import { Input, type InputProps } from './Input'

const normalize = (raw: string): string => {
  let d = raw.replace(/\D/g, '')
  // Veritabanında telefonlar tek formatta değil: "5321002006", "05321002006",
  // "+905321002006" (ülke kodlu) hepsi mevcut (bkz. AdminUserRepository.GetByPhoneAsync
  // yorumu). Ülke kodu/fazla hane varsa son 10 haneye (alan kodu + numara) indirgenir,
  // ardından tek kanonik biçime (0XXXXXXXXXX) çevrilir — aksi halde "5xxxxxxxxxx" (11)
  // veya "905xxxxxxxxx" (12) gibi girdilerde başa fazladan '0' eklenip son haneler
  // kırpılıyor, düzenleme formunda numara eksik/bozuk görünüyordu.
  if (d.length > 10) d = d.slice(-10)
  if (d.length > 0 && d[0] !== '0') d = '0' + d
  return d.slice(0, 11)
}

const format = (raw: string): string => {
  const d = normalize(raw)
  if (d.length === 0) return ''
  const area = d.slice(1, 4)
  const p2 = d.slice(4, 7)
  const p3 = d.slice(7, 9)
  const p4 = d.slice(9, 11)
  let out = '0'
  if (area) out += `(${area}`
  if (area.length === 3) out += ')'
  if (p2) out += ` ${p2}`
  if (p3) out += ` ${p3}`
  if (p4) out += ` ${p4}`
  return out
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
      value={format(value)}
      onChange={e => onChange(normalize(e.target.value))}
      {...props}
    />
  )
)

PhoneInput.displayName = 'PhoneInput'
