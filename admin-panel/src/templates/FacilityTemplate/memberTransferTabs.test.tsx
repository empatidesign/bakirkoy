import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { FacilityGroupsTab } from './tabs/FacilityGroupsTab'
import { FacilitySessionsTab } from './tabs/FacilitySessionsTab'
import { FACILITY_MODULES } from './moduleConfig'
import type { FacilityModuleService } from './types'
import type { GroupRecord, SessionRecord, BulkPreRegisterResult } from '@/types/facility.types'

// Kullanıcı isteği (2026-10-06) doğrulaması: Gruplar ve Seans Takvimi ekranlarından TC ile
// tek/toplu üye ve yedek aktarımı gerçek panel + gerçek sekme bileşenleri üzerinden çalışıyor mu?

vi.mock('@/framework/auth/AuthContext', () => ({ useAuth: () => ({ can: () => false, state: { status: 'anonymous' } }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('./FacilitySendMessageModal', () => ({ FacilitySendMessageModal: () => null }))

const roster = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }))
vi.mock('./FacilityRosterModal', () => ({
  FacilityRosterModal: (props: Record<string, unknown>) => { roster.props = props; return <div data-testid="roster-modal">{String(props.groupName)}</div> },
}))

// Liste kabuğu: seçili satırlar olarak iki grup verip bulkActions'ı render eder.
const selectedGroups = [
  { id: 'g1', name: 'El Sanatları A', type: 'kurs', isActive: true } as GroupRecord,
  { id: 'g2', name: 'Okuma Yazma B', type: 'kurs', isActive: true } as GroupRecord,
]
vi.mock('@/templates/CrudListTemplate', () => ({
  CrudListTemplate: (props: { bulkActions: (rows: GroupRecord[], a: { clear: () => void; refresh: () => void }) => ReactNode }) =>
    <div>{props.bulkActions(selectedGroups, { clear: () => {}, refresh: () => {} })}</div>,
}))

// Takvim: ilk render'da bir gün seçer.
vi.mock('@/components/specialized/MonthCalendar', async () => {
  const { useEffect } = await import('react')
  return {
    MonthCalendar: ({ onSelectDate }: { onSelectDate: (d: string) => void }) => {
      useEffect(() => { onSelectDate('2026-10-07') }, [onSelectDate])
      return null
    },
  }
})

afterEach(() => { cleanup(); roster.props = null })

const ok = (n: number): BulkPreRegisterResult => ({ requested: n, registered: 0, waitlisted: n, alreadyRegistered: 0, notFound: 0, failed: 0, rows: [] })

function makeService(extra: { sessions?: SessionRecord[] } = {}) {
  return {
    groups: {
      getList: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      toggleStatus: vi.fn(),
      getById: vi.fn().mockImplementation(async (id: string) => ({ id, name: `Grup ${id}`, capacity: 10, type: 'kurs', periodType: null })),
    },
    branches: { getOptions: vi.fn().mockResolvedValue([]), getList: vi.fn().mockResolvedValue({ items: [] }) },
    settings: { getGeneral: vi.fn().mockResolvedValue({}) },
    instructors: { getOptions: vi.fn().mockResolvedValue([]) },
    facilities: { getOptions: vi.fn().mockResolvedValue([]) },
    sessions: {
      getCalendar: vi.fn().mockResolvedValue([]),
      getByDay: vi.fn().mockResolvedValue(extra.sessions ?? []),
    },
    registrations: { bulkPreRegister: vi.fn().mockImplementation(async (_g: string, t: string[]) => ok(t.length)) },
  }
}

const session = (id: string, groupId: string, groupName: string): SessionRecord => ({
  id, facilityId: 'f', groupId, groupName, date: '2026-10-07', day: 'wednesday', startTime: '10:00', endTime: '11:00',
})

describe('TC ile üye/yedek aktarımı — Gruplar sekmesi', () => {
  it('seçili her gruba toplu TC listesini yedek hedefiyle aktarır', async () => {
    const api = makeService()
    render(<FacilityGroupsTab config={FACILITY_MODULES.women_family} service={api as unknown as FacilityModuleService} facilityId="f" />)

    fireEvent.click(screen.getByRole('button', { name: /TC ile Üye \/ Yedek Ekle/ }))
    const dialog = await screen.findByText('TC Kimlik ile Üye Aktarımı')
    expect(screen.getByText('2 grup seçili')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Toplu TC'))
    fireEvent.click(screen.getByText('Yedek Liste'))
    fireEvent.change(screen.getByPlaceholderText(/12345678901/), { target: { value: '10000000146\n20000000046' } })
    fireEvent.click(screen.getByRole('button', { name: '2 Kişiyi Yedeğe Ekle' }))

    await waitFor(() => expect(api.registrations.bulkPreRegister).toHaveBeenCalledTimes(2))
    expect(api.registrations.bulkPreRegister).toHaveBeenCalledWith('g1', ['10000000146', '20000000046'], undefined, 'reserve')
    expect(api.registrations.bulkPreRegister).toHaveBeenCalledWith('g2', ['10000000146', '20000000046'], undefined, 'reserve')
    expect(dialog).toBeInTheDocument()
    // her grubun sonucu ayrı başlıkla listelenir
    expect(await screen.findAllByText('El Sanatları A')).not.toHaveLength(0)
  })
})

describe('TC ile üye/yedek aktarımı — Seans Takvimi', () => {
  const sessions = [
    session('s1', 'g1', 'El Sanatları A'),
    session('s2', 'g1', 'El Sanatları A'), // aynı grubun ikinci seansı — tekilleştirilmeli
    session('s3', 'g2', 'Okuma Yazma B'),
  ]

  it('satırdaki Kayıtlar / Yedekler düğmesi grubu yükleyip roster modalını açar', async () => {
    const api = makeService({ sessions })
    render(<FacilitySessionsTab config={FACILITY_MODULES.women_family} service={api as unknown as FacilityModuleService} facilityId="f" />)

    const buttons = await screen.findAllByLabelText('Kayıtlar / Yedekler (TC ile üye ekle)')
    fireEvent.click(buttons[2])
    await waitFor(() => expect(screen.getByTestId('roster-modal')).toHaveTextContent('Grup g2'))
    expect(api.groups.getById).toHaveBeenCalledWith('g2')
    expect(roster.props).toMatchObject({ groupId: 'g2', module: 'women-family', capacity: 10 })
  })

  it('seçili seansların gruplarına (tekil) tek TC ile asıl hedefli aktarım yapar', async () => {
    const api = makeService({ sessions })
    render(<FacilitySessionsTab config={FACILITY_MODULES.women_family} service={api as unknown as FacilityModuleService} facilityId="f" />)

    await screen.findAllByLabelText('Kayıtlar / Yedekler (TC ile üye ekle)')
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0]) // tümünü seç
    fireEvent.click(await screen.findByRole('button', { name: /TC ile Üye \/ Yedek Ekle/ }))

    await screen.findByText('TC Kimlik ile Üye Aktarımı')
    expect(screen.getByText('2 grup seçili')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Asıl Liste'))
    fireEvent.change(screen.getByPlaceholderText('11 haneli T.C. kimlik no'), { target: { value: '10000000146' } })
    fireEvent.click(screen.getByRole('button', { name: 'Asıla Ekle' }))

    await waitFor(() => expect(api.registrations.bulkPreRegister).toHaveBeenCalledTimes(2))
    const calledGroups = api.registrations.bulkPreRegister.mock.calls.map((c) => c[0]).sort()
    expect(calledGroups).toEqual(['g1', 'g2'])
    for (const c of api.registrations.bulkPreRegister.mock.calls) expect(c.slice(1)).toEqual([['10000000146'], undefined, 'main'])
  })
})
