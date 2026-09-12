// ✅ FEATURE 0-PRIORITY: CJ Dropshipping Admin Integration
// Complete product search, import, and inventory management from CJ

import { useState, useRef } from 'react'
import { Search, Download, RefreshCw, AlertCircle } from 'lucide-react'

export interface CJProduct {
  id: string
  productId: string
  productTitle: string
  productDescription: string
  minPrice: number
  maxPrice: number
  commissionRate: number
  commissionType: string
  image: string
  shipping: number
  stock: number
  category: string
  url: string
}

export interface ImportedProduct {
  id: string
  cjProductId: string
  title: string
  price: number
  stock: number
  importedAt: Date
  lastSyncedAt: Date
  status: 'active' | 'low_stock' | 'out_of_stock'
}

export function CJProductSearch() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CJProduct[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set()
  )
  const [importedProducts, setImportedProducts] = useState<ImportedProduct[]>(
    []
  )
  const [isImporting, setIsImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<{
    success: number
    failed: number
    message: string
  } | null>(null)

  // Search CJ Products
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch('/api/cj/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      })

      const data = await response.json()
      if (data.success) {
        setSearchResults(data.products)
      }
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  // Toggle product selection
  const toggleProductSelection = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
  }

  // Import selected products
  const handleImport = async () => {
    if (selectedProducts.size === 0) return

    setIsImporting(true)
    setImportStatus(null)

    try {
      const productsToImport = searchResults.filter((p) =>
        selectedProducts.has(p.id)
      )

      const response = await fetch('/api/cj/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: productsToImport }),
      })

      const data = await response.json()
      if (data.success) {
        setImportStatus({
          success: data.imported,
          failed: data.failed,
          message: `${data.imported} products imported, ${data.failed} failed`,
        })
        setSelectedProducts(new Set())
        // Refresh imported products list
        loadImportedProducts()
      }
    } catch (error) {
      console.error('Import failed:', error)
      setImportStatus({
        success: 0,
        failed: selectedProducts.size,
        message: 'Import failed. Please try again.',
      })
    } finally {
      setIsImporting(false)
    }
  }

  // Load imported products
  const loadImportedProducts = async () => {
    try {
      const response = await fetch('/api/cj/imported-products')
      const data = await response.json()
      if (data.success) {
        setImportedProducts(data.products)
      }
    } catch (error) {
      console.error('Failed to load imported products:', error)
    }
  }

  // Sync inventory with CJ
  const handleInventorySync = async () => {
    try {
      const response = await fetch('/api/cj/sync-inventory', {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        loadImportedProducts()
        alert(`Synced ${data.synced} products`)
      }
    } catch (error) {
      console.error('Sync failed:', error)
    }
  }

  // Recharge specific product
  const handleRecharge = async (cjProductId: string, quantity: number) => {
    try {
      const response = await fetch('/api/cj/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cjProductId, quantity }),
      })

      const data = await response.json()
      if (data.success) {
        alert('Product recharged successfully')
        loadImportedProducts()
      }
    } catch (error) {
      console.error('Recharge failed:', error)
    }
  }

  // Component mount: load imported products
  React.useEffect(() => {
    loadImportedProducts()
  }, [])

  return (
    <div className="space-y-6 p-6 bg-gray-50 rounded-lg">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          CJ Dropshipping Integration
        </h2>
        <p className="text-gray-600 mt-1">
          Search, import, and manage products from CJ Dropshipping
        </p>
      </div>

      {/* Import Status Alert */}
      {importStatus && (
        <div
          className={`p-4 rounded-lg flex gap-3 ${
            importStatus.failed === 0
              ? 'bg-green-50 border border-green-200'
              : 'bg-yellow-50 border border-yellow-200'
          }`}
        >
          <AlertCircle
            className={`w-5 h-5 flex-shrink-0 ${
              importStatus.failed === 0 ? 'text-green-600' : 'text-yellow-600'
            }`}
          />
          <div>
            <p
              className={`font-semibold ${
                importStatus.failed === 0
                  ? 'text-green-900'
                  : 'text-yellow-900'
              }`}
            >
              {importStatus.message}
            </p>
            <p className="text-sm mt-1">
              {importStatus.failed === 0
                ? `All ${importStatus.success} products imported successfully!`
                : `${importStatus.success} succeeded, ${importStatus.failed} failed`}
            </p>
          </div>
        </div>
      )}

      {/* Search Section */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4">
          Search CJ Products
        </h3>

        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products (e.g., laptop, phone, headphones)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Found {searchResults.length} products
              </p>
              <button
                onClick={() => setSelectedProducts(new Set(searchResults.map((p) => p.id)))}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Select All
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((product) => (
                <div
                  key={product.id}
                  className="flex gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(product.id)}
                    onChange={() => toggleProductSelection(product.id)}
                    className="mt-1 w-4 h-4 text-blue-600"
                  />

                  <img
                    src={product.image}
                    alt={product.productTitle}
                    className="w-16 h-16 object-cover rounded"
                  />

                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {product.productTitle}
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {product.productDescription}
                    </p>
                    <div className="flex gap-4 mt-2 text-sm">
                      <span className="text-blue-600 font-semibold">
                        ${product.minPrice} - ${product.maxPrice}
                      </span>
                      <span className="text-gray-600">
                        Stock: {product.stock}
                      </span>
                      <span className="text-green-600">
                        Commission: {product.commissionRate}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleImport}
              disabled={selectedProducts.size === 0 || isImporting}
              className="w-full mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              {isImporting
                ? 'Importing...'
                : `Import ${selectedProducts.size} Products`}
            </button>
          </div>
        )}
      </div>

      {/* Imported Products Section */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900">
            Imported Products ({importedProducts.length})
          </h3>
          <button
            onClick={handleInventorySync}
            className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Inventory
          </button>
        </div>

        {importedProducts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No products imported yet. Search and import from CJ above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Product
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Price
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Stock
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {importedProducts.map((product) => (
                  <tr key={product.id} className="border-b border-gray-200">
                    <td className="py-3 px-4">{product.title}</td>
                    <td className="py-3 px-4 font-semibold">
                      ${product.price}
                    </td>
                    <td className="py-3 px-4">{product.stock} units</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          product.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : product.status === 'low_stock'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleRecharge(product.cjProductId, 10)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Recharge
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default CJProductSearch

