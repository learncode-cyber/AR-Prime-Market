// ✅ CJ Dropshipping API - Import Products to Admin Panel

import { json } from '@tanstack/start'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST({ request }: { request: Request }) {
  try {
    const { products } = await request.json()

    if (!Array.isArray(products) || products.length === 0) {
      return json({
        success: false,
        error: 'Products array is required',
      })
    }

    let imported = 0
    let failed = 0

    // Import each product
    for (const product of products) {
      try {
        // Check if product already exists
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('cj_product_id', product.productId)
          .single()

        if (existing) {
          // Update existing product
          await supabase
            .from('products')
            .update({
              title: product.productTitle,
              description: product.productDescription,
              price: (product.minPrice + product.maxPrice) / 2,
              image: product.image,
              stock: product.stock,
              updated_at: new Date(),
            })
            .eq('id', existing.id)

          imported++
        } else {
          // Insert new product
          const { error } = await supabase.from('products').insert({
            title: product.productTitle,
            description: product.productDescription,
            price: (product.minPrice + product.maxPrice) / 2,
            min_price: product.minPrice,
            max_price: product.maxPrice,
            image: product.image,
            stock: product.stock,
            category: product.category,
            cj_product_id: product.productId,
            cj_commission_rate: product.commissionRate,
            is_dropship: true,
            is_active: true,
            created_at: new Date(),
          })

          if (!error) {
            imported++
          } else {
            failed++
            console.error(`Failed to import product ${product.productId}:`, error)
          }
        }
      } catch (error) {
        failed++
        console.error(`Error importing product ${product.productId}:`, error)
      }
    }

    return json({
      success: true,
      imported,
      failed,
      total: products.length,
      message: `${imported} products imported, ${failed} failed`,
    })
  } catch (error) {
    console.error('CJ Import error:', error)
    return json(
      {
        success: false,
        error: 'Failed to import products',
      },
      { status: 500 }
    )
  }
}

