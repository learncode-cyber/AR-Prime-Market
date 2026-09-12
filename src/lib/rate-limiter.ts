// ✅ FEATURE 4: API Rate Limiting & Caching with Upstash Redis
// Production-grade rate limiting and response caching

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Initialize Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

export interface RateLimitConfig {
  requests: number
  window: string // e.g., "60 s", "1 h"
  key: string
}

export class RateLimiter {
  private limiters: Map<string, Ratelimit> = new Map()

  // Create a rate limiter for an endpoint
  createLimiter(config: RateLimitConfig): Ratelimit {
    const key = `ratelimit:${config.key}`

    if (!this.limiters.has(key)) {
      const limiter = new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(config.requests, config.window),
        ephemeralCache: new Map(), // Use in-memory cache as fallback
        prefix: key,
      })
      this.limiters.set(key, limiter)
    }

    return this.limiters.get(key)!
  }

  // Check rate limit
  async checkLimit(
    limiterKey: string,
    identifier: string
  ): Promise<{
    success: boolean
    remaining: number
    resetAfter: number
  }> {
    const limiter = this.limiters.get(limiterKey)
    if (!limiter) {
      return { success: true, remaining: -1, resetAfter: 0 }
    }

    try {
      const result = await limiter.limit(identifier)
      return {
        success: result.success,
        remaining: result.remaining,
        resetAfter: result.resetAfter,
      }
    } catch (error) {
      console.error('Rate limit check failed:', error)
      // Fail open - allow request if rate limiter fails
      return { success: true, remaining: -1, resetAfter: 0 }
    }
  }
}

export class CacheService {
  private cacheConfig = {
    products: 3600, // 1 hour
    categories: 7200, // 2 hours
    orders: 300, // 5 minutes
    users: 600, // 10 minutes
    search: 1800, // 30 minutes
  }

  // Get from cache
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key)
      return cached ? JSON.parse(String(cached)) : null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  // Set cache
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const expirationTtl =
        ttl ||
        this.cacheConfig[key.split(':')[0] as keyof typeof this.cacheConfig] ||
        3600

      await redis.set(key, JSON.stringify(value), { ex: expirationTtl })
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  // Delete cache
  async delete(key: string): Promise<void> {
    try {
      await redis.del(key)
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  }

  // Cache products
  async cacheProducts(products: any[]): Promise<void> {
    await this.set('products:all', products, this.cacheConfig.products)
  }

  // Get cached products
  async getCachedProducts(): Promise<any[] | null> {
    return this.get('products:all')
  }

  // Cache categories
  async cacheCategories(categories: any[]): Promise<void> {
    await this.set(
      'categories:all',
      categories,
      this.cacheConfig.categories
    )
  }

  // Get cached categories
  async getCachedCategories(): Promise<any[] | null> {
    return this.get('categories:all')
  }

  // Invalidate cache
  async invalidateCategory(category: string): Promise<void> {
    await this.delete(`categories:${category}`)
    await this.delete('categories:all')
  }

  // Invalidate all product cache
  async invalidateAllProducts(): Promise<void> {
    await this.delete('products:all')
  }
}

// Define rate limits for endpoints
export const rateLimitConfigs = {
  '/api/products': { requests: 100, window: '60 s', key: 'products' },
  '/api/orders': { requests: 50, window: '60 s', key: 'orders' },
  '/api/agents': { requests: 10, window: '60 s', key: 'agents' },
  '/api/auth/login': { requests: 5, window: '60 s', key: 'auth' },
  '/api/auth/register': { requests: 3, window: '60 s', key: 'auth-register' },
  '/api/search': { requests: 30, window: '60 s', key: 'search' },
  '/api/cart': { requests: 50, window: '60 s', key: 'cart' },
  '/api/checkout': { requests: 10, window: '60 s', key: 'checkout' },
  '/api/payment': { requests: 5, window: '60 s', key: 'payment' },
  '/api/reviews': { requests: 20, window: '60 s', key: 'reviews' },
}

// Export singletons
export const rateLimiter = new RateLimiter()
export const cacheService = new CacheService()

// Initialize limiters
Object.entries(rateLimitConfigs).forEach(([endpoint, config]) => {
  rateLimiter.createLimiter(config)
})

