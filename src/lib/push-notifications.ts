// ✅ FEATURE 11: Push Notifications
// Web & Mobile push notifications with Firebase

export interface PushNotification {
  id: string
  userId: string
  title: string
  body: string
  icon?: string
  image?: string
  badge?: string
  tag?: string
  data?: Record<string, string>
  action?: string
  url?: string
  timestamp: Date
  read: boolean
}

export class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null

  async initialize(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return false
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js')
      console.log('Service Worker registered')

      // Request notification permission
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission()
        return permission === 'granted'
      }

      return Notification.permission === 'granted'
    } catch (error) {
      console.error('Service Worker registration failed:', error)
      return false
    }
  }

  // Send flash sale notification
  async sendFlashSaleNotification(
    discount: number,
    expiresIn: number,
    productName?: string
  ): Promise<void> {
    const notification: PushNotification = {
      id: `sale-${Date.now()}`,
      userId: '', // Set dynamically
      title: `🎉 Flash Sale! ${discount}% OFF`,
      body: `${productName || 'Limited time offer'} expires in ${expiresIn} mins`,
      icon: '🔥',
      tag: 'flash-sale',
      data: {
        discount: String(discount),
        expiresIn: String(expiresIn),
      },
      url: '/products?sale=true',
      timestamp: new Date(),
      read: false,
    }

    await this.sendNotification(notification)
  }

  // Send order update notification
  async sendOrderUpdateNotification(
    orderId: string,
    status: string,
    trackingUrl?: string
  ): Promise<void> {
    const statusMessages: Record<string, string> = {
      confirmed: '✅ Order Confirmed',
      processing: '⚙️ Processing',
      shipped: '📦 Shipped',
      out_for_delivery: '🚚 Out for Delivery',
      delivered: '✅ Delivered',
      cancelled: '❌ Cancelled',
    }

    const notification: PushNotification = {
      id: `order-${orderId}-${Date.now()}`,
      userId: '',
      title: statusMessages[status] || 'Order Update',
      body: `Order #${orderId} - ${status.replace(/_/g, ' ')}`,
      icon: '📦',
      tag: `order-${orderId}`,
      data: {
        orderId,
        status,
      },
      url: trackingUrl || `/orders/${orderId}`,
      timestamp: new Date(),
      read: false,
    }

    await this.sendNotification(notification)
  }

  // Send back-in-stock notification
  async sendBackInStockNotification(
    productName: string,
    productUrl: string
  ): Promise<void> {
    const notification: PushNotification = {
      id: `stock-${Date.now()}`,
      userId: '',
      title: '📦 Back in Stock!',
      body: `${productName} is available again`,
      icon: '📦',
      tag: 'back-in-stock',
      data: {
        productName,
      },
      url: productUrl,
      timestamp: new Date(),
      read: false,
    }

    await this.sendNotification(notification)
  }

  // Send promotional notification
  async sendPromoNotification(
    title: string,
    body: string,
    promoUrl: string,
    icon = '🎁'
  ): Promise<void> {
    const notification: PushNotification = {
      id: `promo-${Date.now()}`,
      userId: '',
      title,
      body,
      icon,
      tag: 'promotion',
      url: promoUrl,
      timestamp: new Date(),
      read: false,
    }

    await this.sendNotification(notification)
  }

  // Send re-engagement notification
  async sendReEngagementNotification(daysInactive: number): Promise<void> {
    const notification: PushNotification = {
      id: `reeng-${Date.now()}`,
      userId: '',
      title: '👋 We miss you!',
      body: `Come back and get exclusive offers just for you`,
      icon: '💝',
      tag: 're-engagement',
      url: '/products?exclusive=true',
      timestamp: new Date(),
      read: false,
    }

    await this.sendNotification(notification)
  }

  private async sendNotification(notification: PushNotification): Promise<void> {
    if (!this.registration) {
      console.warn('Service Worker not available')
      return
    }

    try {
      // Send to backend for storage/delivery
      await fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
      })

      // Show web notification
      if (Notification.permission === 'granted') {
        await this.registration.showNotification(notification.title, {
          body: notification.body,
          icon: notification.icon,
          badge: notification.badge,
          tag: notification.tag,
          data: notification.data,
          actions: [
            {
              action: 'open',
              title: 'Open',
            },
            {
              action: 'close',
              title: 'Close',
            },
          ],
        })
      }
    } catch (error) {
      console.error('Push notification error:', error)
    }
  }

  // Subscribe to notifications
  async subscribe(userId: string): Promise<boolean> {
    if (!this.registration || !('pushManager' in this.registration)) {
      return false
    }

    try {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey),
      })

      // Send subscription to backend
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscription,
        }),
      })

      return true
    } catch (error) {
      console.error('Subscription failed:', error)
      return false
    }
  }

  // Unsubscribe from notifications
  async unsubscribe(): Promise<boolean> {
    if (!this.registration || !('pushManager' in this.registration)) {
      return false
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        return true
      }
      return false
    } catch (error) {
      console.error('Unsubscribe failed:', error)
      return false
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }

    return outputArray
  }
}

export const pushNotifications = new PushNotificationService()

