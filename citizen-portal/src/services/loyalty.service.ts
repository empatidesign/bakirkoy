import { api } from './api'
import type { CheckInResult, LoyaltyStreak, LoyaltyTransaction, CitizenReward, RedeemResult, WelcomeBonusResult, RewardRedemption } from '@/types/loyalty.types'

interface ApiResp<T> { data: T }
interface PagedData<T> { items: T[]; total: number; page: number; limit: number }

let checkInInflight: Promise<CheckInResult> | null = null

const loyaltyService = {
  checkIn(): Promise<CheckInResult> {
    checkInInflight ??= api.post<ApiResp<CheckInResult>>('/me/loyalty/check-in')
      .then(res => res.data.data)
      .finally(() => { checkInInflight = null })
    return checkInInflight
  },

  async consumeWelcomeBonus(): Promise<WelcomeBonusResult> {
    const res = await api.post<ApiResp<WelcomeBonusResult>>('/me/loyalty/welcome-bonus/consume')
    return res.data.data
  },

  async getStreak(): Promise<LoyaltyStreak> {
    const res = await api.get<ApiResp<LoyaltyStreak>>('/me/loyalty/streak')
    return res.data.data
  },

  async getBalance(): Promise<number> {
    const res = await api.get<ApiResp<{ balance: number }>>('/me/loyalty/balance')
    return res.data.data.balance
  },

  async getTransactions(page = 1, limit = 20): Promise<PagedData<LoyaltyTransaction>> {
    const res = await api.get<ApiResp<PagedData<LoyaltyTransaction>>>('/me/loyalty/transactions', {
      params: { page, limit },
    })
    return res.data.data
  },
  async getRewardCatalog(limit = 20): Promise<CitizenReward[]> {
    const res = await api.get<ApiResp<CitizenReward[]>>('/me/loyalty/rewards/catalog', { params: { limit } })
    return res.data.data
  },

  async redeemReward(rewardId: string): Promise<RedeemResult> {
    const res = await api.post<ApiResp<RedeemResult>>('/me/loyalty/rewards/redeem', { rewardId })
    return res.data.data
  },

  async getEarnWays(): Promise<{ key: string; label: string; points: number; icon: string; completed: boolean; description?: string }[]> {
    const res = await api.get<ApiResp<{ key: string; label: string; points: number; icon: string; completed: boolean; description?: string }[]>>('/me/loyalty/earn-ways')
    return res.data.data
  },

  async getRedemptions(page = 1, limit = 20): Promise<PagedData<RewardRedemption>> {
    const res = await api.get<ApiResp<PagedData<RewardRedemption>>>('/me/loyalty/redemptions', {
      params: { page, limit },
    })
    return res.data.data
  },

  async claimRedemption(redemptionId: string): Promise<RewardRedemption> {
    const res = await api.post<ApiResp<RewardRedemption>>(`/me/loyalty/redemptions/${redemptionId}/claim`)
    return res.data.data
  },
}

export default loyaltyService
