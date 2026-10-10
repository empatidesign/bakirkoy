import { useRef, type KeyboardEvent, type ClipboardEvent } from 'react'
import { cn } from '@/lib/utils'

interface OTPInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  error?: string
}

export const OTPInput = ({ value, onChange, length = 6, disabled, error }: OTPInputProps) => {
  const refs = useRef<Array<HTMLInputElement | null>>([])

  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const handleChange = (index: number, char: string) => {
    if (!/^\d*$/.test(char)) return

    const next = digits.slice()
    next[index] = char.slice(-1)
    onChange(next.join(''))

    if (char && index < length - 1) {
      refs.current[index + 1]?.focus()
    }
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

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
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
            className={cn(
              'h-12 w-10 rounded-lg border text-center text-lg font-semibold tracking-widest transition-colors',
              'bg-[hsl(var(--surface-1))] text-[hsl(var(--foreground-strong))]',
              'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 focus:border-[hsl(var(--primary))]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              digit
                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary-soft))]'
                : 'border-[hsl(var(--border))]',
              error && 'border-[hsl(var(--danger))]'
            )}
          />
        ))}
      </div>
      {error && <p className="text-xs text-[hsl(var(--danger))]">{error}</p>}
    </div>
  )
}
