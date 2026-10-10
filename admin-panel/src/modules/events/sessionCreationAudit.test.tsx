import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SessionForm } from './SessionForm'
import { emptySessionForm } from '@/types/session.types'
import eventService from '@/services/event.service'
import sessionService from '@/services/session.service'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

// Characterization of an observed defect; this is not the desired behavior.
it('audit: changing event retains the previous event date', async () => {
  vi.spyOn(eventService, 'getById').mockImplementation(async (id) => ({
    id, name: id, startDate: id === 'A' ? '2099-11-01' : '2099-12-01',
    endDate: id === 'A' ? '2099-11-01' : '2099-12-01',
    venueType: 'outdoor', capacity: 20, reserveCapacity: 0,
    access: { hasSeating: false, reservationType: 'none' },
  } as Awaited<ReturnType<typeof eventService.getById>>))
  vi.spyOn(sessionService, 'getList').mockResolvedValue({ items: [], total: 0, page: 1, limit: 100, totalPages: 0 })
  const Host = () => {
    const [form, setForm] = useState({ ...emptySessionForm(), eventId: 'A' })
    return <><button onClick={() => setForm((f) => ({ ...f, eventId: 'B' }))}>Switch event</button>
      <output data-testid="form-state">{form.eventId}|{form.date}</output>
      <SessionForm form={form} setForm={setForm} mode="create" editingRow={null} lockEvent />
    </>
  }
  render(<Host />)
  await waitFor(() => expect(screen.getByTestId('form-state')).toHaveTextContent('A|2099-11-01'))
  fireEvent.click(screen.getByText('Switch event'))
  await waitFor(() => expect(eventService.getById).toHaveBeenCalledWith('B'))
  await waitFor(() => expect(screen.getByText('B', { selector: 'p, div, span, input' })).toBeInTheDocument())
  expect(screen.getByTestId('form-state')).toHaveTextContent('B|2099-11-01')
})
