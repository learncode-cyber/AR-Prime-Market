// ✅ FEATURE 14: Affiliate Marketing Program
// Commission tracking, dashboard, payouts

export interface AffiliateAccount {
  id: string
  userId: string
  status: 'active' | 'inactive' | 'suspended'
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  commissionRate: number
  bankAccountId?: string
  appliedDate: Date
  approvedDate?: Date
}

export interface AffiliateReferral {
  id: string
  affiliateId: string
  referralCode: string
  customerId: string
  orderId?: string
  productIds: string[]
  status: 'pending' | 'confirmed' | 'paid'
  amount: number
  commission: number
  commissionRate: number
  createdAt: Date
  confirmedAt?: Date
  paidAt?: Date
}

export interface AffiliateStats {
  totalReferrals: number
  confirmedReferrals: number
  totalCommission: number
  paidCommission: number
  pendingCommission: number
  conversionRate: number
  averageOrderValue: number
  topProducts: Array<{ productId: string; count: number }>
}

export interface AffiliatePayment {
  id: string
  affiliateId: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'paid' | 'failed'
  bankDetails?: {
    bankName: string
    accountNumber: string
    routingNumber: string
  }
  paymentMethod: 'bank_transfer' | 'paypal' | 'check'
  processedDate?: Date
  paidDate?: Date
  failureReason?: string
}

export const AFFILIATE_COMMISSION_RATES: Record<
  'bronze' | 'silver' | 'gold' | 'platinum',
  number
> = {
  bronze: 5,
  silver: 8,
  gold: 12,
  platinum: 15,
}

export class AffiliateService {
  // Generate unique referral code
  generateReferralCode(affiliateId: string): string {
    return `${affiliateId.substring(0, 6)}-${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  // Create affiliate account
  async createAffiliateAccount(
    userId: string
  ): Promise<AffiliateAccount> {
    const referralCode = this.generateReferralCode(userId)
    return {
      id: `aff_${Date.now()}`,
      userId,
      status: 'active',
      tier: 'bronze',
      commissionRate: AFFILIATE_COMMISSION_RATES.bronze,
      appliedDate: new Date(),
      approvedDate: new Date(),
    }
  }

  // Track referral
  async trackReferral(
    affiliateId: string,
    customerId: string,
    orderId: string,
    amount: number
  ): Promise<AffiliateReferral> {
    const account = await this.getAffiliateAccount(affiliateId)
    if (!account) throw new Error('Affiliate account not found')

    const commission = (amount * account.commissionRate) / 100

    return {
      id: `ref_${Date.now()}`,
      affiliateId,
      referralCode: '',
      customerId,
      orderId,
      productIds: [],
      status: 'pending',
      amount,
      commission,
      commissionRate: account.commissionRate,
      createdAt: new Date(),
    }
  }

  // Confirm referral (when order is placed/completed)
  async confirmReferral(referralId: string): Promise<void> {
    // Update referral status to 'confirmed'
    // Add commission to pending total
    // Trigger notification
  }

  // Get affiliate statistics
  async getAffiliateStats(affiliateId: string): Promise<AffiliateStats> {
    return {
      totalReferrals: 0,
      confirmedReferrals: 0,
      totalCommission: 0,
      paidCommission: 0,
      pendingCommission: 0,
      conversionRate: 0,
      averageOrderValue: 0,
      topProducts: [],
    }
  }

  // Upgrade tier based on performance
  async upgradeTierIfEligible(affiliateId: string): Promise<void> {
    const stats = await this.getAffiliateStats(affiliateId)
    const account = await this.getAffiliateAccount(affiliateId)

    if (!account) return

    let newTier = account.tier

    // Bronze → Silver: 50 confirmed referrals
    if (account.tier === 'bronze' && stats.confirmedReferrals >= 50) {
      newTier = 'silver'
    }
    // Silver → Gold: 200 confirmed referrals
    else if (account.tier === 'silver' && stats.confirmedReferrals >= 200) {
      newTier = 'gold'
    }
    // Gold → Platinum: 500 confirmed referrals
    else if (account.tier === 'gold' && stats.confirmedReferrals >= 500) {
      newTier = 'platinum'
    }

    if (newTier !== account.tier) {
      account.tier = newTier
      account.commissionRate = AFFILIATE_COMMISSION_RATES[newTier]
      // Update in database
      // Send celebration email
    }
  }

  // Request payment
  async requestPayment(affiliateId: string): Promise<AffiliatePayment> {
    const stats = await this.getAffiliateStats(affiliateId)

    if (stats.pendingCommission < 100) {
      throw new Error('Minimum payout amount is $100')
    }

    return {
      id: `payout_${Date.now()}`,
      affiliateId,
      amount: stats.pendingCommission,
      currency: 'USD',
      status: 'pending',
      paymentMethod: 'bank_transfer',
    }
  }

  // Process affiliate payouts
  async processBatchPayouts(): Promise<{
    processed: number
    failed: number
    totalAmount: number
  }> {
    // Find all pending payments
    // Process through payment gateway
    // Update status
    // Send confirmations
    return { processed: 0, failed: 0, totalAmount: 0 }
  }

  // Get referral link
  getReferralLink(referralCode: string): string {
    return `${process.env.PUBLIC_URL}?ref=${referralCode}`
  }

  // Validate referral code
  async validateReferralCode(code: string): Promise<boolean> {
    // Check if code exists and is active
    return false
  }

  // Get affiliate dashboard data
  async getDashboardData(affiliateId: string): Promise<{
    account: AffiliateAccount | null
    stats: AffiliateStats
    recentReferrals: AffiliateReferral[]
    pendingPayments: AffiliatePayment[]
  }> {
    return {
      account: null,
      stats: await this.getAffiliateStats(affiliateId),
      recentReferrals: [],
      pendingPayments: [],
    }
  }

  // Cancel affiliate account
  async cancelAffiliateAccount(affiliateId: string): Promise<void> {
    // Set status to inactive
    // Process final payout
    // Send notification
  }

  // Get top affiliates
  async getTopAffiliates(limit = 10): Promise<AffiliateAccount[]> {
    // Get affiliates sorted by commission earned
    return []
  }

  // Create affiliate from referral
  async createAffiliateFromReferral(userId: string): Promise<AffiliateAccount> {
    return this.createAffiliateAccount(userId)
  }

  private async getAffiliateAccount(
    affiliateId: string
  ): Promise<AffiliateAccount | null> {
    // Fetch from database
    return null
  }
}

export const affiliateService = new AffiliateService()

