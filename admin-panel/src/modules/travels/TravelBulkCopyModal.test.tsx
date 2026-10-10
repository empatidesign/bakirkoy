import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TravelBulkCopyModal } from './TravelBulkCopyModal'
import travelService from '@/services/travel.service'
import type { Travel } from '@/types/travel.types'

afterEach(cleanup)

vi.mock('@/services/travel.service', () => ({
  default: { bulkCopy: vi.fn() },
}))

const baseTravel: Travel = {
  id: 'travel-1',
  code: 'GEZ-000001',
  routeId: 'route-1',
  name: 'Bursa Gezisi',
  categoryId: 'cat-1',
  categoryName: 'Kültür',
  categoryColor: '#3B82F6',
  destination: 'Bursa',
  description: '',
  conditions: '',
  internalNote: '',
  startDate: '2026-11-01',
  endDate: '2026-11-02',
  registrationStartDate: '2026-10-01',
  registrationEndDate: '2026-10-25',
  gender: 'mixed',
  minAge: 0,
  maxAge: 99,
  capacity: 20,
  registeredCount: 0,
  reserveCount: 0,
  reserveCapacity: 5,
  participationPeriod: 'none',
  participationLimit: 0,
  exemptFromParticipationLimit: false,
  cancellationDeadlineHours: 24,
  restrictions: {} as unknown as Travel['restrictions'],
  images: {} as unknown as Travel['images'],
  pricing: {} as unknown as Travel['pricing'],
  points: {} as unknown as Travel['points'],
  crew: {} as unknown as Travel['crew'],
  busCount: 0,
  isActive: true,
  departurePoint: '',
  createdAt: '2026-01-01T00:00:00Z',
}

const fillDate = (input: HTMLElement, iso: string) => {
  const [y, m, d] = iso.split('-')
  fireEvent.change(input, { target: { value: `${d}.${m}.${y}` } })
}

describe('TravelBulkCopyModal', () => {
  it('starts with a single empty row and disables the create button until dates are filled', () => {
    render(<TravelBulkCopyModal travel={baseTravel} onClose={() => {}} onCopied={() => {}} />)
    expect(screen.getByText('Sefer 1')).toBeInTheDocument()
    expect(screen.queryByText('Sefer 2')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sefer Oluştur' })).toBeDisabled()
  })

  it('adding a row shows a second independent set of date fields', () => {
    render(<TravelBulkCopyModal travel={baseTravel} onClose={() => {}} onCopied={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Başka Sefer Ekle/ }))
    expect(screen.getByText('Sefer 1')).toBeInTheDocument()
    expect(screen.getByText('Sefer 2')).toBeInTheDocument()
    // IconButton exposes its `title` as an accessible name (aria-label), not a DOM title
    // attribute — each row (but not a lone first row) gets its own remove button.
    expect(screen.getAllByLabelText('Bu satırı kaldır')).toHaveLength(2)
  })

  it('submits one target per row and reports a per-row result summary on success', async () => {
    const bulkCopy = vi.mocked(travelService.bulkCopy)
    bulkCopy.mockResolvedValue({
      results: [
        { index: 0, success: true, travelId: 'new-1', code: 'GEZ-000002', error: null },
        { index: 1, success: true, travelId: 'new-2', code: 'GEZ-000003', error: null },
      ],
    })
    const onCopied = vi.fn()
    render(<TravelBulkCopyModal travel={baseTravel} onClose={() => {}} onCopied={onCopied} />)

    fireEvent.click(screen.getByRole('button', { name: /Başka Sefer Ekle/ }))

    const startInputs = screen.getAllByPlaceholderText('gg.aa.yyyy')
    // Row 1: Gidiş, Dönüş, Kayıt Başlangıcı, Kayıt Bitişi (4 fields); row 2 the same, in order.
    fillDate(startInputs[0], '2026-12-01')
    fillDate(startInputs[1], '2026-12-02')
    fillDate(startInputs[2], '2026-11-15')
    fillDate(startInputs[3], '2026-11-28')
    fillDate(startInputs[4], '2026-12-10')
    fillDate(startInputs[5], '2026-12-11')
    fillDate(startInputs[6], '2026-11-20')
    fillDate(startInputs[7], '2026-12-05')

    const submit = screen.getByRole('button', { name: '2 Sefer Oluştur' })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    await waitFor(() => expect(bulkCopy).toHaveBeenCalledTimes(1))
    expect(bulkCopy).toHaveBeenCalledWith('travel-1', [
      { startDate: '2026-12-01', endDate: '2026-12-02', registrationStartDate: '2026-11-15', registrationEndDate: '2026-11-28', cloneBuses: false },
      { startDate: '2026-12-10', endDate: '2026-12-11', registrationStartDate: '2026-11-20', registrationEndDate: '2026-12-05', cloneBuses: false },
    ])

    await waitFor(() => expect(screen.getByText('Sefer 1 · GEZ-000002')).toBeInTheDocument())
    expect(screen.getByText('Sefer 2 · GEZ-000003')).toBeInTheDocument()
    expect(onCopied).not.toHaveBeenCalled()

    // Modal'ın kendi X kapatma butonu da "Kapat" adıyla erişilebilir; footer'daki asıl
    // "Kapat" aksiyon butonu listedeki ikinci (son) eleman.
    const closeButtons = screen.getAllByRole('button', { name: 'Kapat' })
    fireEvent.click(closeButtons[closeButtons.length - 1])
    expect(onCopied).toHaveBeenCalled()
  })
})
