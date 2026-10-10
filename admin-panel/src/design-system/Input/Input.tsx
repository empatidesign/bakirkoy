import { useFieldControl } from '@/design-system/UiStandards/UiStandards'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type InputSanitize = 'letters' | 'digits' | 'alnum'

const sanitizeValue = (value: string, mode: InputSanitize): string => {
  switch (mode) {
    case 'letters': return value.replace(/[^\p{L}\s'-]/gu, '')
    case 'digits': return value.replace(/\D/g, '')
    case 'alnum': return value.replace(/[^\p{L}\p{N}\s]/gu, '')
  }
}

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  error?: string
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
  sanitize?: InputSanitize
  size?: 'sm' | 'md'
  tone?: 'default' | 'white'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, iconLeft, iconRight, sanitize, size = 'md', tone = 'default', onChange, ...props }, ref) => {
    const field = useFieldControl()
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (sanitize) {
        const cleaned = sanitizeValue(e.target.value, sanitize)
        if (cleaned !== e.target.value) e.target.value = cleaned
      }
      onChange?.(e)
    }

    return (
      <div className="w-full">
        <div className="relative w-full">
          {iconLeft && (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[hsl(var(--foreground-subtle))]">
              {iconLeft}
            </span>
          )}
          <input
            {...field}
            ref={ref}
            onChange={handleChange}
            className={cn(
              'flex w-full rounded-field border px-3 py-2 text-sm text-[hsl(var(--foreground-default))] placeholder:text-[hsl(var(--foreground-subtle))] transition-colors',
              tone === 'white'
                ? 'border-[hsl(var(--surface-1))] bg-[hsl(var(--surface-1))]'
                : 'border-[hsl(var(--border))] bg-[hsl(var(--input-bg))]',
              size === 'sm' ? 'h-[var(--control-h-sm)] text-xs' : 'h-[var(--control-h)]',
              'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 focus:border-[hsl(var(--primary))]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-[hsl(var(--danger))] focus:ring-[hsl(var(--danger))]/30 focus:border-[hsl(var(--danger))]',
              iconLeft && 'pl-10',
              iconRight && 'pr-10',
              className
            )}
            {...props}
          />
          {iconRight && (
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[hsl(var(--foreground-subtle))]">
              {iconRight}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs text-[hsl(var(--danger))]">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
