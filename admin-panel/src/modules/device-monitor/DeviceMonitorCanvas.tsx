import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeviceMonitorItem } from '@/services/deviceMonitor.service'
import type { DeviceScanEvent } from '@/services/deviceMonitorRealtime'

interface LayoutNode {
  device: DeviceMonitorItem
  x: number
  y: number
}

interface GroupLayout {
  parentId: string
  parentName: string
  x: number
  y: number
  width: number
  height: number
  nodes: LayoutNode[]
}

interface ScanFlash {
  deviceId: string
  success: boolean
  startedAt: number
}

const DEVICE_RADIUS = 14
const DEVICE_GAP = 40
const GROUP_PADDING = 24
const GROUP_HEADER_H = 28
const GROUP_GAP_X = 32
const GROUP_GAP_Y = 32
const GROUP_COLS_TARGET = 6 // bir satırda hedeflenen grup sayısı (genişliğe göre otomatik ayarlanır)
const FLASH_DURATION_MS = 1600

const colorForDirection = (direction: string, operationMode?: string | null) => {
  if (operationMode === 'toggle') return '#8b5cf6'
  if (direction === 'exit') return '#ef4444'
  if (direction === 'toggle' || direction === 'both') return '#8b5cf6'
  return '#10b981'
}

export const DeviceMonitorCanvas = ({
  devices,
  scanEvents,
  filter,
}: {
  devices: DeviceMonitorItem[]
  scanEvents: DeviceScanEvent[]
  filter: string
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panState = useRef<{ dragging: boolean; startX: number; startY: number; panX: number; panY: number }>({
    dragging: false, startX: 0, startY: 0, panX: 0, panY: 0,
  })
  const flashesRef = useRef<Map<string, ScanFlash>>(new Map())
  const layoutRef = useRef<GroupLayout[]>([])
  const hoverRef = useRef<LayoutNode | null>(null)
  const [hoverInfo, setHoverInfo] = useState<{ device: DeviceMonitorItem; x: number; y: number } | null>(null)

  useEffect(() => {
    const last = scanEvents[scanEvents.length - 1]
    if (!last) return
    flashesRef.current.set(last.deviceId, { deviceId: last.deviceId, success: last.success, startedAt: performance.now() })
  }, [scanEvents])

  const computeLayout = useCallback((items: DeviceMonitorItem[]): GroupLayout[] => {
    const byParent = new Map<string, DeviceMonitorItem[]>()
    for (const d of items) {
      const list = byParent.get(d.parentId) ?? []
      list.push(d)
      byParent.set(d.parentId, list)
    }

    const groups: GroupLayout[] = []
    let col = 0
    let rowMaxHeight = 0
    let cursorX = GROUP_PADDING
    let cursorY = GROUP_PADDING

    for (const [parentId, list] of byParent) {
      const perRow = Math.max(1, Math.ceil(Math.sqrt(list.length)))
      const rows = Math.ceil(list.length / perRow)
      const width = Math.max(perRow * DEVICE_GAP + GROUP_PADDING, 140)
      const height = rows * DEVICE_GAP + GROUP_HEADER_H + GROUP_PADDING

      if (col >= GROUP_COLS_TARGET) {
        col = 0
        cursorX = GROUP_PADDING
        cursorY += rowMaxHeight + GROUP_GAP_Y
        rowMaxHeight = 0
      }

      const nodes: LayoutNode[] = list.map((device, i) => ({
        device,
        x: cursorX + GROUP_PADDING + (i % perRow) * DEVICE_GAP,
        y: cursorY + GROUP_HEADER_H + GROUP_PADDING + Math.floor(i / perRow) * DEVICE_GAP,
      }))

      groups.push({ parentId, parentName: list[0]?.parentName ?? parentId, x: cursorX, y: cursorY, width, height, nodes })

      cursorX += width + GROUP_GAP_X
      rowMaxHeight = Math.max(rowMaxHeight, height)
      col++
    }

    return groups
  }, [])

  useEffect(() => {
    const filtered = filter === 'all' ? devices : devices.filter((d) => d.source === filter)
    layoutRef.current = computeLayout(filtered)
  }, [devices, filter, computeLayout])

  useEffect(() => {
    let raf = 0
    let running = true

    const draw = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) { raf = requestAnimationFrame(draw); return }
      const dpr = window.devicePixelRatio || 1
      const w = container.clientWidth
      const h = container.clientHeight
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, w, h)

      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)

      const now = performance.now()
      const flashes = flashesRef.current
      for (const [id, f] of flashes) {
        if (now - f.startedAt > FLASH_DURATION_MS) flashes.delete(id)
      }

      for (const group of layoutRef.current) {
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#e2e8f0'
        ctx.lineWidth = 1
        roundRect(ctx, group.x, group.y, group.width, group.height, 10)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#334155'
        ctx.font = '600 12px system-ui, -apple-system, sans-serif'
        ctx.textBaseline = 'top'
        ctx.fillText(truncate(group.parentName, 20), group.x + GROUP_PADDING, group.y + 8)

        for (const node of group.nodes) {
          const flash = flashes.get(node.device.id)
          drawDevice(ctx, node, flash, now)
        }
      }

      ctx.restore()

      if (running && flashes.size > 0) raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => { running = false; cancelAnimationFrame(raf) }
  }, [pan, zoom, scanEvents, filter])

  const toWorld = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect()
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom }
  }

  const findNodeAt = (worldX: number, worldY: number): LayoutNode | null => {
    for (const group of layoutRef.current) {
      for (const node of group.nodes) {
        const dx = node.x - worldX
        const dy = node.y - worldY
        if (dx * dx + dy * dy <= (DEVICE_RADIUS + 4) * (DEVICE_RADIUS + 4)) return node
      }
    }
    return null
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = -e.deltaY * 0.001
    setZoom((z) => Math.min(3, Math.max(0.3, z + delta)))
  }

  const onMouseDown = (e: React.MouseEvent) => {
    panState.current = { dragging: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (panState.current.dragging) {
      const dx = e.clientX - panState.current.startX
      const dy = e.clientY - panState.current.startY
      setPan({ x: panState.current.panX + dx, y: panState.current.panY + dy })
      setHoverInfo(null)
      return
    }
    const world = toWorld(e.clientX, e.clientY)
    const node = findNodeAt(world.x, world.y)
    hoverRef.current = node
    if (node) {
      const rect = containerRef.current!.getBoundingClientRect()
      setHoverInfo({ device: node.device, x: e.clientX - rect.left, y: e.clientY - rect.top })
    } else {
      setHoverInfo(null)
    }
  }
  const onMouseUp = () => { panState.current.dragging = false }
  const onMouseLeave = () => { panState.current.dragging = false; setHoverInfo(null) }

  const zoomIn = () => setZoom((z) => Math.min(3, z + 0.2))
  const zoomOut = () => setZoom((z) => Math.max(0.3, z - 0.2))
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-card border border-border bg-surface-1">
      <canvas
        ref={canvasRef}
        className="cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      />

      <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-field border border-border bg-card p-1 shadow-sm">
        <button type="button" onClick={zoomIn} className="flex h-8 w-8 items-center justify-center rounded-md text-lg font-semibold text-foreground-strong hover:bg-surface-1" title="Yakınlaştır">+</button>
        <button type="button" onClick={zoomOut} className="flex h-8 w-8 items-center justify-center rounded-md text-lg font-semibold text-foreground-strong hover:bg-surface-1" title="Uzaklaştır">−</button>
        <button type="button" onClick={resetView} className="flex h-8 w-8 items-center justify-center rounded-md text-[10px] font-semibold text-foreground-muted hover:bg-surface-1" title="Görünümü sıfırla">SIF</button>
      </div>

      {hoverInfo && (
        <div
          className="pointer-events-none absolute z-10 max-w-[220px] rounded-field border border-border bg-card px-3 py-2 text-xs shadow-lg"
          style={{ left: hoverInfo.x + 16, top: hoverInfo.y + 16 }}
        >
          <p className="font-semibold text-foreground-strong">{hoverInfo.device.name}</p>
          <p className="text-foreground-muted">{hoverInfo.device.parentName}</p>
          <p className="text-foreground-muted">
            {hoverInfo.device.operationMode === 'toggle'
              ? 'Tek cihaz · Giriş + Çıkış'
              : hoverInfo.device.direction === 'exit' ? 'Çıkış cihazı' : hoverInfo.device.direction === 'both' ? 'Giriş + Çıkış cihazı' : 'Giriş cihazı'}
          </p>
          <p className="mt-1 flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${hoverInfo.device.isOnline ? 'bg-success' : 'bg-foreground-subtle'}`} />
            {hoverInfo.device.isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
            {hoverInfo.device.lastSeenAt && !hoverInfo.device.isOnline && (
              <span className="text-foreground-subtle"> · son görülme {new Date(hoverInfo.device.lastSeenAt).toLocaleTimeString('tr-TR')}</span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function truncate(s: string, max: number) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function drawDevice(ctx: CanvasRenderingContext2D, node: LayoutNode, flash: ScanFlash | undefined, now: number) {
  const { x, y } = node
  const online = node.device.isOnline

  if (flash) {
    const t = (now - flash.startedAt) / FLASH_DURATION_MS
    const ringRadius = DEVICE_RADIUS + t * 18
    const alpha = Math.max(0, 1 - t)
    ctx.beginPath()
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2)
    ctx.strokeStyle = flash.success ? `rgba(16, 185, 129, ${alpha})` : `rgba(239, 68, 68, ${alpha})`
    ctx.lineWidth = 3
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.arc(x, y, DEVICE_RADIUS, 0, Math.PI * 2)
  if (!online) {
    ctx.fillStyle = '#cbd5e1'
  } else if (flash) {
    ctx.fillStyle = flash.success ? '#10b981' : '#ef4444'
  } else {
    ctx.fillStyle = colorForDirection(node.device.direction, node.device.operationMode)
  }
  ctx.fill()

  if (online) {
    ctx.beginPath()
    ctx.arc(x, y, DEVICE_RADIUS + 2, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 11px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const icon = node.device.direction === 'exit' ? '↙' : node.device.direction === 'toggle' || node.device.direction === 'both' ? '⇄' : '↗'
  ctx.fillText(icon, x, y + 1)
  ctx.textAlign = 'left'
}
