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
  weekDays: StreakDay[]
}

export interface CheckInResult {
  isNewCheckIn: boolean
  pointsEarned: number
  streak: LoyaltyStreak
}

export interface LoyaltyTransaction {
  id: string
  actionKey: string
  label: string
  points: number
  balanceAfter: number
  referenceId: string | null
  earnedAt: string
}

export interface CitizenReward {
  id: string
  name: string
  pointsRequired: number
  imageUrl: string | null
  stock: number
  description: string | null
  isActive: boolean
}

export interface RedeemResult {
  success: boolean
  message: string
  pointsSpent: number
  balanceAfter: number
}

export interface WelcomeBonusResult {
  shouldShow: boolean
  points: number
}

export interface RewardRedemption {
  id: string
  participantId: string
  participantName: string
  rewardId: string
  rewardName: string
  rewardImageUrl: string | null
  pointsSpent: number
  status: 'Pending' | 'Completed' | 'Cancelled' | string
  redeemedAt: string
  cancelledAt: string | null
  cancelReason: string | null
}
