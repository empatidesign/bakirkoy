import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventBulkCopyModal } from './EventBulkCopyModal'
import eventService from '@/services/event.service'
import type { Event } from '@/types/event.types'

afterEach(cleanup)

vi.mock('@/services/event.service', () => ({
  default: { bulkCopy: vi.fn() },
}))

const baseEvent: Event = {
  id: 'event-1',
  code: 'EVT-000001',
  name: 'Yaz Semineri',
  categoryId: 'cat-1',
  categoryName: 'Eğitim',
  categoryColor: '#3B82F6',
  venueType: 'indoor',
  startDate: '2026-11-01',
  endDate: '2026-11-01',
  gender: 'all' as unknown as Event['gender'],
  capacity: 30,
  reserveCapacity: 5,
  minAge: 0,
  maxAge: 99,
  participationPeriod: 'none',
  participationLimit: 0,
  description: '',
  internalNote: '',
  images: {} as unknown as Event['images'],
  access: { hasSessions: false, hasSeating: false, reservationType: 'none', registrationMode: 'none' } as unknown as Event['access'],
  pricing: {} as unknown as Event['pricing'],
  points: {} as unknown as Event['points'],
  isActive: true,
  residencyMode: 'anyone' as unknown as Event['residencyMode'],
  sultangaziResidentOnly: false,
  registeredCount: 0,
  reserveCount: 0,
  sessionCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
}

const fillDate = (input: HTMLElement, iso: string) => {
  const [y, m, d] = iso.split('-')
  fireEvent.change(input, { target: { value: `${d}.${m}.${y}` } })
}

describe('EventBulkCopyModal', () => {
  it('starts with a single empty row and disables the create button until dates are filled', () => {
    render(<EventBulkCopyModal event={baseEvent} onClose={() => {}} onCopied={() => {}} />)
    expect(screen.getByText('Etkinlik 1')).toBeInTheDocument()
    expect(screen.queryByText('Etkinlik 2')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Etkinlik Oluştur' })).toBeDisabled()
  })

  it('adding a row shows a second independent set of date fields', () => {
    render(<EventBulkCopyModal event={baseEvent} onClose={() => {}} onCopied={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Başka Etkinlik Ekle/ }))
    expect(screen.getByText('Etkinlik 1')).toBeInTheDocument()
    expect(screen.getByText('Etkinlik 2')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Bu satırı kaldır')).toHaveLength(2)
  })

  it('submits one target per row (optional application dates omitted) and reports results on success', async () => {
    const bulkCopy = vi.mocked(eventService.bulkCopy)
    bulkCopy.mockResolvedValue({
      results: [
        { index: 0, success: true, eventId: 'new-1', code: 'EVT-000002', error: null },
      ],
    })
    const onCopied = vi.fn()
    render(<EventBulkCopyModal event={baseEvent} onClose={() => {}} onCopied={onCopied} />)

    const dateInputs = screen.getAllByPlaceholderText('gg.aa.yyyy')
    // Row 1: Başlangıç, Bitiş (başvuru tarihleri boş bırakılabilir).
    fillDate(dateInputs[0], '2026-12-01')
    fillDate(dateInputs[1], '2026-12-01')

    const submit = screen.getByRole('button', { name: 'Etkinlik Oluştur' })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    await waitFor(() => expect(bulkCopy).toHaveBeenCalledTimes(1))
    expect(bulkCopy).toHaveBeenCalledWith('event-1', [
      { startDate: '2026-12-01', endDate: '2026-12-01', applicationStartDate: null, applicationEndDate: null },
    ])

    await waitFor(() => expect(screen.getByText('Etkinlik 1 · EVT-000002')).toBeInTheDocument())
    expect(onCopied).not.toHaveBeenCalled()

    const closeButtons = screen.getAllByRole('button', { name: 'Kapat' })
    fireEvent.click(closeButtons[closeButtons.length - 1])
    expect(onCopied).toHaveBeenCalled()
  })

  it('rejects submission when end date is before start date', () => {
    render(<EventBulkCopyModal event={baseEvent} onClose={() => {}} onCopied={() => {}} />)
    const dateInputs = screen.getAllByPlaceholderText('gg.aa.yyyy')
    fillDate(dateInputs[0], '2026-12-10')
    fillDate(dateInputs[1], '2026-12-05')
    expect(screen.getByRole('button', { name: 'Etkinlik Oluştur' })).toBeDisabled()
  })
})
