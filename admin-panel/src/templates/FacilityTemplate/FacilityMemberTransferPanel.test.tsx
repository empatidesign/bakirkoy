import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FacilityMemberTransferPanel } from './FacilityMemberTransferPanel'
import type { FacilityModuleService } from './types'
import type { BulkPreRegisterResult } from '@/types/facility.types'

afterEach(cleanup)

const okResult = (n: number, waitlisted = 0): BulkPreRegisterResult => ({
  requested: n, registered: n - waitlisted, waitlisted, alreadyRegistered: 0, notFound: 0, failed: 0, rows: [],
})

const makeService = (bulkPreRegister: FacilityModuleService['registrations']['bulkPreRegister']) =>
  ({ registrations: { bulkPreRegister } }) as unknown as FacilityModuleService

describe('FacilityMemberTransferPanel', () => {
  it('adds a single valid TCKN to the reserve list', async () => {
    const bulk = vi.fn().mockResolvedValue(okResult(1, 1))
    const onDone = vi.fn()
    render(<FacilityMemberTransferPanel groups={[{ id: 'g1', name: 'Kadın El Sanatları' }]} service={makeService(bulk)} onDone={onDone} collapsible={false} />)

    fireEvent.click(screen.getByText('Yedek Liste'))
    fireEvent.change(screen.getByPlaceholderText('11 haneli T.C. kimlik no'), { target: { value: '10000000146' } })
    fireEvent.click(screen.getByRole('button', { name: 'Yedeğe Ekle' }))

    await waitFor(() => expect(bulk).toHaveBeenCalledWith('g1', ['10000000146'], undefined, 'reserve'))
    expect(onDone).toHaveBeenCalled()
  })

  it('sends a pasted TCKN list to every selected group', async () => {
    const bulk = vi.fn().mockResolvedValue(okResult(2))
    render(
      <FacilityMemberTransferPanel
        groups={[{ id: 'g1', name: 'Grup 1' }, { id: 'g2', name: 'Grup 2' }]}
        service={makeService(bulk)}
        onDone={() => {}}
        collapsible={false}
      />,
    )

    fireEvent.click(screen.getByText('Toplu TC'))
    fireEvent.change(screen.getByPlaceholderText(/12345678901/), { target: { value: '10000000146\n10000000146, 20000000046' } })
    fireEvent.click(screen.getByRole('button', { name: '3 Kişiyi Ekle' }))

    await waitFor(() => expect(bulk).toHaveBeenCalledTimes(2))
    expect(bulk).toHaveBeenNthCalledWith(1, 'g1', ['10000000146', '10000000146', '20000000046'], undefined, 'auto')
    expect(bulk).toHaveBeenNthCalledWith(2, 'g2', ['10000000146', '10000000146', '20000000046'], undefined, 'auto')
  })

  it('blocks submit for an invalid single TCKN', () => {
    const bulk = vi.fn()
    render(<FacilityMemberTransferPanel groups={[{ id: 'g1', name: 'G' }]} service={makeService(bulk)} onDone={() => {}} collapsible={false} />)
    fireEvent.change(screen.getByPlaceholderText('11 haneli T.C. kimlik no'), { target: { value: '12345678901' } })
    expect(screen.getByRole('button', { name: 'Ekle' })).toBeDisabled()
  })
})
