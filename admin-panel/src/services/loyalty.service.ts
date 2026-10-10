import { api } from './api'
import type {
  LoyaltyRule, LoyaltyTransaction, LoyaltyRuleForm, Reward, RewardForm,
  AwardPointsForm, RedeemResult, RewardRedemption,
} from '@/types/loyalty.types'
import type { PagedResult } from '@/types/common'

interface ApiResp<T> { data: T }

const loyaltyService = {
  async getRules(params?: Record<string, unknown>): Promise<PagedResult<LoyaltyRule>> {
    const res = await api.get<ApiResp<PagedResult<LoyaltyRule>>>('/loyalty/rules', { params })
    return res.data.data
  },

  async createRule(data: Omit<LoyaltyRuleForm, 'isActive'>): Promise<LoyaltyRule> {
    const res = await api.post<ApiResp<LoyaltyRule>>('/loyalty/rules', data)
    return res.data.data
  },

  async updateRule(id: string, data: LoyaltyRuleForm): Promise<LoyaltyRule> {
    const res = await api.put<ApiResp<LoyaltyRule>>(`/loyalty/rules/${id}`, data)
    return res.data.data
  },

  async deleteRule(id: string): Promise<void> {
    await api.delete(`/loyalty/rules/${id}`)
  },

  async getTransactions(params?: Record<string, unknown>): Promise<PagedResult<LoyaltyTransaction>> {
    const res = await api.get<ApiResp<PagedResult<LoyaltyTransaction>>>('/loyalty/transactions', { params })
    return res.data.data
  },

  async getRewards(params?: Record<string, unknown>): Promise<PagedResult<Reward>> {
    const res = await api.get<ApiResp<PagedResult<Reward>>>('/loyalty/rewards', { params })
    return res.data.data
  },

  async createReward(data: RewardForm): Promise<Reward> {
    const res = await api.post<ApiResp<Reward>>('/loyalty/rewards', data)
    return res.data.data
  },

  async updateReward(id: string, data: RewardForm): Promise<Reward> {
    const res = await api.put<ApiResp<Reward>>(`/loyalty/rewards/${id}`, data)
    return res.data.data
  },

  async deleteReward(id: string): Promise<void> {
    await api.delete(`/loyalty/rewards/${id}`)
  },

  async toggleRewardStatus(id: string): Promise<Reward> {
    const res = await api.patch<ApiResp<Reward>>(`/loyalty/rewards/${id}/toggle-status`)
    return res.data.data
  },

  async uploadRewardImage(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post<ApiResp<{ url: string }>>('/loyalty/rewards/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data.url
  },

  async getRewardCatalog(limit = 20): Promise<Reward[]> {
    const res = await api.get<ApiResp<Reward[]>>('/loyalty/rewards/catalog', { params: { limit } })
    return res.data.data
  },

  async redeemReward(participantId: string, rewardId: string): Promise<RedeemResult> {
    const res = await api.post<ApiResp<RedeemResult>>('/loyalty/rewards/redeem', { participantId, rewardId })
    return res.data.data
  },

  // NOT: getBalance/getStreak/getEarnWays admin panelde hiçbir yerden çağrılmıyordu (ölü kod)
  // ve var olmayan admin-scoped /loyalty/balance, /loyalty/streak, /loyalty/earn-ways
  // endpoint'lerine istek atıyordu — backend'de yalnızca vatandaş tarafı için
  // /me/loyalty/balance, /me/loyalty/streak, /me/loyalty/earn-ways mevcut (bkz. LoyaltyEndpoints.cs).
  // Admin panel zaten katılımcı bazlı bakiye/seri/kazanma-yolu göstermiyor (LoyaltyPage sadece
  // kural/işlem/ödül/redemption listeleri gösteriyor), bu yüzden kaldırıldı. İleride admin
  // tarafında katılımcı detayına bu bilgiler eklenecekse, backend'e participantId parametreli
  // admin-scoped endpoint'ler eklenip buradan çağrılmalı.

  async awardPoints(data: AwardPointsForm): Promise<LoyaltyTransaction> {
    const res = await api.post<ApiResp<LoyaltyTransaction>>('/loyalty/award', data)
    return res.data.data
  },

  async checkIn(participantId: string): Promise<{ isNewCheckIn: boolean; pointsEarned: number }> {
    const res = await api.post<ApiResp<{ isNewCheckIn: boolean; pointsEarned: number }>>('/loyalty/check-in', { participantId })
    return res.data.data
  },

  async getRedemptions(params: Record<string, unknown>): Promise<PagedResult<RewardRedemption>> {
    const res = await api.get<ApiResp<PagedResult<RewardRedemption>>>('/loyalty/redemptions', { params })
    return res.data.data
  },

  async getPendingRedemptionCount(): Promise<number> {
    const res = await api.get<ApiResp<number>>('/loyalty/redemptions/pending-count')
    return res.data.data
  },

  async cancelRedemption(id: string, reason?: string): Promise<void> {
    await api.patch(`/loyalty/redemptions/${id}/cancel`, { reason })
  },
}

export default loyaltyService
