// ✅ CJ Dropshipping API - Search Products

import { json } from '@tanstack/start'

const CJ_API_BASE = 'https://api.cjdropshipping.com/api'
const CJ_API_KEY = process.env.CJ_API_KEY || ''

export async function POST({ request }: { request: Request }) {
  try {
    const { query } = await request.json()

    if (!query || query.trim().length === 0) {
      return json({
        success: false,
        error: 'Search query is required',
      })
    }

    // Call CJ Dropshipping API
    const response = await fetch(`${CJ_API_BASE}/v1/product/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CJ_API_KEY}`,
      },
      body: JSON.stringify({
        searchText: query,
        pageNo: 1,
        pageSize: 20,
        order: 'hot',
      }),
    })

    const data = await response.json()

    if (!data.success) {
      return json({
        success: false,
        error: data.message || 'Search failed',
      })
    }

    // Format products
    const products = (data.data || []).map((product: any) => ({
      id: product.productId,
      productId: product.productId,
      productTitle: product.productTitle,
      productDescription: product.productDescription || '',
      minPrice: product.minPrice,
      maxPrice: product.maxPrice,
      commissionRate: product.commissionRate || 0,
      commissionType: product.commissionType || 'percentage',
      image: product.mainImage || '',
      shipping: product.shipping || 0,
      stock: product.stock || 0,
      category: product.category || 'Other',
      url: `${CJ_API_BASE}/product/${product.productId}`,
    }))

    return json({
      success: true,
      products,
      total: data.total || 0,
    })
  } catch (error) {
    console.error('CJ Search error:', error)
    return json(
      {
        success: false,
        error: 'Failed to search products',
      },
      { status: 500 }
    )
  }
}

