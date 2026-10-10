export function citizenPortalBase(): string {
  const host = window.location.hostname
  const pageIsLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  const configured = (import.meta.env.VITE_CITIZEN_PORTAL_URL as string | undefined)?.trim()
  const configIsLocal = !!configured && /\/\/(localhost|127\.0\.0\.1|\[?::1)/i.test(configured)
  if (configured && (pageIsLocal || !configIsLocal)) return configured.replace(/\/+$/, '')
  return `${window.location.origin}/vatandas`
}
