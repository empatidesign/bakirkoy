import { useRef, type KeyboardEvent, type ClipboardEvent } from 'react'

interface OTPInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  error?: string
  variant?: 'citizen' | 'company'
}

export const OTPInput = ({ value, onChange, length = 6, disabled, error, variant = 'citizen' }: OTPInputProps) => {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const handleChange = (index: number, char: string) => {
    if (!/^\d*$/.test(char)) return
    const next = digits.slice()
    next[index] = char.slice(-1)
    onChange(next.join(''))
    if (char && index < length - 1) refs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const next = digits.slice()
        next[index - 1] = ''
        onChange(next.join(''))
        refs.current[index - 1]?.focus()
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < length - 1) refs.current[index + 1]?.focus()
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    onChange(pasted.padEnd(value.length, '').slice(0, length))
    const nextFocus = Math.min(pasted.length, length - 1)
    refs.current[nextFocus]?.focus()
  }

  const isCompany = variant === 'company'

  return (
    <div className="otp-field-wrap">
      <div className="otp-cells">
        {digits.map((digit, index) => (
          <div key={index} className={`otp-cell-wrap ${digit ? 'otp-cell-wrap--filled' : ''} ${error ? 'otp-cell-wrap--error' : ''}`}>
            <div className={`otp-cell-glow ${isCompany ? 'otp-cell-glow--company' : ''} ${digit ? 'otp-cell-glow--active' : ''}`} />
            <input
              ref={(el) => { refs.current[index] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              disabled={disabled}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              onFocus={(e) => e.target.select()}
              className={`otp-cell ${digit ? (isCompany ? 'otp-cell--filled-company' : 'otp-cell--filled') : ''} ${error ? 'otp-cell--error' : ''}`}
            />
            {digit && (
              <div className={`otp-cell-shine ${isCompany ? 'otp-cell-shine--company' : ''}`} />
            )}
          </div>
        ))}
      </div>
      {error && (
        <div className="otp-error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="16" r="1" fill="currentColor"/>
          </svg>
          {error}
        </div>
      )}
    </div>
  )
}
