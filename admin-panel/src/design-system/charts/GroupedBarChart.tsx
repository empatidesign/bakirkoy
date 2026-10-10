import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { CHART_COLORS, chartAxis, chartGrid, tooltipStyle } from './chartTheme'

export interface BarSeries { key: string; label: string; color?: string }

interface Props {
  data: Array<Record<string, string | number>>
  xKey: string
  series: BarSeries[]
  height?: number
  layout?: 'horizontal' | 'vertical'
  stacked?: boolean
  formatValue?: (v: number) => string
}

export const GroupedBarChart = ({ data, xKey, series, height = 300, layout = 'horizontal', stacked, formatValue }: Props) => {
  const vertical = layout === 'vertical'
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={vertical ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 16, left: vertical ? 8 : -8, bottom: 0 }}>
        <CartesianGrid {...chartGrid} horizontal={!vertical} vertical={vertical} />
        {vertical ? (
          <>
            <XAxis type="number" {...chartAxis} allowDecimals={false} tickFormatter={formatValue} />
            <YAxis type="category" dataKey={xKey} {...chartAxis} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...chartAxis} interval={0} angle={data.length > 8 ? -30 : 0} textAnchor={data.length > 8 ? 'end' : 'middle'} height={data.length > 8 ? 60 : 30} />
            <YAxis {...chartAxis} width={40} allowDecimals={false} tickFormatter={formatValue} />
          </>
        )}
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'hsl(var(--surface-2))', opacity: 0.5 }}
          formatter={(v) => (formatValue && typeof v === 'number' ? formatValue(v) : String(v))}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
        {series.map((s, i) => {
          const last = i === series.length - 1
          const radius: [number, number, number, number] = !stacked || last
            ? (vertical ? [0, 6, 6, 0] : [6, 6, 0, 0])
            : [0, 0, 0, 0]
          return (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              stackId={stacked ? 'stack' : undefined}
              radius={radius}
              maxBarSize={stacked ? 48 : 28}
            />
          )
        })}
      </BarChart>
    </ResponsiveContainer>
  )
}
