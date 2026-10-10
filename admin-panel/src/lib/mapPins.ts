function cssVar(name: string, fallback = '0 0% 20%'): string {
  if (typeof window === 'undefined') return `hsl(${fallback})`
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return `hsl(${v || fallback})`
}

interface DotPinOptions {
  colorVar: string
  ring?: boolean
  ringColorVar?: string
  badge?: boolean
  badgeColorVar?: string
}

export function dotPinIcon(opts: DotPinOptions): google.maps.Icon {
  const fill = cssVar(opts.colorVar)
  const stroke = cssVar('--surface-0', '0 0% 100%')
  const ringColor = opts.ring ? cssVar(opts.ringColorVar ?? '--danger') : null
  const badgeColor = opts.badge ? cssVar(opts.badgeColorVar ?? '--primary') : null
  const size = 26
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
    + (ringColor ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1.5}" fill="none" stroke="${ringColor}" stroke-width="2"/>` : '')
    + `<circle cx="${size / 2}" cy="${size / 2}" r="8" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`
    + (badgeColor ? `<circle cx="${size - 6}" cy="6" r="4.5" fill="${badgeColor}" stroke="${stroke}" stroke-width="1.5"/>` : '')
    + `</svg>`
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  }
}
