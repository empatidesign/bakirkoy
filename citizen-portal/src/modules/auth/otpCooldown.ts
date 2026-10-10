const keyFor = (token: string) => `otp_resend_deadline:${token}`

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const safeStore = (store?: Store): Store | null => {
  if (store) return store
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null
  }
}

export const loadOrInitDeadline = (
  token: string,
  cooldownSeconds: number,
  now: number = Date.now(),
  store?: Store,
): number => {
  const s = safeStore(store)
  if (s) {
    try {
      const raw = s.getItem(keyFor(token))
      if (raw) {
        const v = Number(raw)
        if (Number.isFinite(v)) return v
      }
    } catch {
      // ignore
    }
  }
  const deadline = now + cooldownSeconds * 1000
  try { s?.setItem(keyFor(token), String(deadline)) } catch { /* ignore */ }
  return deadline
}

export const saveDeadline = (
  token: string,
  cooldownSeconds: number,
  now: number = Date.now(),
  store?: Store,
): number => {
  const deadline = now + cooldownSeconds * 1000
  try { safeStore(store)?.setItem(keyFor(token), String(deadline)) } catch { /* ignore */ }
  return deadline
}
