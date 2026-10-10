export interface LoyaltyRule {
  id: string
  actionKey: string
  label: string
  points: number
  isActive: boolean
  description: string | null
}

export interface LoyaltyTransaction {
  id: string
  actionKey: string
  label: string
  points: number
  balanceAfter: number
  referenceId: string | null
  earnedAt: string
  type?: 'Earn' | 'Spent'
  description?: string
  participantId: string
  participantName: string | null
  participantPhone: string | null
}

export interface Reward {
  id: string
  name: string
  pointsRequired: number
  imageUrl: string | null
  stock: number
  description: string | null
  isActive: boolean
}

export interface LoyaltyRuleForm {
  actionKey: string
  label: string
  points: number
  isActive: boolean
  description: string
}

export interface RewardForm {
  name: string
  pointsRequired: number
  stock: number
  description: string
  imageUrl: string
  isActive: boolean
}

export interface StreakDay {
  dayNumber: number
  isCompleted: boolean
  isToday: boolean
  isFuture: boolean
}

export interface LoyaltyStreak {
  currentStreak: number
  longestStreak: number
  totalPoints: number
  lastCheckInDate: string | null
  /** İçinde bulunulan ödül turunun günleri (takvim haftası değil). */
  weekDays: StreakDay[]
  target: number
  bonusPoints: number
  /** Bu turda tamamlanan gün sayısı (0..target). */
  cycleProgress: number
  /** Ödüle kalan gün; bugün henüz girilmediyse bugünü de kapsar. */
  daysToReward: number
  checkedInToday: boolean
  streakBroken: boolean
}

export interface EarnWay {
  key: string
  label: string
  points: number
  icon: string
  completed: boolean
}

export interface AwardPointsForm {
  participantId: string
  points: number
  description: string
}

export interface RedeemResult {
  success: boolean
  message: string
  pointsSpent: number
  balanceAfter: number
}

export interface RewardRedemption {
  id: string
  participantId: string
  participantName: string
  rewardId: string
  rewardName: string
  rewardImageUrl?: string | null
  pointsSpent: number
  status: string
  redeemedAt: string
  cancelledAt?: string | null
  cancelReason?: string | null
}

export const ACTION_KEY_LABELS: Record<string, string> = {
  daily_login: 'Günlük Giriş',
  daily_login_streak_7: '7 Günlük Seri',
  event_attendance: 'Etkinlik Katılımı',
  quiz_complete: 'Quiz Tamamlama',
  survey_complete: 'Anket Doldurma',
  travel_join: 'Gezi Katılımı',
  welcome_bonus: 'Hoşgeldin Bonusu',
  reward_redeem: 'Hediye Talebi',
}
