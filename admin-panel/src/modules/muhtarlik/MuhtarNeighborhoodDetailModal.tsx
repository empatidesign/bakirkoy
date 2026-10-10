import { useEffect, useState } from 'react'
import { Modal } from '@/design-system'
import muhtarlikService from '@/services/muhtarlik.service'
import { MuhtarDashboardView } from './MuhtarDashboardView'
import type { MuhtarDashboard } from '@/types/muhtarlik.types'

interface Props {
  neighborhood: string | null
  onClose: () => void
}

export const MuhtarNeighborhoodDetailModal = ({ neighborhood, onClose }: Props) => {
  const [data, setData] = useState<MuhtarDashboard | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!neighborhood) { setData(null); return }
    setLoading(true)
    muhtarlikService.getMuhtarDashboard(neighborhood)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [neighborhood])

  if (!neighborhood) return null

  return (
    <Modal
      open={!!neighborhood}
      onClose={onClose}
      title={`${neighborhood} — Muhtarın Gördüğü Ekran`}
      subtitle="Bu ekran, muhtarın kendi panelinde gördüğü ile birebir aynıdır: kimlik bilgisi (ad, telefon, TC, adres) gösterilmez; metinde geçen şahıs isimleri *** ile maskelenir."
      width={920}
      className="max-w-[96vw]"
    >
      <div className="max-h-[75vh] overflow-auto p-4">
        <MuhtarDashboardView data={data} loading={loading} />
      </div>
    </Modal>
  )
}
