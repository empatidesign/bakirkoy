import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface WheelSpinnerSlice {
  label: string
  color: string
}

export interface WheelSpinnerHandle {
  spinTo: (index: number) => void
}

interface WheelSpinnerProps {
  slices: WheelSpinnerSlice[]
  size?: number
  durationMs?: number
  onSpinStart?: () => void
  onSpinEnd?: (index: number) => void
  className?: string
}

const C = 100
const R = 94

const point = (radius: number, deg: number): [number, number] => {
  const t = (deg * Math.PI) / 180
  return [C + radius * Math.sin(t), C - radius * Math.cos(t)]
}

const slicePath = (start: number, end: number): string => {
  const [x1, y1] = point(R, start)
  const [x2, y2] = point(R, end)
  const largeArc = end - start > 180 ? 1 : 0
  return `M ${C} ${C} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
}

export const WheelSpinner = forwardRef<WheelSpinnerHandle, WheelSpinnerProps>(
  ({ slices, size = 320, durationMs = 4200, onSpinStart, onSpinEnd, className }, ref) => {
    const [rotation, setRotation] = useState(0)
    const [spinning, setSpinning] = useState(false)
    const landingIndex = useRef<number>(0)

    useImperativeHandle(ref, () => ({
      spinTo: (index: number) => {
        if (spinning || slices.length === 0) return
        const n = slices.length
        const per = 360 / n
        const center = per * (index + 0.5)
        const targetBase = (360 - (center % 360)) % 360
        const base = rotation - (rotation % 360)
        let target = base + 6 * 360 + targetBase
        if (target <= rotation + 360) target += 360
        landingIndex.current = index
        setSpinning(true)
        onSpinStart?.()
        setRotation(target)
      },
    }), [rotation, spinning, slices, onSpinStart])

    const n = slices.length
    const per = n > 0 ? 360 / n : 360

    return (
      <div className={cn('relative mx-auto', className)} style={{ width: size, height: size }}>
        <div
          className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1"
          style={{ width: 0, height: 0, borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderTop: '20px solid hsl(var(--primary))' }}
        />
        <svg
          viewBox="0 0 200 200"
          width={size}
          height={size}
          className="drop-shadow-[0_8px_24px_hsl(var(--primary)/0.18)]"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? `transform ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1)` : 'none',
          }}
          onTransitionEnd={() => {
            if (!spinning) return
            setSpinning(false)
            onSpinEnd?.(landingIndex.current)
          }}
        >
          <circle cx={C} cy={C} r={R + 4} fill="hsl(var(--surface-0))" stroke="hsl(var(--primary))" strokeWidth={3} />
          {n === 0 && <circle cx={C} cy={C} r={R} fill="hsl(var(--surface-2))" />}
          {n === 1 && <circle cx={C} cy={C} r={R} fill={slices[0].color} />}
          {n >= 2 &&
            slices.map((s, i) => {
              const start = per * i
              const end = per * (i + 1)
              const mid = per * (i + 0.5)
              const [lx, ly] = point(R * 0.58, mid)
              const textAngle = lx >= C ? mid - 90 : mid + 90
              const maxLen = n > 12 ? 14 : 17
              const label = s.label.length > maxLen ? `${s.label.slice(0, maxLen - 1)}…` : s.label
              return (
                <g key={i}>
                  <path d={slicePath(start, end)} fill={s.color} stroke="hsl(var(--surface-0))" strokeWidth={1} />
                  <text
                    x={lx}
                    y={ly}
                    fill="#ffffff"
                    fontSize={n > 14 ? 7.5 : n > 10 ? 8.5 : n > 6 ? 9.5 : 11}
                    fontWeight={700}
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${textAngle}, ${lx.toFixed(2)}, ${ly.toFixed(2)})`}
                    style={{ paintOrder: 'stroke', pointerEvents: 'none', filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.45))' }}
                  >
                    {label}
                  </text>
                </g>
              )
            })}
          <circle cx={C} cy={C} r={14} fill="hsl(var(--surface-0))" stroke="hsl(var(--primary))" strokeWidth={3} />
          <circle cx={C} cy={C} r={5} fill="hsl(var(--primary))" />
        </svg>
      </div>
    )
  },
)

WheelSpinner.displayName = 'WheelSpinner'
