// ✅ Affiliate API - List payouts

import { json } from '@tanstack/start'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET() {
  try {
    const { data: payouts, error } = await supabase
      .from('affiliate_payouts')
      .select(
        `
        id,
        affiliate_id,
        amount,
        status,
        requested_date,
        processed_date,
        payment_method,
        affiliates(users(name))
      `
      )
      .order('requested_date', { ascending: false })

    if (error) throw error

    const formattedPayouts = (payouts || []).map((p: any) => ({
      id: p.id,
      affiliateId: p.affiliate_id,
      affiliateName: p.affiliates?.users?.name || 'Unknown',
      amount: p.amount,
      status: p.status,
      requestedDate: p.requested_date,
      processedDate: p.processed_date,
      paymentMethod: p.payment_method,
    }))

    return json({ success: true, payouts: formattedPayouts })
  } catch (error) {
    console.error('Affiliate payouts error:', error)
    return json({ success: false, error: 'Failed to fetch payouts' }, { status: 500 })
  }
}

