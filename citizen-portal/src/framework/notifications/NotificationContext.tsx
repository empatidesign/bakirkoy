import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import notificationService from '@/services/notification.service'
import { citizenRealtime } from '@/services/citizenRealtime'
import { toastSuppression } from '@/services/toastSuppression'
import { useAuth } from '@/framework/auth/AuthContext'

interface NotificationContextValue {
  unreadCount: number
  refreshUnread: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  refreshUnread: async () => { void 0 },
})

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { state } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const userId = state.status === 'authenticated' ? state.user.id : null

  const refreshUnread = useCallback(async () => {
    if (!userId) { setUnreadCount(0); return }
    try { setUnreadCount(await notificationService.unreadCount('family')) }
    catch { void 0 }
  }, [userId])

  useEffect(() => { void refreshUnread() }, [refreshUnread])

  useEffect(() => {
    if (!userId) return
    void citizenRealtime.start()
    const unsubscribe = citizenRealtime.onNotification((n) => {
      setUnreadCount((c) => c + 1)
      const suppressed = toastSuppression.isSuppressed(n.referenceType, n.referenceId)
      if (n.title && !suppressed) toast.info(n.title, { duration: 4000 })
      void refreshUnread()
    })
    return () => {
      unsubscribe()
      void citizenRealtime.stop()
    }
  }, [userId, refreshUnread])

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnread }}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = (): NotificationContextValue => useContext(NotificationContext)
