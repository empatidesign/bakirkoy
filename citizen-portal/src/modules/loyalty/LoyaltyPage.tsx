import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  TrophyIcon, FlameIcon, StarIcon, CheckIcon, CoinsIcon, HistoryIcon,
  GiftIcon, PackageIcon, ShoppingBagIcon, ChevronRightIcon,
  ArrowUpIcon, ClipboardListIcon, ZapIcon, CalendarCheckIcon,
} from 'lucide-react'
import { Icon2D, type Icon2DKind } from '@/components/Icon2D'
import { Badge, Button, EmptyState, Pagination, SkeletonRows } from '@/design-system'
import loyaltyService from '@/services/loyalty.service'
import type { LoyaltyStreak, LoyaltyTransaction, CitizenReward, StreakDay, RewardRedemption } from '@/types/loyalty.types'

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const StreakCircle = ({ day, index }: { day: StreakDay; index: number }) => {
  if (day.isCompleted) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full text-white sm:h-10 sm:w-10"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 0 3px rgba(99,102,241,0.35), 0 4px 12px rgba(99,102,241,0.6)' }}>
          <CheckIcon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={3} />
        </div>
        <span className="text-[10px] font-bold text-white">{DAY_LABELS[index]}</span>
      </div>
    )
  }
  if (day.isToday) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full animate-pulse sm:h-10 sm:w-10"
          style={{ background: 'rgba(253,224,71,0.25)', border: '2.5px solid #fde047', boxShadow: '0 0 12px rgba(253,224,71,0.5)' }}>
          <ZapIcon className="h-4 w-4 text-yellow-300" fill="currentColor" />
        </div>
        <span className="text-[10px] font-black text-yellow-300">{DAY_LABELS[index]}</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full sm:h-10 sm:w-10"
        style={{ background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.2)' }}>
        <span className="text-[12px] font-semibold text-white/55">{day.dayNumber}</span>
      </div>
      <span className="text-[10px] font-medium text-white/50">{DAY_LABELS[index]}</span>
    </div>
  )
}

type LoyaltyTab = 'streak' | 'rewards' | 'history'

const HERO_TABS: { key: LoyaltyTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'streak', label: 'Seri & Puan', icon: FlameIcon },
  { key: 'rewards', label: 'Ödüller', icon: GiftIcon },
  { key: 'history', label: 'Geçmiş', icon: HistoryIcon },
]

const HeroBanner = ({
  balance, txTotal, earnedTotal,
}: {
  balance: number; txTotal: number; earnedTotal: number
}) => (
  <div
    className="relative flex-shrink-0 overflow-hidden"
    style={{ background: 'linear-gradient(150deg,#1e1b4b 0%,#312e81 35%,#4f46e5 70%,#7c3aed 100%)' }}
  >
    <div className="relative flex flex-col items-start gap-3 px-6 py-5 md:flex-row md:items-center md:gap-8 md:px-10">

      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.22)', boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }}>
          <TrophyIcon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-[16px] font-black text-white leading-none md:text-[18px]" style={{ letterSpacing: '-0.02em' }}>Puanlarım</h1>
          <p className="mt-0.5 text-[10px] text-white/40">Bakırköy Belediyesi Sadakat</p>
        </div>
      </div>

      <div className="hidden h-10 w-px flex-shrink-0 bg-white/15 sm:block" />

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 4px 12px rgba(245,158,11,0.55)' }}>
          <StarIcon className="h-5 w-5 fill-white text-white" />
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-white/40">Mevcut Bakiyem</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-black text-white leading-none sm:text-[32px] md:text-[38px]" style={{ letterSpacing: '-0.03em' }}>
              {(balance ?? 0).toLocaleString('tr-TR')}
            </span>
            <span className="text-[13px] font-semibold text-white/50">puan</span>
          </div>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          <FlameIcon className="h-3 w-3 text-yellow-300" />
          <span className="text-[11px] text-white/35">Harika! Devam et.</span>
        </div>
      </div>

      <div className="hidden h-10 w-px flex-shrink-0 bg-white/15 md:block" />

      <div className="hidden items-center gap-3 md:flex flex-shrink-0">
        <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
          style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>
          <ArrowUpIcon className="h-4 w-4 text-emerald-400" />
          <div>
            <p className="text-[9px] text-white/40">Toplam Kazanılan</p>
            <p className="text-[14px] font-black text-emerald-400 leading-none">
              {(earnedTotal ?? 0).toLocaleString('tr-TR')} <span className="text-[10px] font-semibold">puan</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
          style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)' }}>
          <ClipboardListIcon className="h-4 w-4 text-indigo-300" />
          <div>
            <p className="text-[9px] text-white/40">İşlem Sayınız</p>
            <p className="text-[14px] font-black text-indigo-300 leading-none">
              {txTotal} <span className="text-[10px] font-semibold">işlem</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-row gap-1.5 md:hidden">
        <div className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-1.5"
          style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>
          <p className="text-[9px] text-white/40">Toplam Kazanılan</p>
          <div className="flex items-center gap-1.5">
            <ArrowUpIcon className="h-3 w-3 text-emerald-400" />
            <p className="text-[11px] font-black text-emerald-400">{(earnedTotal ?? 0).toLocaleString('tr-TR')} <span className="text-[9px] font-semibold">puan</span></p>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-1.5"
          style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)' }}>
          <p className="text-[9px] text-white/40">İşlem Sayınız</p>
          <div className="flex items-center gap-1.5">
            <ClipboardListIcon className="h-3 w-3 text-indigo-300" />
            <p className="text-[11px] font-black text-indigo-300">{txTotal} <span className="text-[9px] font-semibold">işlem</span></p>
          </div>
        </div>
      </div>
    </div>

  </div>
)

const LOYALTY_ACCENT = '#7c3aed'

const LoyaltyTabBar = ({ tab, onTabChange }: { tab: LoyaltyTab; onTabChange: (t: LoyaltyTab) => void }) => (
  <div className="flex flex-shrink-0 items-stretch gap-1 border-b border-gray-200 bg-white px-3 md:px-8">
    {HERO_TABS.map(({ key, label, icon: TabIcon }) => {
      const active = tab === key
      return (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-3 text-[13px] transition-colors duration-150 sm:flex-none sm:px-3 ${
            active ? 'font-semibold' : 'font-medium text-gray-500 hover:text-gray-700'
          }`}
          style={active ? { color: LOYALTY_ACCENT } : undefined}
        >
          <TabIcon className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{label}</span>
          {active && (
            <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full" style={{ backgroundColor: LOYALTY_ACCENT }} />
          )}
        </button>
      )
    })}
  </div>
)

const RewardsBanner = ({ onGoRewards }: { onGoRewards: () => void }) => (
  <button type="button" onClick={onGoRewards}
    className="flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all hover:opacity-90 active:scale-[0.98]"
    style={{ background: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '1px solid #fcd34d' }}>
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl"
      style={{ background: 'rgba(245,158,11,0.2)' }}>
      <TrophyIcon className="h-6 w-6 text-amber-600" />
    </div>
    <div className="flex-1">
      <p className="text-[14px] font-bold text-amber-900">Ödüllerimi Keşfet</p>
      <p className="text-[11px] text-amber-700 mt-0.5">Puanlarını harika ödüllerle değiştir!</p>
    </div>
    <ChevronRightIcon className="h-5 w-5 text-amber-600" />
  </button>
)

const WeeklyStreak = ({ streak }: { streak: LoyaltyStreak | null }) => {
  const days = streak?.weekDays ??
    Array.from({ length: 7 }, (_, i) => ({ dayNumber: i + 1, isCompleted: false, isToday: i === 0, isFuture: i > 0 }))

  return (
    <div className="overflow-hidden rounded-2xl shadow-md"
      style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#9333ea 100%)' }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-[15px] font-black text-white">Haftalık Ziyaret Seriniz</p>
          <p className="text-[11px] text-white/45 mt-0.5">Her gün giriş yap, serini bozma!</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <FlameIcon className="h-4 w-4 text-orange-300" />
          <span className="text-[12px] font-bold text-white">Seri: {streak?.currentStreak ?? 0} Gün</span>
        </div>
      </div>
      <div className="flex items-center justify-between px-5 py-3">
        {days.map((day, i) => <StreakCircle key={i} day={day} index={i} />)}
      </div>
      <div className="mx-5 mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5"
        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <GiftIcon className="h-4 w-4 text-yellow-300 flex-shrink-0" />
        <p className="text-[11px] font-medium text-white/75">7 gün üst üste giriş yapana 100 bonus puan!</p>
      </div>
      <div className="mx-5 mb-5 flex items-start gap-2 rounded-xl px-4 py-2.5"
        style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.35)' }}>
        <CalendarCheckIcon className="h-4 w-4 text-indigo-200 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-indigo-200 leading-relaxed">
          Uygulamaya giriş yaptığınızda günlük puanınız <strong className="text-white">otomatik</strong> hesabınıza eklenir.
        </p>
      </div>
      <div className="flex items-center justify-between bg-black/20 px-5 py-2.5">
        <p className="text-[11px] text-white/35">En uzun seri</p>
        <p className="text-[11px] font-bold text-white">{streak?.longestStreak ?? 0} gün</p>
      </div>
    </div>
  )
}

/**
 * Puan kazanma yollarının ikonu hem yerel varsayılanlardan hem de backend'den (loyalty
 * ayarları) gelebiliyor; backend halen emoji gönderdiği için ikisini de Icon2D adına
 * çeviriyoruz. Tanınmayan değer için nötr 'star' kullanılır.
 */
const EARN_WAY_ICONS: Record<string, Icon2DKind> = {
  mobile: 'mobile', handshake: 'handshake', party: 'party', brain: 'brain',
  clipboard: 'clipboard', bus: 'bus', star: 'star', gift: 'gift', medal: 'medal',
  '📱': 'mobile', '🤝': 'handshake', '🎉': 'party', '🧠': 'brain',
  '📋': 'clipboard', '🚌': 'bus', '⭐': 'star', '🎁': 'gift', '🏅': 'medal',
}
const earnWayIcon = (icon: string): Icon2DKind => EARN_WAY_ICONS[icon] ?? 'star'

const EarnWayRow = ({ icon, label, points, completed, description }: { icon: string; label: string; points: number; completed: boolean; description?: string | null }) => (
  <div className={`flex items-center gap-3 border-b border-border py-3 last:border-0 ${completed ? 'opacity-60' : ''}`}>
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-indigo-500"
      style={{ background: 'rgba(99,102,241,0.07)' }}>
      <Icon2D kind={earnWayIcon(icon)} className="h-5 w-5" />
    </div>
    <div className="min-w-0 flex-1">
      <span className="block break-words text-[13px] font-medium text-foreground-strong">{label}</span>
      {description && <span className="mt-0.5 block text-[11px] leading-snug text-foreground-subtle">{description}</span>}
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      <span className="text-[13px] font-bold" style={{ color: '#6366f1' }}>+{points} Puan</span>
      {completed ? (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500">
          <CheckIcon className="h-4 w-4 text-white" />
        </div>
      ) : (
        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-border">
          <ChevronRightIcon className="h-3.5 w-3.5 text-foreground-subtle" />
        </div>
      )}
    </div>
  </div>
)

const RewardCard = ({ reward, balance, onRedeem, redeeming }: {
  reward: CitizenReward; balance: number; onRedeem: (id: string) => void; redeeming: string | null
}) => {
  const safeBalance = typeof balance === 'number' && !isNaN(balance) ? balance : 0
  const canAfford = safeBalance >= reward.pointsRequired
  const outOfStock = reward.stock === 0
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {reward.imageUrl ? (
        <img src={reward.imageUrl} alt={reward.name} className="h-32 w-full object-cover" />
      ) : (
        <div className="flex h-32 w-full items-center justify-center" style={{ background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}>
          <GiftIcon className="h-10 w-10 text-violet-400" />
        </div>
      )}
      <div className="p-3">
        <p className="truncate text-[13px] font-bold text-foreground-strong">{reward.name}</p>
        {reward.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-foreground-subtle">{reward.description}</p>}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <CoinsIcon className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[12px] font-bold text-foreground-default">{reward.pointsRequired} puan</span>
          </div>
          {outOfStock ? <Badge tone="neutral">Tükendi</Badge> : (
            <Badge tone={reward.stock <= 5 ? 'warning' : 'success'}>{reward.stock} adet</Badge>
          )}
        </div>
        <button type="button"
          disabled={!canAfford || outOfStock || redeeming === reward.id}
          onClick={() => onRedeem(reward.id)}
          className="mt-2.5 w-full rounded-xl py-2 text-[12px] font-bold transition-all disabled:opacity-50"
          style={canAfford && !outOfStock
            ? { background: 'linear-gradient(135deg,#6366f1,#7c3aed)', color: '#fff', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }
            : { background: '#f1f5f9', color: '#94a3b8' }
          }>
          {redeeming === reward.id ? '...' : outOfStock ? 'Stok Yok' : !canAfford ? `${reward.pointsRequired - safeBalance} puan eksik` : 'Talep Et'}
        </button>
      </div>
    </div>
  )
}

const REDEMPTION_STATUS_META: Record<string, { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
  Pending: { tone: 'warning', label: 'Onay Bekliyor' },
  Completed: { tone: 'success', label: 'Teslim Alındı' },
  Cancelled: { tone: 'danger', label: 'İptal Edildi' },
}

const RedemptionCard = ({ redemption, onClaim, claiming }: {
  redemption: RewardRedemption; onClaim: (id: string) => void; claiming: string | null
}) => {
  const meta = REDEMPTION_STATUS_META[redemption.status] ?? { tone: 'neutral' as const, label: redemption.status }
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
      {redemption.rewardImageUrl ? (
        <img src={redemption.rewardImageUrl} alt={redemption.rewardName} className="h-12 w-12 flex-shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(124,58,237,0.1)' }}>
          <GiftIcon className="h-5 w-5 text-violet-400" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-foreground-strong">{redemption.rewardName}</p>
        <p className="mt-0.5 text-[11px] text-foreground-subtle">{fmt(redemption.redeemedAt)} — {redemption.pointsSpent} puan</p>
      </div>
      <div className="flex-shrink-0">
        {redemption.status === 'Pending' ? (
          <Button size="sm" variant="primary" isLoading={claiming === redemption.id}
            onClick={() => onClaim(redemption.id)}>
            Teslim Aldım
          </Button>
        ) : (
          <Badge tone={meta.tone}>{meta.label}</Badge>
        )}
      </div>
    </div>
  )
}

export const LoyaltyPage = () => {
  const [tab, setTab] = useState<'streak' | 'rewards' | 'history'>('streak')
  const [streak, setStreak] = useState<LoyaltyStreak | null>(null)
  const [streakLoading, setStreakLoading] = useState(true)
  const [balance, setBalance] = useState<number | null>(null)
  const [earnedTotal, setEarnedTotal] = useState(0)

  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [txPage, setTxPage] = useState(1)
  const [txTotal, setTxTotal] = useState(0)
  const TX_LIMIT = 20

  const [rewards, setRewards] = useState<CitizenReward[]>([])
  const [rewardsLoading, setRewardsLoading] = useState(false)
  const [redeeming, setRedeeming] = useState<string | null>(null)

  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([])
  const [redemptionsLoading, setRedemptionsLoading] = useState(false)
  const [claiming, setClaiming] = useState<string | null>(null)

  const [earnWays, setEarnWays] = useState<{ key: string; label: string; points: number; icon: string; completed: boolean; description?: string }[]>([])
  const [earnWaysLoading, setEarnWaysLoading] = useState(false)
  const [earnWaysPage, setEarnWaysPage] = useState(1)

  const autoCheckIn = useCallback(async () => {
    try {
      const result = await loyaltyService.checkIn()
      setStreak(result.streak)
      if (result.isNewCheckIn && result.pointsEarned > 0) {
        toast.success(`🎉 +${result.pointsEarned} puan kazandınız! ${result.streak.currentStreak} günlük seri!`)
      }
    } catch {
    }
  }, [])

  const loadStreak = useCallback(async () => {
    setStreakLoading(true)
    try {
      const [data, bal] = await Promise.all([loyaltyService.getStreak(), loyaltyService.getBalance()])
      setStreak(data)
      setBalance(bal ?? 0)
    } finally {
      setStreakLoading(false)
    }
  }, [])

  const loadTransactions = useCallback(async (page = 1) => {
    setTxLoading(true)
    try {
      const data = await loyaltyService.getTransactions(page, TX_LIMIT)
      if (page === 1) {
        setTransactions(data.items)
        setTxTotal(data.total)
        setEarnedTotal(data.items.reduce((s, t) => s + (t.points > 0 ? t.points : 0), 0))
      } else {
        setTransactions(prev => [...prev, ...data.items])
      }
      setTxPage(page)
    } finally {
      setTxLoading(false)
    }
  }, [])

  const loadRewards = useCallback(async () => {
    setRewardsLoading(true)
    try { setRewards(await loyaltyService.getRewardCatalog(20)) }
    finally { setRewardsLoading(false) }
  }, [])

  const loadRedemptions = useCallback(async () => {
    setRedemptionsLoading(true)
    try {
      const data = await loyaltyService.getRedemptions(1, 20)
      setRedemptions(data.items)
    } finally {
      setRedemptionsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStreak()
    void autoCheckIn()
    void loadTransactions()
  }, [loadStreak, autoCheckIn, loadTransactions])

  useEffect(() => {
    if (tab === 'history' && transactions.length === 0) void loadTransactions()
    if (tab === 'rewards') { void loadRewards(); void loadRedemptions() }
    if (tab === 'streak' && earnWays.length === 0) {
      setEarnWaysLoading(true)
      loyaltyService.getEarnWays().then(setEarnWays).catch(() => void 0).finally(() => setEarnWaysLoading(false))
    }
  }, [tab, loadTransactions, loadRewards, loadRedemptions, earnWays.length, transactions.length])

  const handleRedeem = async (rewardId: string) => {
    setRedeeming(rewardId)
    try {
      const result = await loyaltyService.redeemReward(rewardId)
      if (result.success) {
        toast.success(`Ödül talep edildi! Bakiyeniz: ${result.balanceAfter.toLocaleString('tr-TR')} puan`)
        setBalance(result.balanceAfter)
        await loadRewards()
        await loadTransactions()
        await loadRedemptions()
      } else {
        toast.error(result.message)
      }
    } catch { toast.error('Talep işlemi başarısız oldu.') }
    finally { setRedeeming(null) }
  }

  const handleClaim = async (redemptionId: string) => {
    setClaiming(redemptionId)
    try {
      await loyaltyService.claimRedemption(redemptionId)
      toast.success('Ödül teslim alındı olarak işaretlendi!')
      await loadRedemptions()
    } catch { toast.error('Teslim alma işlemi başarısız oldu.') }
    finally { setClaiming(null) }
  }

  const DEFAULT_EARN_WAYS = [
    { key: 'daily_login',      label: 'Uygulamaya giriş yap',  points: 10,  icon: 'mobile', completed: false, description: 'Her gün portala giriş yaparak günlük sadakat puanını kazan.' },
    { key: 'services',         label: 'Hizmetlerden faydalan', points: 20,  icon: 'handshake', completed: false, description: 'Belediye hizmetlerini kullandığında hesabına ek puan yansır.' },
    { key: 'event_attendance', label: 'Etkinliklere katıl',    points: 15,  icon: 'party', completed: false, description: 'Sosyal, kültürel veya eğitim etkinliklerine katılımını puana dönüştür.' },
    { key: 'quiz_complete',    label: 'Quiz Tamamla',          points: 20,  icon: 'brain', completed: false, description: 'Bilgi yarışmalarını tamamlayarak yeni puanlar kazan.' },
    { key: 'survey_complete',  label: 'Anket Doldur',          points: 15,  icon: 'clipboard', completed: false, description: 'Geri bildirim anketlerine katılıp görüşlerinle katkı sağla.' },
    { key: 'travel_join',      label: 'Gezi Katılımı',         points: 25,  icon: 'bus', completed: false, description: 'Belediyenin düzenlediği gezilere katılarak sadakat puanı topla.' },
    { key: 'welcome_bonus',    label: 'Hoşgeldin Bonusu',      points: 100, icon: 'star', completed: false, description: 'Sadakat programına ilk katılımında verilen başlangıç puanı.' },
  ]
  const displayEarnWays = earnWays.length > 0 ? earnWays : DEFAULT_EARN_WAYS
  const EARN_WAYS_LIMIT = 4
  const earnWaysTotalPages = Math.max(1, Math.ceil(displayEarnWays.length / EARN_WAYS_LIMIT))
  const pagedEarnWays = displayEarnWays.slice(
    (earnWaysPage - 1) * EARN_WAYS_LIMIT,
    earnWaysPage * EARN_WAYS_LIMIT,
  )

  return (
    <div className="flex h-full flex-col bg-surface-1">

      {streakLoading ? (
        <div className="h-56 flex-shrink-0 animate-pulse bg-indigo-950/80 md:h-44" />
      ) : (
        <HeroBanner balance={balance ?? 0} txTotal={txTotal} earnedTotal={earnedTotal} />
      )}
      <LoyaltyTabBar tab={tab} onTabChange={setTab} />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-5 md:px-6 lg:px-10">

          {tab === 'streak' && (
            <div className="flex flex-col gap-5">
              <RewardsBanner onGoRewards={() => setTab('rewards')} />

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-stretch">
                {streakLoading ? (
                  <div className="h-64 animate-pulse rounded-2xl bg-indigo-200" />
                ) : (
                  <WeeklyStreak streak={streak} />
                )}

                <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="border-b border-border bg-gray-50/60 px-5 py-4 flex-shrink-0">
                    <p className="flex items-center gap-2 text-[14px] font-bold text-foreground-strong">
                      <CoinsIcon className="h-4 w-4 text-indigo-500" />
                      Puan Nasıl Kazanılır?
                    </p>
                  </div>
                  <div className="flex-1 px-5">
                    {earnWaysLoading ? (
                      <div className="space-y-3 py-3">
                        {[1,2,3,4].map(i => <div key={i} className="h-10 animate-pulse rounded-xl bg-surface-1" />)}
                      </div>
                    ) : (
                      pagedEarnWays.map(item => (
                        <EarnWayRow key={item.key} icon={item.icon} label={item.label} points={item.points} completed={item.completed} description={item.description} />
                      ))
                    )}
                  </div>
                  {!earnWaysLoading && displayEarnWays.length > EARN_WAYS_LIMIT && (
                    <Pagination
                      page={earnWaysPage}
                      totalPages={earnWaysTotalPages}
                      total={displayEarnWays.length}
                      limit={EARN_WAYS_LIMIT}
                      onPageChange={setEarnWaysPage}
                      className="flex-shrink-0 rounded-b-2xl px-5"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'rewards' && (
            <div className="space-y-5">
              <div className="flex items-center gap-4 rounded-2xl p-4 md:p-5"
                style={{ background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)', border: '1px solid #c4b5fd' }}>
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: 'rgba(109,40,217,0.15)' }}>
                  <CoinsIcon className="h-6 w-6 text-violet-700" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-violet-500">Mevcut Bakiye</p>
                  <p className="text-[20px] font-black text-violet-900">{(balance ?? 0).toLocaleString('tr-TR')} puan</p>
                </div>
              </div>
              {rewardsLoading || balance === null ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="overflow-hidden rounded-2xl border border-border">
                      <div className="h-32 animate-pulse bg-surface-1" />
                      <div className="space-y-2 p-3">
                        <div className="h-4 animate-pulse rounded-lg bg-surface-1" />
                        <div className="h-3 w-2/3 animate-pulse rounded-lg bg-surface-1" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : rewards.length === 0 ? (
                <EmptyState icon={ShoppingBagIcon} title="Henüz ödül yok" description="Ödül kataloğu yakında yayınlanacak." />
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {rewards.map(r => (
                    <RewardCard key={r.id} reward={r} balance={balance ?? 0}
                      onRedeem={id => void handleRedeem(id)} redeeming={redeeming} />
                  ))}
                </div>
              )}
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                <PackageIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground-subtle" />
                <p className="text-[12px] text-foreground-subtle leading-relaxed">
                  Talep ettiğiniz ödüller belediye ofisinden teslim alınabilir. Talebiniz onaylandıktan sonra bildirim alırsınız.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-[13px] font-bold text-foreground-strong">Taleplerim</p>
                {redemptionsLoading ? (
                  <SkeletonRows rows={2} />
                ) : redemptions.length === 0 ? (
                  <EmptyState icon={PackageIcon} title="Henüz talebiniz yok" description="Bir ödül talep ettiğinizde burada görünür." />
                ) : (
                  <div className="space-y-2">
                    {redemptions.map(r => (
                      <RedemptionCard key={r.id} redemption={r} onClaim={id => void handleClaim(id)} claiming={claiming} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-4">
              {txLoading && txPage === 1 ? (
                <SkeletonRows rows={5} />
              ) : transactions.length === 0 ? (
                <EmptyState icon={HistoryIcon} title="Henüz işlem yok" description="Uygulamaya giriş yaparak puan kazanmaya başlayın." />
              ) : (
                <>
                  <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <div className="border-b border-border bg-gray-50/60 px-5 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">İşlem Geçmişi</p>
                    </div>
                    {transactions.map((tx, idx) => (
                      <div key={tx.id}
                        className={`flex items-center gap-4 px-5 py-3.5 ${idx < transactions.length - 1 ? 'border-b border-border' : ''}`}>
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                          style={{ background: tx.points > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
                          <StarIcon className="h-4 w-4" style={{ color: tx.points > 0 ? '#10b981' : '#ef4444' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-[13px] font-semibold text-foreground-strong">{tx.label}</p>
                          <p className="text-[11px] text-foreground-subtle">{fmt(tx.earnedAt)}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-[15px] font-black" style={{ color: tx.points > 0 ? '#10b981' : '#ef4444' }}>
                            {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString('tr-TR')}
                          </p>
                          <p className="text-[10px] text-foreground-subtle">{tx.balanceAfter.toLocaleString('tr-TR')} puan</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {transactions.length < txTotal && (
                    <Button variant="outline" size="sm" className="w-full"
                      onClick={() => void loadTransactions(txPage + 1)} isLoading={txLoading}>
                      Daha Fazla Yükle
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
