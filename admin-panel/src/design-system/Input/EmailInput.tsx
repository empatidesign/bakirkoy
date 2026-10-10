import { forwardRef, useState } from 'react'
import { MailIcon } from 'lucide-react'
import { Input, type InputProps } from './Input'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isValidEmail = (value: string): boolean => EMAIL_RE.test(value.trim())

export interface EmailInputProps extends Omit<InputProps, 'type' | 'sanitize'> {
  value: string
}

export const EmailInput = forwardRef<HTMLInputElement, EmailInputProps>(
  ({ value, onBlur, error, iconLeft, placeholder = 'ornek@belediye.gov.tr', ...props }, ref) => {
    const [touched, setTouched] = useState(false)
    const invalid = touched && value.trim().length > 0 && !isValidEmail(value)
    return (
      <Input
        ref={ref}
        type="email"
        inputMode="email"
        value={value}
        placeholder={placeholder}
        iconLeft={iconLeft ?? <MailIcon className="h-3.5 w-3.5" />}
        error={error ?? (invalid ? 'Geçerli bir e-posta adresi giriniz.' : undefined)}
        onBlur={e => { setTouched(true); onBlur?.(e) }}
        {...props}
      />
    )
  }
)

EmailInput.displayName = 'EmailInput'
