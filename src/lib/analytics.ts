// ✅ FEATURE 2: Advanced Google Analytics 4 Event Tracking
// Enhanced GA4 implementation with all ecommerce events

interface GAEvent {
  event_name: string
  event_params: Record<string, any>
  timestamp?: number
}

export class AnalyticsService {
  private measurementId: string
  private apiSecret: string
  private clientId: string

  constructor(
    measurementId: string = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '',
    apiSecret: string = process.env.GA_API_SECRET || ''
  ) {
    this.measurementId = measurementId
    this.apiSecret = apiSecret
    this.clientId = this.getOrCreateClientId()
  }

  private getOrCreateClientId(): string {
    if (typeof window === 'undefined') return 'server-client'

    let clientId = localStorage.getItem('ga_client_id')
    if (!clientId) {
      clientId = `${Date.now()}-${Math.random().toString(36).substring(7)}`
      localStorage.setItem('ga_client_id', clientId)
    }
    return clientId
  }

  // ✅ Track page view
  trackPageView(pagePath: string, pageTitle: string) {
    return this.sendEvent({
      event_name: 'page_view',
      event_params: {
        page_path: pagePath,
        page_title: pageTitle,
        engagement_time_msec: 100,
      },
    })
  }

  // ✅ Track product view
  trackViewItem(product: {
    id: string
    name: string
    price: number
    category: string
    brand: string
  }) {
    return this.sendEvent({
      event_name: 'view_item',
      event_params: {
        items: [
          {
            item_id: product.id,
            item_name: product.name,
            item_category: product.category,
            item_brand: product.brand,
            price: product.price,
            currency: 'USD',
          },
        ],
        value: product.price,
        currency: 'USD',
      },
    })
  }

  // ✅ Track add to cart
  trackAddToCart(product: {
    id: string
    name: string
    price: number
    quantity: number
  }) {
    return this.sendEvent({
      event_name: 'add_to_cart',
      event_params: {
        items: [
          {
            item_id: product.id,
            item_name: product.name,
            quantity: product.quantity,
            price: product.price,
            currency: 'USD',
          },
        ],
        value: product.price * product.quantity,
        currency: 'USD',
      },
    })
  }

  // ✅ Track remove from cart
  trackRemoveFromCart(product: { id: string; name: string; price: number }) {
    return this.sendEvent({
      event_name: 'remove_from_cart',
      event_params: {
        items: [
          {
            item_id: product.id,
            item_name: product.name,
            price: product.price,
            currency: 'USD',
          },
        ],
        value: product.price,
        currency: 'USD',
      },
    })
  }

  // ✅ Track begin checkout
  trackBeginCheckout(cartValue: number, itemCount: number) {
    return this.sendEvent({
      event_name: 'begin_checkout',
      event_params: {
        value: cartValue,
        currency: 'USD',
        items_count: itemCount,
      },
    })
  }

  // ✅ Track add payment info
  trackAddPaymentInfo(
    paymentMethod: string,
    totalValue: number,
    itemCount: number
  ) {
    return this.sendEvent({
      event_name: 'add_payment_info',
      event_params: {
        payment_type: paymentMethod,
        value: totalValue,
        currency: 'USD',
        items_count: itemCount,
      },
    })
  }

  // ✅ Track purchase
  trackPurchase(order: {
    id: string
    value: number
    tax: number
    shipping: number
    items: Array<{ id: string; name: string; quantity: number; price: number }>
  }) {
    return this.sendEvent({
      event_name: 'purchase',
      event_params: {
        transaction_id: order.id,
        value: order.value,
        tax: order.tax,
        shipping: order.shipping,
        currency: 'USD',
        items: order.items.map((item) => ({
          item_id: item.id,
          item_name: item.name,
          quantity: item.quantity,
          price: item.price,
          currency: 'USD',
        })),
      },
    })
  }

  // ✅ Track refund
  trackRefund(orderId: string, value: number) {
    return this.sendEvent({
      event_name: 'refund',
      event_params: {
        transaction_id: orderId,
        value: value,
        currency: 'USD',
      },
    })
  }

  // ✅ Track search
  trackSearch(searchTerm: string, resultCount: number) {
    return this.sendEvent({
      event_name: 'search',
      event_params: {
        search_term: searchTerm,
        results_count: resultCount,
      },
    })
  }

  // ✅ Track view promotion
  trackViewPromotion(promo: { id: string; name: string }) {
    return this.sendEvent({
      event_name: 'view_promotion',
      event_params: {
        promotion_id: promo.id,
        promotion_name: promo.name,
      },
    })
  }

  // ✅ Track select promotion
  trackSelectPromotion(promo: { id: string; name: string }) {
    return this.sendEvent({
      event_name: 'select_promotion',
      event_params: {
        promotion_id: promo.id,
        promotion_name: promo.name,
      },
    })
  }

  // ✅ Track click promotion
  trackClickPromotion(promo: { id: string; name: string }) {
    return this.sendEvent({
      event_name: 'click_promotion',
      event_params: {
        promotion_id: promo.id,
        promotion_name: promo.name,
      },
    })
  }

  // ✅ Track view item list
  trackViewItemList(
    items: Array<{ id: string; name: string; price: number }>,
    listName: string
  ) {
    return this.sendEvent({
      event_name: 'view_item_list',
      event_params: {
        items: items.map((item) => ({
          item_id: item.id,
          item_name: item.name,
          price: item.price,
          currency: 'USD',
        })),
        item_list_name: listName,
        items_count: items.length,
      },
    })
  }

  // ✅ Track select item
  trackSelectItem(product: {
    id: string
    name: string
    price: number
    category: string
  }) {
    return this.sendEvent({
      event_name: 'select_item',
      event_params: {
        items: [
          {
            item_id: product.id,
            item_name: product.name,
            item_category: product.category,
            price: product.price,
            currency: 'USD',
          },
        ],
      },
    })
  }

  // ✅ Custom event
  trackCustomEvent(eventName: string, params: Record<string, any>) {
    return this.sendEvent({
      event_name: eventName,
      event_params: params,
    })
  }

  private async sendEvent(gaEvent: GAEvent) {
    if (!this.measurementId || !this.apiSecret) {
      console.warn('GA4 credentials not configured')
      return
    }

    try {
      const payload = {
        client_id: this.clientId,
        events: [
          {
            name: gaEvent.event_name,
            params: {
              ...gaEvent.event_params,
              timestamp_micros: (gaEvent.timestamp || Date.now()) * 1000,
            },
          },
        ],
      }

      // Send to Google Analytics
      const response = await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      )

      if (!response.ok) {
        console.error('GA4 event send failed:', response.status)
      }
    } catch (error) {
      console.error('GA4 tracking error:', error)
    }
  }
}

// Initialize and export singleton
export const analytics = new AnalyticsService()

