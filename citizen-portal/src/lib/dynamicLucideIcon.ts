import * as LucideIcons from 'lucide-react'
import { LayersIcon, type LucideIcon } from 'lucide-react'

const iconCache = new Map<string, LucideIcon>()

const toPascalCase = (name: string): string =>
  name
    .trim()
    .replace(/[-_\s]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toUpperCase())

export const resolveLucideIcon = (name: string | null | undefined): LucideIcon => {
  const key = (name ?? '').trim()
  if (!key) return LayersIcon

  const cached = iconCache.get(key)
  if (cached) return cached

  const candidates = [key, toPascalCase(key)]
  for (const candidate of candidates) {
    const found = (LucideIcons as unknown as Record<string, LucideIcon>)[candidate]
    if (found) {
      iconCache.set(key, found)
      return found
    }
  }

  iconCache.set(key, LayersIcon)
  return LayersIcon
}
