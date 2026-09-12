// ✅ CJ Dropshipping API - Recharge (Re-import) Products

import { json } from '@tanstack/start'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const CJ_API_BASE = 'https://api.cjdropshipping.com/api'
const CJ_API_KEY = process.env.CJ_API_KEY || ''

export async function POST({ request }: { request: Request }) {
  try {
    const { cjProductId, quantity } = await request.json()

    if (!cjProductId || !quantity) {
      return json({
        success: false,
        error: 'CJ Product ID and quantity are required',
      })
    }

    // Get product details from CJ
    const response = await fetch(
      `${CJ_API_BASE}/v1/product/${cjProductId}`,
      {
        headers: {
          'Authorization': `Bearer ${CJ_API_KEY}`,
        },
      }
    )

    const data = await response.json()

    if (!data.success || !data.data) {
      return json({
        success: false,
        error: 'Failed to fetch product from CJ',
      })
    }

    const cjProduct = data.data

    // Update our database
    const { data: product } = await supabase
      .from('products')
      .select('id, stock')
      .eq('cj_product_id', cjProductId)
      .single()

    if (!product) {
      return json({
        success: false,
        error: 'Product not found in our system',
      })
    }

    // Update stock
    const newStock = (product.stock || 0) + quantity

    await supabase
      .from('products')
      .update({
        stock: newStock,
        last_recharged_at: new Date(),
      })
      .eq('id', product.id)

    // Log recharge action
    await supabase.from('recharge_logs').insert({
      product_id: product.id,
      cj_product_id: cjProductId,
      quantity_added: quantity,
      new_stock: newStock,
      recharged_at: new Date(),
    })

    return json({
      success: true,
      message: `Recharged ${quantity} units`,
      newStock,
    })
  } catch (error) {
    console.error('CJ Recharge error:', error)
    return json(
      {
        success: false,
        error: 'Failed to recharge product',
      },
      { status: 500 }
    )
  }
}

