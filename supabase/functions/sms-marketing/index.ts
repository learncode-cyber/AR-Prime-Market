// ✅ FEATURE 8: SMS Marketing with Twilio
// Order notifications, flash sales, reminders

import { Twilio } from 'https://deno.land/x/twilio/mod.ts'

const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
const twilioNumber = Deno.env.get('TWILIO_PHONE_NUMBER')!

const client = new Twilio(accountSid, authToken)

interface SMSMessage {
  type:
    | 'order_confirmation'
    | 'payment_reminder'
    | 'flash_sale'
    | 'delivery_update'
    | 'back_in_stock'
  phone: string
  data: Record<string, any>
}

async function sendOrderConfirmationSMS(phone: string, orderId: string, total: number) {
  const message = `AR Prime Market: Your order #${orderId} confirmed! Total: $${total}. Track here: arprimemarket.shop/orders/${orderId}`

  return await client.messages.create({
    body: message,
    from: twilioNumber,
    to: phone,
  })
}

async function sendPaymentReminderSMS(phone: string, orderId: string, amount: number) {
  const message = `Order #${orderId}: Payment reminder. Amount due: $${amount}. Complete here: arprimemarket.shop/pay/${orderId}`

  return await client.messages.create({
    body: message,
    from: twilioNumber,
    to: phone,
  })
}

async function sendFlashSaleSMS(phone: string, discount: number, expiresIn: string) {
  const message = `🎉 Flash Sale! ${discount}% off expires in ${expiresIn}. Shop now: arprimemarket.shop/sale`

  return await client.messages.create({
    body: message,
    from: twilioNumber,
    to: phone,
  })
}

async function sendDeliveryUpdateSMS(
  phone: string,
  orderId: string,
  status: string,
  estimatedDate: string
) {
  const message = `Order #${orderId}: ${status}. Estimated delivery: ${estimatedDate}. Track: arprimemarket.shop/track/${orderId}`

  return await client.messages.create({
    body: message,
    from: twilioNumber,
    to: phone,
  })
}

async function sendBackInStockSMS(phone: string, productName: string, productUrl: string) {
  const message = `${productName} is back in stock! Get it now: ${productUrl}`

  return await client.messages.create({
    body: message,
    from: twilioNumber,
    to: phone,
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { type, phone, data } = (await req.json()) as SMSMessage

    let result

    switch (type) {
      case 'order_confirmation':
        result = await sendOrderConfirmationSMS(phone, data.orderId, data.total)
        break
      case 'payment_reminder':
        result = await sendPaymentReminderSMS(phone, data.orderId, data.amount)
        break
      case 'flash_sale':
        result = await sendFlashSaleSMS(phone, data.discount, data.expiresIn)
        break
      case 'delivery_update':
        result = await sendDeliveryUpdateSMS(
          phone,
          data.orderId,
          data.status,
          data.estimatedDate
        )
        break
      case 'back_in_stock':
        result = await sendBackInStockSMS(phone, data.productName, data.productUrl)
        break
      default:
        return new Response('Unknown SMS type', { status: 400 })
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('SMS error:', error)
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

