import { StarIcon } from 'lucide-react'

type Props = {
  value: number
  onChange?: (v: number) => void
  size?: 'sm' | 'md'
}

export const StarRating = ({ value, onChange, size = 'md' }: Props) => {
  const readonly = !onChange
  const dim = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'

  return (
    <div className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={[
            'rounded transition-transform focus:outline-none',
            !readonly ? 'hover:scale-110 active:scale-95 cursor-pointer' : 'cursor-default',
          ].join(' ')}
          aria-label={readonly ? undefined : `${star} yıldız`}
        >
          <StarIcon
            className={[
              dim,
              star <= value ? 'text-amber-400 fill-amber-400' : 'text-foreground-muted/30 fill-foreground-muted/10',
            ].join(' ')}
          />
        </button>
      ))}
    </div>
  )
}
