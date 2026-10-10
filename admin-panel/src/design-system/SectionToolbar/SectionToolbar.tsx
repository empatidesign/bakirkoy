import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useUiStandards } from '@/design-system/UiStandards/UiStandards'

interface SectionToolbarProps {
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ className?: string }>
  actions?: React.ReactNode
  className?: string
}

const PilotSectionToolbar = ({ title, icon: Icon, actions, className }: SectionToolbarProps) => {
  const markerRef = useRef<HTMLDivElement>(null)
  const [slot, setSlot] = useState<Element | null>(null)
  const [resolved, setResolved] = useState(false)

  useLayoutEffect(() => {
    const marker = markerRef.current
    const primary = !!marker && !marker.closest('[role="dialog"]') && document.querySelector('[data-section-toolbar]') === marker
    setSlot(primary ? document.querySelector('.pilot-page-header .pilot-header-slot') : null)
    setResolved(true)
  }, [])

  if (slot) return <><div ref={markerRef} data-section-toolbar hidden />{actions && createPortal(actions, slot)}</>
  return (
    <div ref={markerRef} data-section-toolbar className={cn('flex flex-wrap items-center justify-between gap-2', !resolved && 'invisible', className)}>
      {resolved && (
        <div className="flex min-w-0 items-center gap-2">
          {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-primary" />}
          <h2 className="type-section truncate">{title}</h2>
        </div>
      )}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export const SectionToolbar = ({ title, subtitle, icon: Icon, actions, className }: SectionToolbarProps) => {
  const pilot = useUiStandards()
  if (pilot) return <PilotSectionToolbar title={title} icon={Icon} actions={actions} className={className} />
  return (
    <div
      className={cn('flex items-center justify-between gap-3 rounded-lg bg-white p-[15px]', className)}
      style={{ border: '0.5px solid hsl(var(--border))', boxShadow: '0 1px 4px rgb(0 0 0 / 0.05)' }}
    >
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary-soft))]">
            <Icon className="h-5 w-5 text-[hsl(var(--primary))]" />
          </div>
        )}
        <div>
          <h2 className="text-xs font-bold text-[hsl(var(--foreground-strong))]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs leading-[1.25] text-[hsl(var(--foreground-muted))]">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
