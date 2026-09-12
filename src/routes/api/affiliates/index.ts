// ✅ Affiliate API - List affiliates

import { json } from '@tanstack/start'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET({ request }: { request: Request }) {
  try {
    const url = new URL(request.url)
    const tier = url.searchParams.get('tier') || 'all'

    let query = supabase.from('affiliates').select(
      `
      id,
      user_id,
      tier,
      commission_rate,
      status,
      approved_date,
      users(name, email),
      affiliate_referrals(id)
    `
    )

    if (tier !== 'all') {
      query = query.eq('tier', tier)
    }

    const { data: affiliates, error } = await query.order('approved_date', {
      ascending: false,
    })

    if (error) throw error

    // Calculate stats for each affiliate
    const enrichedAffiliates = await Promise.all(
      (affiliates || []).map(async (aff: any) => {
        const { data: referrals } = await supabase
          .from('affiliate_referrals')
          .select('amount, status')
          .eq('affiliate_id', aff.id)

        const confirmed = referrals?.filter((r: any) => r.status === 'confirmed') || []
        const totalCommission = referrals?.reduce((sum: number, r: any) => sum + (r.amount || 0), 0) || 0
        const pendingCommission = confirmed.reduce((sum: number, r: any) => sum + (r.amount || 0), 0) || 0

        return {
          id: aff.id,
          userId: aff.user_id,
          userName: aff.users?.name || 'Unknown',
          userEmail: aff.users?.email || '',
          tier: aff.tier,
          commissionRate: aff.commission_rate,
          totalReferrals: aff.affiliate_referrals?.length || 0,
          confirmedReferrals: confirmed.length,
          totalCommission,
          pendingCommission,
          status: aff.status,
          joinedDate: aff.approved_date,
        }
      })
    )

    return json({ success: true, affiliates: enrichedAffiliates })
  } catch (error) {
    console.error('Affiliate list error:', error)
    return json({ success: false, error: 'Failed to fetch affiliates' }, { status: 500 })
  }
}

