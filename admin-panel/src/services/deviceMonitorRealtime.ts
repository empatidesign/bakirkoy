import * as signalR from '@microsoft/signalr'
import { tokenStorage } from './tokenStorage'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export interface DeviceScanEvent {
  deviceId: string
  source: string
  direction: string
  success: boolean
  message?: string | null
  at: string
  facilityName?: string | null
  personName?: string | null
}

type ScanHandler = (event: DeviceScanEvent) => void

let connection: signalR.HubConnection | null = null
let starting: Promise<void> | null = null
let refCount = 0
let closeTimer: ReturnType<typeof setTimeout> | null = null
const handlers = new Set<ScanHandler>()

const build = () =>
  new signalR.HubConnectionBuilder()
    .withUrl(`${BASE_URL}/hubs/device-monitor`, {
      accessTokenFactory: () => tokenStorage.getAccessToken() ?? '',
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build()

export const deviceMonitorRealtime = {
  async start(): Promise<void> {
    refCount++
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
    if (connection) return
    if (starting) return starting
    const conn = build()
    conn.on('device-scan', (e: DeviceScanEvent) => handlers.forEach((h) => h(e)))
    connection = conn
    starting = conn.start().catch(() => { connection = null }).finally(() => { starting = null })
    return starting
  },

  async stop(): Promise<void> {
    refCount = Math.max(0, refCount - 1)
    if (refCount > 0) return
    if (closeTimer) clearTimeout(closeTimer)
    closeTimer = setTimeout(() => {
      closeTimer = null
      if (refCount > 0) return
      const conn = connection
      connection = null
      handlers.clear()
      void conn?.stop().catch(() => undefined)
    }, 800)
  },

  onScan(handler: ScanHandler): () => void {
    handlers.add(handler)
    return () => { handlers.delete(handler) }
  },

  get connectionState(): signalR.HubConnectionState | null {
    return connection?.state ?? null
  },
}
