// ✅ Subscription API - List subscriptions

import { json } from '@tanstack/start'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET({ request }: { request: Request }) {
  try {
    const url = new URL(request.url)
    const filter = url.searchParams.get('filter') || 'all'

    let query = supabase
      .from('subscriptions')
      .select(`
        id,
        customer_id,
        tier_id,
        status,
        start_date,
        next_billing_date,
        auto_renew,
        amount,
        customers(name, email),
        subscription_tiers(name)
      `)

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      return json({ success: false, error: error.message })
    }

    const subscriptions = (data || []).map((sub: any) => ({
      id: sub.id,
      customerId: sub.customer_id,
      customerName: sub.customers?.name || 'Unknown',
      customerEmail: sub.customers?.email || '',
      tier: sub.tier_id,
      tierName: sub.subscription_tiers?.name || 'Unknown',
      status: sub.status,
      startDate: sub.start_date,
      nextBillingDate: sub.next_billing_date,
      autoRenew: sub.auto_renew,
      amount: sub.amount,
    }))

    return json({ success: true, subscriptions })
  } catch (error) {
    console.error('Subscription list error:', error)
    return json({ success: false, error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}

