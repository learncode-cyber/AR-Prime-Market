// ✅ Subscription API - Metrics

import { json } from '@tanstack/start'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET() {
  try {
    // Get subscription metrics
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('id, status, amount, created_at, next_billing_date')

    if (error) throw error

    const activeSubscriptions = subscriptions?.filter((s: any) => s.status === 'active') || []
    const cancelledSubscriptions = subscriptions?.filter((s: any) => s.status === 'cancelled') || []

    // Calculate MRR (Monthly Recurring Revenue)
    const monthlyRecurringRevenue = activeSubscriptions.reduce(
      (sum: number, sub: any) => sum + (sub.amount || 0),
      0
    )

    // Calculate churn rate
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentChurned = cancelledSubscriptions.filter((s: any) => {
      const cancelDate = new Date(s.created_at)
      return cancelDate > thirtyDaysAgo
    })

    const churnRate =
      activeSubscriptions.length > 0
        ? (recentChurned.length / (activeSubscriptions.length + recentChurned.length)) * 100
        : 0

    // Calculate average lifetime value
    const totalSubscriptions = subscriptions?.length || 0
    const totalRevenue = subscriptions?.reduce((sum: number, s: any) => sum + (s.amount || 0), 0) || 0
    const averageLifetimeValue = totalSubscriptions > 0 ? totalRevenue / totalSubscriptions : 0

    const metrics = {
      totalSubscriptions,
      activeSubscriptions: activeSubscriptions.length,
      totalRecurringRevenue: totalRevenue,
      monthlyRecurringRevenue,
      churnRate: parseFloat(churnRate.toFixed(1)),
      averageLifetimeValue: parseFloat(averageLifetimeValue.toFixed(2)),
    }

    return json({ success: true, metrics })
  } catch (error) {
    console.error('Subscription metrics error:', error)
    return json(
      { success: false, error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

