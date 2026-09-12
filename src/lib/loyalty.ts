// ✅ FEATURE 7: Customer Loyalty Program
// Points system, tiers, rewards, referrals

export interface LoyaltyTier {
  id: string
  name: string
  minPoints: number
  discount: number
  benefits: string[]
  status_badge: string
}

export interface LoyaltyPoints {
  customer_id: string
  total_points: number
  spent_points: number
  available_points: number
  current_tier: LoyaltyTier
  earned_date: Date
}

export interface Referral {
  referrer_id: string
  referee_email: string
  bonus_points: number
  status: 'pending' | 'completed' | 'expired'
  created_at: Date
}

export const LOYALTY_TIERS: LoyaltyTier[] = [
  {
    id: 'bronze',
    name: 'Bronze',
    minPoints: 0,
    discount: 0,
    benefits: ['Earn 1 point per $1', 'Birthday bonus'],
    status_badge: '🥉',
  },
  {
    id: 'silver',
    name: 'Silver',
    minPoints: 500,
    discount: 5,
    benefits: ['Earn 1.5 points per $1', 'Free shipping', 'Early access to sales'],
    status_badge: '🥈',
  },
  {
    id: 'gold',
    name: 'Gold',
    minPoints: 1500,
    discount: 10,
    benefits: [
      'Earn 2 points per $1',
      'Free express shipping',
      'Exclusive products',
      'VIP support',
    ],
    status_badge: '🥇',
  },
  {
    id: 'platinum',
    name: 'Platinum',
    minPoints: 5000,
    discount: 15,
    benefits: [
      'Earn 3 points per $1',
      'Free overnight shipping',
      'Personal shopper',
      'Exclusive events',
      'Concierge service',
    ],
    status_badge: '💎',
  },
]

export class LoyaltyService {
  // Calculate points earned from purchase
  calculatePointsEarned(
    purchaseAmount: number,
    customerTier: LoyaltyTier
  ): number {
    const baseMultiplier = 1
    const tierMultiplier = customerTier.minPoints >= 5000 ? 3 : customerTier.minPoints >= 1500 ? 2 : customerTier.minPoints >= 500 ? 1.5 : 1

    return Math.floor(purchaseAmount * tierMultiplier)
  }

  // Get customer tier
  getTierFromPoints(points: number): LoyaltyTier {
    const tier = LOYALTY_TIERS.reverse().find((t) => points >= t.minPoints)
    return tier || LOYALTY_TIERS[0]
  }

  // Redeem points for discount
  redeemPoints(
    pointsToSpend: number,
    tier: LoyaltyTier
  ): { discountAmount: number; pointsUsed: number } {
    const discountPerPoint = 0.01 // 1 point = $0.01
    const discountAmount = pointsToSpend * discountPerPoint
    const bonusMultiplier = tier.discount / 100

    return {
      discountAmount: discountAmount * (1 + bonusMultiplier),
      pointsUsed: pointsToSpend,
    }
  }

  // Generate referral code
  generateReferralCode(customerId: string): string {
    return `REF-${customerId}-${Date.now().toString(36).toUpperCase()}`
  }

  // Process referral bonus
  processReferralBonus(
    referrerTier: LoyaltyTier,
    baseBonusPoints = 100
  ): number {
    const tierBonus: Record<string, number> = {
      bronze: 0,
      silver: baseBonusPoints,
      gold: baseBonusPoints * 1.5,
      platinum: baseBonusPoints * 2,
    }

    return tierBonus[referrerTier.id] || baseBonusPoints
  }

  // Calculate tier upgrade eligibility
  checkTierUpgrade(
    currentPoints: number,
    currentTier: LoyaltyTier
  ): { isEligible: boolean; nextTier?: LoyaltyTier; pointsNeeded?: number } {
    const nextTier = LOYALTY_TIERS.find((t) => t.minPoints > currentTier.minPoints)

    if (!nextTier) {
      return { isEligible: false }
    }

    const pointsNeeded = nextTier.minPoints - currentPoints
    const isEligible = currentPoints >= nextTier.minPoints

    return {
      isEligible,
      nextTier: isEligible ? nextTier : undefined,
      pointsNeeded: isEligible ? 0 : pointsNeeded,
    }
  }

  // Get tier benefits
  getTierBenefits(tier: LoyaltyTier): string[] {
    return tier.benefits
  }

  // Calculate birthday bonus
  calculateBirthdayBonus(tier: LoyaltyTier): number {
    const baseBirthday = 100
    const bonusPercentage = tier.discount / 100

    return Math.floor(baseBirthday * (1 + bonusPercentage))
  }

  // Format points display
  formatPoints(points: number): string {
    if (points >= 1000) {
      return `${(points / 1000).toFixed(1)}k`
    }
    return String(points)
  }

  // Get points breakdown
  getPointsBreakdown(
    purchaseAmount: number,
    tier: LoyaltyTier
  ): {
    basePoints: number
    tierBonus: number
    totalPoints: number
    breakdown: string
  } {
    const basePoints = purchaseAmount
    const tierBonus = Math.floor(basePoints * ((tier.discount || 0) / 100))
    const totalPoints = basePoints + tierBonus

    return {
      basePoints,
      tierBonus,
      totalPoints,
      breakdown: `$${purchaseAmount} = ${basePoints} base points + ${tierBonus} tier bonus = ${totalPoints} total`,
    }
  }
}

export const loyaltyService = new LoyaltyService()

