import { CheckIcon } from 'lucide-react'

/**
 * Kullanıcı isteği (2026-08-28): "form sihirbazı gibi girişleri vs yapacak" — İstek/Öneri/
 * Şikayet formunu tek sayfalık uzun bir kaydırma listesinden çok adımlı bir sihirbaza
 * dönüştürüyoruz. Bu bileşen üstte adım numaralarını/başlıklarını gösteren gezinme çubuğudur.
 * Tamamlanan adımlar yeşil tik, aktif adım vurgulu, sonraki adımlar soluk görünür.
 */
export interface WizardStepDef {
  key: string
  label: string
}

interface WizardStepperProps {
  steps: WizardStepDef[]
  currentIndex: number
  /** Bir adıma tıklanınca gezinme — sadece tamamlanmış/mevcut adımlara izin verilir. */
  onStepClick?: (index: number) => void
  maxReachedIndex: number
}

export const WizardStepper = ({ steps, currentIndex, onStepClick, maxReachedIndex }: WizardStepperProps) => {
  return (
    <div className="flex items-start">
      {steps.map((step, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        const clickable = i <= maxReachedIndex && onStepClick
        return (
          <div key={step.key} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div
                className="h-0.5 flex-1"
                style={{ background: i === 0 ? 'transparent' : (i <= currentIndex ? 'hsl(var(--primary))' : 'hsl(var(--border))') }}
              />
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(i)}
                aria-label={`Adım ${i + 1}: ${step.label}`}
                aria-current={active ? 'step' : undefined}
                className="relative grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-xs font-bold transition-colors disabled:cursor-default"
                style={{
                  background: done ? 'hsl(var(--primary))' : active ? 'hsl(var(--primary))' : 'hsl(var(--surface-2))',
                  boxShadow: active ? '0 0 0 3px hsl(var(--primary)/0.2)' : done ? '0 0 0 2px hsl(var(--primary))' : '0 0 0 2px hsl(var(--border))',
                  color: done || active ? '#fff' : 'hsl(var(--foreground-subtle))',
                  cursor: clickable ? 'pointer' : 'default',
                }}
              >
                {done ? <CheckIcon className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </button>
              <div
                className="h-0.5 flex-1"
                style={{ background: i === steps.length - 1 ? 'transparent' : (i < currentIndex ? 'hsl(var(--primary))' : 'hsl(var(--border))') }}
              />
            </div>
            <p
              className="mt-1.5 text-center text-[11px] font-semibold leading-tight sm:text-[12px]"
              style={{ color: active ? 'hsl(var(--foreground-strong))' : done ? 'hsl(var(--foreground-default))' : 'hsl(var(--foreground-subtle))' }}
            >
              {step.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}
