import { APIRequestContext, expect, Page, request as pwRequest } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_OTP, ADMIN_PASSWORD, login } from './auth'

export const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

export function futureIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export class AdminApi {
  private token = ''
  constructor(private readonly ctx: APIRequestContext) {}

  static async create() {
    const ctx = await pwRequest.newContext()
    const api = new AdminApi(ctx)
    await api.freshToken()
    return api
  }

  async dispose() { await this.ctx.dispose() }

  async freshToken(): Promise<string> {
    const login1 = await (await this.ctx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
    if (login1?.data?.accessToken) { this.token = login1.data.accessToken; return this.token }
    const verify = await (await this.ctx.post(`${API_BASE}/auth/verify-otp`, { data: { otpSessionToken: login1.data.otpSessionToken, code: ADMIN_OTP } })).json()
    this.token = verify?.data?.accessToken ?? ''
    if (!this.token) throw new Error(`Admin API OTP failed: ${JSON.stringify(verify)}`)
    return this.token
  }

  async request<T>(method: Method, path: string, body?: unknown, retried = false): Promise<T> {
    const token = this.token || await this.freshToken()
    const res = await this.ctx.fetch(`${API_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.status() === 401 && !retried) {
      await this.freshToken()
      return this.request(method, path, body, true)
    }
    const json = await res.json().catch(() => ({}))
    if (!res.ok()) throw new Error(`${method} ${path} failed ${res.status()}: ${JSON.stringify(json)}`)
    return json.data as T
  }

  /**
   * request() gibi çağırır ama HATA FIRLATMAZ; ham durum kodunu döndürür.
   * Beklenen hata davranışlarını doğrulamak için gerekir (ör. mükerrer
   * yönlendirmenin 409 ile engellendiğini kanıtlamak).
   */
  async raw(method: Method, path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
    const token = this.token || await this.freshToken()
    const res = await this.ctx.fetch(`${API_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: res.status(), body: await res.json().catch(() => ({})) }
  }
}

export async function loginAndOpen(page: Page, url: string, heading: string | RegExp) {
  await login(page)
  await page.goto(url)
  await expect(page.getByText(heading).first()).toBeVisible({ timeout: 20000 })
}

export async function searchAndExpect(page: Page, placeholder: string | RegExp, value: string) {
  await page.getByPlaceholder(placeholder).fill(value)
  await expect(page.locator('tr', { hasText: value }).first().or(page.getByText(value).first())).toBeVisible({ timeout: 20000 })
}
