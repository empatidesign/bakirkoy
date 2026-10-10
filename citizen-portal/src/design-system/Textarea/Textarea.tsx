import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, rows = 3, ...props }, ref) => (
    <div className="w-full">
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          'flex w-full resize-y rounded-field border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2 text-sm text-[hsl(var(--foreground-default))] placeholder:text-[hsl(var(--foreground-subtle))] transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 focus:border-[hsl(var(--primary))]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-[hsl(var(--danger))] focus:ring-[hsl(var(--danger))]/30 focus:border-[hsl(var(--danger))]',
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-[hsl(var(--danger))]">{error}</p>}
    </div>
  ),
)

Textarea.displayName = 'Textarea'
