// ✅ FIXED VERSION WITH ALL 3 SEO FIXES INTEGRATED

import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/start'
import { useState, useEffect } from 'react'
import { ProductDetailPage } from '@/components/ProductDetailPage'
import { supabase } from '@/lib/supabase'
import { SITE_NAME, SITE_URL } from '@/constants'

const STORAGE_PRODUCT_FALLBACK_URL = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'

const resolveStorageImageUrl = (path: string | null, fallback: string) => {
  if (!path) return fallback
  if (path.startsWith('http')) return path
  return `${SITE_URL}/storage/products/${path}`
}

export const Route = createFileRoute('/products/$slug')({
  loader: async ({ params }) => {
    const { data: productData } = await supabase
      .from('products')
      .select('id, title, description, price, gallery_urls, slug, category')
      .eq('slug', params.slug)
      .eq('is_active', true)
      .maybeSingle()

    if (!productData) return { product: null, reviews: [] }

    // ✅ FIX 3: FETCH REVIEWS FOR RATINGS SCHEMA
    const { data: reviewsData } = await supabase
      .from('product_reviews')
      .select('rating, title, comment, author_name, created_at')
      .eq('product_id', productData.id)
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(100)

    const image = resolveStorageImageUrl(
      (productData.gallery_urls as string[] | null)?.[0] ?? null,
      STORAGE_PRODUCT_FALLBACK_URL,
    )

    return {
      product: {
        id: productData.id,
        title: productData.title as string,
        description: (productData.description as string) || '',
        price: Number(productData.price),
        image,
        slug: productData.slug as string,
        category: productData.category as string,
      },
      reviews: reviewsData || [],
    }
  },

  head: ({ params, loaderData }) => {
    const p = loaderData?.product
    const reviews = loaderData?.reviews || []
    const url = `${SITE_URL}/products/${params.slug}`

    // ✅ FIX 3: CALCULATE AVERAGE RATING
    const calculateAverageRating = (reviews: any[]) => {
      if (!reviews.length) return 0
      const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0)
      return (sum / reviews.length).toFixed(1)
    }

    if (!p) {
      const title = `Premium Product — Free Worldwide Shipping | ${SITE_NAME}`
      const desc = `Shop premium products with secure global payments. Fast tracked shipping to USA, Canada, UK, Europe & UAE. ${SITE_NAME}.`
      return {
        meta: [
          { title },
          { name: 'description', content: desc },
          { property: 'og:title', content: title },
          { property: 'og:description', content: desc },
          { property: 'og:url', content: url },
          { property: 'og:type', content: 'product' },
        ],
        links: [{ rel: 'canonical', href: url }],
      }
    }

    const title = `${p.title} — Premium Quality | Free Worldwide Shipping`
    const excerpt = (p.description || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 110)
    const desc = `${excerpt}${excerpt ? ' — ' : ''}Shop online with secure global payments. Fast tracked shipping to USA, Canada, UK, Europe & UAE. ${SITE_NAME}.`

    return {
      meta: [
        { title },
        { name: 'description', content: desc },
        { property: 'og:title', content: title },
        { property: 'og:description', content: desc },
        { property: 'og:url', content: url },
        { property: 'og:type', content: 'product' },
        ...(p.image ? [{ property: 'og:image', content: p.image }] : []),
        // ✅ FIX 1: TWITTER CARD TAGS
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: desc },
        ...(p.image ? [{ name: 'twitter:image', content: p.image }] : []),
        { name: 'twitter:site', content: '@arprimemarket' },
      ],
      links: [{ rel: 'canonical', href: url }],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: p.title,
            description: excerpt,
            sku: p.slug,
            brand: { '@type': 'Brand', name: SITE_NAME },
            ...(p.image ? { image: p.image } : {}),
            offers: {
              '@type': 'Offer',
              priceCurrency: 'USD',
              price: p.price,
              availability: 'https://schema.org/InStock',
              url,
              seller: { '@type': 'Organization', name: SITE_NAME },
              shippingDetails: {
                '@type': 'OfferShippingDetails',
                shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' },
                shippingDestination: [
                  { '@type': 'DefinedRegion', addressCountry: 'US' },
                  { '@type': 'DefinedRegion', addressCountry: 'CA' },
                  { '@type': 'DefinedRegion', addressCountry: 'GB' },
                  { '@type': 'DefinedRegion', addressCountry: 'AE' },
                  { '@type': 'DefinedRegion', addressCountry: 'AU' },
                ],
              },
            },
            // ✅ FIX 3: AGGREGATE RATING SCHEMA
            ...(reviews.length > 0 && {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: calculateAverageRating(reviews),
                ratingCount: reviews.length,
                reviewCount: reviews.length,
              },
              review: reviews.slice(0, 10).map((review) => ({
                '@type': 'Review',
                reviewRating: {
                  '@type': 'Rating',
                  ratingValue: review.rating,
                },
                author: {
                  '@type': 'Person',
                  name: review.author_name || 'Anonymous',
                },
                reviewBody: review.comment || review.title,
                datePublished: review.created_at,
              })),
            }),
          }),
        },
        // ✅ FIX 2: BREADCRUMBLIST SCHEMA
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: `${SITE_URL}/`,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Products',
                item: `${SITE_URL}/products`,
              },
              ...(p.category
                ? [
                    {
                      '@type': 'ListItem',
                      position: 3,
                      name: p.category,
                      item: `${SITE_URL}/products?category=${p.category}`,
                    },
                  ]
                : []),
              {
                '@type': 'ListItem',
                position: p.category ? 4 : 3,
                name: p.title,
                item: url,
              },
            ],
          }),
        },
      ],
    }
  },
  component: ProductDetailPage,
})

function ProductDetailPage() {
  const { slug } = Route.useParams()
  // ... rest of your component code remains the same ...
}

export default ProductDetailPage

