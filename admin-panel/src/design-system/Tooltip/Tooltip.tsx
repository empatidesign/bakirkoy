import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

export interface TooltipProps {
  label?: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  delayDuration?: number
}

export const Tooltip = ({ label, children, side = 'top', delayDuration = 200 }: TooltipProps) => {
  if (label === undefined || label === null || label === '') return <>{children}</>

  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className="z-[100] max-w-xs select-none rounded-field bg-[hsl(var(--foreground-strong))] px-2 py-1 text-xs font-medium text-[hsl(var(--surface-0))] shadow-pop"
          >
            {label}
            <RadixTooltip.Arrow className="fill-[hsl(var(--foreground-strong))]" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  )
}
