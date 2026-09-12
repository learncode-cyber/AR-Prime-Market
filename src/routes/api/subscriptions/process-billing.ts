// ✅ Subscription API - Process Billing

import { json } from '@tanstack/start'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST() {
  try {
    // Get subscriptions due for billing
    const today = new Date().toISOString().split('T')[0]

    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select(
        `
        id,
        customer_id,
        tier_id,
        amount,
        payment_method,
        subscription_tiers(billing_cycle)
      `
      )
      .eq('status', 'active')
      .eq('auto_renew', true)
      .lte('next_billing_date', today)

    if (error) throw error

    let processed = 0
    let failed = 0

    for (const subscription of subscriptions || []) {
      try {
        // Process payment (simplified - in real world use Stripe/PayPal)
        const { error: paymentError } = await supabase
          .from('subscription_invoices')
          .insert({
            subscription_id: subscription.id,
            customer_id: subscription.customer_id,
            amount: subscription.amount,
            currency: 'USD',
            status: 'paid',
            invoice_date: new Date(),
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            paid_date: new Date(),
            payment_method: subscription.payment_method,
          })

        if (!paymentError) {
          // Calculate next billing date
          const nextDate = new Date()
          if (subscription.subscription_tiers?.billing_cycle === 'monthly') {
            nextDate.setMonth(nextDate.getMonth() + 1)
          } else {
            nextDate.setFullYear(nextDate.getFullYear() + 1)
          }

          // Update subscription
          await supabase
            .from('subscriptions')
            .update({
              next_billing_date: nextDate.toISOString(),
            })
            .eq('id', subscription.id)

          processed++
        } else {
          failed++
        }
      } catch (err) {
        console.error(`Failed to process subscription ${subscription.id}:`, err)
        failed++
      }
    }

    return json({
      success: true,
      processed,
      failed,
      total: (subscriptions || []).length,
    })
  } catch (error) {
    console.error('Billing processing error:', error)
    return json(
      { success: false, error: 'Failed to process billing' },
      { status: 500 }
    )
  }
}

