import { useState, type KeyboardEvent } from 'react'
import { PlusIcon, HashIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/design-system/Input'
import { IconButton } from '@/design-system/IconButton'
import { RemovableTag } from '@/design-system/RemovableTag'

export interface NumberListInputProps {
  value: number[]
  onChange: (next: number[]) => void
  placeholder?: string
  suffix?: string
  disabled?: boolean
  className?: string
}

const parseNumbers = (raw: string): number[] =>
  raw
    .split(/[\s,;.]+/)
    .map((p) => parseInt(p, 10))
    .filter((n) => Number.isFinite(n) && n > 0)

export const NumberListInput = ({ value, onChange, placeholder, suffix = '.', disabled, className }: NumberListInputProps) => {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const parsed = parseNumbers(draft)
    if (parsed.length === 0) { setDraft(''); return }
    const next = Array.from(new Set([...value, ...parsed])).sort((a, b) => a - b)
    onChange(next)
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() }
    else if (e.key === 'Backspace' && draft === '' && value.length > 0) onChange(value.slice(0, -1))
  }

  const remove = (n: number) => onChange(value.filter((x) => x !== n))

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-start gap-2">
        <Input
          inputMode="numeric"
          value={draft}
          disabled={disabled}
          iconLeft={<HashIcon className="h-3.5 w-3.5" />}
          placeholder={placeholder ?? 'Sıra no yazıp Enter’a basın (örn. 1, 5, 9)'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
        />
        <IconButton tone="primary" title="Ekle" disabled={disabled || draft.trim() === ''} onClick={commit}>
          <PlusIcon className="h-4 w-4" />
        </IconButton>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((n) => (
            <RemovableTag key={n} label={`${n}${suffix}`} onRemove={() => remove(n)} disabled={disabled} />
          ))}
        </div>
      )}
    </div>
  )
}
