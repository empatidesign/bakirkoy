/**
 * Etkinlik (Events) modülü "seans oluşturma" tam-matris testleri için fikstür
 * yardımcıları. Ortak login/token-cache altyapısını (`adminToken`, `uniq`,
 * `futureIso`, `fastLoginUi`, `pickSelectByFieldLabel`, rate-limit güvenli
 * token önbellekleme) `facilitySessionMatrix.ts`'ten aynen yeniden kullanır —
 * o dosya zaten 8 tesis modülü testinde kanıtlanmış, modül-agnostik bir
 * yardımcı kümesi; burada yalnız Events'e özgü fikstürler (kategori, etkinlik,
 * hizmet tesisi + salon) eklenir.
 */
import { APIRequestContext, expect } from '@playwright/test'
import { API_BASE, futureIso, deleteWithRetry } from './facilitySessionMatrix'

export { API_BASE, adminToken, uniq, futureIso, fastLoginUi, getFreshToken, pickSelectByFieldLabel } from './facilitySessionMatrix'

export interface CreatedEventCategory { id: string; name: string }
export interface CreatedEvent { id: string; code?: string; name: string }
export interface CreatedHallFixture { serviceFacilityId: string; hallId: string; hallCapacity: number; tag: string }

const IMAGES_SPEC = {
  web: { cover: { width: 1920, height: 720, maxSizeKb: 800 }, card: { width: 600, height: 400, maxSizeKb: 200 }, thumb: { width: 240, height: 240, maxSizeKb: 80 } },
  mobile: { cover: { width: 1080, height: 1350, maxSizeKb: 600 }, card: { width: 750, height: 750, maxSizeKb: 250 }, thumb: { width: 320, height: 320, maxSizeKb: 100 } },
  ratios: { '16:9': { width: 1920, height: 1080, maxSizeKb: 800 }, '4:3': { width: 1200, height: 900, maxSizeKb: 400 }, '1:1': { width: 900, height: 900, maxSizeKb: 300 }, '9:16': { width: 1080, height: 1920, maxSizeKb: 600 } },
  photos: [] as unknown[],
}

export async function createEventCategory(ctx: APIRequestContext, token: string, tag: string): Promise<CreatedEventCategory> {
  const headers = { Authorization: `Bearer ${token}` }
  const res = await ctx.post(`${API_BASE}/event-categories`, {
    headers, data: { name: `${tag} Kategori`, description: 'E2E seans matrisi fixture kategorisi', color: '#2563eb', defaultPoints: 5 },
  })
  expect(res.ok(), `event-category oluşturulamadı: ${await res.text()}`).toBeTruthy()
  const body = (await res.json()).data
  return { id: body.id, name: body.name }
}

/**
 * Açık alan (outdoor), salonsuz, seanslı (hasSessions=true) bir etkinlik —
 * hall/facility gerektirmeyen seans senaryoları için en basit fikstür.
 */
export async function createOutdoorSessionableEvent(
  ctx: APIRequestContext, token: string, categoryId: string, tag: string,
  overrides: Record<string, unknown> = {},
): Promise<CreatedEvent> {
  const headers = { Authorization: `Bearer ${token}` }
  const startDate = futureIso(14)
  const res = await ctx.post(`${API_BASE}/events`, {
    headers,
    data: {
      name: `${tag} Açık Alan Etkinliği`,
      categoryId,
      venueType: 'outdoor',
      facilityId: null,
      hallId: null,
      location: { name: 'E2E Açık Alan', latitude: 41.02, longitude: 28.88 },
      startDate, endDate: startDate, startTime: '09:00', endTime: '10:00',
      gender: 'mixed', capacity: 25, reserveCapacity: 5, minAge: 0, maxAge: 99,
      participationPeriod: 'none', participationLimit: 0,
      description: 'E2E seans matrisi fixture açıklaması', internalNote: 'E2E iç not',
      applicationStartDate: null, applicationEndDate: null,
      images: IMAGES_SPEC,
      access: { hasSessions: true, hasSeating: false, reservationType: 'none', registrationMode: 'none', attendanceEnabled: true, entryMethod: 'checkin', qrEnabled: true, qrType: 'rotating', qrRotationSeconds: 30, kioskEnabled: false, turnstileEnabled: false, publicLinkEnabled: false, publicLinkRequiresPin: false, staffIds: [], notificationTemplates: [], cancellationDeadlineHours: 24 },
      pricing: { isPaid: false, currency: 'TRY', audiences: [], siblingDiscountEnabled: false, siblingDiscounts: [], municipalityEmployeeDiscountEnabled: false, municipalityEmployeePercent: 0, disabledDiscountEnabled: false, disabledPercent: 0, veteranDiscountEnabled: false, veteranPercent: 0, combineDiscounts: false, maxDiscountPercent: 50 },
      points: { enabled: true, basePoints: 5, walkInEarnsPoints: false },
      isActive: true, residencyMode: 'anyone', sultangaziResidentOnly: false,
      ...overrides,
    },
  })
  expect(res.ok(), `event oluşturulamadı: ${await res.text()}`).toBeTruthy()
  const body = (await res.json()).data
  return { id: body.id, code: body.code, name: body.name }
}

/** Bir hizmet tesisi + içindeki bir salon (indoor etkinlik/seans senaryoları için). */
export async function createServiceFacilityAndHall(
  ctx: APIRequestContext, token: string, tag: string, hallCapacity = 40,
): Promise<CreatedHallFixture> {
  const headers = { Authorization: `Bearer ${token}` }
  const me = await (await ctx.get(`${API_BASE}/auth/me`, { headers })).json()
  const managerId = me?.data?.me?.id

  const sfRes = await ctx.post(`${API_BASE}/service-facilities`, {
    headers,
    data: {
      name: `${tag} SF`, type: 'events', locationType: 'Indoor',
      city: 'İstanbul', district: 'Sultangazi', address: 'E2E Test Mah. No:1',
      latitude: 41.1039, longitude: 28.8674,
      managerId, weekdayOpen: '08:00', weekdayClose: '22:00',
      weekendOpen: '09:00', weekendClose: '20:00', parkingCapacity: 0, parkingType: 'Free', capacity: 200,
    },
  })
  expect(sfRes.ok(), `service-facility oluşturulamadı: ${await sfRes.text()}`).toBeTruthy()
  const serviceFacilityId = (await sfRes.json()).data.id

  const hallRes = await ctx.post(`${API_BASE}/halls`, {
    headers,
    data: {
      facilityId: serviceFacilityId, name: `${tag} Salon`, type: 'conference',
      buildingFloor: 1, seatingMode: 'standing', capacity: hallCapacity, layout: null, featureIds: [],
      description: 'E2E seans matrisi fixture salonu', about: null,
    },
  })
  expect(hallRes.ok(), `salon oluşturulamadı: ${await hallRes.text()}`).toBeTruthy()
  const hallId = (await hallRes.json()).data.id

  return { serviceFacilityId, hallId, hallCapacity, tag }
}

/** Salonlu, salona bağlı (indoor) seanslı bir etkinlik. */
export async function createIndoorSessionableEvent(
  ctx: APIRequestContext, token: string, categoryId: string, serviceFacilityId: string, hallId: string, tag: string,
  overrides: Record<string, unknown> = {},
): Promise<CreatedEvent> {
  const headers = { Authorization: `Bearer ${token}` }
  const startDate = futureIso(15)
  const res = await ctx.post(`${API_BASE}/events`, {
    headers,
    data: {
      name: `${tag} Salon Etkinliği`,
      categoryId,
      venueType: 'indoor',
      facilityId: serviceFacilityId,
      hallId,
      location: null,
      startDate, endDate: startDate, startTime: '09:00', endTime: '10:00',
      gender: 'mixed', capacity: 20, reserveCapacity: 5, minAge: 0, maxAge: 99,
      participationPeriod: 'none', participationLimit: 0,
      description: 'E2E seans matrisi fixture açıklaması', internalNote: 'E2E iç not',
      applicationStartDate: null, applicationEndDate: null,
      images: IMAGES_SPEC,
      access: { hasSessions: true, hasSeating: false, reservationType: 'none', registrationMode: 'none', attendanceEnabled: true, entryMethod: 'checkin', qrEnabled: true, qrType: 'rotating', qrRotationSeconds: 30, kioskEnabled: false, turnstileEnabled: false, publicLinkEnabled: false, publicLinkRequiresPin: false, staffIds: [], notificationTemplates: [], cancellationDeadlineHours: 24 },
      pricing: { isPaid: false, currency: 'TRY', audiences: [], siblingDiscountEnabled: false, siblingDiscounts: [], municipalityEmployeeDiscountEnabled: false, municipalityEmployeePercent: 0, disabledDiscountEnabled: false, disabledPercent: 0, veteranDiscountEnabled: false, veteranPercent: 0, combineDiscounts: false, maxDiscountPercent: 50 },
      points: { enabled: true, basePoints: 5, walkInEarnsPoints: false },
      isActive: true, residencyMode: 'anyone', sultangaziResidentOnly: false,
      ...overrides,
    },
  })
  expect(res.ok(), `salonlu event oluşturulamadı: ${await res.text()}`).toBeTruthy()
  const body = (await res.json()).data
  return { id: body.id, code: body.code, name: body.name }
}

export function baseSessionPayload(eventId: string, overrides: Record<string, unknown> = {}) {
  const date = futureIso(16)
  return {
    eventId, hallId: null, mode: 'single',
    date, startTime: '09:00', endTime: '10:00',
    startDate: date, endDate: date, dayPlans: [] as unknown[],
    capacity: 10, reserveCapacity: 2,
    instructor: null, instructorId: null, instructorPhone: null, instructorEmail: null, emergencyPhone: null,
    isActive: true, grantAccess: false, tckn: null,
    ...overrides,
  }
}

export async function cleanupEventsFixture(
  ctx: APIRequestContext, token: string,
  fx: { eventIds?: string[]; categoryIds?: string[]; hallIds?: string[]; serviceFacilityIds?: string[]; sessionIds?: string[]; adminUserIds?: string[] },
): Promise<void> {
  const headers = { Authorization: `Bearer ${token}` }
  // GERÇEK TESTTE BULUNAN HATA (2026-10-03, Travels/Facility helper'larında bulunan aynı
  // sınıf hata): önceki sürüm `.catch(() => {})` ile 429 RATE_LIMIT_EXCEEDED dahil TÜM silme
  // hatalarını sessizce yutuyordu, yeniden deneme yoktu — bkz. facilitySessionMatrix.ts
  // deleteWithRetry notu (orada canlı DB kalıntısıyla kanıtlandı, buraya önleyici uygulandı).
  for (const id of fx.sessionIds ?? []) await deleteWithRetry(ctx, `${API_BASE}/sessions/${id}`, headers)
  for (const id of fx.eventIds ?? []) await deleteWithRetry(ctx, `${API_BASE}/events/${id}`, headers)
  for (const id of fx.categoryIds ?? []) await deleteWithRetry(ctx, `${API_BASE}/event-categories/${id}`, headers)
  for (const id of fx.hallIds ?? []) await deleteWithRetry(ctx, `${API_BASE}/halls/${id}`, headers)
  for (const id of fx.serviceFacilityIds ?? []) await deleteWithRetry(ctx, `${API_BASE}/service-facilities/${id}`, headers)
  for (const id of fx.adminUserIds ?? []) await deleteWithRetry(ctx, `${API_BASE}/admins/${id}`, headers)
}
