/**
 * Gezi Sistemi (Travels → "Sefer") modülü "seans oluşturma" tam-matris testleri
 * için fikstür yardımcıları. "Sefer" (Travel entity) Events'teki Session'ın
 * doğrudan eşdeğeridir: bir Gezi'nin (Route) belirli tarihli somut kalkışı —
 * TravelForm.tsx'in kendisi içerik alanı TAŞIMAZ (isim/açıklama/kural/görsel
 * Route'tan miras alınır), yalnızca tarih/kapasite/araç/ekip atar.
 *
 * Ortak login/token-cache altyapısını `facilitySessionMatrix.ts`'ten aynen
 * yeniden kullanır; burada yalnız Travels'e özgü fikstürler eklenir.
 */
import { APIRequestContext, expect } from '@playwright/test'
import { API_BASE, futureIso } from './facilitySessionMatrix'

export { API_BASE, adminToken, uniq, futureIso, fastLoginUi, getFreshToken, pickSelectByFieldLabel } from './facilitySessionMatrix'

export interface CreatedTravelCategory { id: string; name: string }
export interface CreatedTravelRoute { id: string; name: string }
export interface CreatedTravelBus { id: string; name: string; capacity: number }
export interface CreatedTravel { id: string; code?: string; name: string }

export async function createTravelCategory(ctx: APIRequestContext, token: string, tag: string): Promise<CreatedTravelCategory> {
  const headers = { Authorization: `Bearer ${token}` }
  const res = await ctx.post(`${API_BASE}/travel-categories`, {
    headers, data: { name: `${tag} Kategori`, description: 'E2E seans matrisi fixture kategorisi', color: '#2563eb', isActive: true },
  })
  expect(res.ok(), `travel-category oluşturulamadı: ${await res.text()}`).toBeTruthy()
  const body = (await res.json()).data
  return { id: body.id, name: body.name }
}

/**
 * Bir Gezi (Route) — Sefer'in (Travel) içerik bilgilerini (isim, açıklama, kural,
 * görsel, fiyat, kısıt, kalkış noktası) buradan miras alır. restrictions/images/
 * pricing/points boş obje ({}) olarak gönderilebilir — TravelRouteFormRequestValidator
 * bunları zorunlu kılmaz (Events'teki ImageSpec gibi katı bir şema yok).
 */
export async function createTravelRoute(
  ctx: APIRequestContext, token: string, categoryId: string, tag: string,
  overrides: Record<string, unknown> = {},
): Promise<CreatedTravelRoute> {
  const headers = { Authorization: `Bearer ${token}` }
  const res = await ctx.post(`${API_BASE}/travel-routes`, {
    headers,
    data: {
      name: `${tag} Rota`, categoryId, destination: 'E2E Test Güzergahı',
      latitude: 41.02, longitude: 28.88, description: 'E2E açıklama', conditions: 'E2E kural', internalNote: 'E2E iç not',
      gender: 'mixed', minAge: 0, maxAge: 99,
      restrictions: {}, images: {}, pricing: {}, points: {},
      isActive: true, sultangaziResidentOnly: false, departurePoint: 'E2E Kalkış Noktası',
      ...overrides,
    },
  })
  expect(res.ok(), `travel-route oluşturulamadı: ${await res.text()}`).toBeTruthy()
  const body = (await res.json()).data
  return { id: body.id, name: body.name }
}

/** Kontenjan-bazlı (koltuksuz) bir araç — koltuk planı karmaşıklığına girmeden kapasite kuralını test etmek için en basit fikstür. */
export async function createTravelBus(
  ctx: APIRequestContext, token: string, tag: string, capacity = 20,
): Promise<CreatedTravelBus> {
  const headers = { Authorization: `Bearer ${token}` }
  const res = await ctx.post(`${API_BASE}/travel-buses`, {
    headers,
    data: { name: `${tag} Araç`, plateNumber: null, templateId: '', seatStates: {}, vehicleType: 'capacity', capacity },
  })
  expect(res.ok(), `travel-bus oluşturulamadı: ${await res.text()}`).toBeTruthy()
  const body = (await res.json()).data
  return { id: body.id, name: body.name, capacity: body.capacity }
}

export function baseTravelPayload(routeId: string, overrides: Record<string, unknown> = {}) {
  const start = futureIso(16)
  const end = futureIso(17)
  return {
    routeId, startDate: start, endDate: end,
    registrationStartDate: futureIso(1), registrationEndDate: futureIso(15),
    capacity: 10, reserveCapacity: 2,
    participationPeriod: 'none', participationLimit: 0, exemptFromParticipationLimit: false,
    cancellationDeadlineHours: 24,
    crew: {}, busIds: [] as string[], isActive: false,
    ...overrides,
  }
}

/**
 * Travel (Sefer) DELETE SOFT-DELETE'tir (çöp kutusuna taşır) — gerçek testte
 * bulunan davranış: aynı isimli fikstürler arama sonuçlarında silindikten sonra
 * bile "trash" uç noktasında kalır. Temizlik bu yüzden normal delete + trash'teki
 * kalıntıyı permanent-delete ile iki aşamalı yapılır.
 *
 * GERÇEK TESTTE BULUNAN HATA (2026-10-03, bu fonksiyonun kendisinde): önceki sürüm
 * her silme çağrısını `.catch(() => {})` ile SESSİZCE yutuyordu — paylaşılan Production
 * ortamının `429 RATE_LIMIT_EXCEEDED`'ı tetiklediği (uzun kombine suite koşumlarında,
 * ör. Facility+Events+Travels 273 testlik tam koşum) anlarda silme isteği başarısız
 * olup hiç yeniden denenmiyordu — DB'de gerçek QA-TRVKURAL kalıntıları (kategori+rota+
 * 4 sefer) birikti, canlı API sorgusuyla doğrulandı. Şimdi her silme çağrısı 429'u
 * backoff ile 3 kez yeniden dener (events/travels UI spec'lerindeki
 * `clickAndWaitForResponse` ile aynı desen).
 */
export async function deleteWithRetry(ctx: APIRequestContext, url: string, headers: Record<string, string>, maxAttempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await ctx.delete(url, { headers }).catch(() => null)
    if (!res) continue
    if (res.status() !== 429) return
    await new Promise((r) => setTimeout(r, 1500 * attempt))
  }
}

export async function cleanupTravelsFixture(
  ctx: APIRequestContext, token: string,
  fx: { travelIds?: string[]; routeIds?: string[]; categoryIds?: string[]; busIds?: string[]; adminUserIds?: string[] },
): Promise<void> {
  const headers = { Authorization: `Bearer ${token}` }
  for (const id of fx.travelIds ?? []) {
    await deleteWithRetry(ctx, `${API_BASE}/travels/${id}`, headers)
    await deleteWithRetry(ctx, `${API_BASE}/travels/${id}/permanent`, headers)
  }
  for (const id of fx.busIds ?? []) await deleteWithRetry(ctx, `${API_BASE}/travel-buses/${id}`, headers)
  for (const id of fx.routeIds ?? []) await deleteWithRetry(ctx, `${API_BASE}/travel-routes/${id}`, headers)
  for (const id of fx.categoryIds ?? []) await deleteWithRetry(ctx, `${API_BASE}/travel-categories/${id}`, headers)
  for (const id of fx.adminUserIds ?? []) await deleteWithRetry(ctx, `${API_BASE}/admins/${id}`, headers)
}
