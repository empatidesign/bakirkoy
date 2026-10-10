import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GroupFormFields } from './GroupFormFields'
import { getGroupFormErrors, makeEmptyGroupForm } from './groupForm.utils'
import { FACILITY_MODULES } from './moduleConfig'

// GroupFormFields çağırıyor useAuth() (eğitmen listesi/ekleme kısayolları için) — bu testler
// gerçek bir AuthProvider ile sarmalanmıyor, bu yüzden izin kontrolü sahte olarak her zaman
// false döndürülür (kısayol butonları testlerde zaten doğrulanmıyor). Aynı kısayollar gerçek
// react-router useNavigate()'i de çağırıyor — gerçek bir <Router> olmadan testler bu yüzden
// de patlardı, bu yüzden useNavigate de sahte (no-op) olarak mocklanır.
vi.mock('@/framework/auth/AuthContext', () => ({ useAuth: () => ({ can: () => false }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

afterEach(cleanup)

const config = FACILITY_MODULES.women_family
const validForm = () => makeEmptyGroupForm(config, 'facility', {
  name: 'Yeni grup', branchId: 'program', capacity: '20',
})

describe('new main group settings', () => {
  it.each(Object.values(FACILITY_MODULES))('$id shows all settings when creating a main group', (moduleConfig) => {
    render(<GroupFormFields config={moduleConfig} form={makeEmptyGroupForm(moduleConfig, 'facility')}
      setForm={() => {}} branches={[]} instructors={[]} documentLibrary={[]} mode="create" />)

    for (const title of ['Grup Türü', 'Kontenjan ve Yaş', 'Program', 'Dönem / Periyot Ayarları',
      'Seans Girişi (QR)', 'Evrak Şartları', 'İkamet ve Katılım Bölgesi', 'Başvuru Onay Sistemi', 'Devamsızlık Hakları']) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0)
    }
    expect(screen.getAllByText('Durum')).toHaveLength(1)
    expect(screen.getAllByText('Katılım Bölgesi')).toHaveLength(1)
    expect(screen.queryByText(/Ana grubu kaydettikten sonra/)).not.toBeInTheDocument()
  })

  it('keeps settings visible after entering capacity and changing group type', () => {
    const Host = () => {
      const [form, setForm] = useState(makeEmptyGroupForm(config, 'facility'))
      return <GroupFormFields config={config} form={form} setForm={setForm}
        branches={[]} instructors={[]} documentLibrary={[]} mode="create" />
    }
    render(<Host />)
    fireEvent.change(screen.getByPlaceholderText('Örn. 20'), { target: { value: '35' } })
    fireEvent.click(screen.getByRole('button', { name: /^Akademi/ }))
    expect(screen.getByPlaceholderText('Örn. 20')).toHaveValue('35')
    expect(screen.getByText('Akademi Ayarları')).toBeInTheDocument()
    expect(screen.getAllByText('Dönem / Periyot Ayarları').length).toBeGreaterThan(0)
  })

  it('preserves the existing parent container edit form', () => {
    render(<GroupFormFields config={config} form={makeEmptyGroupForm(config, 'facility')}
      setForm={() => {}} branches={[]} instructors={[]} documentLibrary={[]} mode="edit" />)
    expect(screen.getByText('Katılım Bölgesi')).toBeInTheDocument()
    expect(screen.queryByText('Kontenjan ve Yaş')).not.toBeInTheDocument()
  })

  it('keeps saved program settings visible when capacity is zero', () => {
    const form = makeEmptyGroupForm(config, 'facility', {
      capacity: '0', isActive: false,
      schedules: [{ day: 'Monday', start: '10:00', end: '11:00' }],
    })
    render(<GroupFormFields config={config} form={form} setForm={() => {}}
      branches={[]} instructors={[]} documentLibrary={[]} mode="edit" />)
    expect(screen.getByText('Kontenjan ve Yaş')).toBeInTheDocument()
    expect(screen.getByText('Dönem / Periyot Ayarları')).toBeInTheDocument()
  })

  it.each(['', '0'])('rejects active new main groups with capacity "%s" before sending', (capacity) => {
    expect(getGroupFormErrors({ ...validForm(), capacity }, 'create', 'Grup'))
      .toContain('Aktif grubun kontenjanı 0’dan büyük bir tam sayı olmalıdır.')
  })

  it('validates recurring periods for new main groups', () => {
    expect(getGroupFormErrors({ ...validForm(), periodType: 'recurring' }, 'create', 'Grup'))
      .toContain('Tekrarlanan dönem için başlangıç tarihi ve dönem (ay) sayısı zorunludur.')
  })

  it('accepts a main group with valid settings', () => {
    expect(getGroupFormErrors(validForm(), 'create', 'Grup')).toEqual([])
  })
})

// Kullanıcı bulgusu (2026-10-02): "grup oluşturmada da özellikler eksik güncelleme
// formunda görünüyor fakat eklemede görünmüyor" — "Grup Türü" seçici, alt grup (seans)
// oluştururken backend'de karşılığı olmadığı halde (CreateSubGroupRequest'te Type yok,
// tür her zaman ana gruptan miras alınır) seans DÜZENLEME formunda görünüyordu. Artık
// isSubGroup iken create/edit ikisinde de tutarlı şekilde gizli.
describe('sub-group (session) Grup Türü parity', () => {
  it('hides Grup Türü when creating a session (parity with backend CreateSubGroupRequest)', () => {
    render(<GroupFormFields config={config} form={makeEmptyGroupForm(config, 'facility', { parentGroupId: 'parent-1' })}
      setForm={() => {}} branches={[]} instructors={[]} documentLibrary={[]} mode="create" isSubGroup />)
    expect(screen.queryByText('Grup Türü')).not.toBeInTheDocument()
  })

  it('hides Grup Türü when editing a session too (was previously shown — the reported bug)', () => {
    const form = makeEmptyGroupForm(config, 'facility', {
      parentGroupId: 'parent-1', capacity: '20',
      schedules: [{ day: 'Monday', start: '10:00', end: '11:00' }],
    })
    render(<GroupFormFields config={config} form={form} setForm={() => {}}
      branches={[]} instructors={[]} documentLibrary={[]} mode="edit" isSubGroup />)
    expect(screen.queryByText('Grup Türü')).not.toBeInTheDocument()
  })

  it('still shows Grup Türü for real top-level (non-sub-group) records in both modes', () => {
    render(<GroupFormFields config={config} form={makeEmptyGroupForm(config, 'facility')}
      setForm={() => {}} branches={[]} instructors={[]} documentLibrary={[]} mode="create" />)
    expect(screen.getByText('Grup Türü')).toBeInTheDocument()
    cleanup()
    const editedLeafForm = makeEmptyGroupForm(config, 'facility', { capacity: '20' })
    render(<GroupFormFields config={config} form={editedLeafForm} setForm={() => {}}
      branches={[]} instructors={[]} documentLibrary={[]} mode="edit" />)
    expect(screen.getByText('Grup Türü')).toBeInTheDocument()
  })
})
