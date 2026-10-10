import { useEffect, useState } from 'react'
import muhtarlikService from '@/services/muhtarlik.service'
import type { SelectOption } from '@/types/common'

// Mahalle listesi tek kaynaktan gelir (Muhtarlık modülünün /citizen-submissions/neighborhoods
// ucu, backend'deki SultangaziNeighborhoods listesini döner). Anket platformunun saha,
// kota ve analiz ekranları da aynı listeyi kullanır ki mahalle adları birebir eşleşsin.
let cache: SelectOption[] | null = null

export const useNeighborhoodOptions = () => {
  const [options, setOptions] = useState<SelectOption[]>(cache ?? [])

  useEffect(() => {
    if (cache) return
    let alive = true
    muhtarlikService
      .getNeighborhoodOptions()
      .then((res) => {
        cache = res
        if (alive) setOptions(res)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  return options
}
