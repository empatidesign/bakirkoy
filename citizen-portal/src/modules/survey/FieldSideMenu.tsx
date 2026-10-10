import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, ClipboardList, KeyRound, LogOut, Menu, MessageSquarePlus, ShieldCheck, User, X,
} from 'lucide-react'

// Kullanıcı isteği (2026-09-01): "sol menüde hamburger menüde kendi profilim,
// şifre işlemi ve görevleri, gerekli menüler solda olacak."
// Saha ekranı tam ekran çalıştığı için normal portal AppShell'i yok; bu çekmece
// anketörün ihtiyaç duyduğu kişisel işlemleri sol taraftan sunar.
type Props = {
  open: boolean
  onClose: () => void
  onOpenTasks: () => void
  onOpenNotifications: () => void
  /** Talep/öneri/şikayet formunu açar (yalnızca görev listesi ekranında verilir). */
  onOpenQuickActions?: () => void
  taskCount: number
  unreadCount: number
}

export const FieldSideMenu = ({ open, onClose, onOpenTasks, onOpenNotifications, onOpenQuickActions, taskCount, unreadCount }: Props) => {
  const navigate = useNavigate()

  // ESC ile kapansın ve açıkken arka plan kaymasın.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  const go = (path: string) => {
    // Portal sayfalarına geçerken mod bilgisi korunur ki geri dönünce
    // anketör yine saha ekranına düşsün.
    sessionStorage.setItem('app_mode', 'field')
    onClose()
    navigate(path)
  }

  const items = [
    { key: 'tasks', icon: ClipboardList, label: 'Görevlerim', hint: `${taskCount} atanmış görev`, action: () => { onClose(); onOpenTasks() } },
    { key: 'notifications', icon: Bell, label: 'Bildirimler', hint: unreadCount > 0 ? `${unreadCount} okunmamış` : 'Tümü okundu', action: () => { onClose(); onOpenNotifications() } },
    // Hata düzeltmesi (2026-09-02): talep/öneri/şikayet formuna görev listesinden de erişim.
    ...(onOpenQuickActions ? [{ key: 'quick', icon: MessageSquarePlus, label: 'Talep / Öneri / Şikayet', hint: 'Vatandaş adına kayıt aç', action: () => { onClose(); onOpenQuickActions() } }] : []),
    { key: 'profile', icon: User, label: 'Profilim', hint: 'Kişisel bilgiler', action: () => go('/profil') },
    { key: 'password', icon: KeyRound, label: 'Şifre İşlemleri', hint: 'Şifre değiştir', action: () => go('/profil?bolum=sifre') },
    { key: 'sessions', icon: ShieldCheck, label: 'Aktif Oturumlar', hint: 'Cihaz güvenliği', action: () => go('/profil/oturumlar') },
  ]

  return (
    <div className="fixed inset-0 z-[150] flex" data-testid="field-side-menu">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <aside className="relative flex h-full w-[min(320px,85vw)] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-700 to-indigo-600 px-4 py-4 text-white">
          <div>
            <p className="text-sm font-black uppercase tracking-wider">Anketör Menüsü</p>
            <p className="text-[11px] text-blue-100">Saha Anket Sistemi</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Menüyü kapat"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.action}
              data-testid={`field-menu-${item.key}`}
              className="mb-1.5 flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3 text-left transition-colors hover:bg-slate-100"
            >
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <item.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-800">{item.label}</span>
                <span className="block text-xs text-slate-500">{item.hint}</span>
              </span>
              {item.key === 'notifications' && unreadCount > 0 && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-black text-white">{unreadCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={() => { sessionStorage.setItem('app_mode', 'portal'); onClose(); navigate('/') }}
            data-testid="field-menu-exit"
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
          >
            <LogOut className="h-4 w-4" /> Vatandaş Portalına Dön
          </button>
        </div>
      </aside>
    </div>
  )
}

export const FieldMenuButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Menüyü aç"
    data-testid="field-menu-button"
    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 transition-colors hover:bg-white/20"
  >
    <Menu className="h-5 w-5" />
  </button>
)
