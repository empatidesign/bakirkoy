import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GroupFormFields } from './GroupFormFields'
import { getGroupFormErrors, makeEmptyGroupForm, saveGroupUpdate } from './groupForm.utils'
import { FACILITY_MODULES } from './moduleConfig'
import type { FacilityModuleService } from './types'

// GroupFormFields çağırıyor useAuth() (eğitmen listesi/ekleme kısayolları için) — bu testler
// gerçek bir AuthProvider ile sarmalanmıyor, bu yüzden izin kontrolü sahte olarak her zaman
// false döndürülür (kısayol butonları bu denetim testlerinde zaten doğrulanmıyor). Aynı
// kısayollar gerçek react-router useNavigate()'i de çağırıyor — gerçek bir <Router> olmadan
// testler bu yüzden de patlardı, bu yüzden useNavigate de sahte (no-op) olarak mocklanır.
vi.mock('@/framework/auth/AuthContext', () => ({ useAuth: () => ({ can: () => false }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

// Audit characterizations: these assert observed defects, not desired behavior.
// Replace with regression expectations when the corresponding bugs are fixed.
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const config = FACILITY_MODULES.sports
const valid = () => makeEmptyGroupForm(config, 'facility', {
  name: 'Audit', branchId: 'branch', capacity: '20',
})

describe('2026-10-03 creation audit: observed defects', () => {
  it.each([
    ['reversed age range', { ageMin: '30', ageMax: '10' }],
    ['age above backend maximum', { ageMax: '121' }],
    ['paid group without amount', { isPaid: true, feeAmount: '' }],
    ['reversed schedule', { schedules: [{ day: 'Monday', start: '11:00', end: '10:00' }] }],
    ['reversed period', { periodStart: '2099-12-20', periodEnd: '2099-12-01' }],
  ])('frontend accepts %s', (_name, patch) => {
    expect(getGroupFormErrors({ ...valid(), ...patch }, 'create', 'Grup')).toEqual([])
  })

  it('one-day preview shows the next day although backend includes the start day', () => {
    render(<GroupFormFields config={config}
      form={{ ...valid(), periodUnit: 'day', periodStart: '2099-12-01', periodDays: '1' }}
      setForm={() => {}} branches={[]} instructors={[]} documentLibrary={[]} mode="create" />)
    expect(screen.getByText('2099-12-02')).toBeInTheDocument()
  })

  it('declining attendance deletion resolves normally, so callers close the editor', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const update = vi.fn().mockRejectedValue({ response: { data: { errorCode: 'SCHEDULE_SYNC_ATTENDANCE_CONFIRM' } } })
    const service = { groups: { update } } as unknown as FacilityModuleService
    await expect(saveGroupUpdate(service, 'group', valid())).resolves.toBeUndefined()
    expect(update).toHaveBeenCalledTimes(1)
  })
})
