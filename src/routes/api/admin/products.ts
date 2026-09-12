// ✅ FIXED: Admin Products API
import { json } from '@tanstack/start'

export async function GET() {
  try {
    // TODO: Replace with actual Supabase query
    // For now, returning mock data
    
    const mockProducts = [
      {
        id: '1',
        name: 'Lipstick Red',
        price: 25.99,
        category: 'makeup',
        stock: 50,
        image: '/images/products/lipstick.jpg',
        status: 'active' as const,
      },
      {
        id: '2',
        name: 'Foundation',
        price: 35.99,
        category: 'makeup',
        stock: 30,
        image: '/images/products/foundation.jpg',
        status: 'active' as const,
      },
      {
        id: '3',
        name: 'Makeup Brush Set',
        price: 45.99,
        category: 'brushes',
        stock: 20,
        image: '/images/products/brush-set.jpg',
        status: 'active' as const,
      },
      {
        id: '4',
        name: 'Face Cream',
        price: 29.99,
        category: 'skincare',
        stock: 40,
        image: '/images/products/face-cream.jpg',
        status: 'active' as const,
      },
      {
        id: '5',
        name: 'Chanel No 5',
        price: 99.99,
        category: 'fragrance',
        stock: 15,
        image: '/images/products/chanel5.jpg',
        status: 'active' as const,
      },
    ]

    // TODO: Replace with actual Supabase query:
    /*
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, price, category, stock, image, status')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    */

    return json({ success: true, products: mockProducts })
  } catch (error) {
    console.error('Failed to fetch products:', error)
    return json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
