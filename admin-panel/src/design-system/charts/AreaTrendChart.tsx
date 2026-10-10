import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { CHART_COLORS, chartAxis, chartGrid, tooltipStyle } from './chartTheme'

export interface AreaSeries { key: string; label: string }

interface Props {
  data: Array<Record<string, string | number>>
  xKey: string
  series: AreaSeries[]
  height?: number
  formatX?: (v: string) => string
}

export const AreaTrendChart = ({ data, xKey, series, height = 260, formatX }: Props) => (
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
      <defs>
        {series.map((s, i) => (
          <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.35} />
            <stop offset="95%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.02} />
          </linearGradient>
        ))}
      </defs>
      <CartesianGrid {...chartGrid} vertical={false} />
      <XAxis dataKey={xKey} {...chartAxis} tickFormatter={formatX} minTickGap={24} />
      <YAxis {...chartAxis} width={36} allowDecimals={false} />
      <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => (formatX ? formatX(String(label)) : String(label))} />
      <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
      {series.map((s, i) => (
        <Area
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.label}
          stroke={CHART_COLORS[i % CHART_COLORS.length]}
          strokeWidth={2}
          fill={`url(#grad-${s.key})`}
          stackId="1"
        />
      ))}
    </AreaChart>
  </ResponsiveContainer>
)
