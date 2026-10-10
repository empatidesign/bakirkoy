import * as signalR from '@microsoft/signalr'
import { tokenStorage } from './tokenStorage'
import { apiTarget } from './api'

// Gerçek zamanlı bağlantı da REST ile AYNI sunucuya gitmeli. Ayrı ayrı
// okunduğunda biri düzeltilip diğeri unutulabiliyordu (2026-09-03 tablet
// bulgusu); tek kaynak kullanılıyor.
const BASE_URL = apiTarget.baseUrl

export interface RealtimeNotification {
  id: string
  title: string
  body: string
  type?: string
  referenceType?: string | null
  referenceId?: string | null
  createdAt: string
}

export interface LibrarySessionRealtimeEvent {
  action: string
  libraryId: string
  libraryName: string
  status?: string | null
  seat?: string | null
  at: string
}

export interface LibraryOccupancyRealtimeEvent {
  libraryId: string
  inside: number
  onBreak: number
  free: number
  waiting: number
  at: string
}

export interface LibraryQueueCalledRealtimeEvent {
  libraryId: string
  libraryName: string
  seat?: string | null
  countdownExpiresAt?: string | null
  at: string
}

export interface LibraryScanDeniedRealtimeEvent {
  action: string
  libraryId: string
  message: string
  at: string
}

type NotificationHandler = (notification: RealtimeNotification) => void
type LibrarySessionHandler = (event: LibrarySessionRealtimeEvent) => void
type LibraryOccupancyHandler = (event: LibraryOccupancyRealtimeEvent) => void
type LibraryQueueCalledHandler = (event: LibraryQueueCalledRealtimeEvent) => void
type LibraryScanDeniedHandler = (event: LibraryScanDeniedRealtimeEvent) => void

let connection: signalR.HubConnection | null = null
let starting: Promise<void> | null = null
let stopped = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryDelayMs = 2000
const MAX_RETRY_DELAY_MS = 60000
const notificationHandlers = new Set<NotificationHandler>()
const librarySessionHandlers = new Set<LibrarySessionHandler>()
const libraryOccupancyHandlers = new Set<LibraryOccupancyHandler>()
const libraryQueueCalledHandlers = new Set<LibraryQueueCalledHandler>()
const libraryScanDeniedHandlers = new Set<LibraryScanDeniedHandler>()

const build = () =>
  new signalR.HubConnectionBuilder()
    .withUrl(`${BASE_URL}/hubs/citizen`, {
      accessTokenFactory: () => tokenStorage.getAccessToken() ?? '',
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build()

export const citizenRealtime = {
  async start(): Promise<void> {
    stopped = false
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    if (connection) return
    if (starting) return starting
    const conn = build()
    conn.on('notification', (n: RealtimeNotification) => notificationHandlers.forEach((h) => h(n)))
    conn.on('library-session', (e: LibrarySessionRealtimeEvent) => librarySessionHandlers.forEach((h) => h(e)))
    conn.on('library-occupancy', (e: LibraryOccupancyRealtimeEvent) => libraryOccupancyHandlers.forEach((h) => h(e)))
    conn.on('library-queue-called', (e: LibraryQueueCalledRealtimeEvent) => libraryQueueCalledHandlers.forEach((h) => h(e)))
    conn.on('library-scan-denied', (e: LibraryScanDeniedRealtimeEvent) => libraryScanDeniedHandlers.forEach((h) => h(e)))
    connection = conn
    starting = conn
      .start()
      .then(() => {
        retryDelayMs = 2000
      })
      .catch(() => {
        connection = null
        if (!stopped) {
          retryTimer = setTimeout(() => {
            retryTimer = null
            void citizenRealtime.start()
          }, retryDelayMs)
          retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS)
        }
      })
      .finally(() => {
        starting = null
      })
    return starting
  },

  async stop(): Promise<void> {
    stopped = true
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    const conn = connection
    connection = null
    await conn?.stop().catch(() => undefined)
  },

  onNotification(handler: NotificationHandler): () => void {
    notificationHandlers.add(handler)
    return () => {
      notificationHandlers.delete(handler)
    }
  },

  onLibrarySession(handler: LibrarySessionHandler): () => void {
    librarySessionHandlers.add(handler)
    void citizenRealtime.start()
    return () => {
      librarySessionHandlers.delete(handler)
    }
  },

  onLibraryScanDenied(handler: LibraryScanDeniedHandler): () => void {
    libraryScanDeniedHandlers.add(handler)
    void citizenRealtime.start()
    return () => {
      libraryScanDeniedHandlers.delete(handler)
    }
  },

  onLibraryOccupancy(handler: LibraryOccupancyHandler): () => void {
    libraryOccupancyHandlers.add(handler)
    void citizenRealtime.start()
    return () => {
      libraryOccupancyHandlers.delete(handler)
    }
  },

  onLibraryQueueCalled(handler: LibraryQueueCalledHandler): () => void {
    libraryQueueCalledHandlers.add(handler)
    void citizenRealtime.start()
    return () => {
      libraryQueueCalledHandlers.delete(handler)
    }
  },
}
