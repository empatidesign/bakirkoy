import type { MeDto, SessionConfig } from '@/types/auth.types'
import authService from '@/services/auth.service'

export function isAuthFailure(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status
  return status === 401
}

export function isTransientError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === undefined) return true
  return status === 429 || status >= 500
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function meWithRetry(retries = 2, baseDelayMs = 300): Promise<{ me: MeDto; sessionConfig: SessionConfig }> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await authService.meWithSessionConfig()
    } catch (err) {
      lastErr = err
      if (!isTransientError(err) || attempt === retries) throw err
      await sleep(baseDelayMs * Math.pow(2, attempt))
    }
  }
  throw lastErr
}
