import { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Combobox, type ComboOption } from './Combobox'

const OPTIONS: ComboOption[] = [
  { value: 's1', label: 'Okul A' },
  { value: 's2', label: 'Okul B' },
]

const Host = () => {
  const [value, setValue] = useState('')
  return <Combobox value={value} onChange={(v) => setValue(v)} options={OPTIONS} allowCustom placeholder="Okul" />
}

describe('Combobox — serbest-metin (allowCustom) açılma davranışı', () => {
  it('input tıklamasında listeyi açar', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByPlaceholderText('Okul'))
    expect(screen.getByText('Okul A')).toBeInTheDocument()
    expect(screen.getByText('Okul B')).toBeInTheDocument()
  })

  it('seçim sonrası tekrar tıklamada listeyi yeniden açar ve tüm seçenekleri gösterir', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const input = screen.getByPlaceholderText('Okul')

    await user.click(input)
    await user.click(screen.getByText('Okul A'))
    expect(screen.queryByText('Okul B')).not.toBeInTheDocument()

    await user.click(input)
    expect(screen.getByText('Okul A')).toBeInTheDocument()
    expect(screen.getByText('Okul B')).toBeInTheDocument()
  })
})
