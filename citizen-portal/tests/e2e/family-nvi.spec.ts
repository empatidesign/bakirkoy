import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test'
import { TEST_TCKN, TEST_PASSWORD, TEST_OTP, hasCredentials } from './helpers/auth'

const API = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/api\/v1$/, '')

let ctx: APIRequestContext
let token = ''

async function citizenLogin(): Promise<string> {
  const l = await (await ctx.post(`${API}/api/v1/auth/citizen/login`, { data: { identifier: TEST_TCKN, password: TEST_PASSWORD } })).json()
  if (l.data?.accessToken) return l.data.accessToken
  const v = await (await ctx.post(`${API}/api/v1/auth/citizen/verify-otp`, { data: { otpSessionToken: l.data.otpSessionToken, code: TEST_OTP } })).json()
  return v.data.accessToken
}

const auth = () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })
const post = async (path: string, body: unknown = {}) => {
  const res = await ctx.post(`${API}${path}`, { headers: auth(), data: body })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), ok: res.ok(), body: json, message: json?.message, code: json?.errorCode, data: json?.data }
}
const get = async (path: string) => {
  const res = await ctx.get(`${API}${path}`, { headers: auth() })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), ok: res.ok(), data: json?.data }
}

test.describe.serial('Aile — NVI toplu ekleme akışı (API)', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test.beforeAll(async () => {
    ctx = await pwRequest.newContext()
    token = await citizenLogin()
    expect(token, 'citizen token alınmalı').toBeTruthy()
  })

  test.afterAll(async () => {
    await ctx.dispose()
  })

  test('fetch-from-nvi: veliye bağlı NVI kayıtlarını döner, alreadyAdded doğru işaretlenir', async () => {
    const r = await post('/api/v1/auth/citizen/family-members/fetch-from-nvi', {})
    expect(r.status, 'preview 200 dönmeli').toBe(200)
    expect(r.data.tckn, 'maskelenmiş TCKN dönmeli').toBeTruthy()
    expect(r.data.fullName).toBeTruthy()
    expect(Array.isArray(r.data.children)).toBeTruthy()

    const children = await get('/api/v1/auth/citizen/children')
    if (children.data.length > 0) {
      const existingTckns = new Set(children.data.map((c: { tckn: string }) => c.tckn))
      const matched = r.data.children.filter((c: { tckn: string; alreadyAdded: boolean }) => existingTckns.has(c.tckn))
      expect(matched.length, 'zaten eklenmiş çocuklar alreadyAdded=true işaretli olmalı').toBeGreaterThan(0)
      for (const m of matched) expect(m.alreadyAdded).toBe(true)
    }
  })

  test('confirm-from-nvi: boş body -> 400 VALIDATION_ERROR (500 NRE regresyonu)', async () => {
    const r = await post('/api/v1/auth/citizen/family-members/confirm-from-nvi', {})
    expect(r.status, 'boş body 500 değil 400 dönmeli').toBe(400)
    expect(r.code).toBe('VALIDATION_ERROR')
  })

  test('confirm-from-nvi: boş selectedTckns dizisi -> 400 VALIDATION_ERROR', async () => {
    const r = await post('/api/v1/auth/citizen/family-members/confirm-from-nvi', { selectedTckns: [] })
    expect(r.status).toBe(400)
    expect(r.code).toBe('VALIDATION_ERROR')
  })

  test('confirm-from-nvi: NVI sonucunda olmayan TCKN -> SELECTION_NOT_FOUND', async () => {
    const r = await post('/api/v1/auth/citizen/family-members/confirm-from-nvi', { selectedTckns: ['99999999999'] })
    expect(r.ok, 'eşleşmeyen TCKN reddedilmeli').toBeFalsy()
    expect(r.code).toBe('SELECTION_NOT_FOUND')
  })

  test('confirm-from-nvi: zaten eklenmiş TCKN seçilirse alreadyExisted artar, newlyAdded 0 kalır (idempotent)', async () => {
    const preview = await post('/api/v1/auth/citizen/family-members/fetch-from-nvi', {})
    const alreadyAdded = preview.data.children.filter((c: { alreadyAdded: boolean }) => c.alreadyAdded)
    test.skip(alreadyAdded.length === 0, 'Bu hesapta zaten eklenmiş NVI çocuğu yok — idempotency testi atlandı')

    const tckns = alreadyAdded.map((c: { tckn: string }) => c.tckn)
    const r1 = await post('/api/v1/auth/citizen/family-members/confirm-from-nvi', { selectedTckns: tckns })
    expect(r1.ok).toBeTruthy()
    expect(r1.data.newlyAdded).toBe(0)
    expect(r1.data.alreadyExisted).toBe(tckns.length)

    const r2 = await post('/api/v1/auth/citizen/family-members/confirm-from-nvi', { selectedTckns: tckns })
    expect(r2.data.newlyAdded).toBe(0)
    expect(r2.data.alreadyExisted).toBe(tckns.length)
  })

  test('children listesi confirm sonrası preview ile tutarlı', async () => {
    const children = await get('/api/v1/auth/citizen/children')
    const preview = await post('/api/v1/auth/citizen/family-members/fetch-from-nvi', {})
    const nviTckns = new Set(preview.data.children.map((c: { tckn: string }) => c.tckn))
    for (const child of children.data) {
      if (nviTckns.has(child.tckn)) {
        const nviChild = preview.data.children.find((c: { tckn: string }) => c.tckn === child.tckn)
        expect(nviChild.alreadyAdded, `${child.tckn} children listesindeyse alreadyAdded=true olmalı`).toBe(true)
      }
    }
  })
})
