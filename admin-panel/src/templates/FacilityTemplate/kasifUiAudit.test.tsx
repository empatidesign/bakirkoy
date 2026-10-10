import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FacilityGroupsTab } from './tabs/FacilityGroupsTab'
import { FACILITY_MODULES } from './moduleConfig'
import type { FacilityModuleService } from './types'
import type { GroupRecord } from '@/types/facility.types'
import type { ReactNode } from 'react'

// GroupFormFields (FacilityGroupsTab'in renderForm'u içinde) useAuth() çağırıyor — gerçek bir
// AuthProvider burada yok, bu yüzden izin kontrolü sahte olarak her zaman false döner. Aynı
// bileşen gerçek react-router useNavigate()'i de çağırıyor — gerçek bir <Router> olmadan da
// patlar, bu yüzden useNavigate de sahte (no-op) olarak mocklanır.
vi.mock('@/framework/auth/AuthContext', () => ({ useAuth: () => ({ can: () => false }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

// Kaşif Çocuk variant of sportsUiAudit.test.tsx — same shared FacilityGroupsTab component,
// different FACILITY_MODULES config (supportsSections: false, unlike pool's true; narrower
// default age range 6-12; indoor-only facility kind). Confirms SP-04/SP-07 (shared-code
// findings) reproduce identically for kasif_cocuk, and that supportsSections:false does not
// change the button wiring or form submission behavior either (same as pool's true value had
// no effect — confirming the flag is inert regardless of its value, not just when true).
const harness = vi.hoisted(() => ({ mode: 'bulk', props: {} as Record<string, unknown> }))
vi.mock('@/templates/CrudListTemplate', () => ({ CrudListTemplate: (props: {
  bulkActions: (rows: GroupRecord[], actions: { clear: () => void; refresh: () => void }) => ReactNode
  extraRowActions: (row: GroupRecord) => ReactNode
}) => {
  harness.props = props as unknown as Record<string, unknown>
  if (harness.mode === 'bulk') return props.bulkActions([
    { id: 'active', isActive: true } as GroupRecord, { id: 'passive', isActive: false } as GroupRecord,
  ], { clear: () => {}, refresh: () => {} })
  return props.extraRowActions({ id: 'parent', facilityId: 'facility', branchId: 'branch', name: 'Parent', type: 'kurs', capacity: 0 } as GroupRecord)
} }))
vi.mock('./FacilitySendMessageModal', () => ({ FacilitySendMessageModal: () => null }))
vi.mock('./FacilityRosterModal', () => ({ FacilityRosterModal: () => null }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function service() {
  return {
    groups: { getList: vi.fn().mockResolvedValue({ items: [] }), toggleStatus: vi.fn().mockResolvedValue({}), createSubGroup: vi.fn().mockResolvedValue({}) },
    branches: { getOptions: vi.fn().mockResolvedValue([{ id: 'branch', name: 'Robot Atölyesi' }]) },
    settings: { getGeneral: vi.fn().mockResolvedValue({}) },
    instructors: { getOptions: vi.fn().mockResolvedValue([]) },
    facilities: { getOptions: vi.fn().mockResolvedValue([]) },
  }
}

// Exercises real buttons and form fields; only list shell / unrelated message UI are replaced.
// Characterizations of current defects, not assertions that this behavior is desirable.
describe('Kaşif UI audit', () => {
  it.each(['Aktif Yap', 'Pasif Yap'])('%s toggles both already-correct and opposite rows', async (label) => {
    harness.mode = 'bulk'; const api = service()
    render(<FacilityGroupsTab config={FACILITY_MODULES.kasif_cocuk} service={api as unknown as FacilityModuleService} facilityId="facility" />)
    fireEvent.click(screen.getByRole('button', { name: label }))
    await waitFor(() => expect(api.groups.toggleStatus).toHaveBeenCalledTimes(2))
    expect(api.groups.toggleStatus).toHaveBeenCalledWith('active')
    expect(api.groups.toggleStatus).toHaveBeenCalledWith('passive')
  })

  it('quick session drawer submits blank required age bounds', async () => {
    harness.mode = 'sub'; const api = service()
    render(<FacilityGroupsTab config={FACILITY_MODULES.kasif_cocuk} service={api as unknown as FacilityModuleService} facilityId="facility" />)
    fireEvent.click(screen.getByRole('button', { name: 'Seans Oluştur' }))
    await waitFor(() => expect(screen.getByPlaceholderText('Örn. 20')).toBeInTheDocument())
    const nameInput = screen.getByPlaceholderText('Atölye Grubu adını giriniz...')
    fireEvent.change(nameInput, { target: { value: 'Audit Session' } })
    fireEvent.change(screen.getByPlaceholderText('Örn. 20'), { target: { value: '20' } })
    fireEvent.change(screen.getByPlaceholderText('Örn. 8'), { target: { value: '' } })
    fireEvent.change(screen.getByPlaceholderText('Örn. 14'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'Seansı Kaydet' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Seansı Kaydet' }))
    await waitFor(() => expect(api.groups.createSubGroup).toHaveBeenCalledWith('parent', expect.objectContaining({ ageMin: '', ageMax: '' })))
  })
})
