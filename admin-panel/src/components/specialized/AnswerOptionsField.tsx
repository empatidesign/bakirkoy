import { Input, ToggleChip } from '@/design-system'
import { cn } from '@/lib/utils'

interface AnswerOptionsFieldProps {
  options: string[]
  correctAnswer: number
  onOptionsChange: (options: string[]) => void
  onCorrectAnswerChange: (index: number) => void
  disabled?: boolean
  error?: string
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

export const AnswerOptionsField = ({
  options,
  correctAnswer,
  onOptionsChange,
  onCorrectAnswerChange,
  disabled,
  error,
}: AnswerOptionsFieldProps) => {
  const setOption = (index: number, val: string) => {
    const next = [...options]
    next[index] = val
    onOptionsChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {options.map((opt, index) => {
          const isCorrect = correctAnswer === index
          return (
            <div key={index} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-[var(--control-h)] w-9 shrink-0 items-center justify-center rounded-field border text-sm font-medium',
                  isCorrect
                    ? 'border-[hsl(var(--success))] bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--foreground-muted))]',
                )}
              >
                {OPTION_LABELS[index] ?? index + 1}
              </span>
              <Input
                value={opt}
                onChange={(e) => setOption(index, e.target.value)}
                placeholder={`${index + 1}. seçenek`}
                disabled={disabled}
              />
              <ToggleChip
                active={isCorrect}
                tone="success"
                disabled={disabled}
                onClick={() => onCorrectAnswerChange(index)}
              >
                {isCorrect ? 'Doğru cevap' : 'Doğru'}
              </ToggleChip>
            </div>
          )
        })}
      </div>
      <p className="type-caption">Doğru cevabı işaretlemek için seçeneğin yanındaki “Doğru” düğmesine basın.</p>
      {error && <p className="text-xs text-[hsl(var(--danger))]">{error}</p>}
    </div>
  )
}
