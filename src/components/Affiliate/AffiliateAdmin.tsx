// ✅ FEATURE 14: Affiliate Admin Component
// Manage affiliates, track commissions, process payouts

import { useState, useEffect } from 'react'
import {
  Users,
  TrendingUp,
  DollarSign,
  Activity,
  Download,
  Filter,
} from 'lucide-react'

export interface AffiliateUser {
  id: string
  userId: string
  userName: string
  userEmail: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  commissionRate: number
  totalReferrals: number
  confirmedReferrals: number
  totalCommission: number
  pendingCommission: number
  status: 'active' | 'inactive' | 'suspended'
  joinedDate: string
}

export interface AffiliatePayoutRequest {
  id: string
  affiliateId: string
  affiliateName: string
  amount: number
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  requestedDate: string
  processedDate?: string
  paymentMethod: string
}

export function AffiliateAdmin() {
  const [affiliates, setAffiliates] = useState<AffiliateUser[]>([])
  const [payouts, setPayouts] = useState<AffiliatePayoutRequest[]>([])
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'affiliates' | 'payouts'>('affiliates')
  const [tierFilter, setTierFilter] = useState<'all' | 'bronze' | 'silver' | 'gold' | 'platinum'>(
    'all'
  )

  useEffect(() => {
    loadAffiliates()
    loadStats()
    loadPayouts()
  }, [tierFilter])

  const loadAffiliates = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/affiliates?tier=${tierFilter}`)
      const data = await response.json()
      if (data.success) {
        setAffiliates(data.affiliates)
      }
    } catch (error) {
      console.error('Failed to load affiliates:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('/api/affiliates/stats')
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const loadPayouts = async () => {
    try {
      const response = await fetch('/api/affiliates/payouts')
      const data = await response.json()
      if (data.success) {
        setPayouts(data.payouts)
      }
    } catch (error) {
      console.error('Failed to load payouts:', error)
    }
  }

  const handleApprovePayout = async (payoutId: string) => {
    try {
      const response = await fetch(`/api/affiliates/payouts/${payoutId}/approve`, {
        method: 'POST',
      })

      const data = await response.json()
      if (data.success) {
        alert('Payout approved')
        loadPayouts()
        loadStats()
      }
    } catch (error) {
      console.error('Failed to approve payout:', error)
    }
  }

  const handleProcessPayouts = async () => {
    if (!confirm('Process all pending payouts?')) return

    try {
      const response = await fetch('/api/affiliates/payouts/process-batch', {
        method: 'POST',
      })

      const data = await response.json()
      if (data.success) {
        alert(`Processed ${data.processed} payouts`)
        loadPayouts()
        loadStats()
      }
    } catch (error) {
      console.error('Failed to process payouts:', error)
    }
  }

  const handleSuspendAffiliate = async (affiliateId: string) => {
    if (!confirm('Suspend this affiliate?')) return

    try {
      const response = await fetch(`/api/affiliates/${affiliateId}/suspend`, {
        method: 'POST',
      })

      const data = await response.json()
      if (data.success) {
        alert('Affiliate suspended')
        loadAffiliates()
      }
    } catch (error) {
      console.error('Failed to suspend affiliate:', error)
    }
  }

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'bg-amber-100 text-amber-800',
      silver: 'bg-gray-100 text-gray-800',
      gold: 'bg-yellow-100 text-yellow-800',
      platinum: 'bg-purple-100 text-purple-800',
    }
    return colors[tier] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Affiliate Management</h2>
        <p className="text-gray-600 mt-1">Manage affiliate partners and commission tracking</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Affiliates</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.activeAffiliates}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Referrals</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.totalReferrals.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Commissions</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  ${stats.totalCommissions.toLocaleString()}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Pending Payouts</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  ${stats.pendingPayouts.toLocaleString()}
                </p>
              </div>
              <Activity className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border-b border-gray-200">
        <div className="flex gap-8 px-6">
          {(['affiliates', 'payouts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Affiliates Tab */}
      {activeTab === 'affiliates' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="bg-white p-4 rounded-lg shadow-sm flex gap-2 items-center">
            <Filter className="w-4 h-4 text-gray-600" />
            <select
              value={tierFilter}
              onChange={(e) =>
                setTierFilter(
                  e.target.value as
                    | 'all'
                    | 'bronze'
                    | 'silver'
                    | 'gold'
                    | 'platinum'
                )
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Tiers</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
            </select>
          </div>

          {/* Affiliates Table */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Tier</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Commission Rate
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Referrals</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Commissions</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Pending</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : affiliates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-500">
                        No affiliates found
                      </td>
                    </tr>
                  ) : (
                    affiliates.map((affiliate) => (
                      <tr key={affiliate.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{affiliate.userName}</p>
                            <p className="text-xs text-gray-600">{affiliate.userEmail}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getTierColor(affiliate.tier)}`}>
                            {affiliate.tier}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold">{affiliate.commissionRate}%</td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <p className="font-medium text-gray-900">
                              {affiliate.confirmedReferrals}
                            </p>
                            <p className="text-xs text-gray-600">
                              of {affiliate.totalReferrals}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-green-600">
                          ${affiliate.totalCommission.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-orange-600">
                          ${affiliate.pendingCommission.toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              affiliate.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : affiliate.status === 'suspended'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {affiliate.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {affiliate.status === 'active' && (
                            <button
                              onClick={() => handleSuspendAffiliate(affiliate.id)}
                              className="text-red-600 hover:text-red-700 font-medium text-xs"
                            >
                              Suspend
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payouts Tab */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          {/* Action Button */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <button
              onClick={handleProcessPayouts}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Process All Pending Payouts
            </button>
          </div>

          {/* Payouts Table */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Affiliate</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Amount</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Method</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Requested</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        No payouts found
                      </td>
                    </tr>
                  ) : (
                    payouts.map((payout) => (
                      <tr key={payout.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">{payout.affiliateName}</p>
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          ${payout.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 capitalize text-gray-600">
                          {payout.paymentMethod}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              payout.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : payout.status === 'approved'
                                ? 'bg-blue-100 text-blue-800'
                                : payout.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {payout.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {new Date(payout.requestedDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          {payout.status === 'pending' && (
                            <button
                              onClick={() => handleApprovePayout(payout.id)}
                              className="text-blue-600 hover:text-blue-700 font-medium text-xs"
                            >
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AffiliateAdmin

