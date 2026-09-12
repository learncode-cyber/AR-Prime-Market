// ✅ Subscription API - Cancel

import { json } from '@tanstack/start'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST({ params }: { params: { id: string } }) {
  try {
    const { id } = params

    // Update subscription status
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date(),
      })
      .eq('id', id)

    if (error) throw error

    // TODO: Send cancellation email
    // TODO: Process any pro-rata refund

    return json({ success: true })
  } catch (error) {
    console.error('Subscription cancel error:', error)
    return json(
      { success: false, error: 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}

