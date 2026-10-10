export const CHART_COLORS = [
  'hsl(var(--accent-blue))',
  'hsl(var(--accent-green))',
  'hsl(var(--accent-violet))',
  'hsl(var(--accent-orange))',
  'hsl(var(--danger))',
  'hsl(var(--info))',
]

export const chartAxis = {
  stroke: 'hsl(var(--border))',
  tick: { fill: 'hsl(var(--foreground-muted))', fontSize: 11 },
}

export const chartGrid = {
  stroke: 'hsl(var(--border))',
  strokeDasharray: '3 3',
}

export const tooltipStyle = {
  background: 'hsl(var(--surface-0))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 'var(--radius-card, 10px)',
  boxShadow: 'var(--shadow-pop)',
  fontSize: 12,
  color: 'hsl(var(--foreground-strong))',
}
