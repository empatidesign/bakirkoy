import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Routes, Route, useSearchParams } from 'react-router-dom'
import { HallsTab } from './HallsTab'
import type { Hall } from '@/types/hall.types'

// Kullanıcı isteği (2026-10-04): "/halls bağlı seansları da burdan ulaşabilelim" — salon
// satırında yeni bir "Bağlı Seanslar" butonu Etkinlik Programı sayfasının Seanslar sekmesine
// o salona filtrelenmiş olarak yönlendirir (?tab=sessions&hallId=...). Gerçek react-router
// MemoryRouter ile gerçek navigasyonu doğrular (useNavigate mock'lanmaz).
vi.mock('@/framework/auth/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }))

const HALL = vi.hoisted((): Hall => ({
  id: 'hall-1', name: 'Ana Salon', facilityId: 'fac-1', facilityName: 'Tesis A',
  type: 'conference', seatingMode: 'standing', capacity: 100, availableCapacity: 100,
  floorCount: 0, featureIds: [], isActive: true, createdAt: '2026-01-01T00:00:00Z',
}))

vi.mock('@/services/hall.service', () => ({
  default: {
    getList: vi.fn().mockResolvedValue({ items: [HALL], total: 1, page: 1, limit: 20, totalPages: 1 }),
    getSummary: vi.fn().mockResolvedValue({ total: 1, active: 1, passive: 0, totalCapacity: 100 }),
    getFacilityOptions: vi.fn().mockResolvedValue([]),
    getFeatureCatalog: vi.fn().mockResolvedValue({ groups: [], features: [] }),
  },
}))

const LandingProbe = () => {
  const [params] = useSearchParams()
  return <div data-testid="landed">tab={params.get('tab')} hallId={params.get('hallId')}</div>
}

afterEach(cleanup)

describe('HallsTab -> bağlı seanslar navigasyonu', () => {
  it('"Bağlı Seanslar" butonu /events?tab=sessions&hallId=<salon id> adresine yönlendirir', async () => {
    render(
      <MemoryRouter initialEntries={['/halls']}>
        <Routes>
          <Route path="/halls" element={<HallsTab />} />
          <Route path="/events" element={<LandingProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    const expandButton = await screen.findByLabelText('Tüm işlemleri göster')
    fireEvent.click(expandButton)

    const button = await screen.findByLabelText('Bağlı Seanslar')
    fireEvent.click(button)

    const landed = await screen.findByTestId('landed')
    expect(landed.textContent).toBe('tab=sessions hallId=hall-1')
  })
})
