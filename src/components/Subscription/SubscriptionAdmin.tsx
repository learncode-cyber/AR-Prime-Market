// ✅ FEATURE 13: Subscription Admin Component
// Manage tiers, view subscriptions, process billing

import { useState, useEffect } from 'react'
import { DollarSign, Users, TrendingUp, Clock, AlertCircle, CheckCircle } from 'lucide-react'

export interface Subscription {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  tier: string
  tierName: string
  status: string
  startDate: string
  nextBillingDate: string
  autoRenew: boolean
  amount: number
}

export interface SubscriptionMetrics {
  totalSubscriptions: number
  activeSubscriptions: number
  totalRecurringRevenue: number
  monthlyRecurringRevenue: number
  churnRate: number
  averageLifetimeValue: number
}

export function SubscriptionAdmin() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [metrics, setMetrics] = useState<SubscriptionMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'cancelled'>('all')
  const [processingBilling, setProcessingBilling] = useState(false)

  // Load subscriptions
  useEffect(() => {
    loadSubscriptions()
    loadMetrics()
  }, [])

  const loadSubscriptions = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/subscriptions?filter=${filter}`)
      const data = await response.json()
      if (data.success) {
        setSubscriptions(data.subscriptions)
      }
    } catch (error) {
      console.error('Failed to load subscriptions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/subscriptions/metrics')
      const data = await response.json()
      if (data.success) {
        setMetrics(data.metrics)
      }
    } catch (error) {
      console.error('Failed to load metrics:', error)
    }
  }

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to cancel this subscription?')) return

    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
      })

      const data = await response.json()
      if (data.success) {
        alert('Subscription cancelled')
        loadSubscriptions()
        loadMetrics()
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
    }
  }

  const handleProcessBilling = async () => {
    setProcessingBilling(true)
    try {
      const response = await fetch('/api/subscriptions/process-billing', {
        method: 'POST',
      })

      const data = await response.json()
      if (data.success) {
        alert(`Processed ${data.processed} subscriptions`)
        loadSubscriptions()
        loadMetrics()
      }
    } catch (error) {
      console.error('Failed to process billing:', error)
    } finally {
      setProcessingBilling(false)
    }
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Subscription Management</h2>
        <p className="text-gray-600 mt-1">Manage recurring billing and subscription tiers</p>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Monthly Recurring Revenue</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  ${metrics.monthlyRecurringRevenue.toLocaleString()}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Subscriptions</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {metrics.activeSubscriptions.toLocaleString()}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Churn Rate</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {metrics.churnRate.toFixed(1)}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white p-4 rounded-lg shadow-sm flex gap-2">
        <button
          onClick={handleProcessBilling}
          disabled={processingBilling}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
        >
          <Clock className="w-4 h-4" />
          {processingBilling ? 'Processing...' : 'Process Billing'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm flex gap-2">
        {(['all', 'active', 'cancelled'] as const).map((status) => (
          <button
            key={status}
            onClick={() => {
              setFilter(status)
              loadSubscriptions()
            }}
            className={`px-4 py-2 rounded-lg capitalize ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Customer</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Tier</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Amount</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Next Billing</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Auto Renew</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No subscriptions found
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{sub.customerName}</p>
                        <p className="text-xs text-gray-600">{sub.customerEmail}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {sub.tierName}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          sub.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {sub.status === 'active' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      ${sub.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(sub.nextBillingDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs font-medium ${
                          sub.autoRenew ? 'text-green-600' : 'text-gray-600'
                        }`}
                      >
                        {sub.autoRenew ? '✓ Yes' : '✗ No'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {sub.status === 'active' && (
                        <button
                          onClick={() => handleCancelSubscription(sub.id)}
                          className="text-red-600 hover:text-red-700 font-medium text-xs"
                        >
                          Cancel
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
  )
}

export default SubscriptionAdmin

