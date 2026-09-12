// ✅ FEATURE 1: Google Merchant Center Feed Generator
// Edge Function to generate XML feed for Google Shopping

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

interface Product {
  id: string
  title: string
  description: string
  price: number
  currency: string
  image: string
  category: string
  url: string
  availability: 'in stock' | 'out of stock'
  sku: string
  brand: string
  rating?: number
  review_count?: number
}

function generateMerchantXML(products: Product[]): string {
  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>AR Prime Market Products</title>
    <link>https://arprimemarket.shop</link>
    <description>Premium Products - Free Worldwide Shipping</description>`

  const xmlItems = products
    .map(
      (product) => `
    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <title>${escapeXml(product.title)}</title>
      <description>${escapeXml(product.description.substring(0, 5000))}</description>
      <g:link>${escapeXml(product.url)}</g:link>
      <g:image_link>${escapeXml(product.image)}</g:image_link>
      <g:availability>${product.availability}</g:availability>
      <g:price>${product.price} ${product.currency}</g:price>
      <g:currency>${product.currency}</g:currency>
      <g:brand>${escapeXml(product.brand)}</g:brand>
      <g:product_type>${escapeXml(product.category)}</g:product_type>
      <g:gtin>${escapeXml(product.sku)}</g:gtin>
      <g:mpn>${escapeXml(product.sku)}</g:mpn>
      <g:condition>new</g:condition>
      <g:shipping>
        <g:country>US</g:country>
        <g:service>Standard Shipping</g:service>
        <g:price>0 USD</g:price>
      </g:shipping>
      <g:shipping>
        <g:country>CA</g:country>
        <g:service>Standard Shipping</g:service>
        <g:price>0 USD</g:price>
      </g:shipping>
      <g:shipping>
        <g:country>GB</g:country>
        <g:service>Standard Shipping</g:service>
        <g:price>0 USD</g:price>
      </g:shipping>
      <g:shipping>
        <g:country>AU</g:country>
        <g:service>Standard Shipping</g:service>
        <g:price>0 USD</g:price>
      </g:shipping>
      <g:shipping>
        <g:country>AE</g:country>
        <g:service>Standard Shipping</g:service>
        <g:price>0 USD</g:price>
      </g:shipping>
      ${
        product.rating
          ? `<g:rating>${product.rating.toFixed(1)}</g:rating>`
          : ''
      }
      ${
        product.review_count
          ? `<g:review_count>${product.review_count}</g:review_count>`
          : ''
      }
    </item>`
    )
    .join('')

  const xmlFooter = `
  </channel>
</rss>`

  return xmlHeader + xmlItems + xmlFooter
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function fetchProducts(supabase: any): Promise<Product[]> {
  const { data: products, error } = await supabase
    .from('products')
    .select(
      'id, title, description, price, image, category, slug, sku, brand_name, reviews(rating, comment)'
    )
    .eq('is_active', true)
    .limit(5000)

  if (error) {
    console.error('Error fetching products:', error)
    throw error
  }

  return products.map((product: any) => {
    const avgRating =
      product.reviews && product.reviews.length > 0
        ? product.reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) /
          product.reviews.length
        : undefined

    return {
      id: product.id,
      title: product.title,
      description: product.description || '',
      price: product.price,
      currency: 'USD',
      image: product.image || 'https://via.placeholder.com/500',
      category: product.category || 'Uncategorized',
      url: `https://arprimemarket.shop/products/${product.slug}`,
      availability: 'in stock',
      sku: product.sku || product.id,
      brand: product.brand_name || 'AR Prime Market',
      rating: avgRating,
      review_count: product.reviews?.length || 0,
    }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Fetching products for Merchant Center feed...')
    const products = await fetchProducts(supabase)

    console.log(`Generating XML for ${products.length} products...`)
    const xmlFeed = generateMerchantXML(products)

    // Save to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('feeds')
      .upload('merchant-center/products.xml', xmlFeed, {
        contentType: 'application/xml',
        upsert: true,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw uploadError
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from('feeds')
      .getPublicUrl('merchant-center/products.xml')

    return new Response(
      JSON.stringify({
        success: true,
        message: `Generated feed for ${products.length} products`,
        feed_url: publicData.publicUrl,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      }
    )
  }
})

