import { useEffect, useState } from 'react'
import { MapIcon, ImageOffIcon, ZoomInIcon, ZoomOutIcon, Maximize2Icon } from 'lucide-react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { Modal, EmptyState, IconButton, SegmentedControl } from '@/design-system'

export interface KrokiFloor {
  id: string
  name: string
  krokiUrl?: string | null
}

interface KrokiViewerModalProps {
  open: boolean
  onClose: () => void
  floors: KrokiFloor[]
  initialFloorId?: string | null
}

export const KrokiViewerModal = ({ open, onClose, floors, initialFloorId }: KrokiViewerModalProps) => {
  const [activeFloorId, setActiveFloorId] = useState<string>('')

  useEffect(() => {
    if (!open) return
    const preferred = initialFloorId && floors.some((f) => f.id === initialFloorId) ? initialFloorId : floors[0]?.id
    setActiveFloorId(preferred ?? '')
  }, [open, initialFloorId, floors])

  const activeFloor = floors.find((f) => f.id === activeFloorId) ?? floors[0]
  const hasMultipleFloors = floors.length > 1

  return (
    <Modal open={open} onClose={onClose} title="Oturma Planı" subtitle="Yakınlaştırıp sürükleyerek inceleyebilirsiniz" width={520} bodyClassName="p-0">
      <div className="flex flex-col">
        {hasMultipleFloors && (
          <div className="border-b border-border px-4 py-3">
            <SegmentedControl
              value={activeFloorId}
              onChange={setActiveFloorId}
              options={floors.map((f) => ({ value: f.id, label: f.name }))}
            />
          </div>
        )}

        <div className="relative h-[60vh] bg-surface-1">
          {activeFloor?.krokiUrl ? (
            <TransformWrapper initialScale={1} minScale={0.5} maxScale={6} centerOnInit doubleClick={{ mode: 'toggle' }}>
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-field border border-border bg-surface-0/95 p-1 shadow-card backdrop-blur">
                    <IconButton title="Yakınlaştır" onClick={() => zoomIn()}><ZoomInIcon className="h-4 w-4" /></IconButton>
                    <IconButton title="Uzaklaştır" onClick={() => zoomOut()}><ZoomOutIcon className="h-4 w-4" /></IconButton>
                    <IconButton title="Sıfırla" onClick={() => resetTransform()}><Maximize2Icon className="h-4 w-4" /></IconButton>
                  </div>
                  <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
                    <img
                      src={activeFloor.krokiUrl ?? undefined}
                      alt={`${activeFloor.name} krokisi`}
                      className="h-full w-full object-contain"
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          ) : (
            <div className="flex h-full items-center justify-center">
              <EmptyState icon={ImageOffIcon} title="Bu katın krokisi yüklenmemiş" />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

interface KrokiButtonHookResult {
  open: boolean
  floorId: string | null
  show: (floorId?: string | null) => void
  hide: () => void
}

export const useKrokiViewer = (): KrokiButtonHookResult => {
  const [open, setOpen] = useState(false)
  const [floorId, setFloorId] = useState<string | null>(null)
  return {
    open,
    floorId,
    show: (id) => { setFloorId(id ?? null); setOpen(true) },
    hide: () => setOpen(false),
  }
}

export const KrokiIcon = MapIcon
