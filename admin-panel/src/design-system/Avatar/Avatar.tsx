import { cn } from '@/lib/utils'

interface AvatarProps {
  name: string
  src?: string
  size?: 'xs' | 'sm' | 'md'
  className?: string
  // Kullanıcı isteği (2026-10-01): sultansehir-template'teki gibi kişiye göre
  // değişen rozet rengi (isim bazlı deterministik palet). Varsayılan false,
  // tek renk (primary) davranışı korunur; sadece /sports pilot modda açılır.
  colorful?: boolean
}

// Kullanıcı isteği (2026-10-07): "sultanşehirden olan izler burda olmasın" — kişiye göre
// rastgele çok renkli (mavi/teal/indigo/camgöbeği/zümrüt/amber/mor/pembe) rozet paleti
// kaldırıldı; Bakırköy kurumsal kimliğinin mavi/yeşil tonlarına ve nötr bir griye indirgendi.
const INITIALS_PALETTE = [
  'bg-[#eef3f8] text-[#0f4c81]',
  'bg-[#f1f7e8] text-[#5a8a2a]',
  'bg-slate-100 text-slate-700',
]

const colorForName = (name: string): string => {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return INITIALS_PALETTE[hash % INITIALS_PALETTE.length]
}

export const Avatar = ({ name, src, size = 'sm', className, colorful = false }: AvatarProps) => {
  const sizeClass = size === 'xs' ? 'h-5 w-5 text-[8px]' : size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs'

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
        'rounded-full font-bold uppercase flex items-center justify-center flex-shrink-0',
        colorful ? colorForName(name) : 'bg-primary/10 text-primary',
        sizeClass,
        className,
      )}
    >
      {initials}
    </span>
  )
}
