import type React from 'react'
import { cn } from '@/lib/utils'
import { useUiStandards } from '@/design-system/UiStandards/UiStandards'

type StatAccent = 'blue' | 'green' | 'orange' | 'violet' | 'pink' | 'primary' | 'neutral' | 'danger'

interface StatCardProps {
  label: string
  value: React.ReactNode
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  accent?: StatAccent
  size?: 'default' | 'compact'
  hint?: React.ReactNode
  loading?: boolean
  className?: string
  onClick?: () => void
}

// Kullanıcı isteği (2026-10-07, ikinci revizyon): "sağdaki olan kartlar daha renkli olabilir"
// — önceki turda tüm pozitif durumlar tek lacivert/yeşile indirgenmişti, bu fazla tekdüze
// bulundu. Şimdi her accent kendi ayırt edici, marka uyumlu tonuna sahip; sadece anlamsız
// rastgele "sultanşehir" rainbow'u (6+ parlak neon ton rastgele dağıtılmış) geri gelmiyor.
const tokens: Record<StatAccent, { color: string; bg: string; soft: string }> = {
  blue:    { color: '#0f4c81', bg: '#eef3f8', soft: '#d7e3ef' },
  green:   { color: '#5a8a2a', bg: '#f1f7e8', soft: '#dcebc6' },
  orange:  { color: '#b45309', bg: '#fffbeb', soft: '#fde68a' },
  violet:  { color: '#6d28d9', bg: '#f5f3ff', soft: '#ddd6fe' },
  pink:    { color: '#be185d', bg: '#fdf2f8', soft: '#fbcfe8' },
  primary: { color: '#0f4c81', bg: '#eef3f8', soft: '#d7e3ef' },
  neutral: { color: '#64748b', bg: '#f8fafc', soft: '#e2e8f0' },
  danger:  { color: '#dc2626', bg: '#fef2f2', soft: '#fecaca' },
}

export const StatCard = ({ label, value, icon: Icon, accent = 'blue', size = 'default', hint, loading, className, onClick }: StatCardProps) => {
  const t = tokens[accent]
  const compact = size === 'compact'
  const Container = onClick ? 'button' : 'div'
  const displayValue = typeof value === 'number' ? value.toLocaleString('tr-TR') : value
  const pilot = useUiStandards()

  if (pilot) return (
    <Container type={onClick ? 'button' : undefined} onClick={onClick} className={cn('pilot-stat-card w-full text-left', className)}>
      <div>
        <div className="pilot-stat-icon" style={{ backgroundColor: t.bg, color: t.color }}><Icon className="h-4 w-4" /></div>
        <p className="pilot-stat-label">{label}</p>
        <p className="pilot-stat-value">{loading ? '—' : displayValue}</p>
        {hint && <p className="pilot-stat-note">{hint}</p>}
      </div>
    </Container>
  )

  return (
    <Container
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'bg-white rounded-card overflow-hidden text-left w-full',
        compact ? 'p-3' : 'p-4',
        onClick && 'cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
      style={{ border: '1px solid hsl(var(--border))', boxShadow: '0 1px 3px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{
            width: compact ? 32 : 40,
            height: compact ? 32 : 40,
            backgroundColor: t.bg,
          }}
        >
          <Icon style={{ color: t.color, width: compact ? 14 : 18, height: compact ? 14 : 18 }} />
        </div>
        <div
          className="h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0"
          style={{ backgroundColor: t.color }}
        />
      </div>

      <p
        className={cn('font-black tabular-nums leading-none', compact ? 'text-[24px] mt-3' : 'text-[32px] mt-3.5')}
        style={{ color: loading ? '#cbd5e1' : t.color }}
      >
        {loading ? '—' : displayValue}
      </p>

      <p className={cn('font-semibold text-[hsl(var(--foreground-muted))]', compact ? 'text-[10px] mt-1' : 'text-[12px] mt-1.5')}>
        {label}
      </p>

      {hint && (
        <p className="text-[10px] text-[hsl(var(--foreground-subtle))] mt-0.5">{hint}</p>
      )}
    </Container>
  )
}
