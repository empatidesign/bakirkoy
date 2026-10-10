import { useEffect, useState } from 'react'
import roleService from '@/services/role.service'

let cache: Map<string, string> | null = null
let inflight: Promise<Map<string, string>> | null = null

export const getRoleColorMap = (): Promise<Map<string, string>> => {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = roleService
      .getOptions()
      .then((opts) => {
        cache = new Map(opts.filter((o) => o.color).map((o) => [o.key, o.color as string]))
        return cache
      })
      .catch(() => new Map<string, string>())
  }
  return inflight
}

export const useRoleColor = (roleKey?: string, fallback?: string): string | undefined => {
  const [color, setColor] = useState<string | undefined>(fallback)
  useEffect(() => {
    if (!roleKey) {
      setColor(fallback)
      return
    }
    let active = true
    getRoleColorMap().then((m) => {
      if (active) setColor(m.get(roleKey) ?? fallback)
    })
    return () => {
      active = false
    }
  }, [roleKey, fallback])
  return color
}
