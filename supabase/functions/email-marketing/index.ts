// ✅ FEATURE 6: Email Marketing Automation
// Abandoned cart, recommendations, newsletters

import { Resend } from 'https://cdn.jsdelivr.net/npm/resend@latest/+esm'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Send abandoned cart email
async function sendAbandonedCartEmail(
  email: string,
  name: string,
  items: any[],
  total: number
) {
  const itemsList = items
    .map((item) => `<li>${item.name} x${item.qty} = $${item.price}</li>`)
    .join('')

  const html = `
    <h2>You left items behind!</h2>
    <p>Hi ${name}, complete your purchase:</p>
    <ul>${itemsList}</ul>
    <p>Total: $${total}</p>
    <a href="https://arprimemarket.shop/cart">Complete Purchase</a>
  `

  return await resend.emails.send({
    from: 'noreply@arprimemarket.shop',
    to: email,
    subject: `Complete your purchase - $${total} waiting!`,
    html,
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Not allowed', { status: 405 })

  try {
    const { type, email, name, data } = await req.json()

    if (type === 'abandoned_cart') {
      await sendAbandonedCartEmail(email, name, data.items, data.total)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})

