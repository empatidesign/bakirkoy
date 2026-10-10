import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { CHART_COLORS, tooltipStyle } from './chartTheme'

interface Props {
  data: Array<{ label: string; value: number }>
  height?: number
  centerLabel?: string
  centerValue?: string | number
}

export const DonutChart = ({ data, height = 240, centerLabel, centerValue }: Props) => {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-foreground-muted type-caption" style={{ height }}>
        Veri yok
      </div>
    )
  }
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="none">
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
      {(centerValue != null || centerLabel) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: 24 }}>
          {centerValue != null && <span className="type-kpi-value text-foreground-strong tabular-nums">{centerValue}</span>}
          {centerLabel && <span className="type-caption text-foreground-muted">{centerLabel}</span>}
        </div>
      )}
    </div>
  )
}
