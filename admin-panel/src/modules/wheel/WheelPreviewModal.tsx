import { useRef, useState } from 'react'
import { PlayIcon, RotateCwIcon, BadgeCheckIcon } from 'lucide-react'
import { Modal, Button, Badge, Banner } from '@/design-system'
import { WheelSpinner, type WheelSpinnerHandle } from '@/components/specialized/WheelSpinner'
import { wheelSliceTypeMeta } from '@/types/wheel.types'
import type { WheelSlice } from '@/types/wheel.types'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  slices: WheelSlice[]
}

const pickByWinRate = (slices: WheelSlice[]): number => {
  const total = slices.reduce((sum, s) => sum + (Number(s.winRate) || 0), 0)
  if (total <= 0) return Math.floor(Math.random() * slices.length)
  let r = Math.random() * total
  for (let i = 0; i < slices.length; i++) {
    r -= Number(slices[i].winRate) || 0
    if (r <= 0) return i
  }
  return slices.length - 1
}

export const WheelPreviewModal = ({ open, onClose, title, slices }: Props) => {
  const ref = useRef<WheelSpinnerHandle>(null)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<WheelSlice | null>(null)

  const spin = () => {
    if (spinning || slices.length < 2) return
    setResult(null)
    ref.current?.spinTo(pickByWinRate(slices))
  }

  return (
    <Modal open={open} onClose={onClose} title="Çark Önizleme" subtitle={title} width={520} bodyClassName="px-6 py-5">
      <div className="space-y-5">
        <Banner tone="info" variant="soft" icon={BadgeCheckIcon}>
          Bu bir önizlemedir — sonuç kaydedilmez, kullanıcıya puan veya hediye verilmez.
        </Banner>

        <WheelSpinner
          ref={ref}
          slices={slices.map((s) => ({ label: s.label || wheelSliceTypeMeta(s.type).label, color: s.color }))}
          size={320}
          onSpinStart={() => setSpinning(true)}
          onSpinEnd={(i) => { setSpinning(false); setResult(slices[i]) }}
        />

        {result ? (
          <div className="space-y-1 rounded-card border border-border bg-surface-1 p-4 text-center">
            <p className="type-caption">Sonuç</p>
            <div className="flex items-center justify-center gap-2">
              <Badge tone={wheelSliceTypeMeta(result.type).tone}>{wheelSliceTypeMeta(result.type).label}</Badge>
              <span className="type-body-strong">{result.label || wheelSliceTypeMeta(result.type).label}</span>
            </div>
          </div>
        ) : (
          <div className="h-[70px]" />
        )}

        <Button variant="primary" className="w-full" isLoading={spinning} disabled={spinning || slices.length < 2} onClick={spin}>
          {result ? <><RotateCwIcon className="h-4 w-4" /> Tekrar Çevir</> : <><PlayIcon className="h-4 w-4" /> Çevir</>}
        </Button>
      </div>
    </Modal>
  )
}
