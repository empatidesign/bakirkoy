import { CheckIcon, XIcon } from 'lucide-react'
import { applicationSteps, type StepState } from '@/types/applicationStatus'

const DOT: Record<StepState, { bg: string; ring: string; text: string }> = {
  done: { bg: 'hsl(var(--success))', ring: 'hsl(var(--success))', text: '#fff' },
  active: { bg: 'hsl(var(--primary))', ring: 'hsl(var(--primary))', text: '#fff' },
  upcoming: { bg: 'hsl(var(--surface-2))', ring: 'hsl(var(--border))', text: 'hsl(var(--foreground-subtle))' },
  error: { bg: 'hsl(var(--danger))', ring: 'hsl(var(--danger))', text: '#fff' },
}

export const ApplicationStatusStepper = ({ status, date, className = '' }: { status: string; date?: string | null; className?: string }) => {
  const steps = applicationSteps(status)

  return (
    <div className={className}>
      <div className="flex items-start">
        {steps.map((step, i) => {
          const d = DOT[step.state]
          const prevDone = i > 0 && steps[i - 1].state !== 'upcoming'
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div className="h-0.5 flex-1" style={{ background: i === 0 ? 'transparent' : (prevDone ? 'hsl(var(--success))' : 'hsl(var(--border))') }} />
                <div
                  className="relative grid h-7 w-7 flex-shrink-0 place-items-center rounded-full transition-colors"
                  style={{ background: d.bg, boxShadow: `0 0 0 2px ${d.ring}` }}
                >
                  {step.state === 'done' && <CheckIcon className="h-4 w-4" style={{ color: d.text }} strokeWidth={3} />}
                  {step.state === 'error' && <XIcon className="h-4 w-4" style={{ color: d.text }} strokeWidth={3} />}
                  {step.state === 'active' && <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#fff' }} />}
                </div>
                <div className="h-0.5 flex-1" style={{ background: i === steps.length - 1 ? 'transparent' : (steps[i + 1].state !== 'upcoming' ? 'hsl(var(--success))' : 'hsl(var(--border))') }} />
              </div>
              <p className="mt-1.5 text-center text-[12px] font-semibold leading-tight" style={{ color: step.state === 'upcoming' ? 'hsl(var(--foreground-subtle))' : 'hsl(var(--foreground-strong))' }}>
                {step.label}
              </p>
              {i === 0 && date && (
                <p className="mt-0.5 text-center text-[11px] text-[hsl(var(--foreground-subtle))]">{date}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ApplicationStatusStepper
