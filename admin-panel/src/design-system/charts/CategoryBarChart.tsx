import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { CHART_COLORS, chartAxis, chartGrid, tooltipStyle } from './chartTheme'

interface Props {
  data: Array<{ label: string; value: number }>
  height?: number
  layout?: 'horizontal' | 'vertical'
  color?: string
  multicolor?: boolean
}

export const CategoryBarChart = ({ data, height = 260, layout = 'horizontal', color, multicolor }: Props) => {
  const barColor = color ?? CHART_COLORS[0]
  const vertical = layout === 'vertical'
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={vertical ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 16, left: vertical ? 8 : -8, bottom: 0 }}>
        <CartesianGrid {...chartGrid} horizontal={!vertical} vertical={vertical} />
        {vertical ? (
          <>
            <XAxis type="number" {...chartAxis} allowDecimals={false} />
            <YAxis type="category" dataKey="label" {...chartAxis} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" {...chartAxis} />
            <YAxis {...chartAxis} width={36} allowDecimals={false} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--surface-2))', opacity: 0.5 }} />
        <Bar dataKey="value" radius={vertical ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={48}>
          {data.map((_, i) => (
            <Cell key={i} fill={multicolor ? CHART_COLORS[i % CHART_COLORS.length] : barColor} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
