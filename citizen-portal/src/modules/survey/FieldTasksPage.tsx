import { useEffect, useMemo, useState } from 'react'
import { Icon2D } from '@/components/Icon2D'
import {
  ClipboardList, MapPin, Calendar, Target, RefreshCw, Play, AlertTriangle,
  CheckCircle2, LogOut, ListTodo, Navigation, Footprints, Search, Clock,
  Building2, Layers, HeartHandshake, Trash2, Smile, LayoutDashboard, User, Bell,
  MessageSquarePlus,
  ChevronRight, WifiOff,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn, formatDate } from '@/lib/utils'
import type { FieldTask, FieldResponseSummary } from '@/types/fieldSurvey.types'
import fieldSurveyService from '@/services/fieldSurvey.service'
import { subscribeFieldOfflineQueue } from '@/lib/fieldOfflineQueue'
import { FieldSurveyRunner } from './FieldSurveyRunner'
import { FieldNotificationBell } from './FieldNotificationBell'
import { FieldNotificationsTab } from './FieldNotificationsTab'
import { FieldQuickActionsModal } from './FieldQuickActionsModal'
import { FieldSideMenu, FieldMenuButton } from './FieldSideMenu'
import { MandatoryAnnouncementGate } from '@/modules/notifications/MandatoryAnnouncementGate'
import { BypassReturnBanner } from '@/framework/auth/BypassReturnBanner'
import { useAuth } from '@/framework/auth/AuthContext'
import notificationService from '@/services/notification.service'
import { useFieldLocationTracking } from './useFieldLocationTracking'
import { FieldPerformanceCard } from './FieldPerformanceCard'
import { useSystemLogo } from '@/framework/branding/useSystemLogo'

// Kullanıcı isteği (2026-09-01): /saha ekranı `docs/ankettema` tasarım dilinde ve TAM EKRAN
// çalışır — sayfa hiç aşağı kaydırılmaz. Üstte sabit marka barı + yatay sekme menüsü
// (Atanmış Anketler / Saha Görev Paneli) vardır; yalnızca aktif sekmenin içerik alanı
// kendi içinde kayar.

const STATUS_LABEL: Record<string, string> = {
  assigned: 'Atandı',
  in_progress: 'Devam ediyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
}
const STATUS_CLASS: Record<string, string> = {
  assigned: 'bg-blue-100 text-blue-800 border border-blue-200',
  in_progress: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  completed: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  cancelled: 'bg-slate-100 text-slate-700 border border-slate-200',
}

// Hata düzeltmesi (2026-09-02, kullanıcı: "pasif anket başlamıyor sebep nedir"):
// sebep istemcide tahmin ediliyordu ve anket pasif olduğunda yanlışlıkla "Tarih dışı"
// yazıyordu. Artık gerçek sebep backend'den (closedReason) gelir; eski tahmin yalnızca
// bu alan yoksa (eski API) yedek olarak kullanılır.
const CLOSED_REASON_LABELS: Record<string, string> = {
  survey_inactive: 'Anket pasif',
  task_cancelled: 'Görev iptal',
  task_completed: 'Görev tamamlandı',
  out_of_window: 'Tarih dışı',
  target_reached: 'Hedef doldu',
  daily_quota_reached: 'Günlük kota doldu',
}

const closedReason = (t: FieldTask): string => {
  if (t.closedReason) return CLOSED_REASON_LABELS[t.closedReason] ?? t.closedReason
  if (t.targetCount > 0 && t.completedCount >= t.targetCount) return 'Hedef doldu'
  if (t.dailyTarget > 0 && t.todayCount >= t.dailyTarget) return 'Günlük kota doldu'
  return 'Tarih dışı'
}

/** Anketöre ne yapması gerektiğini söyleyen açıklama (toast mesajı). */
const closedHint = (t: FieldTask): string => {
  switch (t.closedReason) {
    case 'survey_inactive': return 'Bu anket yönetici tarafından pasife alınmış. Anket yeniden aktif edilmeden görev başlatılamaz.'
    case 'task_cancelled': return 'Bu görev iptal edilmiş.'
    case 'task_completed': return 'Bu görev tamamlanmış.'
    case 'target_reached': return 'Bu görevin toplam hedefi doldu.'
    case 'daily_quota_reached': return 'Bugünkü hedefinize ulaştınız.'
    case 'out_of_window': return 'Bu görev için tanımlı tarih aralığının dışındasınız.'
    default: return 'Bu görev şu anda açık değil.'
  }
}

const categoryIcon = (category: string) => {
  const c = (category || '').toLocaleLowerCase('tr')
  if (c.includes('temizlik') || c.includes('çevre')) return <Trash2 className="h-5 w-5 text-emerald-600" />
  if (c.includes('sosyal') || c.includes('yardım')) return <HeartHandshake className="h-5 w-5 text-purple-600" />
  if (c.includes('memnuniyet')) return <Smile className="h-5 w-5 text-emerald-600" />
  if (c.includes('altyapı') || c.includes('imar') || c.includes('kent')) return <Building2 className="h-5 w-5 text-blue-600" />
  return <Layers className="h-5 w-5 text-indigo-600" />
}

type FilterId = 'all' | 'open' | 'completed' | 'closed'
type TabId = 'surveys' | 'dashboard' | 'notifications'

export const TASKS_CACHE_KEY = 'field_tasks_cache'

/** Son başarılı görev listesi (30 gün): saha görevleri haftalarca sürebilir. */
const readCachedTasks = (): FieldTask[] | null => {
  try {
    const raw = localStorage.getItem(TASKS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at?: number; list?: FieldTask[] }
    if (!Array.isArray(parsed?.list)) return null
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > 30 * 24 * 60 * 60 * 1000) return null
    return parsed.list
  } catch { return null }
}

export const FieldTasksPage = () => {
  const navigate = useNavigate()
  const logoUrl = useSystemLogo()
  const { state: authState } = useAuth()
  const bypassLabel = authState.status === 'authenticated'
    ? `${authState.user.fullName} hesabını yönetici olarak görüntülüyorsunuz`
    : ''
  const [tasks, setTasks] = useState<FieldTask[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterId>('all')
  const [tab, setTab] = useState<TabId>('dashboard')
  // Kullanıcı isteği (2026-09-01): ankete katılan kişiler panelde listelensin.
  // Anketör ad/TC görmez; görev bazlı katılımcı numarasıyla gösterilir.
  const [participants, setParticipants] = useState<(FieldResponseSummary & { taskTitle: string; no: string })[]>([])
  const [participantsLoading, setParticipantsLoading] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  // Kullanıcı isteği (2026-09-01): sol hamburger menü + sağ üst bildirim alanı.
  const [menuOpen, setMenuOpen] = useState(false)
  // Hata düzeltmesi (2026-09-02, kullanıcı bildirdi: "talep giriş için talep formu açılmıyor"):
  // Talep/öneri/şikayet formu yalnızca anket doldurma ekranında vardı; anketör görev
  // listesindeyken forma hiç ulaşamıyordu. Artık liste ekranından da açılabilir.
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  // Kullanıcı isteği (2026-09-02): "internet yoksa cache'e yazsın" — görev listesinde
  // bekleyen (henüz sunucuya gönderilememiş) kayıt sayısı görünür.
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0)
  useEffect(() => subscribeFieldOfflineQueue(setPendingOfflineCount), [])

  const tracking = useFieldLocationTracking(true)

  /**
   * Kullanıcı isteği (2026-09-03): "internet bağlantısı kapalı olsa da çalışması
   * gerekiyordu." Görev listesi yalnızca sunucudan geliyordu; şebekesiz bölgede
   * anketör hangi anketi dolduracağını göremiyordu. Son başarılı liste cihazda
   * saklanır ve ağ hatasında geri yüklenir (yanıtlar zaten çevrimdışı kuyruğa
   * alınıp ağ dönünce gönderiliyor).
   */
  const load = () => {
    setLoading(true)
    setError(null)
    fieldSurveyService.tasks()
      .then((list) => {
        setTasks(list)
        try { localStorage.setItem(TASKS_CACHE_KEY, JSON.stringify({ at: Date.now(), list })) } catch { /* kota */ }
      })
      .catch((err) => {
        // Sunucudan yanıt geldiyse (4xx/5xx) bu gerçek bir hatadır; önbellek
        // göstermek yanıltıcı olur. Yalnızca ağ/timeout durumunda önbelleğe düş.
        const isOffline = (err as { response?: unknown })?.response === undefined
        const cached = isOffline ? readCachedTasks() : null
        if (cached) {
          setTasks(cached)
          setError(null)
          toast.info('Çevrimdışısınız. Son bilinen görev listesi gösteriliyor.')
          return
        }
        setTasks(null)
        setError('Görevler yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Görevler geldikçe her görevin toplanan yanıtlarını çekip tek listede birleştirir.
  useEffect(() => {
    const list = tasks ?? []
    if (list.length === 0) { setParticipants([]); return }
    let cancelled = false
    setParticipantsLoading(true)
    Promise.all(list.map((t) =>
      fieldSurveyService.responses(t.id, 20)
        .then((rows) => rows.map((r, i) => ({
          ...r,
          taskTitle: t.surveyTitle,
          no: `SG-${t.id.replace(/-/g, '').slice(0, 4).toUpperCase()}-${String(rows.length - i).padStart(4, '0')}`,
        })))
        .catch(() => []),
    ))
      .then((groups) => {
        if (cancelled) return
        const merged = groups.flat()
          .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
          .slice(0, 50)
        setParticipants(merged)
      })
      .finally(() => { if (!cancelled) setParticipantsLoading(false) })
    return () => { cancelled = true }
  }, [tasks])

  // Zil rozeti ve menüdeki sayaç aynı kaynaktan beslenir; menü açıldığında da
  // tazelenir ki anketör güncel sayıyı görsün.
  useEffect(() => {
    const refresh = () => { notificationService.unreadCount('self').then(setUnreadCount).catch(() => undefined) }
    refresh()
    const timer = setInterval(refresh, 60_000)
    return () => clearInterval(timer)
  }, [])

  const rows = useMemo(() => {
    const list = tasks ?? []
    const q = search.trim().toLocaleLowerCase('tr')
    return list.filter((t) => {
      if (filter === 'open' && !(t.isWindowOpen && t.status !== 'completed')) return false
      if (filter === 'completed' && t.status !== 'completed') return false
      if (filter === 'closed' && (t.isWindowOpen || t.status === 'completed')) return false
      if (!q) return true
      return t.surveyTitle.toLocaleLowerCase('tr').includes(q)
        || t.neighborhood.toLocaleLowerCase('tr').includes(q)
        || (t.surveyCategory ?? '').toLocaleLowerCase('tr').includes(q)
    })
  }, [tasks, search, filter])

  const totals = useMemo(() => {
    const list = tasks ?? []
    return {
      assigned: list.length,
      open: list.filter((t) => t.isWindowOpen && t.status !== 'completed').length,
      today: list.reduce((sum, t) => sum + t.todayCount, 0),
      done: list.reduce((sum, t) => sum + t.completedCount, 0),
      target: list.reduce((sum, t) => sum + t.targetCount, 0),
      dailyTarget: list.reduce((sum, t) => sum + t.dailyTarget, 0),
      completedTasks: list.filter((t) => t.status === 'completed').length,
    }
  }, [tasks])

  const percent = totals.dailyTarget > 0
    ? Math.round((totals.today / totals.dailyTarget) * 100)
    : (totals.target > 0 ? Math.round((totals.done / totals.target) * 100) : 0)

  const start = (t: FieldTask) => {
    if (!t.isWindowOpen) {
      toast.error(closedHint(t))
      return
    }
    if (t.dailyTarget > 0 && t.todayCount >= t.dailyTarget) {
      toast.error('Bugünkü hedefinize ulaştınız.')
      return
    }
    setActiveTaskId(t.id)
  }

  if (activeTaskId) {
    // Zorunlu duyuru anket doldururken de görünmeli: acil bir saha talimatı
    // anketörün mevcut ekranını beklemek zorunda kalmamalı.
    return (
      <>
        <MandatoryAnnouncementGate />
        <FieldSurveyRunner
          taskId={activeTaskId}
          onExit={() => { setActiveTaskId(null); load() }}
        />
      </>
    )
  }

  const primaryNeighborhood = (tasks ?? []).find((t) => t.isWindowOpen)?.neighborhood
    ?? (tasks ?? [])[0]?.neighborhood ?? 'Saha bölgesi'

  const gpsLabel = tracking.status === 'tracking' ? 'GPS Açık'
    : tracking.status === 'denied' ? 'Konum izni kapalı' : 'Konum bekleniyor'

  // Kullanıcı isteği (2026-09-01): panel daha RENKLİ ve canlı olsun — her metrik kendi
  // gradient rengine sahip dolu kart olarak gösterilir (soluk beyaz kutular yerine).
  // Kullanıcı isteği (2026-09-02): "hepsi tıklanabilir olsun, gerekli alanlara gitsin".
  // Her metrik kartı ilgili görev listesine (filtreli) götürür; GPS kartı canlı takip
  // durumunu bildirir. `go` fonksiyonu sekme + filtreyi birlikte ayarlar.
  const go = (f: FilterId) => { setFilter(f); setTab('surveys') }

  const metrics = [
    { icon: ListTodo, grad: 'from-blue-500 to-blue-600', ring: 'shadow-blue-500/30', value: totals.open, label: 'Açık Görev', sub: 'Şu an doldurulabilir', onClick: () => go('open') },
    { icon: CheckCircle2, grad: 'from-emerald-500 to-teal-600', ring: 'shadow-emerald-500/30', value: totals.today, label: 'Bugün Toplanan', sub: totals.dailyTarget > 0 ? `Günlük hedef: ${totals.dailyTarget}` : 'Bugünkü kayıtlar', onClick: () => go('open') },
    { icon: ClipboardList, grad: 'from-violet-500 to-purple-600', ring: 'shadow-violet-500/30', value: totals.done, label: 'Toplam Toplanan', sub: 'Tüm görevler', onClick: () => go('all') },
    { icon: Target, grad: 'from-amber-500 to-orange-600', ring: 'shadow-amber-500/30', value: totals.target, label: 'Toplam Hedef', sub: 'Atanan kota', onClick: () => go('all') },
    { icon: CheckCircle2, grad: 'from-cyan-500 to-sky-600', ring: 'shadow-cyan-500/30', value: totals.completedTasks, label: 'Tamamlanan Görev', sub: 'Kapatılan anketler', onClick: () => go('completed') },
    { icon: Navigation, grad: 'from-fuchsia-500 to-pink-600', ring: 'shadow-fuchsia-500/30', value: `${(tracking.todayDistanceMeters / 1000).toFixed(2)} km`, label: 'Bugün Yürünen', sub: gpsLabel, onClick: () => toast.info(`Konum takibi: ${gpsLabel}`) },
  ] as const

  return (
    <div className="field-survey-shell flex h-[100dvh] flex-col overflow-hidden bg-[#F4F7FB] select-none">
      {bypassLabel && <BypassReturnBanner label={bypassLabel} />}
      {/* Üst marka barı */}
      <header className="flex-shrink-0 bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-700 text-white shadow-md">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Kullanıcı isteği (2026-09-01): gerekli menüler solda, hamburger içinde. */}
            <FieldMenuButton onClick={() => setMenuOpen(true)} />
            {/* Sistem logosu (Ayarlar > Logo / Kurumsal Kimlik'ten yönetilir) — diğer ekranlarla aynı marka görseli. */}
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15">
              <img
                src={logoUrl}
                alt="Bakırköy Belediyesi"
                className="h-7 w-7 object-contain brightness-0 invert"
              />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span className="font-black uppercase tracking-wider">Saha Anket Sistemi</span>
              </div>
              <p className="text-[11px] font-medium text-blue-100/90">
                Atanmış görevlerinizi seçip sahada anket toplayın
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Kullanıcı isteği (2026-09-02): "internet yoksa cache'e yazsın, internet
                geldiğinde otomatik senkronize etsin." Bekleyen kayıt varsa görev listesinde
                de görünür (yalnızca form içinde değil) — anketör göreve girmeden
                de sahada ne kadar kayıt biriktiğini fark edebilir. */}
            {pendingOfflineCount > 0 && (
              <span
                title={`${pendingOfflineCount} kayıt bağlantı bekliyor, internet gelince otomatik gönderilecek`}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/20 px-2 py-1 text-[11px] font-semibold text-amber-100 sm:px-2.5 sm:text-xs"
              >
                <WifiOff className="h-3.5 w-3.5" /> {pendingOfflineCount} bekleyen
              </span>
            )}
            <span
              className={cn(
                // Hata bulgusu (2026-09-02, mobil tarayıcı testi): rozet "hidden ... sm:flex"
                // olduğu için TELEFONDA hiç görünmüyordu. Oysa saha görevlisi anketi tam da
                // telefondan dolduruyor; konum izni kapandığında bunu fark edemiyor ve
                // görevi izlenmeden geçiyordu. Rozet her ekranda görünür yapıldı.
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold sm:px-2.5 sm:text-xs',
                tracking.status === 'tracking'
                  ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100'
                  : 'border-amber-400/40 bg-amber-500/20 text-amber-100',
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', tracking.status === 'tracking' ? 'animate-pulse bg-emerald-400' : 'bg-amber-300')} />
              {gpsLabel}
              {/* Yürünen mesafe telefonda da gösterilir: görevli sahadayken takibin
                  gerçekten işlediğini teyit edebilmeli. */}
              {tracking.todayDistanceMeters > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Footprints className="h-3.5 w-3.5" />
                  {(tracking.todayDistanceMeters / 1000).toFixed(2)} km
                </span>
              )}
            </span>

            <div className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1 md:flex">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-blue-300/30">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="text-left leading-none">
                <div className="text-xs font-bold">Anketör</div>
                <div className="mt-0.5 text-[9px] font-medium text-blue-200">Saha Personeli</div>
              </div>
            </div>

            {/* Kullanıcı isteği (2026-09-01): sağ üstte bildirim alanı. */}
            <FieldNotificationBell />
            {/* Hata düzeltmesi (2026-09-02): talep formuna liste ekranından tek dokunuşla erişim. */}
            <button
              onClick={() => {
                // Hata düzeltmesi (2026-09-02): görev listesi boşken düğme tıklanıyor ama
                // modal hiç açılmıyordu (sessiz başarısızlık). Talep kaydı backend'de bir
                // saha görevine bağlandığı için görev yoksa nedeni anketöre söylenir.
                if ((tasks ?? []).length === 0) {
                  toast.error('Talep formu için önce size bir saha görevi atanmalı.')
                  return
                }
                setQuickActionsOpen(true)
              }}
              title="Talep / Öneri / Şikayet oluştur"
              data-testid="field-quick-actions"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 text-xs font-bold transition-colors hover:bg-white/20"
            >
              <MessageSquarePlus className="h-4 w-4" />
              <span className="hidden sm:inline">Talep</span>
            </button>
            <button
              onClick={load}
              title="Yenile"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 transition-colors hover:bg-white/20"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
            <button
              onClick={() => { sessionStorage.setItem('app_mode', 'portal'); navigate('/') }}
              title="Portala dön"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 transition-colors hover:bg-white/20"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

      </header>

      {/* İçerik: yalnızca burası kayar */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-5 py-3">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3">
          {tab === 'notifications' ? (
            <FieldNotificationsTab />
          ) : tab === 'surveys' ? (
            <>
              {/* Kompakt özet şeridi + arama (sabit) */}
              <div className="flex flex-shrink-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 overflow-x-auto">
                  {([
                    { id: 'all', label: 'Tümü', count: totals.assigned },
                    { id: 'open', label: 'Açık', count: totals.open },
                    { id: 'completed', label: 'Tamamlanan', count: totals.completedTasks },
                    { id: 'closed', label: 'Kapalı', count: totals.assigned - totals.open - totals.completedTasks },
                  ] as { id: FilterId; label: string; count: number }[]).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={cn(
                        'flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all',
                        filter === f.id
                          ? 'bg-indigo-600 font-extrabold text-white shadow-sm'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      {f.label}
                      <span className={cn('rounded-full px-1.5 text-[10px] font-black', filter === f.id ? 'bg-white/25' : 'bg-slate-100 text-slate-600')}>
                        {Math.max(0, f.count)}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Anket veya kategori ara..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Görev listesi (kayan alan) */}
              <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                {loading && !tasks ? (
                  <div className="grid grid-cols-1 gap-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
                    ))}
                  </div>
                ) : error ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-white p-8 text-center">
                    <AlertTriangle className="h-8 w-8 text-rose-500" />
                    <h3 className="text-base font-extrabold text-slate-900">Görevler yüklenemedi</h3>
                    <p className="text-xs font-semibold text-slate-500">{error}</p>
                    <button onClick={load} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700">
                      Tekrar dene
                    </button>
                  </div>
                ) : rows.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center">
                    <ClipboardList className="h-8 w-8 text-slate-400" />
                    <h3 className="text-base font-extrabold text-slate-900">
                      {(tasks?.length ?? 0) === 0 ? 'Atanmış saha göreviniz yok' : 'Eşleşen görev yok'}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500">
                      {(tasks?.length ?? 0) === 0
                        ? 'Anket yöneticiniz size görev atadığında burada listelenecek.'
                        : 'Arama veya filtre kriterlerinizi değiştirin.'}
                    </p>
                    <button onClick={load} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700">
                      Yenile
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {rows.map((t) => {
                      const p = t.targetCount > 0 ? t.progressPercent : (t.completedCount > 0 ? 100 : 0)
                      const canStart = t.isWindowOpen && !(t.dailyTarget > 0 && t.todayCount >= t.dailyTarget)
                      return (
                        <div
                          key={t.id}
                          className={cn(
                            'flex flex-col justify-between gap-4 rounded-2xl border-2 bg-white p-4 shadow-sm transition-all md:flex-row md:items-center',
                            canStart ? 'border-slate-200 hover:border-indigo-300' : 'border-slate-200 opacity-80',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-blue-200/80 bg-blue-50">
                              {categoryIcon(t.surveyCategory)}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-extrabold leading-tight text-slate-900 sm:text-base">{t.surveyTitle}</h3>
                                <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider', STATUS_CLASS[t.status] ?? STATUS_CLASS.cancelled)}>
                                  {STATUS_LABEL[t.status] ?? t.status}
                                </span>
                                {!t.isWindowOpen && t.status !== 'completed' && (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">
                                    <AlertTriangle className="h-3 w-3" /> {closedReason(t)}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
                                <span className="flex items-center gap-1 font-bold text-slate-700">
                                  <MapPin className="h-3.5 w-3.5 text-indigo-600" />
                                  {t.neighborhood}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                  {formatDate(t.startDate)} – {formatDate(t.endDate)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                                  {t.questionCount} soru · ~{t.estimatedDuration} dk
                                </span>
                                {t.dailyTarget > 0 && (
                                  <span className="font-bold text-slate-700">Bugün: {t.todayCount}/{t.dailyTarget}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-5 border-t border-slate-100 pt-3 md:justify-end md:border-t-0 md:pt-0">
                            <div className="flex w-40 flex-col gap-1">
                              <div className="flex items-center justify-between text-[11px] font-bold">
                                <span className="text-slate-500">Hedef: {t.targetCount || '-'}</span>
                                <span className="text-slate-800">{t.completedCount}</span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={cn('h-full rounded-full transition-all', p >= 100 ? 'bg-emerald-500' : 'bg-indigo-600')}
                                  style={{ width: `${Math.min(p, 100)}%` }}
                                />
                              </div>
                              <span className="text-right text-[11px] font-black text-indigo-700">%{p}</span>
                            </div>

                            <button
                              onClick={() => start(t)}
                              disabled={!canStart}
                              title={canStart ? undefined : closedReason(t)}
                              className={cn(
                                'flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black shadow-md transition-all sm:text-sm',
                                canStart
                                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg active:scale-95'
                                  : 'cursor-not-allowed bg-slate-200 text-slate-500 shadow-none',
                              )}
                            >
                              <Play className={cn('h-4 w-4', canStart && 'fill-white')} />
                              <span>Anketi Başlat</span>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Saha Görev Paneli sekmesi — renkli gradient kartlar */
            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
              <div className="flex flex-col gap-4">
                {/* Hero: bölge + hedef ilerlemesi.
                    Kullanıcı isteği (2026-09-02): "hepsi tıklanabilir olsun, gerekli
                    alanlara gitsin" — bu banner da tıklanınca görev listesine götürür. */}
                <button
                  type="button"
                  onClick={() => go('all')}
                  className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-5 text-left text-white shadow-xl shadow-violet-500/20 transition-transform active:scale-[0.99] sm:p-6"
                >
                  <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
                  <div className="absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                  <div className="relative flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 backdrop-blur-sm">
                        <Icon2D kind="city" className="h-8 w-8" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-black tracking-tight">{primaryNeighborhood}</h3>
                          <span className="rounded-full border border-white/25 bg-white/20 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide">
                            Aktif Bölge
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-white/85">
                          {totals.dailyTarget > 0
                            ? `Bugünkü Hedef: ${totals.dailyTarget} anket • Tamamlanan: ${totals.today}`
                            : `Toplam Hedef: ${totals.target} anket • Tamamlanan: ${totals.done}`}
                        </p>
                        <div className="mt-2.5 h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/20">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-lime-300 transition-[width] duration-500"
                            style={{ width: `${Math.max(percent, 2)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-4xl font-black leading-none">%{percent}</div>
                        <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-white/70">
                          Hedef İlerlemesi
                        </div>
                      </div>
                      <div className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl border border-white/25 bg-white/15 backdrop-blur-sm">
                        <span className="text-sm font-black">
                          {totals.dailyTarget > 0 ? totals.today : totals.done}
                        </span>
                        <span className="text-[10px] font-bold text-white/70">
                          / {totals.dailyTarget > 0 ? totals.dailyTarget : (totals.target || '—')}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Bugünkü görev özeti — 3 renkli gradient kart, hepsi tıklanabilir. */}
                <div>
                  <div className="mb-2.5 flex items-center justify-between px-0.5">
                    <div className="flex items-center gap-2">
                      <Target className="h-4.5 w-4.5 text-violet-600" />
                      <h2 className="text-sm font-black tracking-tight text-slate-900">Bugünkü Saha Görevleri</h2>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-black text-violet-700">
                      <MapPin className="h-3 w-3" />
                      {primaryNeighborhood}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      { v: totals.assigned, l: 'Atanmış Anket', grad: 'from-blue-500 to-indigo-600', ic: ClipboardList, onClick: () => go('all') },
                      { v: totals.open, l: 'Açık Görev', grad: 'from-amber-500 to-orange-600', ic: ListTodo, onClick: () => go('open') },
                      { v: totals.today, l: 'Bugün Toplanan', grad: 'from-emerald-500 to-teal-600', ic: CheckCircle2, onClick: () => go('open') },
                    ].map(({ v, l, grad, ic: Ic, onClick }) => (
                      <button
                        key={l}
                        type="button"
                        onClick={onClick}
                        className={cn(
                          'relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-left text-white shadow-lg transition-transform active:scale-95',
                          grad,
                        )}
                      >
                        <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/15 blur-xl" />
                        <div className="relative flex items-center justify-between">
                          <div>
                            <div className="text-3xl font-black leading-none">{v}</div>
                            <div className="mt-1.5 text-xs font-bold text-white/85">{l}</div>
                          </div>
                          <Ic className="h-8 w-8 text-white/40" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Detaylı metrikler — renkli ikon rozetli beyaz kartlar */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {metrics.map(({ icon: Icon, grad, ring, value, label, sub, onClick }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={onClick}
                      className="flex w-full items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-all hover:border-violet-300 hover:shadow-md active:scale-[0.98]"
                    >
                      <div className={cn(
                        'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg',
                        grad, ring,
                      )}>
                        <Icon className="h-5.5 w-5.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-2xl font-black leading-none text-slate-900">{value}</div>
                        <div className="mt-1 truncate text-xs font-bold text-slate-600">{label}</div>
                        <div className="truncate text-[10px] font-semibold text-slate-400">{sub}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
                    </button>
                  ))}
                </div>

                {/* Kullanıcı isteği (2026-09-02): anketör kendi performansını görsün. */}
                <FieldPerformanceCard tasks={tasks ?? []} onClick={() => go('all')} />

                {/* Kullanıcı isteği (2026-09-02): "dashboardda liste olmasın, sadece ana
                    detay dashboard olsun ve hepsi tıklanabilir olsun, gerekli alanlara
                    gitsin." Görev TABLOSU kaldırıldı; görev listesi artık yalnızca
                    "Anketler" sekmesinde. Buradaki kartlar ilgili filtreye götürür. */}

                {/* Kullanıcı isteği (2026-09-02): "ankete katılan kişileri altta buton
                    olarak görelim." Tablo yerine, her katılımcı tek dokunuşluk bir buton;
                    tıklanınca o katılımcının görevi açılır (anketör kaldığı yerden devam
                    eder ya da kaydı bağlamında görür). */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4.5 w-4.5 text-emerald-600" />
                      <h3 className="text-sm font-black tracking-tight text-slate-900">Ankete Katılan Kişiler</h3>
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-700">
                      {participants.length} katılımcı
                    </span>
                  </div>

                  <div className="max-h-[340px] overflow-y-auto p-3">
                    {participants.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <User className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                        <p className="text-xs font-bold text-slate-500">
                          {participantsLoading ? 'Katılımcılar yükleniyor…' : 'Henüz ankete katılan kişi yok.'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {participants.map((r) => {
                          const task = (tasks ?? []).find((t) => t.surveyTitle === r.taskTitle)
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                if (task) start(task)
                                else toast.info('Bu kaydın görevi artık açık değil.')
                              }}
                              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-md active:scale-[0.98]"
                            >
                              <span className={cn(
                                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black',
                                r.gender === 'male' ? 'bg-blue-50 text-blue-700'
                                  : r.gender === 'female' ? 'bg-pink-50 text-pink-700'
                                  : 'bg-slate-100 text-slate-500',
                              )}>
                                {r.gender === 'male' ? 'E' : r.gender === 'female' ? 'K' : '?'}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-mono text-[11px] font-black text-violet-700">{r.no}</div>
                                <div className="truncate text-[11px] font-bold text-slate-700">{r.taskTitle}</div>
                                <div className="flex flex-wrap items-center gap-x-2 text-[10px] font-semibold text-slate-400">
                                  <span className="inline-flex items-center gap-0.5">
                                    <MapPin className="h-2.5 w-2.5 text-violet-400" />
                                    {r.neighborhood ?? '—'}
                                  </span>
                                  <span>{r.ageGroup ?? '—'}</span>
                                  <span>{formatDate(r.submittedAt)}</span>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Tam ekran saha kullanımında sekmeler her zaman başparmak mesafesinde kalır. */}
      <nav className="flex flex-shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-2 py-2 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] sm:px-4">
        <button
          type="button"
          onClick={() => setTab('dashboard')}
          className={cn(
            'flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-colors',
            tab === 'dashboard' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          )}
        >
          <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">Dashboard</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('surveys')}
          className={cn(
            'flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-colors',
            tab === 'surveys' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          )}
        >
          <ListTodo className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">Anketler</span>
          {totals.assigned > 0 && <span className={cn('rounded-full px-1.5 text-[10px]', tab === 'surveys' ? 'bg-white/20' : 'bg-white')}>{totals.assigned}</span>}
        </button>
        {/* Kullanıcı isteği (2026-09-02): gelen mesaj ve bildirimler kalıcı bir listede görünsün. */}
        <button
          type="button"
          data-testid="field-notifications-tab"
          onClick={() => setTab('notifications')}
          className={cn(
            'flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-colors',
            tab === 'notifications' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          )}
        >
          <Bell className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">Bildirimler</span>
          {unreadCount > 0 && (
            <span className={cn('rounded-full px-1.5 text-[10px]', tab === 'notifications' ? 'bg-white/20' : 'bg-rose-100 text-rose-700')}>
              {unreadCount}
            </span>
          )}
        </button>
      </nav>

      <FieldSideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenTasks={() => setTab('surveys')}
        onOpenNotifications={() => setTab('notifications')}
        onOpenQuickActions={() => {
          if ((tasks ?? []).length === 0) {
            toast.error('Talep formu için önce size bir saha görevi atanmalı.')
            return
          }
          setQuickActionsOpen(true)
        }}
        taskCount={(tasks ?? []).length}
        unreadCount={unreadCount}
      />

      {/* Talep/öneri/şikayet formu: görev listesi ekranından da açılabilir. Form bir saha
          görevine bağlı çalıştığı için anketörün açık görevlerinden ilki referans alınır. */}
      {quickActionsOpen && (tasks ?? []).length > 0 && (
        <FieldQuickActionsModal
          open={quickActionsOpen}
          onClose={() => setQuickActionsOpen(false)}
          fieldTaskId={((tasks ?? []).find((t) => t.isWindowOpen) ?? (tasks ?? [])[0]).id}
          neighborhood={((tasks ?? []).find((t) => t.isWindowOpen) ?? (tasks ?? [])[0]).neighborhood}
        />
      )}

      {/* Kullanıcı isteği (2026-09-01): okudum denmeden kapatılamayan duyuru. */}
      <MandatoryAnnouncementGate />
    </div>
  )
}
