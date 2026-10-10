import { useMemo, useState, type ReactNode } from 'react'
import bakirkoyGeo from '@/assets/bakirkoyMahalleler.json'

type Ring = [number, number][]
interface GeoFeature { type: 'Feature'; properties: { neighborhood: string }; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: Ring[] | Ring[][] } }
interface GeoCollection { type: 'FeatureCollection'; features: GeoFeature[] }

const GEO = bakirkoyGeo as unknown as GeoCollection

const BBOX = (() => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const f of GEO.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as Ring[]] : (f.geometry.coordinates as Ring[][])
    for (const poly of polys) for (const ring of poly) for (const [x, y] of ring) {
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
  }
  return { minX, maxX, minY, maxY }
})()

const project = (x: number, y: number, w: number, h: number) => {
  const pad = 0.06
  const spanX = BBOX.maxX - BBOX.minX
  const spanY = BBOX.maxY - BBOX.minY
  const scale = Math.min(w * (1 - 2 * pad) / spanX, h * (1 - 2 * pad) / spanY)
  const offX = (w - spanX * scale) / 2
  const offY = (h - spanY * scale) / 2
  return [
    offX + (x - BBOX.minX) * scale,
    offY + (BBOX.maxY - y) * scale,
  ] as const
}

const ringToPoints = (ring: Ring, w: number, h: number) =>
  ring.map(([x, y]) => project(x, y, w, h).join(',')).join(' ')

const centroid = (ring: Ring): [number, number] => {
  let cx = 0, cy = 0
  for (const [x, y] of ring) { cx += x; cy += y }
  return [cx / ring.length, cy / ring.length]
}

export interface NeighborhoodMapDatum {
  neighborhood: string
  percent: number | null
  responseCount: number
  openSubmissionCount: number
  topIssues?: { label: string; percentage: number }[]
}

interface Props {
  data: NeighborhoodMapDatum[]
  colorFor: (percent: number | null) => string
  height?: number
  renderTooltip?: (neighborhood: string) => ReactNode
}

export const BakirkoyNeighborhoodMap = ({ data, colorFor, height = 480, renderTooltip }: Props) => {
  const [hover, setHover] = useState<string | null>(null)
  const byName = useMemo(() => new Map(data.map((d) => [d.neighborhood, d])), [data])
  const width = 900

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-surface-0" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        data-testid="bakirkoy-map-svg"
      >
        {GEO.features.map((f) => {
          const name = f.properties.neighborhood
          const d = byName.get(name)
          const fill = colorFor(d?.percent ?? null)
          const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as Ring[]] : (f.geometry.coordinates as Ring[][])
          const isHover = hover === name
          return (
            <g
              key={name}
              onMouseEnter={() => setHover(name)}
              onMouseLeave={() => setHover((h) => (h === name ? null : h))}
              className="cursor-pointer"
            >
              {polys.map((poly, pi) => (
                <polygon
                  key={pi}
                  points={ringToPoints(poly[0], width, height)}
                  fill={fill}
                  stroke={isHover ? '#0f172a' : '#ffffff'}
                  strokeWidth={isHover ? 2 : 1}
                  opacity={isHover ? 1 : 0.92}
                />
              ))}
              {polys[0]?.[0] && (() => {
                const [cx, cy] = project(...centroid(polys[0][0]), width, height)
                return (
                  <text x={cx} y={cy} textAnchor="middle" fontSize={12} fontWeight={700} fill="#0f172a" style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>
                    {name}
                  </text>
                )
              })()}
            </g>
          )
        })}
      </svg>

      {hover && byName.get(hover) && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-border bg-surface-1/95 px-3 py-2 shadow-lg backdrop-blur">
          <p className="type-body-strong">{hover}</p>
          {renderTooltip ? renderTooltip(hover) : (() => {
            const d = byName.get(hover)!
            return (
              <>
                <p className="type-caption tabular-nums">
                  {d.percent === null ? 'Veri yok' : `%${d.percent} memnuniyet`}
                </p>
                <p className="type-caption text-foreground-muted tabular-nums">
                  {d.responseCount} yanıt · {d.openSubmissionCount} açık kayıt
                </p>
                {d.topIssues && d.topIssues.length > 0 && (
                  <div className="mt-1.5 border-t border-border pt-1.5" data-testid="map-top-issues">
                    <p className="type-caption font-semibold uppercase tracking-wide text-foreground-subtle">
                      Öne çıkan konular
                    </p>
                    <ul className="mt-0.5 space-y-0.5">
                      {d.topIssues.slice(0, 3).map((issue) => (
                        <li key={issue.label} className="flex items-center justify-between gap-3 type-caption tabular-nums">
                          <span>{issue.label}</span>
                          <b>%{issue.percentage.toFixed(1)}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
