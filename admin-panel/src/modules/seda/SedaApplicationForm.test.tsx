import { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { emptySedaApplicationForm } from './sedaConstants'
import type { SedaApplicationForm as FormData } from '@/types/seda.types'

vi.mock('@/services/seda.service', () => ({
  default: {
    getSchoolOptions: vi.fn().mockResolvedValue([]),
    getDefinitionOptions: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('@/services/participant.service', () => ({ default: { lookupByTckn: vi.fn() } }))

import participantService from '@/services/participant.service'
import { SedaApplicationForm } from './SedaApplicationForm'

const TCKN_A = '12345678901'
const TCKN_B = '10987654321'

const Host = () => {
  const [form, setForm] = useState<FormData>(() => ({ ...emptySedaApplicationForm() }))
  return (
    <>
      <button onClick={() => setForm((f) => ({ ...f, tckn: TCKN_A }))}>A</button>
      <button onClick={() => setForm((f) => ({ ...f, tckn: TCKN_B }))}>B</button>
      <SedaApplicationForm form={form} setForm={setForm} editingRow={null} mode="create" />
    </>
  )
}

describe('SedaApplicationForm — TCKN otomatik doldurma (E01/R02)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('kayıtlı katılımcı bulununca ad/soyad otomatik dolar', async () => {
    vi.mocked(participantService.lookupByTckn).mockResolvedValue({
      exists: true,
      participant: { fullName: 'Ali Veli', birthDate: '2010-05-01', phone: '05551112233', guardianPhone: '05334445566', address: 'Sultangazi' },
    } as never)
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByPlaceholderText('Öğrenci adı')).toHaveValue('Ali'))
    expect(screen.getByPlaceholderText('Öğrenci soyadı')).toHaveValue('Veli')
  })

  it('R02: A doldurulduktan sonra bulunamayan B seçilince A verisi TEMİZLENİR', async () => {
    vi.mocked(participantService.lookupByTckn).mockImplementation((tckn: string) =>
      tckn === TCKN_A
        ? Promise.resolve({ exists: true, participant: { fullName: 'Ali Veli', birthDate: '2010-05-01', phone: '05551112233', guardianPhone: '05334445566', address: 'Sultangazi' } } as never)
        : Promise.resolve({ exists: false, participant: null } as never))
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByPlaceholderText('Öğrenci adı')).toHaveValue('Ali'))
    await user.click(screen.getByRole('button', { name: 'B' }))
    await waitFor(() => expect(screen.getByPlaceholderText('Öğrenci adı')).toHaveValue(''))
    expect(screen.getByPlaceholderText('Öğrenci soyadı')).toHaveValue('')
  })

  it('R02: A→B geçişinde B eksik alanları A verisiyle DOLDURULMAZ', async () => {
    vi.mocked(participantService.lookupByTckn).mockImplementation((tckn: string) =>
      tckn === TCKN_A
        ? Promise.resolve({ exists: true, participant: { fullName: 'Ali Veli', birthDate: '2010-05-01', phone: '05551112233', guardianPhone: '05334445566', address: 'Sultangazi' } } as never)
        : Promise.resolve({ exists: true, participant: { fullName: 'Ayşe Can', birthDate: null, phone: null, guardianPhone: null, address: null } } as never))
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByPlaceholderText('Öğrenci adı')).toHaveValue('Ali'))
    await user.click(screen.getByRole('button', { name: 'B' }))
    await waitFor(() => expect(screen.getByPlaceholderText('Öğrenci adı')).toHaveValue('Ayşe'))
    expect(screen.getByPlaceholderText('Öğrenci soyadı')).toHaveValue('Can')
    expect(screen.getByPlaceholderText('Adres bilgileri')).toHaveValue('')
  })

  it('R02: sorgu hatasında kullanıcıya mesaj gösterilir ve alanlar temizlenir', async () => {
    vi.mocked(participantService.lookupByTckn).mockImplementation((tckn: string) =>
      tckn === TCKN_A
        ? Promise.resolve({ exists: true, participant: { fullName: 'Ali Veli', birthDate: '2010-05-01', phone: '05551112233', guardianPhone: '05334445566', address: 'Sultangazi' } } as never)
        : Promise.reject(new Error('network')))
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByPlaceholderText('Öğrenci adı')).toHaveValue('Ali'))
    await user.click(screen.getByRole('button', { name: 'B' }))
    await waitFor(() => expect(screen.getByText(/sorgulanamadı/i)).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Öğrenci adı')).toHaveValue('')
  })
})
