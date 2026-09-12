// ✅ CJ Dropshipping API - Sync Inventory from CJ

import { json } from '@tanstack/start'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const CJ_API_BASE = 'https://api.cjdropshipping.com/api'
const CJ_API_KEY = process.env.CJ_API_KEY || ''

export async function POST() {
  try {
    // Get all dropshipped products
    const { data: products } = await supabase
      .from('products')
      .select('id, cj_product_id, stock')
      .eq('is_dropship', true)

    if (!products || products.length === 0) {
      return json({
        success: true,
        synced: 0,
        message: 'No dropshipped products to sync',
      })
    }

    let synced = 0
    let failed = 0

    // Sync each product's stock
    for (const product of products) {
      try {
        // Get latest stock from CJ
        const response = await fetch(
          `${CJ_API_BASE}/v1/product/${product.cj_product_id}`,
          {
            headers: {
              'Authorization': `Bearer ${CJ_API_KEY}`,
            },
          }
        )

        const data = await response.json()

        if (data.success && data.data) {
          const latestStock = data.data.stock || 0

          // Update our database
          await supabase
            .from('products')
            .update({
              stock: latestStock,
              last_synced_at: new Date(),
            })
            .eq('id', product.id)

          synced++
        } else {
          failed++
        }
      } catch (error) {
        failed++
        console.error(`Failed to sync product ${product.cj_product_id}:`, error)
      }
    }

    return json({
      success: true,
      synced,
      failed,
      total: products.length,
    })
  } catch (error) {
    console.error('CJ Sync error:', error)
    return json(
      {
        success: false,
        error: 'Failed to sync inventory',
      },
      { status: 500 }
    )
  }
}

