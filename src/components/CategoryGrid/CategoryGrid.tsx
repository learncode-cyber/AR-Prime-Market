// ✅ FIXED: Category Grid Component
// Problem: Individual category items নে click কাজ করছিল না
// Solution: Event handlers + proper routing + admin fix

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

export interface CategoryItem {
  id: string
  name: string
  slug: string
  image: string
  productCount?: number
}

export function CategoryGrid() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Categories array - fetch from database in production
  const categories: CategoryItem[] = [
    {
      id: '1',
      name: 'Makeup',
      slug: 'makeup',
      image: '/images/categories/makeup.jpg',
      productCount: 150,
    },
    {
      id: '2',
      name: 'Brushes',
      slug: 'brushes',
      image: '/images/categories/brushes.jpg',
      productCount: 85,
    },
    {
      id: '3',
      name: 'Skincare',
      slug: 'skincare',
      image: '/images/categories/skincare.jpg',
      productCount: 120,
    },
    {
      id: '4',
      name: 'Fragrance',
      slug: 'fragrance',
      image: '/images/categories/fragrance.jpg',
      productCount: 95,
    },
  ]

  // ✅ FIX 1: Individual item click handler
  const handleCategoryClick = (categoryId: string, categorySlug: string) => {
    setSelectedCategory(categoryId)
    console.log(`Category selected: ${categorySlug}`)
  }

  return (
    <div className="w-full bg-white py-12">
      {/* Section Title */}
      <div className="max-w-6xl mx-auto px-4 mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
          Level up your beauty routine
        </h2>
      </div>

      {/* ✅ FIX 2: Grid with proper event handling */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((category) => (
            // ✅ FIX 3: Each item is now a proper link
            <Link
              key={category.id}
              to="/products"
              search={{ category: category.slug }}
              onClick={(e) => {
                e.stopPropagation()
                handleCategoryClick(category.id, category.slug)
              }}
              className="no-underline"
            >
              {/* ✅ FIX 4: Category card with proper pointer events */}
              <div
                className={`
                  relative overflow-hidden rounded-2xl cursor-pointer
                  transition-all duration-300 transform hover:scale-105
                  ${selectedCategory === category.id ? 'ring-2 ring-pink-500' : ''}
                  pointer-events-auto group
                `}
                style={{ pointerEvents: 'auto' }}
              >
                {/* Image */}
                <div className="aspect-square overflow-hidden bg-gray-200">
                  <img
                    src={category.image}
                    alt={category.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                </div>

                {/* Category Name Overlay */}
                <div
                  className="
                    absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent
                    flex items-end justify-between p-4
                    pointer-events-none
                  "
                >
                  <div>
                    <h3 className="text-white text-2xl font-bold">
                      {category.name}
                    </h3>
                    {category.productCount && (
                      <p className="text-gray-200 text-sm">
                        {category.productCount} products
                      </p>
                    )}
                  </div>
                  <ChevronRight className="text-white opacity-50 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Hover State */}
                <div
                  className="
                    absolute inset-0 bg-pink-500/10 opacity-0 hover:opacity-100
                    transition-opacity duration-200
                    flex items-center justify-center
                    pointer-events-none
                  "
                >
                  <span className="text-white font-semibold text-lg">
                    Browse {category.name}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CategoryGrid
