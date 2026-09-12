// ✅ CJ Dropshipping API - Get Imported Products List

import { json } from '@tanstack/start'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET() {
  try {
    // Fetch all imported products
    const { data: products, error } = await supabase
      .from('products')
      .select('id, cj_product_id, title, price, stock, created_at, last_synced_at')
      .eq('is_dropship', true)
      .order('created_at', { ascending: false })

    if (error) {
      return json({
        success: false,
        error: error.message,
      })
    }

    // Map to response format
    const formattedProducts = products.map((p: any) => ({
      id: p.id,
      cjProductId: p.cj_product_id,
      title: p.title,
      price: p.price,
      stock: p.stock,
      importedAt: p.created_at,
      lastSyncedAt: p.last_synced_at,
      status:
        p.stock === 0
          ? 'out_of_stock'
          : p.stock < 10
          ? 'low_stock'
          : 'active',
    }))

    return json({
      success: true,
      products: formattedProducts,
      total: formattedProducts.length,
    })
  } catch (error) {
    console.error('CJ List error:', error)
    return json(
      {
        success: false,
        error: 'Failed to fetch imported products',
      },
      { status: 500 }
    )
  }
}

