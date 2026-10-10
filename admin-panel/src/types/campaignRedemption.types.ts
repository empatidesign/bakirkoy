export interface CampaignRedemption {
  id: string
  companyId: string
  companyName: string
  campaignId: string | null
  campaignName: string
  participantId: string
  participantName: string
  participantPhone?: string
  redemptionCode: string
  redemptionType: 'QrScan' | 'DirectScan'
  redeemedAt: string
  notes?: string
}

export interface CampaignRedemptionSummary {
  total: number
  uniqueParticipants: number
  qrScanCount: number
  directScanCount: number
}

export const CAMPAIGN_REDEMPTION_TYPE_LABELS: Record<CampaignRedemption['redemptionType'], string> = {
  QrScan: 'QR Okutma',
  DirectScan: 'Manuel Kod',
}
