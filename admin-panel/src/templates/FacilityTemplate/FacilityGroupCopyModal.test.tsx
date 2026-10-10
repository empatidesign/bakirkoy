import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FacilityGroupCopyModal } from './FacilityGroupCopyModal'
import type { FacilityModuleService } from './types'
import type { GroupRecord, FacilityRecord } from '@/types/facility.types'

afterEach(cleanup)

const baseGroup: GroupRecord = {
  id: 'group-1',
  facilityId: 'facility-source',
  branchId: 'branch-1',
  branchName: 'El Sanatları',
  name: 'El Sanatları Kursu',
  type: 'kurs',
  gender: 'mixed',
  capacity: 20,
  reserveCapacity: 5,
  registeredCount: 0,
  waitlistCount: 0,
  ageMin: 15,
  ageMax: 80,
  days: ['monday'],
  schedules: [{ day: 'monday', start: '10:00', end: '11:00' }],
  attendanceMode: 'full',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
}

const facilities: FacilityRecord[] = [
  { id: 'facility-source', name: 'Kaynak Merkez', kind: 'indoor', capacity: 0, isActive: true, createdAt: '' },
  { id: 'facility-a', name: 'Tesis A', kind: 'indoor', capacity: 0, isActive: true, createdAt: '' },
  { id: 'facility-b', name: 'Tesis B', kind: 'indoor', capacity: 0, isActive: true, createdAt: '' },
]

const makeService = (copyToFacilities: FacilityModuleService['groups']['copyToFacilities']) =>
  ({ groups: { copyToFacilities } }) as unknown as FacilityModuleService

describe('FacilityGroupCopyModal', () => {
  it('preselects the source facility and prefills the copy name', () => {
    render(<FacilityGroupCopyModal group={baseGroup} service={makeService(vi.fn())} facilities={facilities}
      groupLabel="Grup" onClose={() => {}} onSingleCopyCreated={() => {}} />)
    expect(screen.getByText('Kaynak Merkez (bu tesis)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('El Sanatları Kursu (Kopya)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kopyala' })).toBeEnabled()
  })

  it('disables the Kopyala button when the new name is empty', () => {
    render(<FacilityGroupCopyModal group={baseGroup} service={makeService(vi.fn())} facilities={facilities}
      groupLabel="Grup" onClose={() => {}} onSingleCopyCreated={() => {}} />)
    fireEvent.change(screen.getByDisplayValue('El Sanatları Kursu (Kopya)'), { target: { value: '  ' } })
    expect(screen.getByRole('button', { name: 'Kopyala' })).toBeDisabled()
    expect(screen.getByText('Yeni grup adı zorunludur.')).toBeInTheDocument()
  })

  it('sends name and copy options, and auto-opens edit for a single successful target', async () => {
    const copyToFacilities = vi.fn().mockResolvedValue({
      results: [{ facilityId: 'facility-source', facilityName: 'Kaynak Merkez', success: true, groupId: 'new-group-id', error: null }],
    })
    const onSingleCopyCreated = vi.fn()
    const onClose = vi.fn()
    render(<FacilityGroupCopyModal group={baseGroup} service={makeService(copyToFacilities)} facilities={facilities}
      groupLabel="Grup" onClose={onClose} onSingleCopyCreated={onSingleCopyCreated} />)

    fireEvent.change(screen.getByDisplayValue('El Sanatları Kursu (Kopya)'), { target: { value: 'Yeni Kurs' } })
    fireEvent.click(screen.getByRole('switch', { name: /İçerikle birlikte kopyala/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Kopyala' }))

    await waitFor(() => expect(copyToFacilities).toHaveBeenCalledWith('group-1', ['facility-source'],
      { name: 'Yeni Kurs', includeSubGroups: true, includeContent: false }))
    await waitFor(() => expect(onSingleCopyCreated).toHaveBeenCalledWith('facility-source', 'new-group-id'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows a per-facility result summary (without auto-closing) when multiple targets are copied', async () => {
    const copyToFacilities = vi.fn().mockResolvedValue({
      results: [
        { facilityId: 'facility-a', facilityName: 'Tesis A', success: true, groupId: 'new-a', error: null },
        { facilityId: 'facility-b', facilityName: 'Tesis B', success: false, groupId: null, error: 'Kontenjan, tesis kapasitesini aşamaz.' },
      ],
    })
    const onSingleCopyCreated = vi.fn()
    const onClose = vi.fn()
    render(<FacilityGroupCopyModal group={baseGroup} service={makeService(copyToFacilities)} facilities={facilities}
      groupLabel="Grup" onClose={onClose} onSingleCopyCreated={onSingleCopyCreated} />)

    fireEvent.click(screen.getByRole('button', { name: 'Kopyala' }))

    await waitFor(() => expect(screen.getByText('Tesis A')).toBeInTheDocument())
    expect(screen.getByText('Tesis B')).toBeInTheDocument()
    expect(screen.getByText(/Kontenjan, tesis kapasitesini aşamaz\./)).toBeInTheDocument()
    expect(onSingleCopyCreated).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
