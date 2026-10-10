import * as signalR from '@microsoft/signalr'
import { tokenStorage } from './tokenStorage'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export interface RealtimeMessage {
  id: string
  senderId: string
  recipientId: string
  text: string
  sentAt: string
}

export interface RealtimeNotification {
  id: string
  title: string
  body: string
  referenceType?: string
  referenceId?: string
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

export interface DashboardApplicationEvent {
  module: string
  action: string
  applicationId: string
  sourceId?: string | null
  sourceName?: string | null
  participantId?: string | null
  participantName?: string | null
  status: string
  at: string
}

export interface DashboardReservationEvent {
  module: string
  action: string
  reservationId: string
  sourceId?: string | null
  sourceName?: string | null
  participantId?: string | null
  at: string
}

type MessageHandler = (message: RealtimeMessage) => void
type NotificationHandler = (notification: RealtimeNotification) => void
type LibrarySessionHandler = (event: LibrarySessionRealtimeEvent) => void
type ApplicationHandler = (event: DashboardApplicationEvent) => void
type ReservationHandler = (event: DashboardReservationEvent) => void

let connection: signalR.HubConnection | null = null
let starting: Promise<void> | null = null
let refCount = 0
let closeTimer: ReturnType<typeof setTimeout> | null = null
const handlers = new Set<MessageHandler>()
const notificationHandlers = new Set<NotificationHandler>()
const librarySessionHandlers = new Set<LibrarySessionHandler>()
const applicationHandlers = new Set<ApplicationHandler>()
const reservationHandlers = new Set<ReservationHandler>()
const joinedLibraries = new Set<string>()

const build = () =>
  new signalR.HubConnectionBuilder()
    .withUrl(`${BASE_URL}/hubs/team`, {
      accessTokenFactory: () => tokenStorage.getAccessToken() ?? '',
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build()

export const teamRealtime = {
  async start(): Promise<void> {
    refCount++
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
    if (connection) return
    if (starting) return starting
    const conn = build()
    conn.on('message', (m: RealtimeMessage) => handlers.forEach((h) => h(m)))
    conn.on('notification', (n: RealtimeNotification) => notificationHandlers.forEach((h) => h(n)))
    conn.on('library-session', (e: LibrarySessionRealtimeEvent) => librarySessionHandlers.forEach((h) => h(e)))
    conn.on('library-queue-called', (e: LibrarySessionRealtimeEvent) => librarySessionHandlers.forEach((h) => h(e)))
    conn.on('library-occupancy', (e: LibrarySessionRealtimeEvent) => librarySessionHandlers.forEach((h) => h(e)))
    conn.on('application-changed', (e: DashboardApplicationEvent) => applicationHandlers.forEach((h) => h(e)))
    conn.on('reservation-changed', (e: DashboardReservationEvent) => reservationHandlers.forEach((h) => h(e)))
    connection = conn
    starting = conn
      .start()
      .then(() => {
        joinedLibraries.forEach((id) => { void conn.invoke('JoinLibrary', id).catch(() => undefined) })
      })
      .catch(() => {
        connection = null
      })
      .finally(() => {
        starting = null
      })
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
      notificationHandlers.clear()
      librarySessionHandlers.clear()
      applicationHandlers.clear()
      reservationHandlers.clear()
      joinedLibraries.clear()
      void conn?.stop().catch(() => undefined)
    }, 800)
  },

  onMessage(handler: MessageHandler): () => void {
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
    }
  },

  onNotification(handler: NotificationHandler): () => void {
    notificationHandlers.add(handler)
    return () => {
      notificationHandlers.delete(handler)
    }
  },

  onLibrarySession(handler: LibrarySessionHandler): () => void {
    librarySessionHandlers.add(handler)
    return () => {
      librarySessionHandlers.delete(handler)
    }
  },

  onApplicationChanged(handler: ApplicationHandler): () => void {
    applicationHandlers.add(handler)
    return () => {
      applicationHandlers.delete(handler)
    }
  },

  onReservationChanged(handler: ReservationHandler): () => void {
    reservationHandlers.add(handler)
    return () => {
      reservationHandlers.delete(handler)
    }
  },

  async joinLibrary(libraryId: string): Promise<void> {
    joinedLibraries.add(libraryId)
    await teamRealtime.start()
    if (connection?.state === signalR.HubConnectionState.Connected)
      await connection.invoke('JoinLibrary', libraryId).catch(() => undefined)
  },

  async leaveLibrary(libraryId: string): Promise<void> {
    joinedLibraries.delete(libraryId)
    if (connection?.state === signalR.HubConnectionState.Connected)
      await connection.invoke('LeaveLibrary', libraryId).catch(() => undefined)
    await teamRealtime.stop()
  },
}
