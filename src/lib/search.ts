// ✅ FEATURE 5: Advanced Search with Algolia Integration
// Full-text search, filtering, and faceted search

import algoliasearch from 'algoliasearch'

export interface SearchProduct {
  objectID: string
  name: string
  description: string
  price: number
  category: string
  brand: string
  rating: number
  review_count: number
  sku: string
  tags: string[]
  in_stock: boolean
}

export interface SearchFilters {
  category?: string
  minPrice?: number
  maxPrice?: number
  brand?: string
  minRating?: number
  inStock?: boolean
  tags?: string[]
}

export class SearchService {
  private client: any
  private index: any

  constructor(appId?: string, apiKey?: string) {
    const algoliaAppId =
      appId || process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || ''
    const algoliaApiKey =
      apiKey || process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY || ''

    this.client = algoliasearch(algoliaAppId, algoliaApiKey)
    this.index = this.client.initIndex('products')
  }

  // Search products with query
  async search(query: string, filters?: SearchFilters, hitsPerPage = 20) {
    try {
      // Build filter string
      let filterString = ''
      if (filters?.category) {
        filterString += `category:"${filters.category}"`
      }
      if (filters?.minPrice !== undefined && filters?.maxPrice !== undefined) {
        filterString += ` AND price:${filters.minPrice} TO ${filters.maxPrice}`
      }
      if (filters?.brand) {
        filterString += ` AND brand:"${filters.brand}"`
      }
      if (filters?.minRating) {
        filterString += ` AND rating>=${filters.minRating}`
      }
      if (filters?.inStock !== undefined) {
        filterString += ` AND in_stock:${filters.inStock}`
      }
      if (filters?.tags && filters.tags.length > 0) {
        const tagFilter = filters.tags.map((t) => `tags:"${t}"`).join(' OR ')
        filterString += ` AND (${tagFilter})`
      }

      const results = await this.index.search(query, {
        filters: filterString,
        hitsPerPage,
        facets: ['category', 'brand', 'price'],
      })

      return results
    } catch (error) {
      console.error('Search error:', error)
      throw error
    }
  }

  // Get search suggestions
  async getSuggestions(query: string): Promise<string[]> {
    try {
      const results = await this.index.search(query, {
        hitsPerPage: 5,
      })

      return results.hits.map((hit: any) => hit.name)
    } catch (error) {
      console.error('Suggestions error:', error)
      return []
    }
  }

  // Get facets (categories, brands, price ranges)
  async getFacets(query?: string) {
    try {
      const results = await this.index.search(query || '', {
        facets: ['category', 'brand', 'price'],
        maxFacetHits: 10,
      })

      return results.facets
    } catch (error) {
      console.error('Facets error:', error)
      return {}
    }
  }

  // Index products
  async indexProducts(products: SearchProduct[]): Promise<void> {
    try {
      await this.index.saveObjects(products, { autoGenerateObjectIDIfNotExist: true })
      await this.index.waitTask(0)
    } catch (error) {
      console.error('Indexing error:', error)
      throw error
    }
  }

  // Update product
  async updateProduct(product: SearchProduct): Promise<void> {
    try {
      await this.index.saveObject(product)
    } catch (error) {
      console.error('Update error:', error)
      throw error
    }
  }

  // Delete product
  async deleteProduct(objectID: string): Promise<void> {
    try {
      await this.index.deleteObject(objectID)
    } catch (error) {
      console.error('Delete error:', error)
      throw error
    }
  }

  // Clear index
  async clearIndex(): Promise<void> {
    try {
      await this.index.clearObjects()
    } catch (error) {
      console.error('Clear index error:', error)
      throw error
    }
  }
}

export const searchService = new SearchService()

