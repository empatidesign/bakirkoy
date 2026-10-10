import { cn } from '@/lib/utils'

interface AvatarProps {
  name: string
  src?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

export const Avatar = ({ name, src, size = 'sm', className }: AvatarProps) => {
  const sizeClass = size === 'xs' ? 'h-5 w-5 text-[8px]' : size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'md' ? 'h-9 w-9 text-xs' : 'h-14 w-14 text-base'

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover flex-shrink-0 border border-border', sizeClass, className)}
      />
    )
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <span
      className={cn(
        'rounded-full bg-primary/10 text-primary font-bold uppercase flex items-center justify-center flex-shrink-0',
        sizeClass,
        className,
      )}
    >
      {initials}
    </span>
  )
}
