const suppressed = new Map<string, number>()

const key = (referenceType: string, referenceId: string) => `${referenceType}:${referenceId}`

export const toastSuppression = {
  suppress(referenceType: string, referenceId: string, ms = 8000): void {
    suppressed.set(key(referenceType, referenceId), Date.now() + ms)
  },
  isSuppressed(referenceType?: string | null, referenceId?: string | null): boolean {
    if (!referenceType || !referenceId) return false
    const k = key(referenceType, referenceId)
    const until = suppressed.get(k)
    if (until === undefined) return false
    if (Date.now() > until) { suppressed.delete(k); return false }
    return true
  },
}
