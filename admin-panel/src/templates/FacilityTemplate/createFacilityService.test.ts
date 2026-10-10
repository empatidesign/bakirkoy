import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import { api } from '@/services/api'
import type { FacilityForm } from '@/types/facility.types'
import { createFacilityService } from './createFacilityService'

const originalAdapter = api.defaults.adapter

afterEach(() => {
  api.defaults.adapter = originalAdapter
})

describe.each(['create', 'update'] as const)('facility %s request', (operation) => {
  it.each([
    { capacity: '', expected: 0 },
    { capacity: '0', expected: 0 },
    { capacity: '120', expected: 120 },
  ])('sends capacity "$capacity" as the JSON number $expected', async ({ capacity, expected }) => {
    const form: FacilityForm = {
      name: 'Kadın ve Aile Merkezi',
      kind: 'indoor',
      serviceFacilityId: 'cd218b72-e390-468f-8c30-d707610c2231',
      capacity,
      managerId: '',
      manager: '',
      managerRoleKey: '',
      managerRoleName: '',
      managerPhone: '',
      managerEmail: '',
      emergencyPhone: '',
      grantAccess: false,
      tckn: '',
      isActive: true,
    }
    const saved = { id: 'facility-id', name: form.name, capacity: expected }
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({
      data: { data: saved },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }))
    api.defaults.adapter = adapter

    const service = createFacilityService('/women-family')
    const result = operation === 'create'
      ? await service.facilities.create(form)
      : await service.facilities.update(saved.id, form)

    expect(adapter).toHaveBeenCalledOnce()
    const request = adapter.mock.calls[0][0]
    expect(request.method).toBe(operation === 'create' ? 'post' : 'put')
    expect(request.url).toBe(`/women-family/facilities${operation === 'update' ? `/${saved.id}` : ''}`)
    expect(JSON.parse(request.data)).toEqual({ ...form, capacity: expected })
    expect(form.capacity).toBe(capacity)
    expect(result).toEqual(saved)
  })
})

// Kullanıcı isteği (2026-10-01): grup/seans kopyalama — "başka tesislerde de aynı
// saatlerde aynı günlerde seansları olabilir" isteğiyle eklenen POST .../groups/{id}/copy
// çağrısının doğru URL/body ile gittiğini ve backend'in sonuç şeklini (per-tesis
// başarı/hata) olduğu gibi geri döndürdüğünü doğrular.
describe('facility group copy request', () => {
  it('posts targetFacilityIds to /groups/{id}/copy and returns the per-facility results as-is', async () => {
    const groupId = 'group-123'
    const serverResult = {
      results: [
        { facilityId: 'fac-a', facilityName: 'Tesis A', success: true, groupId: 'new-group-a', error: null },
        { facilityId: 'fac-b', facilityName: 'Tesis B', success: false, groupId: null, error: 'Tesis bulunamadı.' },
      ],
    }
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({
      data: { data: serverResult },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }))
    api.defaults.adapter = adapter

    const service = createFacilityService('/women-family')
    const result = await service.groups.copyToFacilities(groupId, ['fac-a', 'fac-b'])

    expect(adapter).toHaveBeenCalledOnce()
    const request = adapter.mock.calls[0][0]
    expect(request.method).toBe('post')
    expect(request.url).toBe(`/women-family/groups/${groupId}/copy`)
    expect(JSON.parse(request.data)).toEqual({ targetFacilityIds: ['fac-a', 'fac-b'] })
    expect(result).toEqual(serverResult)
  })
})
