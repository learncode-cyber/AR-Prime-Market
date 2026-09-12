// ✅ Affiliate API - Stats

import { json } from '@tanstack/start'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET() {
  try {
    // Get all affiliates
    const { data: affiliates } = await supabase
      .from('affiliates')
      .select('id, status')
      .eq('status', 'active')

    // Get all referrals
    const { data: referrals } = await supabase
      .from('affiliate_referrals')
      .select('amount, status, commission')

    const activeAffiliates = affiliates?.length || 0
    const totalReferrals = referrals?.length || 0
    const confirmedReferrals = referrals?.filter((r: any) => r.status === 'confirmed').length || 0
    const totalCommissions = referrals?.reduce((sum: number, r: any) => sum + (r.commission || 0), 0) || 0
    const pendingPayouts = referrals
      ?.filter((r: any) => r.status === 'confirmed')
      .reduce((sum: number, r: any) => sum + (r.commission || 0), 0) || 0

    const stats = {
      activeAffiliates,
      totalReferrals,
      confirmedReferrals,
      totalCommissions: parseFloat(totalCommissions.toFixed(2)),
      pendingPayouts: parseFloat(pendingPayouts.toFixed(2)),
      conversionRate:
        totalReferrals > 0
          ? parseFloat(((confirmedReferrals / totalReferrals) * 100).toFixed(1))
          : 0,
    }

    return json({ success: true, stats })
  } catch (error) {
    console.error('Affiliate stats error:', error)
    return json({ success: false, error: 'Failed to fetch stats' }, { status: 500 })
  }
}

