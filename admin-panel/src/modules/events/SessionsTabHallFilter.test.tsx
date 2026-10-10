import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SessionsTab } from './SessionsTab'

// Kullanıcı isteği (2026-10-04): "/halls bağlı seansları da burdan ulaşabilelim" — Salonlar
// listesinden ?hallId=... ile buraya gelindiğinde Seanslar sekmesi o salona göre önceden
// filtrelenmiş olarak listeyi çeker ve kullanıcıya hangi salonun gösterildiğini bildirir.
vi.mock('@/framework/auth/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }))

const getListMock = vi.hoisted(() => vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 1 }))

vi.mock('@/services/session.service', () => ({
  default: {
    getList: getListMock,
    getSummary: vi.fn().mockResolvedValue({ total: 0, active: 0, passive: 0, totalRegistered: 0, totalCapacity: 0 }),
  },
}))
vi.mock('@/services/hall.service', () => ({
  default: {
    getFacilityOptions: vi.fn().mockResolvedValue([]),
    getHallOptions: vi.fn().mockResolvedValue([]),
    getById: vi.fn(),
  },
}))
vi.mock('@/services/eventCategory.service', () => ({ default: { getOptions: vi.fn().mockResolvedValue([]) } }))
vi.mock('@/services/applications.service', () => ({ default: { exportExcel: vi.fn() } }))

afterEach(cleanup)

describe('SessionsTab <- ?hallId= ile gelindiğinde', () => {
  it('liste gerçekten o salona göre filtrelenir ve "Filtreyi kaldır" banner\'ı gösterilir', async () => {
    render(
      <MemoryRouter initialEntries={['/events?tab=sessions&hallId=hall-1']}>
        <Routes>
          <Route path="/events" element={<SessionsTab />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(getListMock).toHaveBeenCalled())
    const lastCall = getListMock.mock.calls[getListMock.mock.calls.length - 1][0] as Record<string, unknown>
    expect(lastCall.hallId).toBe('hall-1')

    expect(await screen.findByText('Belirli bir salonun seansları gösteriliyor.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Filtreyi kaldır/ }))

    await waitFor(() => {
      const calls = getListMock.mock.calls
      const after = calls[calls.length - 1][0] as Record<string, unknown>
      expect(after.hallId).toBeUndefined()
    })
  })
})
